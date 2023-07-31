<script setup>
import { inject, ref, onMounted } from 'vue';
import { useDialogPluginComponent } from 'quasar'
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

const seedCount = ref(0);
const seedCost = ref(0);
const seller = ref(null);
const invoice_number = ref(null);
const lot_number = ref(null);

// Create a function to fetch assetLink and store it in the ref
const fetchAssetLink = async () => {
  assetLink.value = await getAssetLink(); // Replace getAssetLink with your code to retrieve assetLink
};

// Fetch the assetLink on component mount
onMounted(fetchAssetLink);

const findseasons = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--season')
  );


  const seasons = results.flatMap((l) => l);

  console.log('All taxonomy_term--season records:', seasons);

  // Extract the attributes.name from each element and return as a list
  return seasons.map((season) => season.attributes.name);
};

const findplanttypes = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--plant_type')
  );


  const plant_types = results.flatMap((l) => l);

  console.log('All taxonomy_term--plant_type records:', plant_types);

  // Extract the attributes.name from each element and return as a list
  return plant_types.map((plant_type) => plant_type.attributes.name);
};

const seasons = ref([]);
const plant_types = ref([]);

onMounted(async () => {
  seasons.value = await findseasons(assetLink.entitySource);
  plant_types.value = await findplanttypes(assetLink.entitySource);
  
});

const plantSeason = ref(null);
const plantType = ref(null);

const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, plantType: plantType.value, lot_number: lot_number.value, seedCost: seedCost.value });
};

filterFn (val, update) {
        if (val === '') {
          update(() => {
            options.value = stringOptions

            // here you have access to "ref" which
            // is the Vue reference of the QSelect
          })
          return
        }

        update(() => {
          const needle = val.toLowerCase()
          options.value = stringOptions.filter(v => v.toLowerCase().indexOf(needle) > -1)
        })
    }

</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>How many seeds did you plant?</h4>
      <div class="q-pa-md">
        <q-slider
            v-model="seedCount"
            :min="0"
            :max="5000"
            :step="1"
            snap
            label
        />
        <q-input
            v-model.number="seedCount"
            type="number"
            filled
        />
        <q-select
        filled
        v-model="plantSeason"
        :options="seasons"
        label="Season"
        use-input
        input-debounce="300"
        datalist
        @filter="filterFn"
        />
        <q-select
        filled
        v-model="plantType"
        :options="plant_types"
        label="Species"
        use-input
        input-debounce="300"
        datalist
        />

      </div>
      
      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
        <q-btn
          color="primary"
          label="Record"
          @click="onSubmit"
          :disabled="seedCount <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';
import { formatRFC3339, summarizeAssetNames, uuidv4 } from "assetlink-plugin-api";

const UNIT_NAME = "st";

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const findUnitTerm = async entitySource => {
      const results = await entitySource.query(q => q
          .findRecords('taxonomy_term--unit')
          .filter({ attribute: 'name', op: 'equal', value: UNIT_NAME }));
      return results.flatMap(l => l).find(a => a);
    };

    let seedUnitTerm = await findUnitTerm(assetLink.entitySource.cache);

    if (!seedUnitTerm) {
      seedUnitTerm = await findUnitTerm(assetLink.entitySource);
    }

    if (!seedUnitTerm) {
      const unitTermToCreate = {
          type: 'taxonomy_term--unit',
          id: uuidv4(),
          attributes: {
            name: UNIT_NAME,
          },
      };

      seedUnitTerm = await assetLink.entitySource.update(
          (t) => t.addRecord(unitTermToCreate),
          {label: `Add '${UNIT_NAME}' unit`});
    }

    handle.defineSlot('com.example.farmos_asset_link.actions.v0.plant_seed_inventory', action => {
      action.type('asset-action');

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
          // TODO: Implement a better predicate here...
          && (asset.type === 'asset--land' || (asset.type === 'asset--structure' && asset.attributes.structure_type === 'greenhouse')) );

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        console.log('Dialog result:', dialogResult);
        const seedCount = dialogResult.seedCount;
        console.log('seedCount', seedCount)
        const plantSeason = dialogResult.plantSeason;
        console.log('seller', plantSeason)
        const plantType = dialogResult.plantType;
        console.log('plantType', plantType)
        const lot_number = dialogResult.lot_number;
        console.log('lot_number', lot_number)
        const seedCost = dialogResult.seedCost;
        console.log('total cost', seedCost)

        if (!seedCount || seedCount <= 0) {
          return;
        }


        const seedQuantity = {
          type: 'quantity--price',
          id: uuidv4(),
          attributes: {
            measure: 'count',
            value: {
              numerator: seedCount,
              denominator: 1,
              decimal: `${seedCount}`,
            },
            total_price: {
              numerator: `${seedCost}`,
              denominator: 1,
            },
            inventory_adjustment: 'decrement',
          },
          relationships: {
            inventory_asset: {
              data: {
                  type: asset.type,
                  id: asset.id,
                }
            },
            units: {
              data: {
                type: seedUnitTerm.type,
                id: seedUnitTerm.id,
              }
            },
          },
        };

        const purchaseLog = {
          type: 'log--purchase',
          attributes: {
            name: `Bought ${seedCount} seeds`,
            timestamp: formatRFC3339(new Date()),
            status: "done",
            seller: `${seller}`,
            invoice_number: `${invoice_number}`,
            lot_number: `${lot_number}`,
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
                  type: seedQuantity.type,
                  id: seedQuantity.id,
                }
              ]
            },
          },
        };

        assetLink.entitySource.update(
            (t) => [
              t.addRecord(seedQuantity),
              t.addRecord(purchaseLog),
            ],
            {label: `Plant from seeds`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Plant from seeds" ));
    });
  }
}
</script>