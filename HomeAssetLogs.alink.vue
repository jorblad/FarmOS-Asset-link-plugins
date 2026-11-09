<script>
import { h, defineComponent } from 'vue';
import { QPage, QBtn } from 'quasar';
import { AssetLogsPanel } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config';

// Done + pending logs across the whole farm.
//
// NOTE: Asset Link has NO home/start-page `page-slot` — the start page is the
// route-based `tasks_page` (a built-in plugin) which does not consume plugin
// page-slots, so the original `slots.v0.home` guess never rendered. Instead we
// expose this as its own route and add a toolbar button (visible on every page,
// including the start page) that navigates to it. Verified against the running
// app: the route renders the two panels and the toolbar button opens it.
const HomeLogsPage = defineComponent({
  setup() {
    return () => h(QPage, { padding: true, class: 'column text-left' }, [
      h('h4', t('homeLogsHeading')),
      h('div', { class: 'q-pa-md' }, [
        h(AssetLogsPanel, { status: 'done', asset: null }),
        h(AssetLogsPanel, { status: 'pending', asset: null }),
      ]),
    ]);
  },
});

const HomeLogsToolbarButton = defineComponent({
  setup() {
    return () => h(QBtn, {
      flat: true,
      dense: true,
      icon: 'mdi-format-list-checks',
      label: t('homeLogs'),
      to: '/jorblad-logs',
    });
  },
});

export default {
  onLoad(handle) {
    handle.defineRoute('se.jorblad.farmos_asset_link.routes.v0.home_logs', (route) => {
      route.path('/jorblad-logs');
      route.component(HomeLogsPage);
    });

    handle.defineSlot('se.jorblad.farmos_asset_link.slots.v0.home_logs_toolbar', (slot) => {
      slot.type('toolbar-item');
      slot.weight(200);
      slot.component(HomeLogsToolbarButton);
    });
  },
};
</script>
