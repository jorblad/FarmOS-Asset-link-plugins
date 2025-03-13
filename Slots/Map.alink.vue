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

// Function to convert WKT to GeoJSON
const wktToGeoJSON = (wkt) => {
  const type = wkt.split(' ')[0];
  const coordinatesString = wkt.replace(`${type} (`, '').replace(')', '');
  let coordinates;

  if (type === 'POLYGON') {
    coordinates = coordinatesString.split(', ').map(coord => coord.split(' ').map(Number));
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
      properties: {},
    };
  } else if (type === 'POINT') {
    coordinates = coordinatesString.split(' ').map(Number);
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinates,
      },
      properties: {},
    };
  } else {
    throw new Error('Unsupported WKT type');
  }
};



const onMapInitialized = (map) => {
  map.addBehavior("sidePanel");
  map.addBehavior("layerSwitcherInSidePanel");
  // Convert WKT to GeoJSON
  const geojson = wktToGeoJSON(props.asset.attributes.geometry.value);

  console.log("GeoJSON: ", geojson);
  console.log("Props: ", props);

  const allAssetsLayer = map.addLayer('geojson', {
    title: 'All Assets',
    url: createDrupalUrl('/assets/geojson/full/all'),
    color: 'grey', // defaults to 'orange'

  });

  const propsLayer = map.addLayer('geojson', {
    title: 'Props Asset',
    geojson: geojson,
  });

  allAssetsLayer.getSource().on('change', function () {
    map.zoomToVectors();
  });

  propsLayer.getSource().on('change', function () {
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
      //actionsSlot.weight(200); // Set the weight to determine the order

      actionsSlot.showIf(context => context.pageName === 'asset-page');

      actionsSlot.component(handle.thisPlugin);
    });
  }
}
</script>