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

<template alink-slot[se.jorblad.farmos_asset_link.slots.v0.pending_asset_logs]="page-slot(weight: 150)">
  <AssetLogsPanel status="pending" :asset="asset" />
</template>
