<script setup>
import { inject, ref } from 'vue';
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
import { usePhotoCapture } from '../usePhotoCapture.js';
const { capturedPhotos, photoCaptureModel, carouselPosition } = usePhotoCapture();

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

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureTaxonomyTerm, runUpdate } from '../useFarmOS.js';

const UNIT_NAME = "egg(s)";


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const eggUnitTerm = await ensureTaxonomyTerm(assetLink, UNIT_NAME);



    // Animal types (by name, matched case-insensitively as a substring) for which
    // the egg harvest action is offered. Edit this list to suit your flock, e.g.
    // add 'kyckling' for Swedish, or 'duck' for ducks.
    const EGG_ANIMAL_TYPE_MATCHES = ['chicken', 'kyckling'];

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

        // Match the animal type name against the configurable list above
        // (case-insensitive substring match).
        const animalTypeName = animalType.attributes.name.toLowerCase();
        return EGG_ANIMAL_TYPE_MATCHES.some(match =>
          animalTypeName.includes(match.toLowerCase()));
      });


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const harvestCount = dialogResult.harvestCount;

        if (!eggUnitTerm) {
          return;
        }


        if (!harvestCount || harvestCount <= 0) {
          return;
        }



        const harvestQuantity = {
          type: 'quantity--material',
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

        await runUpdate(assetLink, `Record egg harvest for ${asset.attributes.name}`,
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
