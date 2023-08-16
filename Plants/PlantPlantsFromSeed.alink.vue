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
const harvestDate = ref(null)


const seasonsOptions = ref([]);
const plantTypesOptions = ref([]);
const seedAssetsOptions = ref([]);

const maxDesiredSearchEntries = 200;

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
    console.log("val", val)
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "taxonomy_term",
        entityBundles: ["season"],
        term: val,
    };
    console.log("searchRequest", searchRequest)

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
        console.log("seasonsOptions before update", seasonsOptions)
        seasonsOptions.value = [];
        console.log("seasonsOptions after update", seasonsOptions)
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
    console.log("val", val)
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "taxonomy_term",
        entityBundles: ["plant_type"],
        term: val,
    };
    console.log("searchRequest", searchRequest)

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
        console.log("plantTypesOptions before update", plantTypesOptions)
        plantTypesOptions.value = [];
        console.log("plantTypesOptions after update", plantTypesOptions)
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
    console.log("val", val)
    const searchRequest = {
        id: uuidv4(),
        type: "text-search",
        entityType: "asset",
        entityBundles: ["seed"],
        term: val,
    };
    console.log("searchRequest", searchRequest)

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
        console.log("seedAssetsOptions before update", seedAssetsOptions)
        seedAssetsOptions.value = [];
        console.log("seedAssetsOptions after update", seedAssetsOptions)
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
  onDialogOK({ seedCount: seedCount.value, plantSeason: plantSeason.value, planting: planting.value, plantType: plantType.value, notes: notes.value, seedAsset: seedAsset.value, transPlanting: transPlanting.value, transPlantingDate: transPlantingDate.value, transplantLocation: transplantLocation.value, harvestDate: harvestDate.value, harvest: harvest.value, capturedPhotos: capturedPhotos.value, photoCaptureModel: photoCaptureModel.value });
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
    plantTypeID: seed_asset.entity.relationships.plant_type.data[0].id
  }));
});


const additionalFilters = [
  // Only allow moving to locations
  { attribute: 'is_location', op: 'equal', value: true },
  // Do not allow moving to self
  { attribute: 'drupal_internal__id', op: '<>', value: props.asset.attributes.drupal_internal__id },
];

// Use ref to create reactive variable for input errors
const hasInputErrors = ref(true);

// Create a watch to update hasInputErrors based on input fields
watch(
    [
        () => seedCount,
        () => plantSeason,
        () => seedAsset,
        () => plantType,
        () => transPlantingDate,
        () => transplantLocation,
        () => harvestDate,
    ],
    () => {
    console.log("hasInputError", seedCount.value !== undefined && seedCount.value.$error !== undefined && seedCount.value.$error === true)
  hasInputErrors.value = (
    (seedCount.value !== undefined && seedCount.value.$error !== undefined && seedCount.value.$error === true)
    // Add similar conditions for other input fields
  );
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
                label="How many seeds/plants are you planting?"
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
                :additional-filters="additionalFilters"
                :rules="[val => !!val || 'Transplant location is required']"
                ></entity-select>
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
          :disabled="hasInputErrors"
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

        console.log('Planting plugin: V0.131')

        action.showIf(({ asset }) => asset.attributes.status !== 'archived'
            // TODO: Implement a better predicate here...
            && (asset.type === 'asset--land' || (asset.type === 'asset--structure' && asset.attributes.structure_type === 'greenhouse')) );

        const doActionWorkflow = async (asset) => {
            try {
                const dialogResult = await assetLink.ui.dialog.custom(handle.thisPlugin, { asset });
                console.log('Dialog result:', dialogResult);
                const seedCount = dialogResult.seedCount;
                console.log('seedCount', seedCount)
                const planting = dialogResult.planting;
                console.log('planting', planting)
                const plantSeason = dialogResult.plantSeason;
                console.log('plantSeason', plantSeason)
                let seasonName;
                if (typeof plantSeason === 'string') {
                    seasonName = plantSeason
                } else {
                    seasonName = plantSeason.name
                }
                console.log('seasonName', seasonName)
                const plantType = dialogResult.plantType;
                console.log('plantType', plantType)
                let plantTypeName;
                if (typeof plantType === 'string') {
                    plantTypeName = plantType
                } else {
                    plantTypeName = plantType.name
                }
                const notes = dialogResult.notes;
                console.log('notes', notes)
                const seedAsset = dialogResult.seedAsset;
                console.log('seedAsset', seedAsset)
                const photos = dialogResult.capturedPhotos;
                console.log('Photos', photos)
                const transPlanting = dialogResult.transPlanting;
                console.log('transPlanting', transPlanting)
                const transPlantingDate = dialogResult.transPlantingDate;
                console.log('transPlantingDate', transPlantingDate)
                const transplantLocation = dialogResult.transplantLocation;
                console.log('transplantLocation', transplantLocation)
                const harvest = dialogResult.harvest;
                console.log('harvest', harvest)
                const harvestDate = dialogResult.harvestDate;
                console.log('harvestDate', harvestDate)
            

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
                                        name: plantTypeName,
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

                const plantName = `${seasonName} ${asset.attributes.name} ${plantTypeName}`;

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
                                    name: plantTypeName,
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
                                    name: seasonName,
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
                                    type: 'taxonomy_term--unit',
                                    id: uuidv4(),
                                    '$relateByName': {
                                    name: UNIT_NAME,
                                    },
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
                                    type: 'taxonomy_term--unit',
                                    id: uuidv4(),
                                    '$relateByName': {
                                    name: UNIT_NAME,
                                    },
                                }
                            },
                        },
                    };
                }
                

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
                let transplantingLog;
                if (planting) {
                    transplantingLog = {
                        type: 'log--transplant',
                        attributes: {
                            name: `Transplant ${plantName}`,
                            timestamp: formatRFC3339(new Date(transPlantingDate)),
                            status: "pending",

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
                                    type: transplantLocation.type,
                                    id: transplantLocation.id,
                                    }
                                ]
                            },
                        },
                    };
                } else {
                    transplantingLog = {
                        type: 'log--transplant',
                        attributes: {
                            name: `Transplant ${plantName}`,
                            timestamp: formatRFC3339(new Date()),
                            status: "pending",

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
                }
                

                console.log('transplantingLog:', transplantingLog)

                const harvestLog = {
                    type: 'log--harvest',
                    attributes: {
                        name: `Harvest ${plantName}`,
                        timestamp: formatRFC3339(new Date(harvestDate)),
                        status: "pending",
                        
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
                    },
                };

                console.log('harvestLog:', harvestLog)

                assetLink.entitySource.update(
                    (t) => [
                        t.addRecord(plant),
                        t.addRecord(seedQuantity),
                    ]
                )

                if (planting) {
                    assetLink.entitySource.update(
                    (t) => [
                        t.addRecord(plantingLog),
                    ],
                    {label: `Plant from seeds`});
                }
                
                
                if (transPlanting) {
                    assetLink.entitySource.update(
                        (t) => [
                            t.addRecord(transplantingLog),
                        ],
                        {label: `Create transplanting log`});
                }

                if (harvest) {
                    assetLink.entitySource.update(
                        (t) => [
                            t.addRecord(harvestLog),
                        ],
                        {label: `Create harvest log`});
                }

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