<script setup>
import { ref, inject, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { t } from 'plugin-library:org.jorblad.farmos_asset_link.config';

// Rendered as an asset-page panel (see the `equipment_related` slot defined in
// the <script> block below). Receives the current asset as a prop so it can
// exclude itself from the list of "other" equipment.
const props = defineProps({
  asset: { type: Object, required: true },
});

const assetLink = inject('assetLink');
const router = useRouter();

const related = ref([]);
const loading = ref(false);
const error = ref(null);

const resolve = async () => {
  if (!props.asset) return;
  loading.value = true;
  error.value = null;
  try {
    const results = await assetLink.entitySource.query(q =>
      q.findRecords('asset--equipment').sort('name')
    );
    const all = results.flatMap(r => r);
    // Show up to the first 10 other equipment assets (the user asked for "all
    // other equipment or the first 10 or so"). Exclude the current asset.
    related.value = all
      .filter(a => a.id !== props.asset.id)
      .slice(0, 10);
  } catch (e) {
    error.value = e && e.message ? e.message : String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(resolve);
watch(() => props.asset && props.asset.id, resolve);

// Navigate to another equipment asset via Asset Link's router (the same API the
// built-in plugins use: `router.push('/asset/<id>')`).
const open = (rel) => {
  try {
    const ref = rel.attributes?.drupal_internal__id || rel.id;
    router.push(`/asset/${ref}`);
  } catch (e) {
    console.warn('RelatedEquipment: could not navigate to', rel && rel.id, e);
  }
};
</script>

<template>
  <q-card flat bordered class="q-ma-sm">
    <q-card-section>
      <div class="text-subtitle1">{{ t('relatedEquipment') }}</div>
      <div v-if="loading">{{ t('loading') }}</div>
      <div v-else-if="error" class="text-negative">{{ error }}</div>
      <q-list v-else-if="related.length" separator>
        <q-item
          v-for="rel in related"
          :key="rel.id"
          clickable
          v-ripple
          @click="open(rel)"
        >
          <q-item-section>
            <q-item-label>{{ rel.attributes.name }}</q-item-label>
            <q-item-label caption v-if="rel.attributes.type">{{ rel.attributes.type }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <div v-else>{{ t('noRelatedEquipment') }}</div>
    </q-card-section>
  </q-card>
</template>

<script>
import { h } from 'vue';

// Asset-page panel listing other equipment. Uses the same <script setup> +
// <script onLoad> split as the other plugins: the component above is
// `handle.thisPlugin`, and we render it with the current `asset` passed in.
export default {
  onLoad(handle, assetLink) {
    handle.defineSlot('se.jorblad.farmos_asset_link.slots.v0.equipment_related', slot => {
      slot.type('page-slot');
      slot.weight(200);

      // Only on an equipment asset's page.
      slot.showIf(context => !!(context.asset && context.asset.type === 'asset--equipment'));

      slot.component(({ asset }) => h(handle.thisPlugin, { asset }));
    });
  }
};
</script>
