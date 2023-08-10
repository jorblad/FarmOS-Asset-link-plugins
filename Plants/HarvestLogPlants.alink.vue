<script setup>
import { inject } from 'vue';

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
  
});


const quantityType = ref(null);
const unitLabelFn = unitTerm => unitTerm.attributes.name;

const onSubmit = () => {
  onDialogOK({ harvestCount: harvestCount.value, quantityType: quantityType.value });
};
</script>

<template>
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

        console.log('Harvest log: V0.1')

        action.showIf(({ log }) => log.attributes.status != `done` );
        const doActionWorkflow = async (asset) => {
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
                    name: UNIT_NAME,
                    },
                }
                },
            },
            };

            const harvestLog = {
            type: props.log.type,
            id: props.log.id,
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
