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

// Archive the animal by default — the whole point of the exit flow is to retire
// it. The caller can uncheck to only record a (butchering/sale) log instead.
const archiveAnimal = ref(true);
const meatWeight = ref(0);
const unitOptions = Object.keys(config.exit.units);
const selectedUnit = ref(unitOptions[0]);
const notes = ref('');

const onSubmit = () => {
  onDialogOK({
    archiveAnimal: archiveAnimal.value,
    meatWeight: meatWeight.value,
    selectedUnit: selectedUnit.value,
    notes: notes.value,
  });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('exitHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-toggle
          v-model="archiveAnimal"
          :label="t('exitArchiveAnimal')"
          color="primary"
        />
        <q-input
          v-model.number="meatWeight"
          type="number"
          :step="0.5"
          filled
          :label="t('exitMeatWeight')"
          class="q-mt-sm"
        />
        <q-select
          v-model="selectedUnit"
          :options="unitOptions"
          :label="t('exitMeatUnit')"
          filled
          class="q-mt-sm"
        />
        <q-input
          v-model="notes"
          type="textarea"
          filled
          :label="t('exitNotes')"
          class="q-mt-sm"
        />
      </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="!(archiveAnimal || meatWeight > 0)"
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

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.exitAnimal', action => {

      action.type('asset-action');

      action.showIf(({ asset }) =>
        asset.attributes.archived !== true && asset.type === 'asset--animal');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const archiveAnimal = dialogResult.archiveAnimal;
        const meatWeight = Number(dialogResult.meatWeight);
        const selectedUnit = dialogResult.selectedUnit;
        const notes = (dialogResult.notes || '').trim();

        // Either archive the animal or record a meat weight (or both). Nothing to
        // do otherwise.
        if (!archiveAnimal && !(meatWeight > 0)) {
          return;
        }

        // Build the plain record objects first; the mutator operations (t.*) are
        // constructed inside the `runUpdate` callback where `t` (the
        // TransformBuilder) is in scope. Doing `t.addRecord`/`t.updateRecord`
        // out here would reference an undefined `t` and throw (silently — Asset
        // Link swallows action errors, see AGENTS.md #3/#4).

        // 1) Optionally archive the animal. farmOS 4.x has no `status` attribute
        //    on assets — archiving is done by setting the `archived` boolean
        //    (see AGENTS.md #5). A plain PATCH of `archived: true` returns 200.
        let archiveRecord = null;
        if (archiveAnimal) {
          archiveRecord = {
            type: asset.type,
            id: asset.id,
            attributes: { archived: true },
          };
        }

        // 2) Optionally record a meat weight that increments the shared `Kött`
        //    (meat) product inventory.
        let meatQuantity = null;
        if (meatWeight > 0) {
          if (!requireValue(meatWeight > 0, translate('exitMeatWeightRequired'))) {
            return;
          }

          // farmOS 4.x requires the product's `product_type` term at creation.
          const meatProduct = await ensureAsset(
            assetLink,
            config.exit.meatProductName,
            'asset--product',
            { typeTerm: config.exit.meatProductType },
          );

          const unitTerm = await ensureTaxonomyTerm(assetLink, selectedUnit);

          meatQuantity = {
            type: 'quantity--material',
            id: uuidv4(),
            attributes: {
              measure: config.exit.units[selectedUnit],
              value: {
                numerator: meatWeight,
                denominator: 1,
                decimal: `${meatWeight}`,
              },
              inventory_adjustment: 'increment',
            },
            relationships: {
              inventory_asset: {
                data: {
                  type: meatProduct.type,
                  id: meatProduct.id,
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
        }

        // 3) Always record an exit (butchering / sale) activity log referencing
        //    the animal. Notes is a text_with_summary field and MUST be sent as
        //    an object `{ value }` (a plain string 422s — see AGENTS.md #5).
        const exitLog = {
          type: config.exit.logType,
          attributes: {
            name: translate('exitLogName', { name: asset.attributes.name }),
            timestamp: formatRFC3339(new Date()),
            status: "done",
            ...(notes ? { notes: { value: notes } } : {}),
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
            ...(meatQuantity ? {
              quantity: {
                data: [{ type: meatQuantity.type, id: meatQuantity.id }]
              }
            } : {}),
          },
        };

        const label = translate('exitLogName', { name: asset.attributes.name });
        await runUpdate(assetLink, label,
            (t) => [
              ...(archiveRecord ? [t.updateRecord(archiveRecord)] : []),
              ...(meatQuantity ? [t.addRecord(meatQuantity)] : []),
              t.addRecord(exitLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('exitAction') ));
    });

  }
}
</script>
