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

const feedAmount = ref(0);
// The dialog lets the user pick a unit; each maps to a farmOS quantity measure.
const unitOptions = Object.keys(config.feed.units);
const selectedUnit = ref(unitOptions[0]);

const onSubmit = () => {
  onDialogOK({ feedAmount: feedAmount.value, selectedUnit: selectedUnit.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('feedHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-input
          v-model.number="feedAmount"
          type="number"
          :step="0.5"
          filled
          :label="t('feedUnit')"
        />
        <q-select
          v-model="selectedUnit"
          :options="unitOptions"
          :label="t('feedUnit')"
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
          :disabled="!feedAmount || feedAmount <= 0"
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

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.feedAnimal', action => {

      action.type('asset-action');

      action.showIf(({ asset }) =>
        asset.attributes.status !== 'archived' && asset.type === 'asset--animal');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const feedAmount = Number(dialogResult.feedAmount);
        const selectedUnit = dialogResult.selectedUnit;

        if (!requireValue(feedAmount > 0, translate('feedQuantityRequired'))) {
          return;
        }

        // Resolve (or create) the shared feed material inventory. farmOS 4.x
        // requires the material's `material_type` term at creation, passed via
        // `typeTerm` (ensureAsset builds the full `taxonomy_term--material_type`).
        const feedMaterial = await ensureAsset(
          assetLink,
          config.feed.materialName,
          'asset--material',
          { typeTerm: config.feed.materialType },
        );

        // Resolve (or create) the chosen unit term by exact name to avoid
        // duplicate terms (e.g. "kg" vs "KG").
        const unitTerm = await ensureTaxonomyTerm(assetLink, selectedUnit);

        // A material quantity that decrements the feed material's inventory.
        const feedQuantity = {
          type: 'quantity--material',
          id: uuidv4(),
          attributes: {
            measure: config.feed.units[selectedUnit],
            value: {
              numerator: feedAmount,
              denominator: 1,
              decimal: `${feedAmount}`,
            },
            inventory_adjustment: 'decrement',
          },
          relationships: {
            inventory_asset: {
              data: {
                type: feedMaterial.type,
                id: feedMaterial.id,
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

        const feedLog = {
          type: 'log--input',
          attributes: {
            name: translate('fedTo', { name: asset.attributes.name }),
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
                  type: feedQuantity.type,
                  id: feedQuantity.id,
                }
              ]
            },
          },
        };

        await runUpdate(assetLink, translate('recordFeedFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(feedQuantity),
              t.addRecord(feedLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true }, translate('feed') ));
    });

  }
}
</script>
