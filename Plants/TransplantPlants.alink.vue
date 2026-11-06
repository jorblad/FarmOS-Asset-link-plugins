<script setup>
import { inject, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config'
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
import { usePhotoCapture } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
const { capturedPhotos, photoCaptureModel, carouselPosition } = usePhotoCapture()


const transplantLocation = ref(null)

const additionalFilters = [
  // Only allow moving to locations
  { attribute: 'is_location', op: 'equal', value: true },
  // Do not allow moving to self
  { attribute: 'drupal_internal__id', op: '<>', value: props.asset.attributes.drupal_internal__id },
];



const onSubmit = () => {
  onDialogOK({ transplantLocation: transplantLocation.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">

        <div class="q-pa-md">
            <entity-select
            :label="t('transplantLocation')"
            entity-type="asset"
            v-model="transplantLocation"
            :additional-filters="additionalFilters"
            :rules="[val => !!val || t('transplantLocationRequired')]"
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
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="!transplantLocation"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.TransplantPlant', action => {

      action.type('asset-action');

       console.log('Transplanting plugin: V0.1')

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
        const transplantLocation = dialogResult.transplantLocation;

        if (!requireValue(transplantLocation, translate('transplantDestRequired'))) {
          return;
        }

        //Photos
        const photos = dialogResult.capturedPhotos;

        let transplantingLog;
        transplantingLog = {
            type: 'log--transplanting',
            attributes: {
                name: translate('transplantName', { name: asset.attributes.name }),
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
                location: {
                    data: [
                        {
                        type: transplantLocation.type,
                        id: transplantLocation.id,
                        }
                    ]
                },
            },
        };

        await runUpdate(assetLink, translate('transplantFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(transplantingLog)
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('transplantPlant') ));
    });

  }
}
</script>
