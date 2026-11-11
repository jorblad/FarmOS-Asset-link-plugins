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
import { QTree } from 'quasar';
import { uuidv4, parseJSONDate } from 'assetlink-plugin-api';
import { ref, computed, inject, onMounted, onUnmounted, h, watch, getCurrentInstance } from 'vue';

// Asset Link installs Quasar with only the Dialog + Loading plugins, and the
// Notify/Dialog *static* methods (Notify.create / Dialog.create) are only attached
// to `$q` during plugin install, so they are not callable from a plain helper
// function. Quasar's own plugins report via the console for the same reason. To
// keep feedback working (and crash-proof) without depending on Quasar/Vue instance
// state, we log to the console AND render a tiny self-contained DOM toast.
function domToast(message, caption, type) {
  if (typeof document === 'undefined' || !document.body) return;
  const el = document.createElement('div');
  el.textContent = caption ? `${message} — ${caption}` : message;
  const color = type === 'negative' ? '#c10015'
    : type === 'warning' ? '#f2c037' : '#21ba45';
  const fg = type === 'warning' ? '#000' : '#fff';
  el.style.cssText =
    `position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:340px;` +
    `padding:10px 14px;border-radius:8px;color:${fg};background:${color};` +
    `font:13px/1.4 sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), type === 'negative' || type === 'warning' ? 9000 : 3500);
}

function notify(opts) {
  const isObj = opts && typeof opts === 'object';
  const message = isObj ? (opts.message ?? '') : String(opts ?? '');
  const caption = isObj ? opts.caption : undefined;
  const type = isObj ? (opts.type ?? 'info') : 'info';
  const fn = type === 'negative' ? console.error
    : type === 'warning' ? console.warn
    : console.log;
  fn(`[${type}] ${message}`, caption ?? '');
  try {
    domToast(message, caption, type);
  } catch (_) { /* non-DOM environment */ }
  return undefined;
}

// Guard used by action workflows: if `condition` is falsy, show a warning and
// return false so the caller can `if (!requireValue(...)) return;`. Without this
// the action would silently do nothing (no log, no error, nothing queued), which
// is exactly the failure mode users report as "the log just isn't created".
export function requireValue(condition, message) {
  if (condition) return true;
  notify({ type: 'warning', message });
  return false;
}

// Map each asset bundle to the taxonomy vocabulary that identifies its type.
// farmOS 4.x requires this relationship at creation time.
const ASSET_TYPE_VOCAB = {
  'asset--plant': 'plant_type',
  'asset--animal': 'animal_type',
  'asset--product': 'product_type',
  'asset--seed': 'plant_type',
  'asset--land': 'land_type',
  'asset--equipment': 'equipment_type',
  'asset--material': 'material_type',
};

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
      actions: [{ label: 'Stäng', color: 'white', handler: () => {} }],
    });
    throw err;
  }
}

// Find an asset by (normalized) name, or create it with the given type.
// Pass `{ parentAsset }` to make a newly-created asset a child of another asset
// (e.g. a harvested product under its plant). Pass `{ typeTerm }` to set the
// asset's required type taxonomy term (e.g. the `product_type` for a product —
// farmOS 4.x rejects asset creation without it).
export async function ensureAsset(assetLink, name, type, { parentAsset, typeTerm } = {}) {
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

  const relationships = {};
  if (parentAsset) {
    relationships.parent = {
      data: { type: parentAsset.type, id: parentAsset.id },
    };
  }

  // farmOS 4.x requires the asset's type term (e.g. product_type) on creation.
  // ensureTaxonomyTerm expects the full record type (taxonomy_term--<vocab>),
  // not the bare vocabulary name, or Orbit rejects it as "Record type
  // '<vocab>' does not exist in schema".
  const vocab = ASSET_TYPE_VOCAB[type];
  if (vocab && typeTerm) {
    const term = await ensureTaxonomyTerm(assetLink, typeTerm, `taxonomy_term--${vocab}`);
    relationships[vocab] = {
      data: { type: `taxonomy_term--${vocab}`, id: term.id },
    };
  }

  const newAsset = {
    type,
    id: uuidv4(),
    attributes: { name: assetName },
    ...(Object.keys(relationships).length ? { relationships } : {}),
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
      actions: [{ label: 'Stäng', color: 'white', handler: () => {} }],
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

// Run an async mapper over `items` with at most `limit` items in flight at
// once. Resolves to an array of the per-item results in input order. Individual
// rejections should be handled by the mapper itself (so one failure can't
// blank the whole batch).
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await mapper(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

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
    // The router is installed on the Asset Link app globally, so grab it from the
    // component instance rather than importing 'vue-router' (which isn't a
    // resolvable bare specifier for this shared library module — importing it
    // would break the whole plugin suite that depends on SharedFarmOS).
    const instance = getCurrentInstance();
    const router = instance?.proxy?.$router || instance?.appContext?.config?.globalProperties?.$router;

    const logs = ref([]);

    const logNodes = computed(() => logs.value.map(log => ({
      id: log.id,
      log,
      selectable: true,
    })));

    // Open a log when its row is clicked (mirrors the built-in Tasks page).
    const openLog = (nodeKey) => {
      const log = logs.value.find(l => l.id === nodeKey);
      if (!log || !router) return;
      const ref = log.attributes?.drupal_internal__id || log.id;
      router.push(`/log/${ref}`);
    };

    const isDone = props.status === 'done';

    const resolveLogs = async () => {
      const logTypes = (await assetLink.getLogTypes()).map(t => t.attributes.drupal_internal__id);

      // Query each log type in its own call. A single compound query
      // (`logTypes.map(...)`) only ends up firing one of the sub-queries in this
      // Asset Link build, so the panel would only ever show one log type's
      // (usually empty) results. Querying per type is robust and a failing type
      // can't blank the whole panel.
      //
      // The queries are run sequentially (rather than a single Promise.all of all
      // types) because firing every log type at once can overwhelm a
      // slow/constrained farm instance and trip Orbit's per-request fetch
      // timeout, which would leave the panel empty. On a normal farm each typed
      // query is a fast round-trip, so running them one at a time is still
      // sub-second; on a slow instance this stays safely under the timeout
      // instead of hanging forever.
      const settled = await mapWithConcurrency(logTypes, 1, logType =>
        assetLink.entitySource.query(q => {
          let base = q.findRecords(`log--${logType}`)
            .filter({ attribute: 'status', op: isDone ? 'equal' : '<>', value: 'done' });
          if (props.asset) {
            base = base.filter({
              relation: 'asset.id',
              op: 'some',
              records: [{ type: props.asset.type, id: props.asset.id }],
            });
          }
          return base.sort(isDone ? 'timestamp' : '-timestamp');
        })
          .then(r => r.flatMap(x => x))
          .catch(() => []),
      );

      logs.value = settled.flat()
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
      // NOTE: these strings are hardcoded in Swedish on purpose. SharedFarmOS is
      // imported directly by the unit tests (tests/AssetLogsPanel.test.js), which
      // only stub `quasar`/`assetlink-plugin-api` and cannot resolve the
      // `plugin-library:org.jorblad.farmos_asset_link.config` import. Every other
      // plugin gets its labels through config.t(); this panel is the one exception.
      h('h5', { class: 'q-my-xs' }, isDone ? 'Klara loggar:' : 'Väntande loggar:'),
      h('div', {
        class: 'col',
        style: 'height:auto;min-height:160px;height:25vh;position:relative;contain:strict;overflow:auto;',
      }, [
        h(QTree, {
          'node-key': 'id',
          nodes: logNodes.value,
          selected: null,
          'no-nodes-label': isDone ? 'Inga klara loggar' : 'Inga väntande loggar',
          class: 'q-ml-md',
          'onUpdate:selected': openLog,
        }, {
          // Render the log name directly. `entitySource.query` returns raw
          // JSON:API records (not hydrated Orbit models), and the global
          // `entity-name` component can't derive a display name from that shape,
          // so it renders empty. The record always carries `attributes.name`,
          // so we use it directly. Fall back to the id if a name is missing.
          'default-header': (prop) => {
            const log = prop.node.log;
            const name = (log && log.attributes && log.attributes.name) || (log && log.id) || '';
            return h('div', { class: 'q-pl-xs text-body2 cursor-pointer' }, name);
          },
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
        requireValue,
      });
    });
  }
}
