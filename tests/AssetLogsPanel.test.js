import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { AssetLogsPanel } from '../SharedFarmOS.alink.js';

// Fake assetLink: getLogTypes + a query returning a couple of logs, plus a
// spyable eventBus (the wiring we fixed in the Done/Pending refactor).
function makeAssetLink() {
  return {
    getLogTypes: async () => [
      { attributes: { drupal_internal__id: 'activity' } },
      { attributes: { drupal_internal__id: 'harvest' } },
    ],
    entitySource: {
      query: async () => [
        [
          { id: '1', type: 'log--activity', attributes: { timestamp: '2024-01-01T00:00:00Z', status: 'done' } },
          { id: '2', type: 'log--harvest', attributes: { timestamp: '2024-02-01T00:00:00Z', status: 'pending' } },
        ],
      ],
    },
    eventBus: {
      $on: () => {},
      $off: () => {},
    },
  };
}

describe('AssetLogsPanel', () => {
  it('renders the right heading for done logs', async () => {
    const assetLink = makeAssetLink();
    const on = vi.spyOn(assetLink.eventBus, '$on');
    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'done', asset: null },
      global: { provide: { assetLink } },
    });
    await nextTick();
    expect(wrapper.text()).toContain('Done Logs:');
    expect(on).toHaveBeenCalledWith('changed:assetLogs', expect.any(Function));
  });

  it('renders the right heading for pending logs', async () => {
    const assetLink = makeAssetLink();
    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'pending', asset: null },
      global: { provide: { assetLink } },
    });
    await nextTick();
    expect(wrapper.text()).toContain('Pending Logs:');
  });

  it('unsubscribes from the event bus on unmount (regression guard)', async () => {
    const assetLink = makeAssetLink();
    const off = vi.spyOn(assetLink.eventBus, '$off');
    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'done', asset: null },
      global: { provide: { assetLink } },
    });
    await nextTick();
    wrapper.unmount();
    expect(off).toHaveBeenCalledWith('changed:assetLogs', expect.any(Function));
  });
});
