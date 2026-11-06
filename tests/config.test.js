import { describe, it, expect } from 'vitest';
import { config, t } from '../config.alink.js';

// Guards the centralized tunables + i18n map. Importing the module directly (as a
// plain ESM module) works because it has no external imports; in the browser it
// is additionally provided as the `org.jorblad.farmos_asset_link.config` library.
describe('config module', () => {
  it('exposes the expected tunables', () => {
    expect(config.locale).toBe('sv');
    expect(config.fallbackLocale).toBe('en');
    expect(config.units.seed).toBe('st');
    expect(config.units.egg).toBe('egg(s)');
    expect(config.units.catch).toBe('St');
    expect(config.inventoryAssets.catch).toBe('Fångade möss');
    expect(config.productTypes.catch).toBe('Catch');
    expect(config.defaultHarvestProductName).toBe('Skörd');
    expect(config.maxDesiredSearchEntries).toBe(200);
    expect(config.weightUnitSentinel).toBe('gram');
    expect(config.structureTypeGreenhouse).toBe('greenhouse');
    expect(Array.isArray(config.animalTypeMatches.egg)).toBe(true);
    expect(Array.isArray(config.observationTypes)).toBe(true);
    expect(config.observationTypes[0].labelKey).toBe('obsRainfall');
  });

  it('keeps the sv and en label maps in sync (same key set)', () => {
    expect(Object.keys(config.labels.sv).sort()).toEqual(
      Object.keys(config.labels.en).sort());
  });

  it('t() translates the active locale with interpolation', () => {
    expect(t('cancel')).toBe('Avbryt');
    expect(t('harvestedFrom', { count: 5, name: 'Tomato' }))
      .toBe('Skördade 5 från Tomato');
  });

  it('t() falls back to fallbackLocale, then to the key', () => {
    const prev = config.locale;
    // Unknown locale -> falls back to en
    config.locale = 'xx';
    expect(t('cancel')).toBe('Cancel');
    // Key missing in both locales -> returns the key itself
    expect(t('thisKeyDoesNotExist')).toBe('thisKeyDoesNotExist');
    config.locale = prev;
  });
});
