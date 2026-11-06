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


  return unitTerms;
};

const unitTerms = ref([]);

onMounted(async () => {
  unitTerms.value = await findUnitTerms(assetLink.entitySource);
  
});


const quantityType = ref(null);
const unitLabelFn = unitTerm => unitTerm.attributes.name;

const selectProduct = ref(null);

const onSubmit = () => {
  onDialogOK({ harvestCount: harvestCount.value, quantityType: quantityType.value, selectProduct: selectProduct.value });
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
        <div class="q-pa-md">
          <entity-select
            label="Product (optional)"
            entity-type="asset"
            v-model="selectProduct"
          ></entity-select>
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
import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureAsset, runUpdate } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';

// Default product asset that harvest yield is counted against when the user
// doesn't pick a specific product. Named after the harvested plant's
// crop/variety when available, so every harvest records inventory.
const FALLBACK_PRODUCT_NAME = 'Skörd';

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
            const harvestCount = dialogResult.harvestCount;
            const harvestUnitTerm = dialogResult.quantityType;

            if (!harvestUnitTerm) {
            return;
            }


            if (!harvestCount || harvestCount <= 0) {
            return;
            }

            let harvestQuantityMeasure = harvestUnitTerm.attributes.name === "gram" ? "weight" : "count";

            // Derive the default product name from the related plant's
            // crop/variety (Gröda/sort). Reuse an existing product, or create
            // one under the plant. Every harvest records inventory.
            const relatedAssets = (log.relationships && log.relationships.asset && log.relationships.asset.data) || [];
            const plantRef = relatedAssets[0];
            let parentAsset = null;
            let cropName = FALLBACK_PRODUCT_NAME;
            if (plantRef) {
              parentAsset = { type: plantRef.type, id: plantRef.id };
              const plantTypeRecs = assetLink.entitySource.cache.query((q) =>
                q.findRelatedRecords({ type: plantRef.type, id: plantRef.id }, 'plant_type'));
              if (plantTypeRecs && plantTypeRecs.length) {
                cropName = plantTypeRecs[0].attributes.name;
              }
            }

            const harvestInventoryProduct = dialogResult.selectProduct
              || await ensureAsset(assetLink, cropName, 'asset--product', { parentAsset });

            const harvestQuantity = {
            type: 'quantity--material',
            id: uuidv4(),
            attributes: {
                measure: harvestQuantityMeasure,
                value: {
                numerator: harvestCount,
                denominator: 1,
                decimal: `${harvestCount}`,
                },
                inventory_adjustment: 'increment',
            },
            relationships: {
                inventory_asset: {
                data: {
                    type: harvestInventoryProduct.type,
                    id: harvestInventoryProduct.id,
                }
                },
                units: {
                data: {
                    type: harvestUnitTerm.type,
                    id: harvestUnitTerm.id,
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

            await runUpdate(assetLink, `Record harvest`,
                (t) => [
                t.addRecord(harvestQuantity),
                t.updateRecord(harvestLog),
                ],
                { notifySuccess: true });
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
