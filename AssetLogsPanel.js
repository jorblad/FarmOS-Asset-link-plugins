import { ref, computed, inject, onMounted, onUnmounted, h } from 'vue';
import { QTree } from 'quasar';
import { parseJSONDate } from 'assetlink-plugin-api';

// Shared, reusable panel that lists asset logs filtered by status.
// Used on the asset page (with `:asset`) and on the home page (without it,
// i.e. `:asset="null"`, showing logs across the whole farm).
export default {
  name: 'AssetLogsPanel',
  props: {
    status: { type: String, required: true }, // 'done' | 'pending'
    asset: { type: Object, default: null },
  },
  setup(props) {
    const assetLink = inject('assetLink');
    const logs = ref([]);

    const logNodes = computed(() => logs.value.map(log => ({
      id: log.id,
      log,
      selectable: false,
    })));

    const isDone = props.status === 'done';

    const resolveLogs = async () => {
      const logTypes = (await assetLink.getLogTypes()).map(t => t.attributes.drupal_internal__id);

      const results = await assetLink.entitySource.query(q => logTypes.map(logType => {
        const base = q.findRecords(`log--${logType}`)
          .filter({ attribute: 'status', op: isDone ? 'equal' : '<>', value: 'done' });
        if (props.asset) {
          base.filter({
            relation: 'asset.id',
            op: 'some',
            records: [{ type: props.asset.type, id: props.asset.id }],
          });
        }
        return base.sort(isDone ? 'timestamp' : '-timestamp');
      }));

      logs.value = results.flatMap(l => l)
        .sort((a, b) => parseJSONDate(a.attributes.timestamp) - parseJSONDate(b.attributes.timestamp));
    };

    const onChanged = ({ assetType, assetId }) => {
      if (!props.asset || (props.asset.type === assetType && props.asset.id === assetId)) {
        resolveLogs();
      }
    };

    onMounted(() => {
      resolveLogs();
      assetLink.eventBus.$on('changed:assetLogs', onChanged);
    });
    onUnmounted(() => assetLink.eventBus.$off('changed:assetLogs', onChanged));

    return () => h('div', [
      h('h5', { class: 'q-my-xs' }, isDone ? 'Done Logs:' : 'Pending Logs:'),
      h('div', {
        class: 'col',
        style: 'height:auto;min-height:160px;height:25vh;position:relative;contain:strict;overflow:auto;',
      }, [
        h(QTree, {
          'node-key': 'id',
          nodes: logNodes.value,
          selected: null,
          'no-nodes-label': isDone ? 'No done logs' : 'No pending logs',
          class: 'q-ml-md',
        }, {
          'default-header': (prop) => h('entity-name', { entity: prop.node.log }),
        }),
      ]),
    ]);
  },
};
