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
const planting = ref(true)
const transPlanting = ref(false)
const harvest = ref(false)
const notes = ref(null);
const transPlantingDate = ref(null)
const transplantLocation = ref(null)
const transplantLocations = ref([]);
const harvestDate = ref(null)
const multipleAssets = ref(false)


const seasonsOptions = ref([]);
const plantTypesOptions = ref([]);
const seedAssetsOptions = ref([]);

const maxDesiredSearchEntries = 200;

// Photo adding
import { usePhotoCapture } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
const { capturedPhotos, photoCaptureModel, carouselPosition } = usePhotoCapture()


// Find functions


const FindplantTypes = async () => {
  const searchRequest = {
    id: uuidv4(),
    type: "text-search",
    entityType: "taxonomy_term",
    entityBundles: ["plant_type"],
    term: '',
  };

  let entitySearchResultCursor = assetLink.searchEntities(
    searchRequest,
    "local"
  );

  if (assetLink.connectionStatus.isOnline.value) {
    entitySearchResultCursor = new RacingLocalRemoteAsyncIterator(
      entitySearchResultCursor,
      assetLink.searchEntities(searchRequest, "remote")
    );
  }

  plantTypesOptions.value = []; // Clear the array before populating

  const alreadyFoundEntityIds = new Set();

  let searchIterItem = {};
  while (
    !searchIterItem.done
  ) {
    searchIterItem = await entitySearchResultCursor.next();

    if (
      searchIterItem.value &&
      !alreadyFoundEntityIds.has(searchIterItem.value.entity.id)
    ) {
      alreadyFoundEntityIds.add(searchIterItem.value.entity.id);

      plantTypesOptions.value.push(searchIterItem.value);
    }
  }
};




onMounted(async () => {
  await FindplantTypes();
  
  
});

const plantSeason = ref(null);
const plantType = ref(null);
const seedAsset = ref(null);

const seasonsFilterFn = async (val, update, abort) => {
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "taxonomy_term",
        entityBundles: ["season"],
        term: val,
    };

    let entitySearchResultCursor = assetLink.searchEntities(
        searchRequest,
        "local"
    );

    if (assetLink.connectionStatus.isOnline.value) {
        entitySearchResultCursor = new RacingLocalRemoteAsyncIterator(
        entitySearchResultCursor,
        assetLink.searchEntities(searchRequest, "remote")
        );
    }

    update(() => {
        seasonsOptions.value = [];
    });

    const alreadyFoundEntityIds = new Set();

    let searchIterItem = {};
    while (
        seasonsOptions.value.length < maxDesiredSearchEntries &&
        !searchIterItem.done
    ) {
        searchIterItem = await entitySearchResultCursor.next();

        if (
        searchIterItem.value &&
        !alreadyFoundEntityIds.has(searchIterItem.value.entity.id)
        ) {
        alreadyFoundEntityIds.add(searchIterItem.value.entity.id);

        update(() => {
            seasonsOptions.value.push(searchIterItem.value);
        });
        }
    }
};


const plantTypesFilterFn = async (val, update = () => {}, abort = () => {}) => {
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "taxonomy_term",
        entityBundles: ["plant_type"],
        term: val,
    };

    let entitySearchResultCursor = assetLink.searchEntities(
        searchRequest,
        "local"
    );

    if (assetLink.connectionStatus.isOnline.value) {
        entitySearchResultCursor = new RacingLocalRemoteAsyncIterator(
        entitySearchResultCursor,
        assetLink.searchEntities(searchRequest, "remote")
        );
    }

    update(() => {
        plantTypesOptions.value = [];
    });

    const alreadyFoundEntityIds = new Set();

    let searchIterItem = {};
    while (
        plantTypesOptions.value.length < maxDesiredSearchEntries &&
        !searchIterItem.done
    ) {
        searchIterItem = await entitySearchResultCursor.next();

        if (
        searchIterItem.value &&
        !alreadyFoundEntityIds.has(searchIterItem.value.entity.id)
        ) {
        alreadyFoundEntityIds.add(searchIterItem.value.entity.id);

        update(() => {
            plantTypesOptions.value.push(searchIterItem.value);
        });
        }
    }
};


const seedAssetsFilterFn = async (val, update, abort) => {
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "asset",
        entityBundles: ["seed"],
        term: val,
    };

    let entitySearchResultCursor = assetLink.searchEntities(
        searchRequest,
        "local"
    );

    if (assetLink.connectionStatus.isOnline.value) {
        entitySearchResultCursor = new RacingLocalRemoteAsyncIterator(
        entitySearchResultCursor,
        assetLink.searchEntities(searchRequest, "remote")
        );
    }

    update(() => {
        seedAssetsOptions.value = [];
    });

    const alreadyFoundEntityIds = new Set();

    let searchIterItem = {};
    while (
        seedAssetsOptions.value.length < maxDesiredSearchEntries &&
        !searchIterItem.done
    ) {
        searchIterItem = await entitySearchResultCursor.next();

        if (
        searchIterItem.value &&
        !alreadyFoundEntityIds.has(searchIterItem.value.entity.id)
        ) {
        alreadyFoundEntityIds.add(searchIterItem.value.entity.id);

        update(() => {
            seedAssetsOptions.value.push(searchIterItem.value);
        });
        }
    }
};



const onSubmit = () => {
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, planting: planting.value, plantType: plantType.value, notes: notes.value, seedAsset: seedAsset.value, transPlanting: transPlanting.value, transPlantingDate: transPlantingDate.value, transplantLocation: transplantLocation.value, harvestDate: harvestDate.value, harvest: harvest.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value, multipleAssets: multipleAssets.value, transplantLocations: transplantLocations.value });
};


watch(seedAsset, async (newValue) => {
  if (newValue !== null && typeof newValue !== 'string' && newValue.plantTypeID) {
    try {
        // Perform actions based on the selected seedAsset

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
  }
});


// Watch for changes in the selected plantType
watch(plantType, (newValue) => {
  if (newValue) {
    // Perform actions based on the selected plantType
    // Extract maturity_days from newValue
    const maturityDays = newValue.maturity_days;
    const transplantDays = newValue.transplant_days;

    // Calculate the date after adding maturity_days
    const prefillHarvestDate = new Date();
    prefillHarvestDate.setDate(prefillHarvestDate.getDate() + parseInt(maturityDays));
    const harvest_date = new Date(prefillHarvestDate);
    const harvestYear = harvest_date.getFullYear();
    const harvestMonth = (harvest_date.getMonth() + 1).toString().padStart(2, '0');
    const harvestDay = harvest_date.getDate().toString().padStart(2, '0');

    // Update selectedDate with the prefill date
    harvestDate.value = `${harvestYear}/${harvestMonth}/${harvestDay}`;

    // Calculate the date after adding transplant_days
    const prefillTransplantDate = new Date();
    prefillTransplantDate.setDate(prefillTransplantDate.getDate() + parseInt(transplantDays));
    const transplant_date = new Date(prefillTransplantDate);
    const transplantYear = transplant_date.getFullYear();
    const transplantMonth = (transplant_date.getMonth() + 1).toString().padStart(2, '0');
    const transplantDay = transplant_date.getDate().toString().padStart(2, '0');

    // Update selectedDate with the prefill date
    transPlantingDate.value = `${transplantYear}/${transplantMonth}/${transplantDay}`;
  }
});

watch(planting, (newValue) => {
    if (!newValue) {
        transPlanting.value = true;
    }
});


// Create a computed property for season options with labels
const seasonOptionsWithLabel = computed(() => {
  return seasonsOptions.value.map((season) => ({
    label: `${season.entity.attributes.name} (${season.entity.attributes.drupal_internal__tid})`,
    value: season.entity.id,
    name: season.entity.attributes.name
  }));
});

// Create a computed property for seed asset options with labels
const plantTypeOptionsWithLabel = computed(() => {
  return plantTypesOptions.value.map((plant_type) => ({
    label: `${plant_type.entity.attributes.name} (${plant_type.entity.attributes.drupal_internal__tid})`,
    value: plant_type.entity.id,
    name: plant_type.entity.attributes.name,
    transplant_days: plant_type.entity.attributes.transplant_days,
    maturity_days: plant_type.entity.attributes.maturity_days
  }));
});

// Create a computed property for seed asset options with labels
const seedAssetOptionsWithLabel = computed(() => {
  return seedAssetsOptions.value.map((seed_asset) => ({
    label: `${seed_asset.entity.attributes.name} (${seed_asset.entity.attributes.drupal_internal__id})`,
    value: seed_asset.entity.id,
    name: seed_asset.entity.attributes.name,
    plantTypeID: seed_asset.entity.relationships.plant_type && seed_asset.entity.relationships.plant_type.data && seed_asset.entity.relationships.plant_type.data[0] ? seed_asset.entity.relationships.plant_type.data[0].id : null,
  }));
});


const additionalFilters = [
  // Only allow moving to locations
  { attribute: 'is_location', op: 'equal', value: true },
  // Do not allow moving to self
  { attribute: 'drupal_internal__id', op: '<>', value: props.asset.attributes.drupal_internal__id },
];

</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-gutter-md" style="width: 700px; max-width: 80vw;">
        <q-form
            @submit="onSubmit"
            greedy
        >

        
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
                label="How many seeds/plants are you planting?"
                autofocus
                :rules="[val => val > 0 || 'Seed Count is required to be more than 0']"
            />
        </div>
        <div class="q-pa-md">
             <q-select
                filled
                v-model="plantSeason"
                :options="seasonOptionsWithLabel"
                label="Season"
                use-input
                clearable
                input-debounce="300"
                datalist
                @filter="seasonsFilterFn"
                new-value-mode="add-unique"
                :rules="[val => !!val || 'Season is required']"
            /> 
        </div>
        <div class="q-pa-md">
            <q-toggle 
                v-model="multipleAssets"
                label="Create multiple assets"
                icon="mdi-sprout"
                size="xl"
                color="green"
            />
        </div>
        <div class="q-pa-md">
            <q-toggle 
                    v-model="planting"
                    label="Create planting log"
                    icon="mdi-sprout"
                    size="xl"
                    color="green"
                />
            <q-tooltip
                anchor="bottom middle"
                self="top middle"
                :offset="[0, 10]"
                >
                    Disable this toggle if you are directly transplanting.
            </q-tooltip>

        </div>
        <div v-if="planting">
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
                    :rules="[val => !!val || 'Seed is required']"
                />
            </div>
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
                :rules="[val => !!val || 'Species is required']"
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
        <div v-if="transPlanting && planting">
          <div class="q-pa-md">
            <q-input
              filled
              v-model="transPlantingDate"
              mask="date"
              :rules="['date']"
              label="Transplanting date"
            >
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
          <div v-if="multipleAssets">
            <div v-for="i in seedCount" :key="i" class="q-pa-md">
              <entity-select
                :label="`Transplant location for asset ${plantType.name} ${i}`"
                entity-type="asset"
                v-model="transplantLocations[i - 1]"
                :additional-filters="additionalFilters"
                :rules="[val => !!val || 'Transplant location is required']"
              />
            </div>
        </div>
        <div v-else>
            <div class="q-pa-md">
                <entity-select
                label="Transplant location"
                entity-type="asset"
                v-model="transplantLocation"
                :additional-filters="additionalFilters"
                :rules="[val => !!val || 'Transplant location is required']"
                />
            </div>
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
            type="submit"
            color="primary"
            label="Record"
        />
      </div>
    </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { h } from 'vue';
import { QBtn } from 'quasar';
import { formatRFC3339, uuidv4 } from "assetlink-plugin-api";
import { runUpdate, ensureTaxonomyTerm, normalizeName, requireValue } from 'plugin-library:org.jorblad.farmos_asset_link.helpers';

const UNIT_NAME = "st";

export default {
  async onLoad(handle, assetLink) {
    await assetLink.booted;


    handle.defineSlot('se.jorblad.farmos_asset_link.actions.v0.plant_seed_inventory', action => {
        action.type('asset-action');
        action.weight(-10);

        console.log('Planting plugin: V0.145')

        action.showIf(({ asset }) => asset.attributes.status !== 'archived'
            // TODO: Implement a better predicate here...
            && (asset.type === 'asset--land' || (asset.type === 'asset--structure' && asset.attributes.structure_type === 'greenhouse')) );

        const doActionWorkflow = async (asset) => {
            try {
                const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
                const seedCount = dialogResult.seedCount;
                const planting = dialogResult.planting;
                const plantSeason = dialogResult.plantSeason;
                let seasonName;
                if (typeof plantSeason === 'string') {
                    seasonName = plantSeason
                } else {
                    seasonName = plantSeason.name
                }
                const plantType = dialogResult.plantType;
                let plantTypeName;
                if (typeof plantType === 'string') {
                    plantTypeName = plantType
                } else {
                    plantTypeName = plantType.name
                }
                const notes = dialogResult.notes;
                const seedAsset = dialogResult.seedAsset;
                const photos = dialogResult.capturedPhotos;
                const transPlanting = dialogResult.transPlanting;
                const transPlantingDate = dialogResult.transPlantingDate;
                const transplantLocation = dialogResult.transplantLocation;
                const harvest = dialogResult.harvest;
                const harvestDate = dialogResult.harvestDate;
                const multipleAssets = dialogResult.multipleAssets;
                const transplantLocations = dialogResult.transplantLocations;
                

                if (transplantLocations && transplantLocations.length > 0) {
                    transplantLocations.forEach(location => {

                    });
                }

                let seed_id;
                if (planting) {
                    let newSeedRecord;
                    // If seed array is empty, add a new record
                    if (typeof seedAsset === 'string') {
                        seed_id = uuidv4();
                        newSeedRecord = {
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
                                            name: normalizeName(plantTypeName),
                                            },
                                        }
                                    ]
                                },
                            }
                        };
                

                        await runUpdate(assetLink, `Add new seeds`,
                            (t) => [
                            t.addRecord(newSeedRecord),
                            ]);


                    } else {
                        // Extract the id from the first item (if available)
                        seed_id = seedAsset ? seedAsset.value : null;
                    }
                }


                

                const plantName = `${seasonName} ${asset.attributes.name} ${plantTypeName}`;


                if (!requireValue(seedCount > 0, 'Enter a seed count greater than 0.')) {
                return;
                }

                const plants = [];
                const plantIDs = [];

                for (let i = 0; i < (multipleAssets ? seedCount : 1); i++) {
                const plantID = uuidv4();
                plantIDs.push(plantID);

                const plant = {
                    type: 'asset--plant',
                    id: plantID,
                    attributes: {
                    name: `${plantName} ${multipleAssets ? `${i + 1}` : ''}`,
                    },
                    relationships: {
                    plant_type: {
                        data: [
                        {
                            type: 'taxonomy_term--plant_type',
                            id: uuidv4(),
                            '$relateByName': {
                            name: normalizeName(plantTypeName),
                            },
                        },
                        ],
                    },
                    season: {
                        data: [
                        {
                            type: 'taxonomy_term--season',
                            id: uuidv4(),
                            '$relateByName': {
                            name: normalizeName(seasonName),
                            },
                        },
                        ],
                    },
                    image: {
                        data: photos.map(({ id, fileName, fileDataUrl }) => ({
                        type: 'file--file',
                        id,
                        '$upload': {
                            fileName,
                            fileDataUrl,
                        },
                        })),
                    },
                    },
                };

                plants.push(plant);
                }
                


                // Resolve (or create) the seed unit so we reference a real term
                // id instead of relying on $relateByName auto-creation.
                const seedUnitTerm = await ensureTaxonomyTerm(assetLink, UNIT_NAME);

                let seedQuantity;
                
                if (planting) {
                    seedQuantity = {
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
                } else {
                    seedQuantity = {
                        type: 'quantity--material',
                        id: uuidv4(),
                        attributes: {
                            measure: 'count',
                            value: {
                                numerator: seedCount,
                                denominator: 1,
                                decimal: `${seedCount}`,
                            },
                        },
                        relationships: {
                            units: {
                                data: {
                                    type: seedUnitTerm.type,
                                    id: seedUnitTerm.id,
                                }
                            },
                        },
                    };
                }
                


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
                            data: plantIDs.map(id => ({
                                type: 'asset--plant',
                                id,
                            })),
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

                let transplantingLogs = [];
                if (planting && transPlanting) {
                    if (transplantLocations && transplantLocations.length > 0) {
                        transplantingLogs = plantIDs.map((id, index) => ({
                            type: 'log--transplanting',
                            attributes: {
                                name: `Transplant ${plantName} ${multipleAssets ? `#${index + 1}` : ''}`,
                                timestamp: formatRFC3339(new Date(String(transPlantingDate).replace(/\//g, '-'))),
                                status: "pending",
                            },
                            relationships: {
                                asset: {
                                    data: [
                                        {
                                            type: 'asset--plant',
                                            id,
                                        },
                                    ],
                                },
                                location: {
                                    data: [
                                        {
                                            type: transplantLocations[index].type,
                                            id: transplantLocations[index].id,
                                        },
                                    ],
                                },
                            },
                        }));
                    } else {
                        transplantingLogs = [{
                            type: 'log--transplanting',
                            attributes: {
                                name: `Transplant ${plantName}`,
                                timestamp: formatRFC3339(new Date(String(transPlantingDate).replace(/\//g, '-'))),
                                status: "pending",
                            },
                            relationships: {
                                asset: {
                                    data: plantIDs.map(id => ({
                                        type: 'asset--plant',
                                        id,
                                    })),
                                },
                                location: {
                                    data: [
                                        {
                                            type: transplantLocation.type,
                                            id: transplantLocation.id,
                                        },
                                    ],
                                },
                            },
                        }];
                    }
                } else {
                    transplantingLogs = [{
                        type: 'log--transplanting',
                        attributes: {
                            name: `Transplant ${plantName}`,
                            timestamp: formatRFC3339(new Date()),
                            status: "done",
                        },
                        relationships: {
                            asset: {
                                data: plantIDs.map(id => ({
                                    type: 'asset--plant',
                                    id,
                                })),
                            },
                            location: {
                                data: [
                                    {
                                        type: asset.type,
                                        id: asset.id,
                                    },
                                ],
                            },
                            quantity: {
                                data: [
                                    {
                                        type: seedQuantity.type,
                                        id: seedQuantity.id,
                                    },
                                ],
                            },
                        },
                    }];
                }



                let harvestLog;
                if (harvest) {
                harvestLog = {
                    type: 'log--harvest',
                    attributes: {
                    name: `Harvest ${plantName}`,
                    timestamp: formatRFC3339(new Date(String(harvestDate).replace(/\//g, '-'))),
                    status: "pending",
                    },
                    relationships: {
                    asset: {
                        data: plantIDs.map(id => ({
                        type: 'asset--plant',
                        id,
                        })),
                    },
                    },
                };
                }
                

                

                await runUpdate(assetLink, `Create ${seedCount} plant(s) from seeds`,
                    (t) => [
                        ...plants.map(plant => t.addRecord(plant)),
                        t.addRecord(seedQuantity),
                    ]
                );

                if (planting) {
                    await runUpdate(assetLink, `Plant from seeds`,
                    (t) => [
                        t.addRecord(plantingLog),
                    ]);
                }


                // Update the entity source with the transplanting logs
                if (transPlanting) {
                    await runUpdate(assetLink, `Create transplanting logs`,
                        (t) => [
                            ...transplantingLogs.map(log => t.addRecord(log)),
                        ]
                    );
                }

                if (harvest) {
                    await runUpdate(assetLink, `Create harvest log`,
                        (t) => [
                            t.addRecord(harvestLog),
                        ]
                    );
                }

            } catch (error) {
                console.error('Error in doActionWorkflow:', error);
                console.error('Stack trace:', error.stack);
            }
            
        };
        try {
            action.component(({ asset }) =>
                h(QBtn, { block: true, color: 'secondary', onClick: () => doActionWorkflow(asset), 'no-caps': true },  "Plant plants" ));
        } catch (error) {
                console.error('Error in doActionWorkflow:', error);
        }
      
    });
  }
}
</script>
