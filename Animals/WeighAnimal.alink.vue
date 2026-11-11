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

const weight = ref(0);
// The dialog lets the user pick a unit; each maps to a farmOS quantity measure.
const unitOptions = Object.keys(config.weight.units);
const selectedUnit = ref(unitOptions[0]);

const onSubmit = () => {
  onDialogOK({ weight: weight.value, selectedUnit: selectedUnit.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('weightHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-input
          v-model.number="weight"
          type="number"
          :step="0.5"
          filled
          :label="t('weightUnit')"
        />
        <q-select
          v-model="selectedUnit"
          :options="unitOptions"
          :label="t('weightUnit')"
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
          :disabled="!weight || weight <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureTaxonomyTerm, runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.weighAnimal', action => {

      action.type('asset-action');

      action.showIf(({ asset }) =>
        asset.attributes.status !== 'archived' && asset.type === 'asset--animal');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const weight = Number(dialogResult.weight);
        const selectedUnit = dialogResult.selectedUnit;

        if (!requireValue(weight > 0, translate('weightQuantityRequired'))) {
          return;
        }

        // Resolve (or create) the chosen unit term by exact name to avoid
        // duplicate terms (e.g. "kg" vs "KG").
        const unitTerm = await ensureTaxonomyTerm(assetLink, selectedUnit);

        // A material quantity that records the weight as a measurement. Unlike
        // feeding/milking this is NOT an inventory adjustment — it simply
        // carries a measure + value + unit reference.
        const weightQuantity = {
          type: 'quantity--material',
          id: uuidv4(),
          attributes: {
            measure: config.weight.units[selectedUnit],
            value: {
              numerator: weight,
              denominator: 1,
              decimal: `${weight}`,
            },
          },
          relationships: {
            units: {
              data: {
                type: unitTerm.type,
                id: unitTerm.id,
              }
            },
          },
        };

        const weightLog = {
          type: 'log--observation',
          attributes: {
            name: translate('weighedAnimal', { name: asset.attributes.name }),
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
                  type: weightQuantity.type,
                  id: weightQuantity.id,
                }
              ]
            },
          },
        };

        await runUpdate(assetLink, translate('recordWeightFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(weightQuantity),
              t.addRecord(weightLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('weigh') ));
    });

  }
}
</script>
