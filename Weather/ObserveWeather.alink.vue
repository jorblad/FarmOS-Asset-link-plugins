<script setup>
import { ref, inject } from 'vue';

import { formatRFC3339 } from "assetlink-plugin-api";
import { ensureTaxonomyTerm, runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';

const assetLink = inject('assetLink');

// The kinds of weather you can record. Add more here (e.g. "Air pressure",
// "Soil moisture") — each maps to a farmOS quantity measure + unit name.
const observationTypes = [
  { label: 'Rainfall',     measure: 'length',     unit: 'mm',  suffix: 'mm' },
  { label: 'Temperature',  measure: 'temperature', unit: '°C', suffix: '°C' },
  { label: 'Wind speed',   measure: 'rate',       unit: 'm/s', suffix: 'm/s' },
  { label: 'Humidity',     measure: 'ratio',      unit: '%',   suffix: '%' },
];

const selectedType = ref(observationTypes[0]);
const value = ref(null);

const onSubmit = async () => {
  if (!requireValue(value.value !== null && value.value !== undefined && value.value !== '', 'Enter a measurement value before recording.')) {
    return;
  }

  // Resolve (or create) the unit for the chosen observation type.
  const unitTerm = await ensureTaxonomyTerm(assetLink, selectedType.value.unit);

  const quantity = {
    type: 'quantity--material',
    id: window.crypto.randomUUID ? window.crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2)),
    attributes: {
      measure: selectedType.value.measure,
      value: {
        decimal: `${value.value}`,
      },
    },
    relationships: {
      units: {
        data: {
          type: unitTerm.type,
          id: unitTerm.id,
        }
      },
    },
  };

  const observationLog = {
    type: 'log--observation',
    attributes: {
      name: `Measured ${value.value} ${selectedType.value.unit} ${selectedType.value.label.toLowerCase()}`,
      timestamp: formatRFC3339(new Date()),
      status: "done",
    },
    relationships: {
      quantity: {
        data: [
          {
            type: quantity.type,
            id: quantity.id,
          }
        ]
      },
    },
  };

  await runUpdate(assetLink, `Record ${selectedType.value.label.toLowerCase()} observation`,
      (t) => [
        t.addRecord(quantity),
        t.addRecord(observationLog),
      ],
      { notifySuccess: true });
};
</script>

<template alink-route[se.jorblad.farmos_asset_link.routes.v0.observe_weather_page]="/observe-weather">
  <q-page padding class="column text-left">
    <h4>Record a weather observation</h4>
    <div class="q-pa-md">
      <q-select
        filled
        v-model="selectedType"
        :options="observationTypes"
        :option-label="opt => opt.label"
        label="Observation type"
        emit-value
        map-options
      />
    </div>
    <div class="q-pa-md">
      <q-input
        v-model.number="value"
        type="number"
        filled
        :label="`Value (${selectedType.suffix})`"
        :suffix="selectedType.suffix"
      />
    </div>
    <div class="q-pa-sm q-gutter-sm row justify-end">
      <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
      <q-btn
        color="primary"
        label="Record"
        @click="onSubmit"
        :disabled="value === null || value === undefined || value === ''"
      />
    </div>
  </q-page>
</template>
