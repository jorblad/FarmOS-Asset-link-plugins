// Seeds demo data into the local farmOS dev instance so the Asset Link plugins
// have something to work with (units, plant/animal/product/seed/land assets, and
// a couple of logs). Idempotent: existing records (matched by name) are reused.
//
// Requires the dev instance to be running (see docker-compose.yml +
// scripts/setup-farmos.sh). Override the base URL with FARMOS_URL.
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

const BASE = (process.env.FARMOS_URL || 'http://localhost:8080') + '/api';
const USER = process.env.FARMOS_USER || 'admin';
const PASS = process.env.FARMOS_PASS || 'admin';
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

const HEADERS = {
  'Content-Type': 'application/vnd.api+json',
  Accept: 'application/vnd.api+json',
  Authorization: AUTH,
};

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: HEADERS.Accept, Authorization: AUTH } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()).data;
}

// Find an existing record by name, or create it.
async function findOrCreate(path, type, attributes, { nameField = 'name', relationships = {} } = {}) {
  const existing = (await apiGet(path)).find((d) => d.attributes[nameField] === attributes[nameField]);
  if (existing) {
    console.log(`  reuse   ${type} "${attributes[nameField]}"`);
    return existing;
  }
  const created = await apiPost(path, { type, attributes, relationships });
  console.log(`  created ${type} "${attributes[nameField]}"`);
  return created;
}

async function term(vocab, name) {
  return findOrCreate(
    `/taxonomy_term/${vocab}`,
    `taxonomy_term--${vocab}`,
    { name },
  );
}

async function asset(bundle, name, typeRef) {
  const relationships = {};
  if (typeRef) {
    relationships[typeRef.vocab] = {
      data: { type: `taxonomy_term--${typeRef.vocab}`, id: typeRef.id },
    };
  }
  // NOTE: farmOS 4.x assets have no `status` attribute here; they default to
  // active. Including one causes a 422.
  return findOrCreate(`/asset/${bundle}`, `asset--${bundle}`, { name }, { relationships });
}

async function main() {
  console.log('Seeding demo data into', BASE);

  console.log('Taxonomy terms:');
  const units = {};
  for (const u of ['St', 'mm', '°C', 'm/s', '%', 'kg', 'g', 'L']) units[u] = await term('unit', u);
  const plantTypes = {};
  for (const p of ['Tomato', 'Wheat', 'Apple']) plantTypes[p] = await term('plant_type', p);
  const seasons = {};
  for (const s of ['Spring', 'Summer', 'Autumn', 'Winter']) seasons[s] = await term('season', s);
  const animalTypes = {};
  for (const a of ['Chicken']) animalTypes[a] = await term('animal_type', a);
  const productTypes = {};
  for (const p of ['Crop', 'Egg', 'Wool']) productTypes[p] = await term('product_type', p);
  await term('material_type', 'Compost');

  console.log('Assets:');
  const tomatoPlant = await asset('plant', 'Tomato plant 1', { vocab: 'plant_type', id: plantTypes.Tomato.id });
  await asset('plant', 'Wheat field 1', { vocab: 'plant_type', id: plantTypes.Wheat.id });
  const hen = await asset('animal', 'Hen 1', { vocab: 'animal_type', id: animalTypes.Chicken.id });
  const tomatoProduct = await asset('product', 'Tomato', { vocab: 'product_type', id: productTypes.Crop.id });
  await asset('product', 'Eggs', { vocab: 'product_type', id: productTypes.Egg.id });
  await asset('seed', 'Tomato seeds', { vocab: 'plant_type', id: plantTypes.Tomato.id });
  // land_type is a `list_string` attribute whose value must be an existing
  // `land_type` entity id (only "other" exists by default in this build).
  await findOrCreate('/asset/land', 'asset--land', { name: 'Field A', land_type: 'other' });
  void hen;

  // farmOS wants timestamps as `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds).
  const now = () => new Date().toISOString().slice(0, 19) + 'Z';

  console.log('Logs:');
  // A material quantity that records a temperature observation.
  const obsQuantity = await apiPost('/quantity/material', {
    type: 'quantity--material',
    id: randomUUID(),
    attributes: { measure: 'temperature', value: { decimal: '21.5' } },
    relationships: { units: { data: { type: 'taxonomy_term--unit', id: units['°C'].id } } },
  });

  // An observation on the tomato plant so the Asset Logs panel has something to show.
  await findOrCreate(
    '/log/observation',
    'log--observation',
    { name: 'Demo observation', timestamp: now(), status: 'done' },
    {
      relationships: {
        asset: { data: [{ type: 'asset--plant', id: tomatoPlant.id }] },
        quantity: { data: [{ type: 'quantity--material', id: obsQuantity.id }] },
      },
    },
  );

  // A material quantity that increments the Tomato product inventory.
  const harvestQuantity = await apiPost('/quantity/material', {
    type: 'quantity--material',
    id: randomUUID(),
    attributes: { measure: 'count', value: { decimal: '5' }, inventory_adjustment: 'increment' },
    relationships: {
      units: { data: { type: 'taxonomy_term--unit', id: units.St.id } },
      inventory_asset: { data: { type: 'asset--product', id: tomatoProduct.id } },
    },
  });

  // A harvest on the tomato plant that increments the Tomato product inventory.
  await findOrCreate(
    '/log/harvest',
    'log--harvest',
    { name: 'Demo harvest', timestamp: now(), status: 'done' },
    {
      relationships: {
        asset: { data: [{ type: 'asset--plant', id: tomatoPlant.id }] },
        quantity: { data: [{ type: 'quantity--material', id: harvestQuantity.id }] },
      },
    },
  );

  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
