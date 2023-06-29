<script setup>
import { ref } from 'vue';
import { useDialogPluginComponent, QBtn, QSelect } from 'quasar';

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

const quantityType = ref('');
const quantityOptions = ['Count', 'Grams'];

const harvestCount = ref(0);

const onSubmit = () => {
  onDialogOK(harvestCount.value, quantityType.value);
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>Record Harvest</h4>
      <div class="q-pa-md">
        <q-select
          v-model="quantityType"
          :options="quantityOptions"
          label="Quantity Type"
          filled
        />
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

import { formatRFC3339, summarizeAssetNames, uuidv4 } from "assetlink-plugin-api";

const UNIT_NAME = "st";

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const findUnitTerm = async (entitySource) => {
      const results = await entitySource.query((q) =>
        q.findRecords('taxonomy_term--unit').filter({
          attribute: 'name',
          op: 'equal',
          value: UNIT_NAME,
        })
      );

      return results.flatMap((l) => l).find((a) => a);
    };

    let harvestUnitTerm = await findUnitTerm(assetLink.entitySource.cache);

    if (!harvestUnitTerm) {
      harvestUnitTerm = await findUnitTerm(assetLink.entitySource);
    }

    if (!harvestUnitTerm) {
      const unitTermToCreate = {
        type: 'taxonomy_term--unit',
        id: uuidv4(),
        attributes: {
          name: UNIT_NAME,
        },
      };

      harvestUnitTerm = await assetLink.entitySource.update(
        (t) => t.addRecord(unitTermToCreate),
        { label: `Add '${UNIT_NAME}' unit` }
      );
    }

    handle.defineSlot(
      'net.symbioquine.farmos_asset_link.actions.v0.harvestPlant',
      (action) => {
        action.type('asset-action');

        action.showIf(({ asset }) => asset.attributes.status !== 'archived');

        const doActionWorkflow = async (asset, quantityType) => {
          const { harvestCount } =
            await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });

          if (!harvestCount || harvestCount <= 0) {
            return;
          }

          const harvestQuantity = {
            type: 'quantity--standard',
            id: uuidv4(),
            attributes: {
              measure: quantityType,
              value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
              },
            },
            relationships: {
              units: {
                data: {
                  type: harvestUnitTerm.type,
                  id: harvestUnitTerm.id,
                },
              },
            },
          };

          const harvestLog = {
            type: 'log--harvest',
            attributes: {
              name: `Harvested ${harvestCount} ${quantityType} from ${asset.attributes.name}`,
              timestamp: formatRFC3339(new Date()),
              status: 'done',
            },
            relationships: {
              asset: {
                data: [
                  {
                    type: asset.type,
                    id: asset.id,
                  },
                ],
              },
              quantity: {
                data: [
                  {
                    type: harvestQuantity.type,
                    id: harvestQuantity.id,
                  },
                ],
              },
            },
          };

          assetLink.entitySource.update(
            (t) => [
              t.addRecord(harvestQuantity),
              t.addRecord(harvestLog),
            ],
            { label: `Record harvest for ${asset.attributes.name}` }
          );
        };

        action.component(({ asset }) =>
          h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset, quantityType.value), 'no-caps': true },  "Record Harvest" )
        );
      }
    );
  },
};
</script>
