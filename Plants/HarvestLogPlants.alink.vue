<script setup>
import { inject, ref, onMounted } from 'vue';
import { useDialogPluginComponent } from 'quasar'

const assetLink = inject('assetLink');

const props = defineProps({
  log: {
    type: Object,
    required: true,
  },
});

defineEmits([
  ...useDialogPluginComponent.emits
]);

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const harvestCount = ref(0);


const findUnitTerms = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--unit')
  );


  const unitTerms = results.flatMap((l) => l);

  console.log('All taxonomy_term--unit records:', unitTerms);

  return unitTerms;
};

const unitTerms = ref([]);

onMounted(async () => {
  unitTerms.value = await findUnitTerms(assetLink.entitySource);
  console.log("Props: ", props)
  
});


const quantityType = ref(null);
const unitLabelFn = unitTerm => unitTerm.attributes.name;

const onSubmit = () => {
  onDialogOK({ harvestCount: harvestCount.value, quantityType: quantityType.value });
};
</script>

<template>
    <q-dialog ref="dialogRef" @hide="onDialogHide">
        <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
        <h4>How much did you harvest?</h4>
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

        <q-select
            filled v-model="quantityType"
            :options="unitTerms"
            :option-label="unitLabelFn"
            label="Standard"
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
import { QBtn } from 'quasar';
import { formatRFC3339, summarizeAssetNames, uuidv4 } from "assetlink-plugin-api";

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;


    handle.defineSlot('se.jorblad.farmos_asset_link.log_actions.v0.harvest_log', action => {
        action.type('log-action');
        action.weight(-10);

        console.log('Harvest log: V0.4')


        action.showIf(({ log }) => log.attributes.status != `done` && log.type === 'log--harvest' );
        const doActionWorkflow = async (log) => {
            const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { log });
            console.log('Dialog result:', dialogResult);
            const harvestCount = dialogResult.harvestCount;
            console.log('Harvest Count:', harvestCount);
            const harvestUnitTerm = dialogResult.quantityType;
            console.log('QuantityType:', harvestUnitTerm);

            if (!harvestUnitTerm) {
            return;
            }


            if (!harvestCount || harvestCount <= 0) {
            return;
            }

            let harvestQuantityMeasure = "count";
            if (harvestUnitTerm.attributes.name === "gram" ) {
            harvestQuantityMeasure = "weight";
            } else {
            harvestQuantityMeasure = "count";
            }



            const harvestQuantity = {
            type: 'quantity--standard',
            id: uuidv4(),
            attributes: {
                measure: harvestQuantityMeasure,
                value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
                },
            },
            relationships: {
                units: {
                data: {
                    type: 'taxonomy_term--unit',
                    id: uuidv4(),
                    '$relateByName': {
                    name: harvestUnitTerm.attributes.name,
                    },
                }
                },
            },
            };

            const harvestLog = {
            type: log.type,
            id: log.id,
            attributes: {
                timestamp: formatRFC3339(new Date()),
                status: "done",
            },
            relationships: {
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

            assetLink.entitySource.update(
                (t) => [
                t.addRecord(harvestQuantity),
                t.updateRecord(harvestLog),
                ],
                {label: `Record harvest`});
        };
        try {
            action.component(({ log }) =>
                h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(log), 'no-caps': true },  "Harvest" ));
        } catch (error) {
                console.error('Error in doActionWorkflow:', error);
        }
    });
    }
}
</script>
