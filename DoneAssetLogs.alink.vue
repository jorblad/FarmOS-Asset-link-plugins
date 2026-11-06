<script setup>
import { inject } from 'vue';
import AssetLogsPanel from '../AssetLogsPanel.js';

const assetLink = inject('assetLink');
const props = defineProps({
  asset: {
    type: Object,
    required: true,
  },
});
</script>

<template alink-slot[se.jorblad.farmos_asset_link.slots.v0.done_asset_logs]="page-slot(weight: 180)">
  <AssetLogsPanel status="done" :asset="asset" />
</template>
