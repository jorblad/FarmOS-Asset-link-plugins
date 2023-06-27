<script setup>
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'

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

const eggCount = ref(0);

const onSubmit = () => {
  onDialogOK(eggCount.value);
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>How many eggs were harvested from {{ props.asset.attributes.name }}?</h4>
      <div class="q-pa-md">
      <q-slider
        v-model="eggCount"
        :min="0"
        :max="20"
        :step="1"
        snap
        label
      />
      <q-input
        v-model.number="eggCount"
        type="number"
        filled
      />
      </div>
      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
        <q-btn
          color="primary"
          label="Record"
          @click="onSubmit"
          :disabled="eggCount <= 0"
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

    handle.defineSlot('net.symbioquine.farmos_asset_link.actions.v0.egg_harvest', action => {

      action.type('asset-action');

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
          // TODO: Implement a better predicate here...
          && asset.attributes.name.toLowerCase().indexOf("chicken") !== -1);

      const doActionWorkflow = async (asset) => {
        const eggCount = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });

        if (!eggCount || eggCount <= 0) {
          return;
        }

        const eggQuantity = {
          type: 'quantity--standard',
          id: uuidv4(),
          attributes: {
            measure: 'count',
            value: {
              numerator: eggCount,
              denominator: 1,
              decimal: `${eggCount}`,
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
            name: `Collected ${eggCount} egg(s) from ${asset.attributes.name}`,
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
                  type: eggQuantity.type,
                  id: eggQuantity.id,
                }
              ]
            },
          },
        };

        assetLink.entitySource.update(
            (t) => [
              t.addRecord(eggQuantity),
              t.addRecord(harvestLog),
            ],
            {label: `Record egg harvest for ${asset.attributes.name}`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Record Egg Harvest" ));
    });

  }
}
</script>