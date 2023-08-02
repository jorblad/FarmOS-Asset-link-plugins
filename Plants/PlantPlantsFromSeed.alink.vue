<script setup>
import { inject, ref, watch, onMounted } from 'vue';
import { useDialogPluginComponent } from 'quasar'
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

const seedCount = ref(0);
const notes = ref(null);

// Create a function to fetch assetLink and store it in the ref
const fetchAssetLink = async () => {
  assetLink.value = await getAssetLink(); // Replace getAssetLink with your code to retrieve assetLink
};

// Fetch the assetLink on component mount
onMounted(fetchAssetLink);


const seasonsOptions = ref([]);
const plantTypesOptions = ref([]);
const seedAssetsOptions = ref([]);

const findseasons = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--season')
  );

  const seasons = results.flatMap((l) => l);

  console.log('All taxonomy_term--season records:', seasons);

  // Extract the attributes.name from each element and return as a list
  return seasons.map((season) => season.attributes.name);
};

const findplanttypes = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--plant_type')
  );

  const plant_types = results.flatMap((l) => l);

  console.log('All taxonomy_term--plant_type records:', plant_types);

  // Extract the attributes.name from each element and return as a list
  return plant_types.map((plant_type) => plant_type.attributes.name);
};

const findseedassets = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('asset--seed')
  );

  const seed_assets = results.flatMap((l) => l);

  console.log('All asset--seed records:', seed_assets);

  // Extract the attributes.name from each element and return as a list
  return seed_assets.map((seed_asset) => seed_asset.attributes.name);
};

const seasons = ref([]);
const plant_types = ref([]);
const seed_assets = ref([]);


onMounted(async () => {
  seasons.value = await findseasons(assetLink.entitySource);
  plant_types.value = await findplanttypes(assetLink.entitySource);
  seed_assets.value = await findseedassets(assetLink.entitySource);
  
  
});

const plantSeason = ref(null);
const plantType = ref(null);
const seedAsset = ref(null);

const seasonsFilterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase();
    seasonsOptions.value = seasons.value.filter((season) =>
      season.toLowerCase().indexOf(needle) > -1
    );
  });
};

const plantTypesFilterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase();
    plantTypesOptions.value = plant_types.value.filter((plant_type) =>
      plant_type.toLowerCase().indexOf(needle) > -1
    );
  });
};

const seedAssetsFilterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase();
    seedAssetsOptions.value = seed_assets.value.filter((seed_asset) =>
      seed_asset.toLowerCase().indexOf(needle) > -1
    );
  });
};

const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, plantType: plantType.value, notes: notes.value, seedAsset: seedAsset.value });
};

// Define a ref for presetting plantType
const presetPlantType = ref(null);


// Watch for changes in the selected seedAsset
watch(seedAsset, async (newValue) => {
  if (newValue) {
    try {
      // Perform actions based on the selected seedAsset
      //console.log('Selected seedAsset:', newValue);

      const seed = await assetLink.entitySource.query((q) =>
        q.findRecords('asset--seed').filter({ attribute: 'name', op: 'equal', value: newValue })
      );
      //console.log('Seed object', seed);

      // Extract the relationships, specifically the plant_type ID
      const plantTypeRelationship = seed[0].relationships.plant_type;
      const plantTypeId = plantTypeRelationship.data[0].id;

      // Perform further actions with plantTypeId if needed
      //console.log('Plant Type ID:', plantTypeId);

      const SeedPlantType = await assetLink.entitySource.query((q) =>
        q.findRecords('taxonomy_term--plant_type').filter({ attribute: 'id', op: 'equal', value: plantTypeId })
      );
      const seedPlantName = SeedPlantType[0].attributes.name;
      console.log('Plant Type:', seedPlantName)

      // Set presetPlantType to the extracted name
      presetPlantType.value = seedPlantName;

    } catch (error) {
      console.error('Error fetching seed:', error);
    }
  }
});

// Watch for changes in presetPlantType and update plantType accordingly
watch(presetPlantType, (newValue) => {
  if (newValue) {
    plantType.value = newValue;
  }
});

// Watch for changes in the selected plantType
watch(plantType, (newValue) => {
  if (newValue) {
    // Perform actions based on the selected plantType
    //console.log('Selected plantType:', newValue);
    // Your custom logic here...
  }
});

const addNewPlantSeason = () => {
    if (plantSeason && !seasons.value.includes(plantSeason)) {
        seasons.value.push(plantSeason);
        plantSeason = plantSeason.toLowerCase(); // Adding the new value to the list
    }
};

const addNewPlantType = () => {
    if (plantType && !plant_types.value.includes(plantType)) {
        plant_types.value.push(plantType);
        plantType = plantType.toLowerCase(); // Adding the new value to the list
    }
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
        <h4>Planting</h4>
        <div class="q-pa-md">
            <q-slider
                v-model="seedCount"
                :min="0"
                :max="5000"
                :step="1"
                snap
                label
            />
            <q-input
                v-model.number="seedCount"
                type="number"
                filled
                label="How many seeds?"
            />
        </div>
        <div class="q-pa-md">
            <q-select
                filled
                v-model="plantSeason"
                :options="seasonsOptions"
                label="Season"
                use-input
                input-debounce="300"
                datalist
                @filter="seasonsFilterFn"
                new-value-mode="add-unique"
            />
        </div>
        <div class="q-pa-md">
            <q-select
                filled
                v-model="seedAsset"
                :options="seedAssetsOptions"
                label="Seed asset"
                use-input
                input-debounce="300"
                datalist
                @filter="seedAssetsFilterFn"
                new-value-mode="add-unique"
            />
        </div>
        <div class="q-pa-md">
            <q-select
                filled
                v-model="plantType"
                :options="plantTypesOptions"
                label="Species"
                use-input
                input-debounce="300"
                datalist
                @filter="plantTypesFilterFn"
                new-value-mode="add-unique"
            />
        </div>
        <div class="q-pa-md">
            <q-input
                v-model="notes"
                label="Notes"
                filled
                autogrow
            />
        </div>

      
      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
        <q-btn
          color="primary"
          label="Record"
          @click="onSubmit"
          :disabled="seedCount <= 0"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';
import { formatRFC3339, summarizeAssetNames, uuidv4 } from "assetlink-plugin-api";

const UNIT_NAME = "st";

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;

    const findUnitTerm = async entitySource => {
      const results = await entitySource.query(q => q
          .findRecords('taxonomy_term--unit')
          .filter({ attribute: 'name', op: 'equal', value: UNIT_NAME }));
      return results.flatMap(l => l).find(a => a);
    };

    let seedUnitTerm = await findUnitTerm(assetLink.entitySource.cache);

    if (!seedUnitTerm) {
      seedUnitTerm = await findUnitTerm(assetLink.entitySource);
    }

    if (!seedUnitTerm) {
      const unitTermToCreate = {
          type: 'taxonomy_term--unit',
          id: uuidv4(),
          attributes: {
            name: UNIT_NAME,
          },
      };

      seedUnitTerm = await assetLink.entitySource.update(
          (t) => t.addRecord(unitTermToCreate),
          {label: `Add '${UNIT_NAME}' unit`});
    }

    handle.defineSlot('com.example.farmos_asset_link.actions.v0.plant_seed_inventory', action => {
      action.type('asset-action');

      console.log('V0.32')

      action.showIf(({ asset }) => asset.attributes.status !== 'archived'
          // TODO: Implement a better predicate here...
          && (asset.type === 'asset--land' || (asset.type === 'asset--structure' && asset.attributes.structure_type === 'greenhouse')) );

      const doActionWorkflow = async (asset) => {
        try {
            const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
            console.log('Dialog result:', dialogResult);
            const seedCount = dialogResult.seedCount;
            console.log('seedCount', seedCount)
            const plantSeason = dialogResult.plantSeason;
            console.log('plantSeason', plantSeason)
            const plantType = dialogResult.plantType;
            console.log('plantType', plantType)
            const notes = dialogResult.notes;
            console.log('notes', notes)
            const seedAsset = dialogResult.seedAsset;
            console.log('seedAsset', seedAsset)

            const seed = await assetLink.entitySource.query((q) =>
                q.findRecords('asset--seed').filter({ attribute: 'name', op: 'equal', value: seedAsset })
            );
            console.log('Seed object', seed)

            // Extract the id from the first item (if available)
            const seed_id = seed.length > 0 ? seed[0].id : null;

            // If seed array is empty, add a new record
            if (seed.length === 0) {
                const newSeedRecord = {
                    type: 'asset--seed',
                    id: uuidv4(),
                    attributes: {
                        name: seedAsset
                    }
                };

                const addedSeedRecord = await assetLink.entitySource.query((q) =>
                    q.addRecord(newSeedRecord)
                );

                console.log('Added Seed Record', addedSeedRecord);

                // Use the newly added seed record's ID
                const newSeedId = addedSeedRecord.id;
            }

            const plantName = `${plantSeason} ${asset.attributes.name} ${plantType}`;

            const plantID = uuidv4();


            if (!seedCount || seedCount <= 0) {
            return;
            }


            const plant = {
                type: 'asset--plant',
                id: plantID,
                attributes: {
                    name: `${plantName}`,
                    status: 'active',
                },
                relationships: {
                    plant_type: {
                        data: [
                            {
                                type: 'taxonomy_term--plant_type',
                                id: uuidv4(),
                                '$relateByName': {
                                name: plantType,
                                },
                            }
                        ]
                    },
                    season: {
                        data: [
                            {
                                type: 'taxonomy_term--season',
                                id: uuidv4(),
                                '$relateByName': {
                                name: plantSeason,
                                },
                            }
                        ]
                    },
                }
            }

            console.log('plant:', plant)

            const seedQuantity = {
                type: 'quantity--material',
                id: uuidv4(),
                attributes: {
                    measure: 'count',
                    value: {
                        numerator: seedCount,
                        denominator: 1,
                        decimal: `${seedCount}`,
                    },
                    inventory_adjustment: 'decrement',
                },
                relationships: {
                    inventory_asset: {
                    data: {
                        type: 'asset--seed',
                        id: seed_id,
                        }
                    },
                    units: {
                        data: {
                            type: seedUnitTerm.type,
                            id: seedUnitTerm.id,
                        }
                    },
                },
            };

            console.log('seedQuantity:', seedQuantity)

            const plantingLog = {
                type: 'log--seeding',
                attributes: {
                    name: `Planted ${seedCount} seeds`,
                    timestamp: formatRFC3339(new Date()),
                    status: "done",
                    notes: { value: `${notes}` },
                },
                relationships: {
                    asset: {
                        data: [
                            {
                            type: 'asset--plant',
                            id: plantID,
                            }
                        ]
                    },
                    location: {
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
                            type: seedQuantity.type,
                            id: seedQuantity.id,
                            }
                        ]
                    },
                },
            };

            console.log('plantingLog:', plantingLog)


            assetLink.entitySource.update(
            (t) => [
              t.addRecord(plant),
              t.addRecord(seedQuantity),
              t.addRecord(plantingLog),
            ],
            {label: `Plant from seeds`});
        } catch (error) {
            console.error('Error in doActionWorkflow:', error);
        }
        
      };
      try {
        action.component(({ asset }) =>
            h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Plant from seeds" ));
      } catch (error) {
            console.error('Error in doActionWorkflow:', error);
      }
      
    });
  }
}
</script>