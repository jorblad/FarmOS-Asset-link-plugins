<script setup>
import { inject, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { usePhotoCapture } from '../usePhotoCapture.js';
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

const selectedAction = ref(null);
const actionOptions = [
  { label: 'Reset trap', value: 'reset' },
  { label: 'Empty trap', value: 'empty' },
  { label: 'Put together and empty trap', value: 'putTogetherAndEmpty' }
];

// Photo adding
const { capturedPhotos, photoCaptureModel, carouselPosition } = usePhotoCapture();

const onSubmit = () => {
  onDialogOK({ capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value, selectedAction: selectedAction.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>Reset trap {{ props.asset.attributes.name }}?</h4>
      <div class="q-gutter-sm">
        <q-select
          v-model="selectedAction"
          :options="actionOptions"
          label="Select Action"
          emit-value
          map-options
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
          :disabled="!selectedAction"
          @click="onSubmit"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";

const CATCH_INVENTORY_UNIT = 'St';
const CATCH_INVENTORY_ASSET_NAME = 'Fångade möss';

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const findCatchInventoryAsset = async (entitySource) => {
      const results = await entitySource.query(q => q
        .findRecords('asset--product')
        .filter({ attribute: 'name', op: 'equal', value: CATCH_INVENTORY_ASSET_NAME }));

      return results.flatMap(l => l).find(a => a);
    };

    // The catch inventory must point at a real product asset. Find an existing one
    // by name, or create it on first use, so the inventory_asset relationship always
    // resolves (a dangling reference was causing the quantity POST to 404).
    const ensureCatchInventoryAsset = async () => {
      let asset = await findCatchInventoryAsset(assetLink.entitySource.cache);
      if (!asset) {
        asset = await findCatchInventoryAsset(assetLink.entitySource);
      }
      if (asset) {
        return asset;
      }

      const newAsset = {
        type: 'asset--product',
        id: uuidv4(),
        attributes: {
          name: CATCH_INVENTORY_ASSET_NAME,
          status: 'active',
        },
      };

      return await assetLink.entitySource.update(
        (t) => t.addRecord(newAsset),
        { label: `Create ${CATCH_INVENTORY_ASSET_NAME} inventory asset` });
    };

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.resetTrap', action => {

      action.type('asset-action');

      console.log('Reset trap: V0.1')

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
            && (asset.type === 'asset--equipment' ));


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const selectedAction = dialogResult.selectedAction;

        const actionName = selectedAction === 'reset' ? 'Reset' : selectedAction === 'empty' ? 'Empty' : 'Put together and empty';

        const catchInventoryAsset = await ensureCatchInventoryAsset();

        const catchQuantity = ['empty', 'putTogetherAndEmpty'].includes(selectedAction)
          ? {
              type: 'quantity--standard',
              id: uuidv4(),
              attributes: {
                measure: 'count',
                value: {
                  numerator: 1,
                  denominator: 1,
                  decimal: '1',
                },
                inventory_adjustment: 'increment',
              },
              relationships: {
                inventory_asset: {
                  data: {
                    type: catchInventoryAsset.type,
                    id: catchInventoryAsset.id,
                  },
                },
                units: {
                  data: {
                    type: 'taxonomy_term--unit',
                    id: uuidv4(),
                    '$relateByName': {
                      name: CATCH_INVENTORY_UNIT,
                    },
                  },
                },
              },
            }
          : null;

        const resetTrapLog = {
          type: 'log--activity',
          attributes: {
            name: `${actionName} ${asset.attributes.name}`,
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
            ...(catchQuantity && {
              quantity: {
                data: [
                  {
                    type: catchQuantity.type,
                    id: catchQuantity.id,
                  },
                ],
              },
            }),
          },
        };

        assetLink.entitySource.update(
            (t) => [
              ...(catchQuantity ? [t.addRecord(catchQuantity)] : []),
              t.addRecord(resetTrapLog),
            ],
            {label: `Record reset ${asset.attributes.name}`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Record Reset" ));
    });

  }
}
</script>
