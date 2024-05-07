<script setup>
import { createDrupalUrl } from "assetlink-plugin-api";

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

<template alink-route[se.jorblad.farmos_asset_link.routes.v0.test_map]="/test-map">
<farm-map @map-initialized="onMapInitialized"></farm-map>
</template>