<script setup>
import { inject, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config'
const assetLink = inject('assetLink');
const props = defineProps({
  asset: {
    type: Object,
    required: true,
  },
});

defineEmits([
  ...useDialogPluginComponent.emits
]);

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const description = ref('');

const onSubmit = () => {
  onDialogOK({ description: description.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('maintenanceHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-input
          v-model="description"
          type="textarea"
          filled
          autogrow
          :label="t('notes')"
        />
      </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="!description || !description.trim()"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339 } from "assetlink-plugin-api";
import { runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    // Maintenance is a first-class farmOS log type (farm_maintenance). Offer it on
    // equipment and structure assets (the trap already targets asset--equipment).
    const MAINTENANCE_ASSET_TYPES = ['asset--equipment', 'asset--structure'];

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.maintainAsset', action => {

      action.type('asset-action');

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
            && MAINTENANCE_ASSET_TYPES.includes(asset.type));

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const description = (dialogResult.description || '').trim();

        if (!requireValue(description, translate('maintenanceDescriptionRequired'))) {
          return;
        }

        const maintenanceLog = {
          type: 'log--maintenance',
          attributes: {
            name: translate('maintenanceName', { name: asset.attributes.name }),
            timestamp: formatRFC3339(new Date()),
            status: "done",
            // farmOS text/log `notes` is a text_with_summary field; in JSON:API it
            // must be supplied as an object `{ value }` (a plain string is
            // rejected with "value is invalid").
            notes: { value: description },
          },
          relationships: {
            asset: {
              data: [
                {
                  type: asset.type,
                  id: asset.id,
                }
              ]
            },
          },
        };

        await runUpdate(assetLink, translate('recordMaintenanceFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(maintenanceLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('recordMaintenance') ));
    });

  }
}
</script>
