<script setup>
import { inject, ref,watch, onMounted } from 'vue';
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
const capturedPhotos = ref([]);

const photoCaptureModel = ref(null);
const carouselPosition = ref("capture-photo");

watch(photoCaptureModel, async () => {
  const file = photoCaptureModel.value;

  if (!file) {
    return;
  }

  const fileToArrayBuffer = data => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsArrayBuffer(data);
  });

  const fileName = file.name;
  const fileType = file.type;
  const fileData = await fileToArrayBuffer(file);

  const fileStringData = new Uint8Array(fileData).reduce((data, byte) => {
    return data + String.fromCharCode(byte);
  }, '');

  const fileDataUrl = `data:${fileType};base64, ` + btoa(fileStringData);

  const photoId = uuidv4()

  capturedPhotos.value.push({
    id: photoId,
    fileName,
    fileDataUrl,
  });

  carouselPosition.value = photoId;
});

const findUnitTerms = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--unit')
  );


  const unitTerms = results.flatMap((l) => l);

  console.log('All taxonomy_term--unit records:', unitTerms);

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

import { formatRFC3339, summarizeAssetNames, uuidv4 } from "assetlink-plugin-api";


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;


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

        //console.log("plantTypes=", plantTypes);
        
        // Obviously, since `plant_type` is a required (N >= 1)
        // attribute, we didn't actually need to load them it would have
        // been sufficient to just check `asset.type === 'asset--plant'`
        if (plantTypes.length) {
          return true;
        }

      });


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        console.log('Dialog result:', dialogResult);
        const harvestCount = dialogResult.harvestCount;
        console.log('Harvest Count:', harvestCount);
        const harvestUnitTerm = dialogResult.quantityType;
        console.log('QuantityType:', harvestUnitTerm);
        const harvestInventoryProduct = dialogResult.selectProduct;
        console.log('harvestInventoryProduct:', harvestInventoryProduct);

        //Photos
        const photos = dialogResult.capturedPhotos;
        console.log('Photos', photos)

        if (!harvestUnitTerm) {
          return;
        }


        if (!harvestCount || harvestCount <= 0) {
          return;
        }

        let harvestQuantityMeasure = "count";
        if (harvestUnitTerm.attributes.name === "gram" ) {
          harvestQuantityMeasure = "weight";
        } else {
          harvestQuantityMeasure = "count";
        }



        let harvestQuantity = {
            type: 'quantity--standard',
            id: uuidv4(),
            attributes: {
              measure: harvestQuantityMeasure,
              value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
              },
            },
            relationships: {
              units: {
                data: {
                  type: 'taxonomy_term--unit',
                  id: uuidv4(),
                  '$relateByName': {
                    name: harvestUnitTerm.attributes.name,
                  },
                }
              },
            },
          };
        
        

        if (harvestInventoryProduct) {
            harvestQuantity = {
              type: 'quantity--standard',
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
                    type: 'taxonomy_term--unit',
                    id: uuidv4(),
                    '$relateByName': {
                      name: harvestUnitTerm.attributes.name,
                    },
                  }
                },
              },
            };
        } else {
          harvestQuantity = {
            type: 'quantity--standard',
            id: uuidv4(),
            attributes: {
              measure: harvestQuantityMeasure,
              value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
              },
            },
            relationships: {
              units: {
                data: {
                  type: 'taxonomy_term--unit',
                  id: uuidv4(),
                  '$relateByName': {
                    name: harvestUnitTerm.attributes.name,
                  },
                }
              },
            },
          };
        }

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

        assetLink.entitySource.update(
            (t) => [
              t.addRecord(harvestQuantity),
              t.addRecord(harvestLog),
            ],
            {label: `Record harvest for ${asset.attributes.name}`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Record Harvest" ));
    });

  }
}
</script>
