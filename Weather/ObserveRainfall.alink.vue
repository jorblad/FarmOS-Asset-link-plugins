<script setup>
import { ref, inject } from 'vue';
  
import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";

const assetLink = inject('assetLink');

const loadingUnitTerm = ref(true);
let mmUnitTerm = undefined;

const loadUnitTerm = async () => {
  await assetLink.booted;

  const UNIT_NAME = "mm";

  const findUnitTerm = async entitySource => {
    const results = await entitySource.query(q => q
        .findRecords('taxonomy_term--unit')
        .filter({ attribute: 'name', op: 'equal', value: UNIT_NAME }));

    return results.flatMap(l => l).find(a => a);
  };

  mmUnitTerm = await findUnitTerm(assetLink.entitySource.cache);

  if (!mmUnitTerm) {
    mmUnitTerm = await findUnitTerm(assetLink.entitySource);
  }

  if (!mmUnitTerm) {
    const unitTermToCreate = {
        type: 'taxonomy_term--unit',
        id: uuidv4(),
        attributes: {
          name: UNIT_NAME,
        },
    };

    mmUnitTerm = await assetLink.entitySource.update(
        (t) => t.addRecord(unitTermToCreate),
        {label: `Add '${UNIT_NAME}' unit`});
  }

  loadingUnitTerm.value = false;
};
loadUnitTerm();

const mmOfRain = ref(0);

const onSubmit = (mmOfRain) => {
  if (!mmOfRain || mmOfRain <= 0) {
    return;
  }

  const rainfallQuantity = {
    type: 'quantity--standard',
    id: uuidv4(),
    attributes: {
      measure: 'count',
      value: {
        decimal: `${mmOfRain}`,
      },
    },
    relationships: {
      units: {
        data: {
          type: mmUnitTerm.type,
          id: mmUnitTerm.id,
        }
      },
    },
  };

  const observationLog = {
    type: 'log--observation',
    attributes: {
      name: `Measured ${mmOfRain} mm of rainfall`,
      timestamp: formatRFC3339(new Date()),
      status: "done",
    },
    relationships: {
      quantity: {
        data: [
          {
            type: rainfallQuantity.type,
            id: rainfallQuantity.id,
          }
        ]
      },
    },
  };

  assetLink.entitySource.update(
      (t) => [
        t.addRecord(rainfallQuantity),
        t.addRecord(observationLog),
      ],
      {label: `Record rainfall observation`});
};
</script>

<template alink-route[se.sj-tech.farmos_asset_link.routes.v0.observe_rainfall_page]="/observe-rainfall">
  <q-page padding class="column text-left">
    <h4>How much rain was there?</h4>
    <div class="q-pa-md">
    <q-slider
      v-model="mmOfRain"
      :min="0"
      :max="100"
      :step="1"
      snap
      label
    />
    <q-input
      v-model.number="mmOfRain"
      type="number"
      filled
      suffix="mm"
    />
    </div>
    <div class="q-pa-sm q-gutter-sm row justify-end">
      <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
      <q-btn
        color="primary"
        label="Record"
        @click="() => onSubmit(mmOfRain)"
        :disabled="mmOfRain <= 0"
      />
    </div>
    <q-inner-loading :showing="loadingUnitTerm"></q-inner-loading>
  </q-page>
</template>