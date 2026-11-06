<script setup>
import { AssetLogsPanel } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
</script>

<!--
  Shown on the assetlink start page when no asset is selected, listing done and
  pending logs across the whole farm. NOTE: the slot id below (...slots.v0.home)
  is a best guess for assetlink's home/dashboard area - verify it actually
  appears on the start page and adjust the id if not.
-->
<template alink-slot[se.jorblad.farmos_asset_link.slots.v0.home]="page-slot(weight: 100)">
  <div class="q-pa-md">
    <AssetLogsPanel status="done" :asset="null" />
    <AssetLogsPanel status="pending" :asset="null" />
  </div>
</template>
