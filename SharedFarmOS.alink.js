// Asset Link shared-helper library.
//
// Asset Link's loader only resolves a fixed set of bare specifiers
// (vue, quasar, assetlink-plugin-api, ...) and `plugin-library:<name>` imports.
// It does NOT support relative imports between plugins, so all shared logic is
// provided here once and consumed by the other plugins via:
//
//   import { ensureAsset, runUpdate } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
//
// This file is both:
//   - an Asset Link plugin (the default export's onLoad provides the library), and
//   - a plain ESM module (the named exports) so the unit tests can import it
//     directly without a running Asset Link.
import { Dialog, QTree } from 'quasar';
import { uuidv4, parseJSONDate } from 'assetlink-plugin-api';
import { ref, computed, inject, onMounted, onUnmounted, h, watch } from 'vue';

// Asset Link installs Quasar with only the Dialog + Loading plugins; the Notify
// plugin is NOT registered, so `Notify.create` is unavailable (it is only attached
// during the Notify plugin's install). We therefore surface feedback exclusively
// through the registered Dialog plugin. A try/catch guards against any build that
// does not register Dialog, falling back to the console so a missing UI dep can
// never crash a workflow.
function notify(opts) {
  const isObj = opts && typeof opts === 'object';
  const message = isObj ? (opts.message ?? '') : String(opts ?? '');
  const caption = isObj ? opts.caption : undefined;
  const type = isObj ? (opts.type ?? 'info') : 'info';
  const title = type === 'negative' ? 'Error' : type === 'warning' ? 'Warning' : 'Notice';
  try {
    return Dialog.create({ title, message, caption });
  } catch (e) {
    console.error(`[notify] ${title}: ${message}`, caption ?? '', e);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// useFarmOS.js
// ---------------------------------------------------------------------------

// Trim a name so that find-by-name / $relateByName don't create duplicate
// terms or assets because of stray whitespace or case differences.
export function normalizeName(name) {
  return (name || '').trim();
}

// Find a taxonomy term by (normalized) name, or create it.
// Defaults to the `taxonomy_term--unit` bundle used for quantity units.
export async function ensureTaxonomyTerm(assetLink, name, bundle = 'taxonomy_term--unit') {
  const termName = normalizeName(name);

  const findTerm = async (entitySource) => {
    const results = await entitySource.query(q =>
      q.findRecords(bundle)
        .filter({ attribute: 'name', op: 'equal', value: termName })
    );
    return results.flatMap(l => l).find(a => a);
  };

  let term = await findTerm(assetLink.entitySource.cache);
  if (!term) {
    term = await findTerm(assetLink.entitySource);
  }
  if (term) {
    return term;
  }

  const newTerm = {
    type: bundle,
    id: uuidv4(),
    attributes: { name: termName },
  };

  try {
    return await assetLink.entitySource.update(
      (t) => t.addRecord(newTerm),
      { label: `Create ${bundle} '${termName}'` }
    );
  } catch (err) {
    notify({
      type: 'negative',
      message: `Could not create unit '${termName}'`,
      caption: err && err.message ? err.message : String(err),
      icon: 'error',
      timeout: 0,
      actions: [{ label: 'Dismiss', color: 'white', handler: () => {} }],
    });
    throw err;
  }
}

// Find an asset by (normalized) name, or create it with the given type.
// Pass `{ parentAsset }` to make a newly-created asset a child of another asset
// (e.g. a harvested product under its plant).
export async function ensureAsset(assetLink, name, type, { parentAsset } = {}) {
  const assetName = normalizeName(name);

  const findAsset = async (entitySource) => {
    const results = await entitySource.query(q =>
      q.findRecords(type)
        .filter({ attribute: 'name', op: 'equal', value: assetName })
    );
    return results.flatMap(l => l).find(a => a);
  };

  let asset = await findAsset(assetLink.entitySource.cache);
  if (!asset) {
    asset = await findAsset(assetLink.entitySource);
  }
  if (asset) {
    return asset;
  }

  const newAsset = {
    type,
    id: uuidv4(),
    attributes: { name: assetName },
    ...(parentAsset && {
      relationships: {
        parent: {
          data: {
            type: parentAsset.type,
            id: parentAsset.id,
          },
        },
      },
    }),
  };

  try {
    return await assetLink.entitySource.update(
      (t) => t.addRecord(newAsset),
      { label: `Create ${assetName} (${type})` }
    );
  } catch (err) {
    notify({
      type: 'negative',
      message: `Could not create ${type} '${assetName}'`,
      caption: err && err.message ? err.message : String(err),
      icon: 'error',
      timeout: 0,
      actions: [{ label: 'Dismiss', color: 'white', handler: () => {} }],
    });
    throw err;
  }
}

// Run a mutation, surfacing success/failure to the user via a toast.
// Set `{ notifySuccess: true }` to also toast on success (recommended for
// single-action dialog workflows). Errors are re-thrown so callers can stop
// the workflow (e.g. not create a log if the quantity failed first).
export async function runUpdate(assetLink, label, mutator, { notifySuccess = false } = {}) {
  try {
    const result = await assetLink.entitySource.update(mutator, { label });
    if (notifySuccess) {
      notify({
        type: 'positive',
        message: label,
        icon: 'check_circle',
      });
    }
    return result;
  } catch (err) {
    notify({
      type: 'negative',
      message: `Failed: ${label}`,
      caption: err && err.message ? err.message : String(err),
      icon: 'error',
      timeout: 0,
      actions: [{ label: 'Dismiss', color: 'white', handler: () => {} }],
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// usePhotoCapture.js
// ---------------------------------------------------------------------------

// Shared photo-capture carousel logic used by several dialog plugins.
// Returns reactive refs to bind in the template:
//   - capturedPhotos:   array of { id, fileName, fileDataUrl }
//   - photoCaptureModel: the <photo-input> v-model
//   - carouselPosition: which carousel slide is currently shown
export function usePhotoCapture() {
  const capturedPhotos = ref([]);
  const photoCaptureModel = ref(null);
  const carouselPosition = ref('capture-photo');

  watch(photoCaptureModel, async () => {
    const file = photoCaptureModel.value;

    if (!file) {
      return;
    }

    const fileToArrayBuffer = data => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(data);
    });

    const fileName = file.name;
    const fileType = file.type;
    const fileData = await fileToArrayBuffer(file);

    const fileStringData = new Uint8Array(fileData).reduce((data, byte) => {
      return data + String.fromCharCode(byte);
    }, '');

    const fileDataUrl = `data:${fileType};base64, ` + btoa(fileStringData);

    const photoId = uuidv4();

    capturedPhotos.value.push({
      id: photoId,
      fileName,
      fileDataUrl,
    });

    carouselPosition.value = photoId;
  });

  return { capturedPhotos, photoCaptureModel, carouselPosition };
}

// ---------------------------------------------------------------------------
// AssetLogsPanel.js
// ---------------------------------------------------------------------------

// Shared, reusable panel that lists asset logs filtered by status.
// Used on the asset page (with `:asset`) and on the home page (without it,
// i.e. `:asset="null"`, showing logs across the whole farm).
export const AssetLogsPanel = {
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

// Provide all of the above as an Asset Link plugin library so the other plugins
// (and the unit tests) can import them without relative imports.
export default class SharedFarmOS {
  static onLoad(handle) {
    handle.provideLibrary('org.jorblad.farmos_asset_link.helpers', (lib) => {
      lib.provides({
        normalizeName,
        ensureTaxonomyTerm,
        ensureAsset,
        runUpdate,
        usePhotoCapture,
        AssetLogsPanel,
        notify,
      });
    });
  }
}
