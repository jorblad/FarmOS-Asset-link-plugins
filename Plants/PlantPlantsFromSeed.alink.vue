<script setup>
import { inject, ref, watch, onMounted,  computed } from 'vue';
import { useDialogPluginComponent } from 'quasar'
import { RacingLocalRemoteAsyncIterator } from 'assetlink-plugin-api';


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
const transPlanting = ref(false)
const harvest = ref(false)
const notes = ref(null);
const transPlantingDate = ref(null)
const transplantLocation = ref(null)
const harvestDate = ref(null)


const seasonsOptions = ref([]);
const plantTypesOptions = ref([]);
const seedAssetsOptions = ref([]);

const maxDesiredSearchEntries = 20;

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
  return results.map((season) => season.attributes.name);
};

const findplanttypes = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('taxonomy_term--plant_type')
  );

  const plant_types = results.flatMap((l) => l);

  console.log('All taxonomy_term--plant_type records:', plant_types);

  // Extract the attributes.name from each element and return as a list
  return plant_types;
};

const findseedassets = async (entitySource) => {
  const results = await entitySource.query((q) =>
    q.findRecords('asset--seed')
  );

  const seed_assets = results.flatMap((l) => l);

  console.log('All asset--seed records:', seed_assets);

  return seed_assets;
};

// const findlocationassets = async (entitySource) => {
//   const results = await entitySource.query((q) =>
//     q.findRelatedRecords({ attribute: 'is_location', op: 'equal', value: true })
//   );

//   const location_assets = results.flatMap((l) => l);

//   console.log('All asset--location records:', location_assets);

//   return location_assets;
// };

const seasons = ref([]);
const plant_types = ref([]);
const seed_assets = ref([]);
const location_assets = ref([]);


onMounted(async () => {
  seasons.value = await findseasons(assetLink.entitySource);
  plant_types.value = await findplanttypes(assetLink.entitySource);
  seed_assets.value = await findseedassets(assetLink.entitySource);
  //location_assets.value = await findlocationassets(assetLink.entitySource);
  plantTypesOptions.value = await findplanttypes(assetLink.entitySource);
  
  
});

const plantSeason = ref(null);
const plantType = ref(null);
const seedAsset = ref(null);
const locationAsset = ref(null);

const seasonsFilterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase();
    seasonsOptions.value = seasons.value.filter((season) =>
      season.toLowerCase().indexOf(needle) > -1
    );
  });
};

const plantTypesFilterFn = (val, update, abort) => {
    update(async () => {
    const needle = val.toLowerCase();
    const filteredPlantTypes = await findplanttypes(assetLink.entitySource);
    plantTypesOptions.value = filteredPlantTypes.filter((plant_type) =>
      plant_type.attributes.name.toLowerCase().indexOf(needle) > -1
    );
  });
};

const seedAssetsFilterFn = async (val, update, abort) => {
  update(async () => {
    const needle = val.toLowerCase();
    const filteredSeedAssets = await findseedassets(assetLink.entitySource);
    seedAssetsOptions.value = filteredSeedAssets.filter((seed_asset) =>
      seed_asset.attributes.name.toLowerCase().indexOf(needle) > -1
    );
    console.log("SeedAssetOptions: ", seedAssetsOptions);
  });
};

/* const locationFilterFn = async (val, update, abort) => {
  update(async () => {
    const needle = val.toLowerCase();
    const filteredLocations = await findlocationassets(assetLink.entitySource);
    seedAssetsOptions.value = filteredLocations.filter((location_asset) =>
      location_asset.attributes.name.toLowerCase().indexOf(needle) > -1
    );
    console.log("locationsOptions: ", locationOptions);
  });
}; */



const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, plantType: plantType.value, notes: notes.value, seedAsset: seedAsset.value, transPlanting: transPlanting.value, transPlantingDate: transPlantingDate.value, transplantLocation: transplantLocation.value, harvestDate: harvestDate.value, harvest: harvest.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
};


watch(seedAsset, async (newValue) => {
  console.log("Type of seed", typeof newValue);
  if (newValue !== null && typeof newValue !== 'string' && newValue.plantTypeID) {
    try {
        // Perform actions based on the selected seedAsset
        console.log('Selected seedAsset:', newValue);

        // Find the corresponding plant type object based on the selected seedAsset's plantTypeID
        const selectedPlantType = plantTypeOptionsWithLabel.value.find(
            (plantTypeObj) => plantTypeObj.value === newValue.plantTypeID
        );
        // Update the plantType with the selected plant type object
        plantType.value = selectedPlantType;

    } catch (error) {
        console.error('Error fetching seed:', error);
    }
  } else {
    // If seedAsset is null or does not have a valid plantTypeID, set plantType to null
    plantType.value = null;
    console.log("Reset planttype")
  }
});








// Watch for changes in the selected plantType
watch(plantType, (newValue) => {
  if (newValue) {
    // Perform actions based on the selected plantType
    console.log('Selected plantType:', newValue);
    // Extract maturity_days from newValue
    const maturityDays = newValue.maturity_days;
    const transplantDays = newValue.transplant_days;

    // Calculate the date after adding maturity_days
    const prefillHarvestDate = new Date();
    prefillHarvestDate.setDate(prefillHarvestDate.getDate() + parseInt(maturityDays));
    console.log("Harvest Date", prefillHarvestDate)
    const harvest_date = new Date(prefillHarvestDate);
    const harvestYear = harvest_date.getFullYear();
    const harvestMonth = (harvest_date.getMonth() + 1).toString().padStart(2, '0');
    const harvestDay = harvest_date.getDate().toString().padStart(2, '0');

    // Update selectedDate with the prefill date
    harvestDate.value = `${harvestYear}/${harvestMonth}/${harvestDay}`;
    console.log("harvestDate: ", harvestDate)

    // Calculate the date after adding transplant_days
    const prefillTransplantDate = new Date();
    prefillTransplantDate.setDate(prefillTransplantDate.getDate() + parseInt(transplantDays));
    console.log("Transplant Date", prefillTransplantDate)
    const transplant_date = new Date(prefillTransplantDate);
    const transplantYear = transplant_date.getFullYear();
    const transplantMonth = (transplant_date.getMonth() + 1).toString().padStart(2, '0');
    const transplantDay = transplant_date.getDate().toString().padStart(2, '0');

    // Update selectedDate with the prefill date
    transPlantingDate.value = `${transplantYear}/${transplantMonth}/${transplantDay}`;
    console.log("transPlantingDate: ", transPlantingDate)
  }
});

// Create a computed property for seed asset options with labels
const plantTypeOptionsWithLabel = computed(() => {
  return plantTypesOptions.value.map((plant_type) => ({
    label: `${plant_type.attributes.name} (${plant_type.attributes.drupal_internal__tid})`,
    value: plant_type.id,
    transplant_days: plant_type.attributes.transplant_days,
    maturity_days: plant_type.attributes.maturity_days
  }));
});

// Create a computed property for seed asset options with labels
const seedAssetOptionsWithLabel = computed(() => {
  return seedAssetsOptions.value.map((seed_asset) => ({
    label: `${seed_asset.attributes.name} (${seed_asset.attributes.drupal_internal__id})`,
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
                clearable
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
                clearable
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
                :options="plantTypeOptionsWithLabel"
                label="Species"
                use-input
                clearable
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
            <q-toggle 
                v-model="transPlanting"
                label="Create transplanting log"
                icon="mdi-sprout"
                size="xl"
                color="green"
            />
        </div>
        <div v-if="transPlanting">
            <div class="q-pa-md">
                <q-input filled v-model="transPlantingDate" mask="date" :rules="['date']" label="Transplanting date">
                    <template v-slot:append>
                        <q-icon name="mdi-calendar" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                            <q-date
                                v-model="transPlantingDate"
                                today-btn
                                subtitle="Transplanting date"
                                first-day-of-week="1"
                            >
                            <div class="row items-center justify-end">
                                <q-btn v-close-popup label="Close" color="primary" flat icon="mdi-close" />
                            </div>
                            </q-date>
                        </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>
            <div class="q-pa-md">
                <entity-select
                label="Transplant location"
                entity-type="asset"
                v-model="transplantLocation"
                additionalFilters="[{ attribute: 'is_location', op: 'eq', value: 'true' }]"
                ></entity-select>
                <!-- <q-select
                    filled
                    v-model="transplantLocation"
                    :options="locationOptions"
                    label="Transplant location"
                    use-input
                    clearable
                    input-debounce="300"
                    datalist
                    @filter="locationFilterFn"
                    new-value-mode="add-unique"
                />  -->
        </div>
            
            
        </div>
        <div class="q-pa-md">
            <q-toggle 
                v-model="harvest"
                label="Create harvest log"
                icon="mdi-basket-outline"
                size="xl"
                color="green"
            />
        </div>
        <div v-if="harvest">
            <div class="q-pa-md">
                <q-input filled v-model="harvestDate" mask="date" :rules="['date']" label="Harvest date">
                    <template v-slot:append>
                        <q-icon name="mdi-calendar" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                            <q-date
                                v-model="harvestDate"
                                today-btn
                                subtitle="Harvest date"
                                first-day-of-week="1"
                            >
                            <div class="row items-center justify-end">
                                <q-btn v-close-popup label="Close" color="primary" flat icon="mdi-close"/>
                            </div>
                            </q-date>
                        </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>
            
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


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.plant_seed_inventory', action => {
      action.type('asset-action');
      action.weight(-10);

      console.log('V0.101')

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
                console.log("Seed name for creaton of new seed", seedAsset)
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

                console.log('New Seed Record', newSeedRecord);
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