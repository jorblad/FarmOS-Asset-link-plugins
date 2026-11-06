<script setup>
import { inject, ref, onMounted } from 'vue';
import { useDialogPluginComponent } from 'quasar'
const assetLink = inject('assetLink');
const props = defineProps({
  asset: {
    type: Object,
    required: true,
  },
});

defineEmits([
  ...useDialogPluginComponent.emits
]);

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const harvestCount = ref(0);

// Photo adding
import { usePhotoCapture } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
const { capturedPhotos, photoCaptureModel, carouselPosition } = usePhotoCapture();

const findUnitTerms = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--unit')
  );


  const unitTerms = results.flatMap((l) => l);


  return unitTerms;
};

const unitTerms = ref([]);

onMounted(async () => {
  unitTerms.value = await findUnitTerms(assetLink.entitySource);
  
});

const childrenFilter = [{
    attribute: 'parent.id',
    value: props.asset.id
}];


const quantityType = ref(null);
const unitLabelFn = unitTerm => unitTerm.attributes.name;

const selectProduct = ref(null);

const onSubmit = () => {
  onDialogOK({ harvestCount: harvestCount.value, quantityType: quantityType.value, selectProduct: selectProduct.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value  });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>How much did you harvest from {{ props.asset.attributes.name }}?</h4>
      <div class="q-pa-md">
      <q-slider
        v-model="harvestCount"
        :min="0"
        :max="20"
        :step="1"
        snap
        label
      />
      <q-input
        v-model.number="harvestCount"
        type="number"
        filled
        label="Measurment"
      />
      </div>
      <div class="q-pa-md">

      <q-select
        filled v-model="quantityType"
        :options="unitTerms"
        :option-label="unitLabelFn"
        label="Unit"
      />
      
      </div>
      <div class="q-pa-md">
        <entity-select
          label="Product"
          entity-type="asset"
          v-model="selectProduct"
          :additional-filters="childrenFilter"
        ></entity-select>
      </div>

      <div class="q-pa-md">
          <q-carousel
            swipeable
            animated
            navigation
            navigation-icon="mdi-radiobox-marked"
            control-type="flat"
            control-color="orange"
            :arrows="false"
            height="200px"
            v-model="carouselPosition"
          >
            <q-carousel-slide
				v-for="(capturedPhoto, capturedPhotoIdx) in capturedPhotos"
            	:key="capturedPhoto.id"
            	:name="capturedPhoto.id">
              <q-img
                :src="capturedPhoto.fileDataUrl"
                class="rounded-borders full-height"
                fit="contain"
              ></q-img>
            </q-carousel-slide>

            <q-carousel-slide name="capture-photo">
              <photo-input class="q-pb-xl" v-model="photoCaptureModel"></photo-input>
            </q-carousel-slide>
          </q-carousel>
        </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
        <q-btn
          color="primary"
          label="Record"
          @click="onSubmit"
          :disabled="harvestCount <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureAsset, runUpdate } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    // When the user doesn't pick a product, harvest yield is counted against a
    // product named after the plant's crop/variety (Gröda/sort). An existing one
    // is reused; otherwise it's created as a child of the plant. Every harvest
    // therefore always records inventory.
    const FALLBACK_PRODUCT_NAME = 'Skörd';


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.harvestPlant', action => {

      action.type('asset-action');

      action.showIf(({ asset }) => {
        if (asset.attributes.status === 'archived') {
          return false;
        }

        // Here we're querying `assetLink.entitySource.cache` which is
        // synchronous and never results in a request to farmOS. That
        // is possible because these relationships will almost always
        // already be loaded on the asset page. It is also necessary
        // since slots cannot have asynchronous `showIf` methods.
        const plantTypes = asset.type === 'asset--plant' ?
          assetLink.entitySource.cache.query((q) =>
          q.findRelatedRecords(
            { type: asset.type, id: asset.id },
            'plant_type')
          ) : [];

          if (!plantTypes) {
            return false;
          }

        
        // Obviously, since `plant_type` is a required (N >= 1)
        // attribute, we didn't actually need to load them it would have
        // been sufficient to just check `asset.type === 'asset--plant'`
        if (plantTypes.length) {
          return true;
        }

      });


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const harvestCount = dialogResult.harvestCount;
        const harvestUnitTerm = dialogResult.quantityType;

        //Photos
        const photos = dialogResult.capturedPhotos;

        if (!harvestUnitTerm) {
          return;
        }


        if (!harvestCount || harvestCount <= 0) {
          return;
        }

        let harvestQuantityMeasure = harvestUnitTerm.attributes.name === "gram" ? "weight" : "count";

        // Derive the default product name from the plant's crop/variety
        // (Gröda/sort), so harvest of e.g. "Tomato" rolls up into a "Tomato"
        // product. Fall back to the plant name, then a generic "Skörd".
        const plantTypeRecs = assetLink.entitySource.cache.query((q) =>
          q.findRelatedRecords({ type: asset.type, id: asset.id }, 'plant_type'));
        const cropName = (plantTypeRecs && plantTypeRecs.length)
          ? plantTypeRecs[0].attributes.name
          : (asset.attributes.name || FALLBACK_PRODUCT_NAME);

        // Always increment a product inventory. Use the product the user picked,
        // or the crop-named product (reused if it exists, else created under the
        // plant), so every harvest records yield even when no product is selected.
        const harvestInventoryProduct = dialogResult.selectProduct
          || await ensureAsset(assetLink, cropName, 'asset--product', { parentAsset: asset, typeTerm: cropName });

        const harvestQuantity = {
            type: 'quantity--material',
            id: uuidv4(),
            attributes: {
              measure: harvestQuantityMeasure,
              value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
              },
              inventory_adjustment: 'increment',
            },
            relationships: {
              inventory_asset: {
                data: {
                  type: harvestInventoryProduct.type,
                  id: harvestInventoryProduct.id,
                }
              },
              units: {
                data: {
                  type: harvestUnitTerm.type,
                  id: harvestUnitTerm.id,
                }
              },
            },
          };

        const harvestLog = {
          type: 'log--harvest',
          attributes: {
            name: `Harvested ${harvestCount} from ${asset.attributes.name}`,
            timestamp: formatRFC3339(new Date()),
            status: "done",
          },
          relationships: {
            asset: {
              data: [
                {
                  type: asset.type,
                  id: asset.id,
                }
              ]
            },
            quantity: {
              data: [
                {
                  type: harvestQuantity.type,
                  id: harvestQuantity.id,
                }
              ]
            },
            image: {
              data: photos.map(({ id, fileName, fileDataUrl }) =>
                  ({
                      type: 'file--file',
                      id,
                      '$upload': {
                          fileName,
                          fileDataUrl,
                      }
                  })
                  ),
              },
          },
        };

        await runUpdate(assetLink, `Record harvest for ${asset.attributes.name}`,
            (t) => [
              t.addRecord(harvestQuantity),
              t.addRecord(harvestLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Record Harvest" ));
    });

  }
}
</script>
