<script setup>
import { inject, ref, onMounted } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { config, t } from 'plugin-library:org.jorblad.farmos_asset_link.config'
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

const count = ref(config.birth.defaultCount);
// Default the offspring type to the parent's own animal_type; the user can
// override it in the dialog.
const animalTypeName = ref('');
const notes = ref('');

onMounted(async () => {
  try {
    const at = await assetLink.entitySource.cache.query((q) =>
      q.findRelatedRecord({ type: props.asset.type, id: props.asset.id }, 'animal_type')
    );
    if (at && at.attributes && at.attributes.name) {
      animalTypeName.value = at.attributes.name;
    }
  } catch (e) {
    // Non-fatal: the user can still type a type name.
  }
});

const onSubmit = () => {
  onDialogOK({
    count: count.value,
    animalTypeName: animalTypeName.value,
    notes: notes.value,
  });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('birthHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
        <q-input
          v-model.number="count"
          type="number"
          :min="1"
          :step="1"
          filled
          :label="t('birthCount')"
          autofocus
        />
        <q-input
          v-model="animalTypeName"
          type="text"
          filled
          :label="t('birthAnimalType')"
          class="q-mt-sm"
        />
        <q-input
          v-model="notes"
          type="textarea"
          filled
          :label="t('birthNotes')"
          class="q-mt-sm"
        />
      </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="!(count > 0 && animalTypeName)"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureTaxonomyTerm, runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.birthLitter', action => {

      action.type('asset-action');

      action.showIf(({ asset }) =>
        asset.attributes.archived !== true && asset.type === 'asset--animal');

      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const count = Number(dialogResult.count);
        const animalTypeName = (dialogResult.animalTypeName || '').trim();
        const notes = (dialogResult.notes || '').trim();

        if (!requireValue(count > 0, translate('birthCountRequired'))) {
          return;
        }
        if (!requireValue(animalTypeName.length > 0, translate('birthAnimalType'))) {
          return;
        }

        // Resolve (or create) the offspring animal_type term by exact name to
        // avoid duplicate terms; require the full record type per AGENTS.md #2.
        const animalTypeTerm = await ensureTaxonomyTerm(
          assetLink,
          animalTypeName,
          'taxonomy_term--animal_type',
        );

        // Build the N offspring animal assets. Each is linked to the parent via
        // the `parent` relationship and shares the chosen `animal_type`.
        const offspring = [];
        for (let i = 1; i <= count; i++) {
          const offspringId = uuidv4();
          offspring.push({
            type: 'asset--animal',
            id: offspringId,
            attributes: {
              name: translate('offspringName', { parent: asset.attributes.name, i }),
            },
            relationships: {
              animal_type: {
                data: {
                  type: animalTypeTerm.type,
                  id: animalTypeTerm.id,
                },
              },
              // `parent` is a has-many relationship on asset--animal, so it must
              // be an array even for a single parent (a plain object 422s with
              // "data for a hasMany relationship must be an array").
              parent: {
                data: [
                  {
                    type: asset.type,
                    id: asset.id,
                  },
                ],
              },
            },
          });
        }

        // A single birth log referencing all the newborns. Notes is a
        // text_with_summary field and MUST be sent as an object `{ value }`
        // (a plain string 422s — see AGENTS.md #5).
        const birthLog = {
          type: config.birth.logType,
          attributes: {
            name: translate('birthLogName', { name: asset.attributes.name, count }),
            timestamp: formatRFC3339(new Date()),
            status: "done",
            ...(notes ? { notes: { value: notes } } : {}),
          },
          relationships: {
            asset: {
              data: offspring.map((o) => ({ type: o.type, id: o.id })),
            },
          },
        };

        const label = translate('birthLogName', { name: asset.attributes.name, count });
        await runUpdate(assetLink, label,
            (t) => [
              ...offspring.map((o) => t.addRecord(o)),
              t.addRecord(birthLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('birthAction') ));
    });

  }
}
</script>
