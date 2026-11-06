import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeName,
  ensureTaxonomyTerm,
  ensureAsset,
  runUpdate,
} from '../SharedFarmOS.alink.js';

// Build a fake assetLink. `cacheRecords` / `sourceRecords` are the arrays
// returned by the cache / source `query` (already in the flat shape the code
// expects after `.flatMap(...)`). `updateImpl` can override the create behaviour.
function makeAssetLink({ cacheRecords = [], sourceRecords = [], updateImpl } = {}) {
  return {
    entitySource: {
      cache: { query: async () => cacheRecords },
      query: async () => sourceRecords,
      update:
        updateImpl ||
        (async (mutator) => mutator({ addRecord: (record) => record })),
    },
  };
}

// notify() logs to console (and renders a DOM toast that is a no-op under jsdom
// without a body), so we assert on console output rather than Quasar statics.
let errorSpy, warnSpy, logSpy;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('normalizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeName('  St ')).toBe('St');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('ensureTaxonomyTerm', () => {
  it('returns an existing term found in the cache without creating', async () => {
    const existing = { type: 'taxonomy_term--unit', id: 't1', attributes: { name: 'St' } };
    const assetLink = makeAssetLink({ cacheRecords: [existing] });
    const result = await ensureTaxonomyTerm(assetLink, ' St ');
    expect(result).toBe(existing);
  });

  it('falls back to the source when not in cache', async () => {
    const existing = { type: 'taxonomy_term--unit', id: 't2', attributes: { name: 'mm' } };
    const assetLink = makeAssetLink({ cacheRecords: [], sourceRecords: [existing] });
    const result = await ensureTaxonomyTerm(assetLink, 'mm');
    expect(result).toBe(existing);
  });

  it('creates the term when missing and reuses a normalized name', async () => {
    let created = null;
    const assetLink = makeAssetLink({
      updateImpl: async (mutator) => {
        created = mutator({ addRecord: (r) => r });
        return created;
      },
    });
    const result = await ensureTaxonomyTerm(assetLink, '  St ');
    expect(result.attributes.name).toBe('St');
    expect(created.attributes.name).toBe('St');
  });

  it('toasts (negative) and rethrows when creation fails', async () => {
    const assetLink = makeAssetLink({
      updateImpl: async () => {
        throw new Error('boom');
      },
    });
    await expect(ensureTaxonomyTerm(assetLink, 'St')).rejects.toThrow('boom');
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.at(-1).join(' ')).toContain('Could not create');
  });
});

describe('ensureAsset', () => {
  it('finds an existing asset by name', async () => {
    const existing = { type: 'asset--product', id: 'p1', attributes: { name: 'Tomato' } };
    const assetLink = makeAssetLink({ cacheRecords: [existing] });
    const result = await ensureAsset(assetLink, ' Tomato ', 'asset--product');
    expect(result).toBe(existing);
  });

  it('creates an asset and sets parent when given', async () => {
    let created = null;
    const assetLink = makeAssetLink({
      updateImpl: async (mutator) => {
        created = mutator({ addRecord: (r) => r });
        return created;
      },
    });
    const parent = { type: 'asset--plant', id: 'plant-1' };
    const result = await ensureAsset(assetLink, 'Tomato', 'asset--product', { parentAsset: parent });
    expect(result.attributes.name).toBe('Tomato');
    expect(result.relationships.parent.data).toEqual({ type: parent.type, id: parent.id });
  });

  it('creates without a parent relationship when none given', async () => {
    let created = null;
    const assetLink = makeAssetLink({
      updateImpl: async (mutator) => {
        created = mutator({ addRecord: (r) => r });
        return created;
      },
    });
    await ensureAsset(assetLink, 'Skörd', 'asset--product');
    expect(created.relationships).toBeUndefined();
  });
});

describe('runUpdate', () => {
  it('runs the mutator and toasts success when requested', async () => {
    const assetLink = makeAssetLink();
    const result = await runUpdate(assetLink, 'Do thing', (t) => [t.addRecord({})], {
      notifySuccess: true,
    });
    expect(result).toBeDefined();
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls.at(-1).join(' ')).toContain('Do thing');
  });

  it('does not toast success when notifySuccess is false', async () => {
    const assetLink = makeAssetLink();
    await runUpdate(assetLink, 'Do thing', (t) => [t.addRecord({})]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('toasts failure and rethrows so the workflow can stop', async () => {
    const assetLink = makeAssetLink({
      updateImpl: async () => {
        throw new Error('nope');
      },
    });
    await expect(runUpdate(assetLink, 'Do thing', () => {})).rejects.toThrow('nope');
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.at(-1).join(' ')).toContain('nope');
  });
});
