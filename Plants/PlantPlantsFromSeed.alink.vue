<script setup>
import { inject, ref, watch, onMounted,  computed } from 'vue';
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


const seasonsOptions = ref([]);
const plantTypesOptions = ref([]);
const seedAssetsOptions = ref([]);

// Photo adding
const capturedPhotos = ref([]);

const photoCaptureModel = ref(null);
const carouselPosition = ref("capture-photo");

watch(photoCaptureModel, async () => {
  const file = photoCaptureModel.value;

  if (!file) {
    return;
  }

  const fileToArrayBuffer = data => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsArrayBuffer(data);
  });

  const fileName = file.name;
  const fileType = file.type;
  const fileData = await fileToArrayBuffer(file);

  const fileStringData = new Uint8Array(fileData).reduce((data, byte) => {
    return data + String.fromCharCode(byte);
  }, '');

  const fileDataUrl = `data:${fileType};base64, ` + btoa(fileStringData);

  const photoId = uuidv4()

  capturedPhotos.value.push({
    id: photoId,
    fileName,
    fileDataUrl,
  });

  carouselPosition.value = photoId;
});


// Find functions

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
  //return seed_assets.map((seed_asset) => seed_asset.attributes.name);
  return seed_assets;
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

const seedAssetsFilterFn = async (val, update, abort) => {
  update(async () => {
    const needle = val.toLowerCase();
    const filteredSeedAssets = await findseedassets(assetLink.entitySource);
    seedAssetsOptions.value = filteredSeedAssets.filter((seed_asset) =>
      //console.log("Seed asset: ", seed_asset.attributes.name.toLowerCase())
      seed_asset.attributes.name.toLowerCase().indexOf(needle) > -1
    );
    console.log("SeedAssetOptions: ", seedAssetsOptions);
  });
};



const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, plantType: plantType.value, notes: notes.value, seedAsset: seedAsset.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
};

// Define a ref for presetting plantType
const presetPlantType = ref(null);


// Watch for changes in the selected seedAsset
// watch(seedAsset, async (newValue) => {
//   if (newValue) {
//     try {
//       // Perform actions based on the selected seedAsset
//       //console.log('Selected seedAsset:', newValue);

//       const seed = await assetLink.entitySource.query((q) =>
//         q.findRecords('asset--seed').filter({ attribute: 'name', op: 'equal', value: newValue })
//       );
//       //console.log('Seed object', seed);

//       // Extract the relationships, specifically the plant_type ID
//       const plantTypeRelationship = seed[0].relationships.plant_type;
//       const plantTypeId = plantTypeRelationship.data[0].id;

//       // Perform further actions with plantTypeId if needed
//       //console.log('Plant Type ID:', plantTypeId);

//       const SeedPlantType = await assetLink.entitySource.query((q) =>
//         q.findRecords('taxonomy_term--plant_type').filter({ attribute: 'id', op: 'equal', value: plantTypeId })
//       );
//       const seedPlantName = SeedPlantType[0].attributes.name;
//       console.log('Plant Type:', seedPlantName)

//       // Set presetPlantType to the extracted name
//       presetPlantType.value = seedPlantName;

//     } catch (error) {
//       console.error('Error fetching seed:', error);
//     }
//   }
// });


// Watch for changes in the selected seedAsset
watch(seedAsset, async (newValue) => {
  if (newValue) {
    try {
      // Perform actions based on the selected seedAsset
      console.log('Selected seedAsset:', newValue);

      // Extract the relationships, specifically the plant_type ID
      const plantTypeId = newValue.plantTypeID;

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

// Create a computed property for seed asset options with labels
const seedAssetOptionsWithLabel = computed(() => {
  return seedAssetsOptions.value.map((seed_asset) => ({
    label: seed_asset.attributes.name,
    value: seed_asset.id,
    plantTypeID: seed_asset.relationships.plant_type.data[0].id
  }));
});

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
                :options="seedAssetOptionsWithLabel"
                label="Seed asset"
                use-input
                input-debounce="300"
                datalist
                @filter="seedAssetsFilterFn"
                new-value-mode="add-unique"
            />
        </div>
        <div class="q-pa-md">
            <entity-select
            label="Plant Type"
            entity-type="taxonomy_term--plant_type"
            v-model="plantType2"
            ></entity-select>
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

        <div class="q-pa-md">
          <q-carousel
            swipeable
            animated
            navigation
            navigation-icon="mdi-radiobox-marked"
            control-type="flat"
            control-color="orange"
            :arrows="false"
            height="200px"
            v-model="carouselPosition"
          >
            <q-carousel-slide
				v-for="(capturedPhoto, capturedPhotoIdx) in capturedPhotos"
            	:key="capturedPhoto.id"
            	:name="capturedPhoto.id">
              <q-img
                :src="capturedPhoto.fileDataUrl"
                class="rounded-borders full-height"
                fit="contain"
              ></q-img>
            </q-carousel-slide>

            <q-carousel-slide name="capture-photo">
              <photo-input class="q-pb-xl" v-model="photoCaptureModel"></photo-input>
            </q-carousel-slide>
          </q-carousel>
        </div>

      
      <div class="q-pa-sm q-gutter-sm row justify-end">
        <q-btn color="secondary" label="Cancel" @click="onDialogCancel" />
        <q-btn
          color="primary"
          label="Record"
          @click="onSubmit"
          :disabled="seedCount <= 0 || !seedAsset || !plantSeason || !plantType"
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


    handle.defineSlot('se.sj-tech.farmos_asset_link.actions.v0.plant_seed_inventory', action => {
      action.type('asset-action');

      console.log('V0.59')

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
            const photos = dialogResult.capturedPhotos;
            console.log('Photos', photos)
           

            let seed_id;
            // If seed array is empty, add a new record
            if (typeof seedAsset === 'string') {
                seed_id = uuidv4();
                const newSeedRecord = {
                    type: 'asset--seed',
                    id: seed_id,
                    attributes: {
                        name: seedAsset
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
                    }
                };


                assetLink.entitySource.update(
                    (t) => [
                    t.addRecord(newSeedRecord),
                    ],
                    {label: `Add new seeds`});

                console.log('Added Seed Record', newSeedRecord);

            } else {
                // Extract the id from the first item (if available)
                seed_id = seedAsset.value;
            }

            console.log('Final Seed ID', seed_id);

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
                    image: {
                        data: photos.map(({ id, fileName, fileDataUrl }) =>
                            ({
                                type: 'file--file',
                                id,
                                '$upload': {
                                    fileName,
                                    fileDataUrl,
                                }
                            })
                            ),
                        },
                    },
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
                            type: 'taxonomy_term--unit',
                            id: uuidv4(),
                            '$relateByName': {
                            name: UNIT_NAME,
                            },
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