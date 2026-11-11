<script setup>
// Top-bar button (visible on every page) that opens the ObserveWeather page.
// Uses the same `toolbar-item(weight: N)` slot directive the built-in Asset Link
// toolbar items use (see ConfigActionsToolbarSlotProvider /
// QrCodeSearchToolbarSlotProvider in the Asset Link source). A separate file is
// required because a .alink.vue file may contain only one `<template>` element
// (the ObserveWeather page itself is a `<template alink-route>`).
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config';
</script>

<template alink-slot[se.jorblad.farmos_asset_link.slots.v0.observe_weather_toolbar]="toolbar-item(weight: 200)">
  <q-btn flat dense icon="mdi-weather-partly-cloudy" :label="t('weatherToolbarButton')" to="/observe-weather" />
</template>
