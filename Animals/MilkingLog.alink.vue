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

const milkVolume = ref(0);

const onSubmit = () => {
  onDialogOK({ milkVolume: milkVolume.value });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
      <h4>{{ t('milkHeading', { name: props.asset.attributes.name }) }}</h4>
      <div class="q-pa-md">
      <q-slider
        v-model="milkVolume"
        :min="0"
        :max="50"
        :step="0.5"
        snap
        label
        label-always
      />
      <q-input
        v-model.number="milkVolume"
        type="number"
        :step="0.5"
        filled
        suffix="L"
      />
      </div>

      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" :label="t('cancel')" @click="onDialogCancel" />
        <q-btn
          color="primary"
          :label="t('record')"
          @click="onSubmit"
          :disabled="milkVolume <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';

import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { ensureAsset, ensureTaxonomyTerm, runUpdate, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
import { config, t as translate } from 'plugin-library:org.jorblad.farmos_asset_link.config';


export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    // Animal types (by name, matched case-insensitively as a substring) for which
    // the milking action is offered. Configurable in config.animalTypeMatches.milk.
    const MILK_ANIMAL_TYPE_MATCHES = config.animalTypeMatches.milk;

    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.milkAnimal', action => {

      action.type('asset-action');

      action.showIf(({ asset }) => {
        // farmOS 4.x animals have no `status` attribute — they use the `archived`
        // boolean. Keep both checks so archived assets of either kind are hidden
        // (land/structure use `status`; animals use `archived`).
        if (asset.attributes.archived === true || asset.attributes.status === 'archived') {
          return false;
        }

        // Here we're querying `assetLink.entitySource.cache` which is
        // synchronous and never results in a request to farmOS. That
        // is possible because these relationships will almost always
        // already be loaded on the asset page. It is also necessary
        // since slots cannot have asynchronous `showIf` methods.

        const animalType = asset.type === 'asset--animal' ?
          assetLink.entitySource.cache.query((q) =>
          q.findRelatedRecord(
            { type: asset.type, id: asset.id },
            'animal_type')
          ) : [];

          if (!animalType || !animalType.attributes) {
            return false;
          }
        // Note the difference between `findRelatedRecords` and
        // `findRelatedRecord` (above) which return a list of entities and
        // a single entity respectively. They cannot be used
        // interchangeably - usage must match the cardinality of the
        // relationship.

        // Match the animal type name against the configurable list above
        // (case-insensitive substring match).
        const animalTypeName = animalType.attributes.name.toLowerCase();
        return MILK_ANIMAL_TYPE_MATCHES.some(match =>
          animalTypeName.includes(match.toLowerCase()));
      });


      const doActionWorkflow = async (asset) => {
        const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
        const milkVolume = dialogResult.milkVolume;

        if (!requireValue(milkVolume > 0, translate('milkVolumeGreaterThanZero'))) {
          return;
        }

        // Resolve (or create) the shared milk product inventory. farmOS 4.x
        // requires the product's `product_type` term at creation, so we pass it
        // via `typeTerm` (ensureAsset builds the full `taxonomy_term--product_type`
        // type and creates the term if missing — see AGENTS.md #2).
        const milkProduct = await ensureAsset(
          assetLink,
          config.milk.productName,
          'asset--product',
          { typeTerm: config.milk.productType },
        );

        // Resolve (or create) the litre unit so we reference a real term id
        // instead of relying on $relateByName auto-creation (which can create
        // duplicate terms for e.g. "L" vs "l").
        const unitTerm = await ensureTaxonomyTerm(assetLink, config.units.milk);

        // A material quantity that increments the milk product's inventory.
        const milkQuantity = {
          type: 'quantity--material',
          id: uuidv4(),
          attributes: {
            measure: 'volume',
            value: {
              numerator: milkVolume,
              denominator: 1,
              decimal: `${milkVolume}`,
            },
            inventory_adjustment: 'increment',
          },
          relationships: {
            inventory_asset: {
              data: {
                type: milkProduct.type,
                id: milkProduct.id,
              }
            },
            units: {
              data: {
                type: unitTerm.type,
                id: unitTerm.id,
              }
            },
          },
        };

        const milkLog = {
          type: 'log--harvest',
          attributes: {
            name: translate('milkedFrom', { volume: milkVolume, name: asset.attributes.name }),
            timestamp: formatRFC3339(new Date()),
            status: "done",
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
            quantity: {
              data: [
                {
                  type: milkQuantity.type,
                  id: milkQuantity.id,
                }
              ]
            },
          },
        };

        await runUpdate(assetLink, translate('recordMilkFor', { name: asset.attributes.name }),
            (t) => [
              t.addRecord(milkQuantity),
              t.addRecord(milkLog),
            ],
            { notifySuccess: true });
      };

      action.component(({ asset }) =>
        h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  translate('recordMilking') ));
    });

  }
}
</script>
