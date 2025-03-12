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


const transplantLocation = ref(null)





const onSubmit = () => {
  onDialogOK({ transplantLocation: transplantLocation.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">

        <div class="q-pa-md">
            <entity-select
            label="Transplant location"
            entity-type="asset"
            v-model="transplantLocation"
            :additional-filters="additionalFilters"
            :rules="[val => !!val || 'Transplant location is required']"
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


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.TransplantPlant', action => {

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
        const transplantLocation = dialogResult.transplantLocation;
        console.log('transplantLocation:', transplantLocation);

        //Photos
        const photos = dialogResult.capturedPhotos;
        console.log('Photos', photos)

        let transplantingLog;
        transplantingLog = {
            type: 'log--transplanting',
            attributes: {
                name: `Transplant ${plantName}`,
                timestamp: formatRFC3339(new Date()),
                status: "done",

            },
            relationships: {
                asset: {
                    data: plantIDs.map(id => ({
                        type: 'asset--plant',
                        id,
                    })),
                },
                location: {
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
                        type: seedQuantity.type,
                        id: seedQuantity.id,
                        }
                    ]
                },
            },
        };

        assetLink.entitySource.update(
            (t) => [
              t.addRecord(transplantingLog)
            ],
            {label: `Transplant ${asset.attributes.name}`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Transplant plant" ));
    });

  }
}
</script>