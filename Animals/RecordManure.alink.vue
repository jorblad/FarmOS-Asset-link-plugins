<script setup>
import { inject, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { config, t } from 'plugin-library:org.jorblad.farmos_asset_link.config'
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

const manureAmount = ref(0);
// The dialog lets the user pick a unit; each maps to a farmOS quantity measure.
const unitOptions = Object.keys(config.compost.units);
const selectedUnit = ref(unitOptions[0]);

const onSubmit = () => {
  onDialogOK({ manureAmount: manureAmount.value, selectedUnit: selectedUnit.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('compostHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-input
          v-model.number="manureAmount"
          type="number"
          :step="0.5"
          filled
          :label="t('compostUnit')"
        />
        <q-select
          v-model="selectedUnit"
          :options="unitOptions"
          :label="t('compostUnit')"
          filled
          class="q-mt-sm"
        />
      </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="!manureAmount || manureAmount <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureAsset, ensureTaxonomyTerm, runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.recordManure', action => {

      action.type('asset-action');

      action.showIf(({ asset }) =>
        asset.attributes.status !== 'archived' && asset.type === 'asset--animal');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const manureAmount = Number(dialogResult.manureAmount);
        const selectedUnit = dialogResult.selectedUnit;

        if (!requireValue(manureAmount > 0, translate('compostQuantityRequired'))) {
          return;
        }

        // Resolve (or create) the shared compost asset. `asset--compost` needs no
        // type term, so ensureAsset is called without one. Requires the
        // `farm_compost` module to be enabled (it is, via setup-farmos.sh).
        const compostAsset = await ensureAsset(
          assetLink,
          config.compost.materialName,
          'asset--compost',
        );

        // Resolve (or create) the chosen unit term by exact name to avoid
        // duplicate terms (e.g. "kg" vs "KG").
        const unitTerm = await ensureTaxonomyTerm(assetLink, selectedUnit);

        // A material quantity that increments the compost asset's inventory.
        const manureQuantity = {
          type: 'quantity--material',
          id: uuidv4(),
          attributes: {
            measure: config.compost.units[selectedUnit],
            value: {
              numerator: manureAmount,
              denominator: 1,
              decimal: `${manureAmount}`,
            },
            inventory_adjustment: 'increment',
          },
          relationships: {
            inventory_asset: {
              data: {
                type: compostAsset.type,
                id: compostAsset.id,
              }
            },
            units: {
              data: {
                type: unitTerm.type,
                id: unitTerm.id,
              }
            },
          },
        };

        const manureLog = {
          type: 'log--input',
          attributes: {
            name: translate('recordedManure', { name: asset.attributes.name }),
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
                  type: manureQuantity.type,
                  id: manureQuantity.id,
                }
              ]
            },
          },
        };

        await runUpdate(assetLink, translate('recordManureFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(manureQuantity),
              t.addRecord(manureLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('manure') ));
    });

  }
}
</script>
