// Shared helpers for the e2e suite. Talks to the farmOS JSON:API (farm_api,
// exposed at /api) the way the Asset-link plugins do through the Asset Link
// framework. Credentials default to admin/admin (the dev instance) and can be
// overridden via FARMOS_USER / FARMOS_PASS.
export const FARMOS_URL = process.env.FARMOS_URL || 'http://localhost:8080';
const USER = process.env.FARMOS_USER || 'admin';
const PASS = process.env.FARMOS_PASS || 'admin';

const JSONAPI_HEADERS = {
  'Content-Type': 'application/vnd.api+json',
  Accept: 'application/vnd.api+json',
  Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
};

// Generic JSON:API call. `body` is the resource object (without the wrapping
// { data: ... } — that is added here).
export async function apiCall(request, method, path, body) {
  const res = await request.fetch(`${FARMOS_URL}${path}`, {
    method,
    headers: JSONAPI_HEADERS,
    ...(body ? { data: JSON.stringify({ data: body }) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status(), json };
}

// Create a taxonomy term in the given vocabulary (e.g. "unit", "plant_type",
// "product_type", "season"). Throws on failure so the calling test fails fast.
export async function createTerm(request, vocab, name) {
  const res = await apiCall(request, 'POST', `/api/taxonomy_term/${vocab}`, {
    type: `taxonomy_term--${vocab}`,
    attributes: { name },
  });
  if (res.status !== 201) {
    throw new Error(
      `create taxonomy_term--${vocab} "${name}" failed: ${res.status} ${JSON.stringify(res.json)}`,
    );
  }
  return res.json.data;
}

// Create an asset of the given bundle (e.g. "plant", "product") with a name and
// an optional `{ termVocab, termId }` for the required type reference
// (asset--plant needs plant_type, asset--product needs product_type).
export async function createAsset(request, bundle, name, typeRef) {
  const rel = {};
  if (typeRef) {
    rel[typeRef.vocab] = {
      data: { type: `taxonomy_term--${typeRef.vocab}`, id: typeRef.id },
    };
  }
  const res = await apiCall(request, 'POST', `/api/asset/${bundle}`, {
    type: `asset--${bundle}`,
    attributes: { name },
    relationships: rel,
  });
  if (res.status !== 201) {
    throw new Error(
      `create asset--${bundle} "${name}" failed: ${res.status} ${JSON.stringify(res.json)}`,
    );
  }
  return res.json.data;
}

// Create a material quantity (farmOS 4.x has quantity--material, not
// quantity--standard) with a measure, value and unit reference.
export async function createQuantity(request, { measure, value, unitId, inventory } = {}) {
  const attributes = { measure, value: { decimal: String(value) } };
  const relationships = {
    units: { data: { type: 'taxonomy_term--unit', id: unitId } },
  };
  if (inventory) {
    attributes.inventory_adjustment = inventory.adjustment; // 'increment' | 'decrement'
    relationships.inventory_asset = {
      data: { type: `asset--${inventory.bundle}`, id: inventory.assetId },
    };
  }
  const res = await apiCall(request, 'POST', '/api/quantity/material', {
    type: 'quantity--material',
    attributes,
    relationships,
  });
  if (res.status !== 201) {
    throw new Error(
      `create quantity--material failed: ${res.status} ${JSON.stringify(res.json)}`,
    );
  }
  return res.json.data;
}
