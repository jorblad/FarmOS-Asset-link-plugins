<script setup>
import { computed, inject, ref, onMounted, onUnmounted } from 'vue';

import { createDrupalUrl } from "assetlink-plugin-api";

import { useRouter } from 'vue-router'

const router = useRouter();

const props = defineProps({
  asset: {
    type: Object,
    required: true,
  },
});

const assetLink = inject('assetLink');

const onMapInitialized = (map) => {
  map.addBehavior("sidePanel");
  map.addBehavior("layerSwitcherInSidePanel");

  const layer = map.addLayer('geojson', {
    title: 'All Assets',
    url: createDrupalUrl('/assets/geojson/full/all')
  });

  layer.getSource().on('change', function () {
    map.zoomToVectors();
  });
};

</script>

<template>
  <div>
    <h5 class="q-my-xs">Map:</h5>
    <div
      class="col"
      style="
        height: auto;
        min-height: 160px;
        height: 25vh;
        position: relative;
        contain: strict;
        overflow: auto;
      "
    >
      <farm-map @map-initialized="onMapInitialized"></farm-map>
    </div>
  </div>
</template>

<script>
export default {
  onLoad(handle) {
    handle.defineSlot('se.jorblad.farmos_asset_link.slots.v0.map', actionsSlot => {
      actionsSlot.type('page-slot');

      actionsSlot.showIf(context => context.pageName === 'asset-page');

      actionsSlot.component(handle.thisPlugin);
    });
  }
}
</script>