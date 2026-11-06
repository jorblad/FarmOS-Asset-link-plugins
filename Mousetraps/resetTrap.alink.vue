<script setup>
import { inject, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { usePhotoCapture } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config';
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
  { label: t('resetTrap'), value: 'reset' },
  { label: t('emptyTrap'), value: 'empty' },
  { label: t('putTogetherAndEmptyTrap'), value: 'putTogetherAndEmpty' }
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
      <h4>{{ t('resetTrapHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-gutter-sm">
        <q-select
          v-model="selectedAction"
          :options="actionOptions"
          :label="t('selectAction')"
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
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
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
import { ensureAsset, ensureTaxonomyTerm, runUpdate } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.resetTrap', action => {

      action.type('asset-action');

      console.log('Reset trap: V0.1')

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
            && (asset.type === 'asset--equipment' ));


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const selectedAction = dialogResult.selectedAction;

        const actionName = selectedAction === 'reset' ? translate('resetAction')
          : selectedAction === 'empty' ? translate('emptyAction') : translate('putTogetherAndEmptyAction');

        // The catch inventory must point at a real product asset (resolved by
        // name). ensureAsset finds an existing one or creates it on first use
        // so the inventory_asset relationship always resolves.
        const catchInventoryAsset = await ensureAsset(assetLink, config.inventoryAssets.catch, 'asset--product', { typeTerm: config.productTypes.catch });
        const catchUnitTerm = await ensureTaxonomyTerm(assetLink, config.units.catch);

        const catchQuantity = ['empty', 'putTogetherAndEmpty'].includes(selectedAction)
          ? {
              type: 'quantity--material',
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
                    type: catchUnitTerm.type,
                    id: catchUnitTerm.id,
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

        await runUpdate(assetLink, translate('recordResetFor', { name: asset.attributes.name }),
            (t) => [
              ...(catchQuantity ? [t.addRecord(catchQuantity)] : []),
              t.addRecord(resetTrapLog),
            ], { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('recordReset') ));
    });

  }
}
</script>
