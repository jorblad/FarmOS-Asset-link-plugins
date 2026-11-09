import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { AssetLogsPanel } from '../SharedFarmOS.alink.js';
import { EntityName } from './quasar-stub.js';

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
    expect(wrapper.text()).toContain('Klara loggar:');
    expect(on).toHaveBeenCalledWith('changed:assetLogs', expect.any(Function));
  });

  it('renders the right heading for pending logs', async () => {
    const assetLink = makeAssetLink();
    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'pending', asset: null },
      global: { provide: { assetLink } },
    });
    await nextTick();
    expect(wrapper.text()).toContain('Väntande loggar:');
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

  it('renders one tree node per returned log (regression guard for the empty panel)', async () => {
    const assetLink = {
      getLogTypes: async () => [
        { attributes: { drupal_internal__id: 'observation' } },
        { attributes: { drupal_internal__id: 'activity' } },
      ],
      entitySource: {
        // Per-type query: return a distinct log for each requested type so we
        // exercise the sequential multi-type path that was previously broken.
        query: async (build) => {
          const chain = {
            _type: null,
            findRecords: (t) => { chain._type = t; return chain; },
            filter: () => chain,
            sort: () => chain,
          };
          try {
            build(chain);
          } catch (e) {
            console.error('MOCK build threw:', e && e.message);
            throw e;
          }
          const type = chain._type.replace('log--', '');
          const log = {
            id: `log-${type}`,
            type: `log--${type}`,
            attributes: { name: `A ${type} log`, timestamp: '2024-01-01T00:00:00Z', status: 'done' },
          };
          return [[log]];
        },
      },
      eventBus: { $on: () => {}, $off: () => {} },
    };

    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'done', asset: null },
      global: { provide: { assetLink }, components: { 'entity-name': EntityName } },
    });

    await flushPromises();
    await nextTick();
    await new Promise((r) => setTimeout(r, 50));
    await flushPromises();
    await nextTick();

    // The panel's job is to gather the logs and hand them to QTree as `nodes`.
    // (QTree itself renders them; we verify the data flow, since the stub QTree
    // doesn't re-render its own DOM on prop change.)
    const qtree = wrapper.findComponent({ name: 'QTree' });
    const nodes = qtree.props('nodes');
    expect(nodes.length).toBe(2);
    expect(nodes[0].log.attributes.name).toBe('A observation log');
    expect(nodes[1].log.attributes.name).toBe('A activity log');
    expect(wrapper.text()).toContain('Klara loggar:');
  });

  it('shows the no-nodes label when the data layer returns nothing', async () => {
    const assetLink = {
      getLogTypes: async () => [{ attributes: { drupal_internal__id: 'observation' } }],
      entitySource: { query: async () => [[]] },
      eventBus: { $on: () => {}, $off: () => {} },
    };
    const wrapper = mount(AssetLogsPanel, {
      props: { status: 'pending', asset: null },
      global: { provide: { assetLink }, components: { 'entity-name': EntityName } },
    });
    await flushPromises();
    await nextTick();
    const qtree = wrapper.findComponent({ name: 'QTree' });
    expect(qtree.props('nodes').length).toBe(0);
    expect(wrapper.text()).toContain('Inga väntande loggar');
  });
});
