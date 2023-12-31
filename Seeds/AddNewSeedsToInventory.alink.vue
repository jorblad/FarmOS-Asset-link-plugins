<!-- Modified from https://github.com/Farmer-Eds-Shed/FarmOS-Asset-link-plugins/blob/main/Bales/AddNewHayBalesToInventory.alink.vue -->
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

const seedCount = ref(0);
const seedCost = ref(0);
const seller = ref(null);
const invoice_number = ref(null);
const lot_number = ref(null);

const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, seller: seller.value, invoice_number: invoice_number.value, lot_number: lot_number.value, seedCost: seedCost.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
        <h5>How many seeds did you buy?</h5>
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
            <h5>Total cost</h5>
            <q-slider
                v-model="seedCost"
                :min="0"
                :max="500"
                :step="1"
                snap
                label
            />
        </div>
        <div class="q-pa-md">
            <q-input
                v-model.number="seedCost"
                type="number"
                filled
            />
        </div>
        <div class="q-pa-md">
            <q-input
                v-model="seller"
                filled
                label="Seller"
                />
        </div>
        <div class="q-pa-md">
            <q-input
                v-model="invoice_number"
                filled
                label="Invoice number"
                />
        </div>
        <div class="q-pa-md">
            <q-input
                v-model="lot_number"
                filled
                label="Lot number"
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


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.increment_seed_inventory', action => {
      action.type('asset-action');

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
          // TODO: Implement a better predicate here...
          && asset.type === 'asset--seed');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        console.log('Dialog result:', dialogResult);
        const seedCount = dialogResult.seedCount;
        console.log('seedCount', seedCount)
        const seller = dialogResult.seller;
        console.log('seller', seller)
        const invoice_number = dialogResult.invoice_number;
        console.log('invoice_number', invoice_number)
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
            inventory_adjustment: 'increment',
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
                type: 'taxonomy_term--unit',
                id: uuidv4(),
                '$relateByName': {
                name: UNIT_NAME,
                },
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
            {label: `Buy new seeds`});
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Buy new seeds" ));
    });
  }
}
</script>