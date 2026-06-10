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

const onSubmit = () => {
  onDialogOK({ harvestCount: harvestCount.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>How many eggs did you harvest from {{ props.asset.attributes.name }}?</h4>
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
      />
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

const UNIT_NAME = "egg(s)";


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const findUnitTerm = async entitySource => {
      const results = await entitySource.query(q => q
          .findRecords('taxonomy_term--unit')
          .filter({ attribute: 'name', op: 'equal', value: UNIT_NAME }));
      return results.flatMap(l => l).find(a => a);
    };
    let eggUnitTerm = await findUnitTerm(assetLink.entitySource.cache);
    if (!eggUnitTerm) {
      eggUnitTerm = await findUnitTerm(assetLink.entitySource);
    }
    if (!eggUnitTerm) {
      const unitTermToCreate = {
          type: 'taxonomy_term--unit',
          id: uuidv4(),
          attributes: {
            name: UNIT_NAME,
          },
      };
      eggUnitTerm = await assetLink.entitySource.update(
          (t) => t.addRecord(unitTermToCreate),
          {label: `Add '${UNIT_NAME}' unit`});
    }



    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.harvestEgg', action => {

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

        const animalType = asset.type === 'asset--animal' ?
          assetLink.entitySource.cache.query((q) =>
          q.findRelatedRecord(
            { type: asset.type, id: asset.id },
            'animal_type')
          ) : [];

          if (!animalType || !animalType.attributes) {
            return false;
          }
        // Note the difference between `findRelatedRecords` and
        // `findRelatedRecord` (above) which return a list of entities and
        // a single entity respectively. They cannot be used
        // interchangeably - usage must match the cardinality of the
        // relationship.
        console.log("animalType=", animalType);

        // Ideally, there'd be a better "machine readable" way to determine
        // if a given animal type can be "harvested" - and maybe provide
        // defaults to the harvest dialog.
        return animalType.attributes.name.toLowerCase().includes('chicken');
      });


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        console.log('Dialog result:', dialogResult);
        const harvestCount = dialogResult.harvestCount;
        console.log('Harvest Count:', harvestCount);

        if (!harvestUnitTerm) {
          return;
        }


        if (!harvestCount || harvestCount <= 0) {
          return;
        }



        const harvestQuantity = {
          type: 'quantity--standard',
          id: uuidv4(),
          attributes: {
            measure: 'count',
            value: {
              numerator: harvestCount,
              denominator: 1,
              decimal: `${harvestCount}`,
            },
          },
          relationships: {
            units: {
              data: {
                type: eggUnitTerm.type,
                id: eggUnitTerm.id,
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
          },
        };

        assetLink.entitySource.update(
            (t) => [
              t.addRecord(harvestQuantity),
              t.addRecord(harvestLog),
            ],
            {label: `Record egg harvest for ${asset.attributes.name}`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Record Harvest" ));
    });

  }
}
</script>