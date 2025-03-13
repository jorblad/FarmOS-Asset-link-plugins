<script setup>
import { inject } from 'vue';
import { createDrupalUrl } from "assetlink-plugin-api";
import { useRouter } from 'vue-router';

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
    url: createDrupalUrl('/assets/geojson/full/all'),
    style: (feature) => {
      // Check if the feature corresponds to the asset in props
      console.log('feature', feature);
      console.log('props.asset', props.asset);
      if (feature.get('id') === props.asset.id) {
        // Return a different style for the asset in props
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: 'rgba(255, 0, 0, 0.6)', // Red color with transparency
          }),
          stroke: new ol.style.Stroke({
            color: 'rgba(255, 0, 0, 1)', // Red color
            width: 2,
          }),
        });
      } else {
        // Return the default style for other assets
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: 'rgba(0, 0, 255, 0.6)', // Blue color with transparency
          }),
          stroke: new ol.style.Stroke({
            color: 'rgba(0, 0, 255, 1)', // Blue color
            width: 1,
          }),
        });
      }
    },
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
        height: 75vh;
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
      actionsSlot.weight(200); // Set the weight to determine the order

      actionsSlot.showIf(context => context.pageName === 'asset-page');

      actionsSlot.component(handle.thisPlugin);
    });
  }
}
</script>