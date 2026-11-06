import { Notify } from 'quasar';
import { uuidv4 } from "assetlink-plugin-api";

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
    Notify.create({
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
    attributes: { name: assetName, status: 'active' },
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
    Notify.create({
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
      Notify.create({
        type: 'positive',
        message: label,
        icon: 'check_circle',
      });
    }
    return result;
  } catch (err) {
    Notify.create({
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
