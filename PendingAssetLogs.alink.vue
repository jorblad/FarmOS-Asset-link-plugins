<script setup>
import { computed, inject, ref, onMounted, onUnmounted } from 'vue';

import { currentEpochSecond, parseJSONDate } from "assetlink-plugin-api";

import { useRouter } from 'vue-router'

const router = useRouter();

const props = defineProps({
  asset: {
    type: Object,
    required: true,
  },
});

const assetLink = inject('assetLink');

const pendingAssetLogs = ref([]);

const pendingAssetLogNodes = computed(() => {
  return pendingAssetLogs.value.map(log => {
    return {
      id: log.id,
      log,
      selectable: false,
    };
  });
});

const resolvePendingAssetLogs = async () => {
  console.log("Resolving pending asset logs...");
  
  console.log("Pending asset logTypes:", doneAssetLogNodes.value);

  const logTypes = (await assetLink.getLogTypes()).map(t => t.attributes.drupal_internal__id);

  console.log("Pending asset logTypes:", logTypes);

  const results = await assetLink.entitySource.query(q => logTypes.map(logType => {
    return q.findRecords(`log--${logType}`)
      .filter({ attribute: 'status', op: '<>', value: 'done' })
      .filter({
        relation: 'asset.id',
        op: 'some',
        records: [{ type: props.asset.type, id: props.asset.id }]
      })
      .sort('-timestamp');
  }));

  pendingAssetLogs.value = results.flatMap(l => l)
    .sort((logA, logB) => parseJSONDate(logA.attributes.timestamp) - parseJSONDate(logB.attributes.timestamp));
  console.log("Pending asset logs:", doneAssetLogs.value);
};

const onAssetLogsChanged = ({ assetType, assetId }) => {
  if (
    props.asset.type === assetType &&
    props.asset.id === assetId
  ) {
    resolvePendingAssetLogs();
  }
};

let unsubber;
onMounted(() => {
  resolvePendingAssetLogs();
  unsubber = assetLink.eventBus.$on("changed:assetLogs", onAssetLogsChanged);
});
onUnmounted(() => unsubber && unsubber.$off());
</script>

<template alink-slot[se.jorblad.farmos_asset_link.slots.v0.pending_asset_logs]="page-slot(weight: 150)">
  <div>
    <h5 class="q-my-xs">Pending Logs:</h5>
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
      <q-tree
        node-key="id"
        :nodes="pendingAssetLogNodes"
        :selected="null"
        no-nodes-label="No pending logs"
        class="q-ml-md"
      >
        <template v-slot:default-header="prop">
          <entity-name :entity="prop.node.log"></entity-name>
        </template>
      </q-tree>
    </div>
  </div>
</template>
