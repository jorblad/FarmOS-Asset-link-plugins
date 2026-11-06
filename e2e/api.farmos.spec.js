import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, createQuantity } from './helpers.js';

// Unique suffix per run so repeated e2e runs don't collide on term/asset names.
const run = Date.now();

test.describe('farmOS JSON:API contract used by the Asset-link plugins', () => {
  // ObserveWeather / general quantity creation: a material quantity carries a
  // `measure`, a `value` and a unit reference. farmOS 4.x exposes
  // quantity--material (NOT quantity--standard), so plugins must target it.
  test('creates a unit term and a material quantity with a measure', async ({ request }) => {
    const unit = await createTerm(request, 'unit', `degC-${run}`);
    expect(unit.attributes.name).toBe(`degC-${run}`);

    const qty = await createQuantity(request, {
      measure: 'temperature',
      value: 21.5,
      unitId: unit.id,
    });
    expect(qty.type).toBe('quantity--material');
    expect(qty.attributes.measure).toBe('temperature');
    expect(qty.relationships.units.data.id).toBe(unit.id);
  });

  // Several measure enums should be accepted on quantity--material (the plugins
  // map rainfall/temperature/wind/humidity to these).
  test('accepts the measure enums the weather plugin emits', async ({ request }) => {
    const unit = await createTerm(request, 'unit', `generic-${run}`);
    for (const measure of ['count', 'weight', 'volume', 'length', 'rate', 'ratio', 'time']) {
      const qty = await createQuantity(request, { measure, value: 1, unitId: unit.id });
      expect(qty.attributes.measure, `measure ${measure}`).toBe(measure);
    }
  });

  // Plant asset requires a plant_type; an observation log references the asset.
  test('creates a plant asset and an observation log referencing it', async ({ request }) => {
    const plantType = await createTerm(request, 'plant_type', `tomato-${run}`);
    const plant = await createAsset(request, 'plant', `Plant-${run}`, {
      vocab: 'plant_type',
      id: plantType.id,
    });
    expect(plant.type).toBe('asset--plant');

    const res = await apiCall(request, 'POST', '/api/log/observation', {
      type: 'log--observation',
      attributes: {
        name: `Observation-${run}`,
        timestamp: '2026-11-06T10:00:00Z',
        status: 'done',
      },
      relationships: {
        asset: { data: [{ type: 'asset--plant', id: plant.id }] },
      },
    });
    expect(res.status).toBe(201);
    expect(res.json.data.relationships.asset.data[0].id).toBe(plant.id);
  });

  // Harvest flow: a product asset + a quantity that increments its inventory,
  // referenced by a harvest log. This mirrors HarvestingPlants / HarvestLogPlants.
  test('harvest increments product inventory via a quantity + harvest log', async ({ request }) => {
    const productType = await createTerm(request, 'product_type', `crop-${run}`);
    const product = await createAsset(request, 'product', `Product-${run}`, {
      vocab: 'product_type',
      id: productType.id,
    });

    const unit = await createTerm(request, 'unit', `st-${run}`);
    const qty = await createQuantity(request, {
      measure: 'count',
      value: 5,
      unitId: unit.id,
      inventory: { adjustment: 'increment', bundle: 'product', assetId: product.id },
    });
    expect(qty.attributes.inventory_adjustment).toBe('increment');
    expect(qty.relationships.inventory_asset.data.id).toBe(product.id);

    const res = await apiCall(request, 'POST', '/api/log/harvest', {
      type: 'log--harvest',
      attributes: {
        name: `Harvest-${run}`,
        timestamp: '2026-11-06T10:00:00Z',
        status: 'done',
      },
      relationships: {
        asset: { data: [{ type: 'asset--product', id: product.id }] },
        quantity: { data: [{ type: 'quantity--material', id: qty.id }] },
      },
    });
    expect(res.status).toBe(201);
  });
});
