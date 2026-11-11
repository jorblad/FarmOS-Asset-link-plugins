// Central configuration + i18n for the jorblad farmOS Asset Link plugins.
//
// This is the single source of truth for the tunable constants that used to be
// scattered (and duplicated) across the individual plugins — unit names,
// inventory asset / product-type names, the default harvest product name, the
// weather observation types, the "is this a greenhouse / gram weight" sentinels,
// and so on — plus a small bilingual label map for the user-facing UI text.
//
// It is BOTH:
//   - an Asset Link plugin (the default export's onLoad provides the library),
//     so the other plugins can consume it via:
//       import { config, t } from 'plugin-library:org.jorblad.farmos_asset_link.config';
//   - a plain ESM module (the named exports), so unit tests can import it
//     directly without a running Asset Link (the same dual nature as
//     SharedFarmOS.alink.js).
//
// i18n note: Quasar's own i18n / vue-i18n is NOT wired into the Asset Link
// build (only Quasar's QLocale date/number formatting is present, and we have
// no handle to the Quasar app instance), so we use this tiny self-contained
// label map + `t()` helper instead. `config.locale` selects the active
// language; missing keys fall back to `config.fallbackLocale` (en) and then to
// the key itself, so the app never shows a blank label.

export const config = {
  // Active UI language. The farm is Swedish, so sv is the default. Flip this to
  // 'en' to run the UI in English; every visible string has an en fallback.
  locale: 'sv',
  // Used when a key is missing in `locale`.
  fallbackLocale: 'en',

  // --- Tunable constants (the "truly configurable" set) -----------------------

  // Animal-type substrings (matched case-insensitively as a substring of the
  // taxonomy term name) that enable a given harvest action.
  animalTypeMatches: {
    egg: ['chicken', 'kyckling'],
    sheep: ['sheep', 'får'],
    milk: ['cow', 'ko', 'goat', 'get'],
  },

  // Quantity unit names used when creating taxonomy terms. Keep these EXACT:
  // farmOS matches units by name, and e.g. 'st' vs 'St' would create duplicate
  // terms. 'egg(s)' (with the parentheses) is the egg-count unit's literal name.
  units: {
    seed: 'st',
    egg: 'egg(s)',
    catch: 'St',
    milk: 'L',
  },

  // Milking: the milk is recorded against a shared `Mjölk` (milk) product
  // inventory. `productName` is the product asset's name; `productType` is the
  // `product_type` taxonomy term created (if missing) when the product is first
  // ensured. `units.milk` above is the volume unit (litres).
  milk: {
    productName: 'Mjölk',
    productType: 'Milk',
  },

  // Weight / measurement: a one-off measurement recorded against an animal (or
  // any asset) as a `quantity--material` with measure `weight` — NOT an inventory
  // adjustment. `units` maps a unit term name to the farmOS quantity measure it
  // implies; the dialog lets the user pick one.
  weight: {
    units: {
      kg: 'weight',
      g: 'weight',
      hg: 'weight',
    },
  },

  // Feeding: feed given to animals decrements a shared `Foder` (feed) material
  // inventory. `materialName` is the material asset's name; `materialType` is the
  // `material_type` taxonomy term created (if missing) when first ensured.
  // `units` maps a unit term name to the farmOS quantity measure it implies; the
  // dialog lets the user pick one.
  feed: {
    materialName: 'Foder',
    materialType: 'Feed',
    units: {
      kg: 'weight',
      g: 'weight',
      hg: 'weight',
      L: 'volume',
      st: 'count',
    },
  },

  // Manure / compost: manure collected from animals increments a shared `Gödsel`
  // (manure) compost asset inventory. `materialName` is the compost asset's name;
  // `asset--compost` needs no type term. `units` maps a unit term name to the
  // farmOS quantity measure it implies. Requires the `farm_compost` module (in
  // setup-farmos.sh's MODULES) so the compost asset type exists.
  compost: {
    materialName: 'Gödsel',
    units: {
      kg: 'weight',
      g: 'weight',
      hg: 'weight',
    },
  },

  // Animal exit (butchering / sale): archive an animal and optionally record a
  // meat weight that increments a shared `Kött` (meat) product inventory.
  // `meatProductName`/`meatProductType` create the product on first use; `units`
  // maps a unit term name to the farmOS quantity measure it implies. The animal
  // is archived by setting its `archived` boolean (assets have no `status`
  // attribute — see AGENTS.md #5), not `status`.
  exit: {
    meatProductName: 'Kött',
    meatProductType: 'Meat',
    logType: 'log--activity',
    units: {
      kg: 'weight',
      g: 'weight',
      hg: 'weight',
    },
  },

  // Inventory asset + product-type names created on first use (catch/mouse trap).
  inventoryAssets: {
    catch: 'Fångade möss',
  },
  productTypes: {
    catch: 'Catch',
  },

  // Default product name when a harvest has no crop/variety to name it after.
  defaultHarvestProductName: 'Skörd',

  // Max entries pulled from the search API before giving up (a perf guard used
  // by the plant-from-seed type-ahead selectors).
  maxDesiredSearchEntries: 200,

  // Sentinel unit name whose presence flips a harvest measure from 'count' to
  // 'weight' (e.g. wool weighed in grams vs. counted in pieces).
  weightUnitSentinel: 'gram',

  // Asset structure_type that counts as a greenhouse for the planting predicates.
  structureTypeGreenhouse: 'greenhouse',

  // Weather observation types. `unit` / `measure` / `suffix` are farmOS-technical
  // values (must stay as-is); `labelKey` resolves to a localized label via t().
  observationTypes: [
    { labelKey: 'obsRainfall',    measure: 'length',      unit: 'mm',  suffix: 'mm' },
    { labelKey: 'obsTemperature', measure: 'temperature', unit: '°C', suffix: '°C' },
    { labelKey: 'obsWindSpeed',   measure: 'rate',        unit: 'm/s', suffix: 'm/s' },
    { labelKey: 'obsHumidity',    measure: 'ratio',       unit: '%',   suffix: '%' },
    // Air pressure / soil moisture added per backlog; the `measure` enum values
    // (e.g. 'pressure') must be confirmed against the running farmOS instance
    // (see IDEAS.md "ObserveWeather measures"). 'ratio' % is used for moisture.
    { labelKey: 'obsAirPressure',  measure: 'pressure', unit: 'hPa', suffix: 'hPa' },
    { labelKey: 'obsSoilMoisture', measure: 'ratio',    unit: '%',   suffix: '%' },
  ],

  // --- Bilingual UI label maps ------------------------------------------------
  // Keys are stable identifiers (English-ish, for readability). Values are the
  // user-facing strings. Add a key to BOTH maps; t() falls back to en then key.
  labels: {
    sv: {
      // Generic
      cancel: 'Avbryt',
      record: 'Spara',

      // Dialog headings
      resetTrapHeading: 'Återställ fälla {name}?',
      eggHeading: 'Hur många ägg skördade du från {name}?',
      woolHeading: 'Hur mycket ull skördade du från {name}?',
      seedsBoughtHeading: 'Hur många frön köpte du?',
      totalCost: 'Total kostnad',
      harvestPlantHeading: 'Hur mycket skördade du från {name}?',
      harvestLogHeading: 'Hur mycket skördade du?',
      plantingHeading: 'Plantering',
      weatherHeading: 'Registrera en väderobservation',
      maintenanceHeading: 'Beskriv underhållet för {name}',
      milkHeading: 'Hur mycket mjölk mjölkade du från {name}?',
      weightHeading: 'Hur mycket vägde {name}?',
      weightUnit: 'Enhet',
      weightQuantityRequired: 'Ange en vikt större än 0.',
      feedHeading: 'Hur mycket foder gav du {name}?',
      feedUnit: 'Enhet',
      feedQuantityRequired: 'Ange en fodermängd större än 0.',
      compostHeading: 'Hur mycket gödsel samlade du från {name}?',
      compostUnit: 'Enhet',
      compostQuantityRequired: 'Ange en mängd gödsel större än 0.',
      exitHeading: 'Vad hände med {name}?',
      exitArchiveAnimal: 'Arkivera djuret',
      exitMeatWeight: 'Köttvikt',
      exitMeatUnit: 'Enhet',
      exitMeatWeightRequired: 'Ange en köttvikt större än 0.',
      exitNotes: 'Anteckningar',
      exitAction: 'Avsluta / slakta / sälj',
      exitLogName: 'Avslut {name}',

      // Field / select labels
      selectAction: 'Välj åtgärd',
      observationType: 'Observationstyp',
      valueLabel: 'Värde ({suffix})',
      measurement: 'Mängd',
      unit: 'Enhet',
      product: 'Produkt',
      productOptional: 'Produkt (valfritt)',
      seller: 'Säljare',
      invoiceNumber: 'Fakturanummer',
      lotNumber: 'Partinummer',
      transplantLocation: 'Omplanteringsplats',
      transplantLocationForAsset: 'Omplanteringsplats för tillgång {name} {i}',
      seedsPlantingCount: 'Hur många frön/växter planterar du?',
      season: 'Säsong',
      createMultipleAssets: 'Skapa flera tillgångar',
      createPlantingLog: 'Skapa planteringslogg',
      seedAsset: 'Frötillgång',
      species: 'Art',
      notes: 'Anteckningar',
      createTransplantingLog: 'Skapa omplanteringslogg',
      transplantingDate: 'Omplanteringsdatum',
      close: 'Stäng',
      createHarvestLog: 'Skapa skördelogg',
      harvestDate: 'Skördedatum',

      // Validation rules / messages
      seedCountRequired: 'Fröantal måste vara större än 0',
      seasonRequired: 'Säsong krävs',
      seedRequired: 'Frö krävs',
      speciesRequired: 'Art krävs',
      transplantLocationRequired: 'Omplanteringsplats krävs',
      selectUnitBeforeHarvest: 'Välj en enhet innan du registrerar skörden.',
      harvestQtyGreaterThanZero: 'Ange en skördemängd större än 0.',
      maintenanceDescriptionRequired: 'Ange en beskrivning av underhållet.',
      milkVolumeGreaterThanZero: 'Ange en mjölkmängd större än 0.',
      seedCountGreaterThanZero: 'Ange ett fröantal större än 0.',
      transplantDestRequired: 'Välj en destinationsplats innan du omplanterar.',
      measurementValueRequired: 'Ange ett mätvärde innan du registrerar.',

      // Tooltip
      disableToggleTransplant: 'Inaktivera denna växling om du omplanterar direkt.',

      // Action button labels (asset-action chips)
      recordHarvest: 'Registrera skörd',
      buyNewSeeds: 'Köp nya frön',
      water: 'Vattna',
      recordReset: 'Registrera återställning',
      harvest: 'Skörda',
      transplantPlant: 'Omplantera växt',
      plantPlants: 'Plantera',
      recordMaintenance: 'Underhåll',
      recordMilking: 'Mjölka',
      weigh: 'Väg',
      feed: 'Utfodra',
      manure: 'Gödsel',

      // Reset-trap action options
      resetTrap: 'Återställ fälla',
      emptyTrap: 'Töm fälla',
      putTogetherAndEmptyTrap: 'Sätt ihop och töm fälla',

      // Reset-trap action names (used in the log title)
      resetAction: 'Återställ',
      emptyAction: 'Töm',
      putTogetherAndEmptyAction: 'Sätt ihop och töm',

      // Observation type labels
      obsRainfall: 'Nederbörd',
      obsTemperature: 'Temperatur',
      obsWindSpeed: 'Vindhastighet',
      obsHumidity: 'Luftfuktighet',
      obsAirPressure: 'Lufttryck',
      obsSoilMoisture: 'Jordfuktighet',

      // Related-equipment panel
      relatedEquipment: 'Relaterad utrustning',
      loading: 'Laddar…',
      noRelatedEquipment: 'Ingen annan utrustning hittades',

      // Log names / runUpdate labels (static parts; {placeholders} are filled in)
      harvestedFrom: 'Skördade {count} från {name}',
      recordEggHarvestFor: 'Registrera äggskörd för {name}',
      recordWoolHarvestFor: 'Registrera ullskörd för {name}',
      recordHarvestFor: 'Registrera skörd för {name}',
      recordHarvest: 'Registrera skörd',
      boughtSeeds: 'Köpte {count} frön',
      buyNewSeedsLabel: 'Köp nya frön',
      waterName: 'Vattna {name}',
      recordWaterFor: 'Registrera vattning för {name}',
      recordResetFor: 'Registrera återställning {name}',
      measuredObs: 'Mätte {value} {unit} {label}',
      recordObs: 'Registrera {label} observation',
      transplantName: 'Omplantera {name}',
      transplantFor: 'Omplantera {name}',
      plantedSeeds: 'Planterade {count} frön',
      addNewSeeds: 'Lägg till nya frön',
      createPlantsFromSeeds: 'Skapa {count} växt(er) från frön',
      plantFromSeeds: 'Plantera från frön',
      createTransplantingLogs: 'Skapa omplanteringsloggar',
      createHarvestLog: 'Skapa skördelogg',
      harvestName: 'Skörda {name}',
      maintenanceName: 'Underhåll: {name}',
      recordMaintenanceFor: 'Registrera underhåll för {name}',
      milkedFrom: 'Mjölkade {volume} L från {name}',
      recordMilkFor: 'Registrera mjölkning för {name}',
      weighedAnimal: 'Vägde {name}',
      recordWeightFor: 'Registrera vägning för {name}',
      fedTo: 'Utfodrade {name}',
      recordFeedFor: 'Registrera utfodring för {name}',
      recordedManure: 'Gödsel från {name}',
      recordManureFor: 'Registrera gödsel för {name}',

      // Warnings (notify)
      seedsLedgerDisabled: 'Frön: farm_ledger-modulen är inte aktiverad, så "{action}" är inaktiverad.',
      seedsLedgerDisabledCaption: 'Aktivera farm_ledger i farmOS för att registrera fröinköp med pris.',
    },

    en: {
      // Generic
      cancel: 'Cancel',
      record: 'Record',

      // Dialog headings
      resetTrapHeading: 'Reset trap {name}?',
      eggHeading: 'How many eggs did you harvest from {name}?',
      woolHeading: 'How much wool did you harvest from {name}?',
      seedsBoughtHeading: 'How many seeds did you buy?',
      totalCost: 'Total cost',
      harvestPlantHeading: 'How much did you harvest from {name}?',
      harvestLogHeading: 'How much did you harvest?',
      plantingHeading: 'Planting',
      weatherHeading: 'Record a weather observation',
      maintenanceHeading: 'Describe the maintenance for {name}',
      milkHeading: 'How much milk did you milk from {name}?',
      weightHeading: 'How much did {name} weigh?',
      weightUnit: 'Unit',
      weightQuantityRequired: 'Enter a weight greater than 0.',
      feedHeading: 'How much feed did you give {name}?',
      feedUnit: 'Unit',
      feedQuantityRequired: 'Enter a feed quantity greater than 0.',
      compostHeading: 'How much manure did you collect from {name}?',
      compostUnit: 'Unit',
      compostQuantityRequired: 'Enter a manure amount greater than 0.',
      exitHeading: 'What happened to {name}?',
      exitArchiveAnimal: 'Archive the animal',
      exitMeatWeight: 'Meat weight',
      exitMeatUnit: 'Unit',
      exitMeatWeightRequired: 'Enter a meat weight greater than 0.',
      exitNotes: 'Notes',
      exitAction: 'Exit / butcher / sell',
      exitLogName: 'Exit {name}',

      // Field / select labels
      selectAction: 'Select Action',
      observationType: 'Observation type',
      valueLabel: 'Value ({suffix})',
      measurement: 'Measurement',
      unit: 'Unit',
      product: 'Product',
      productOptional: 'Product (optional)',
      seller: 'Seller',
      invoiceNumber: 'Invoice number',
      lotNumber: 'Lot number',
      transplantLocation: 'Transplant location',
      transplantLocationForAsset: 'Transplant location for asset {name} {i}',
      seedsPlantingCount: 'How many seeds/plants are you planting?',
      season: 'Season',
      createMultipleAssets: 'Create multiple assets',
      createPlantingLog: 'Create planting log',
      seedAsset: 'Seed asset',
      species: 'Species',
      notes: 'Notes',
      createTransplantingLog: 'Create transplanting log',
      transplantingDate: 'Transplanting date',
      close: 'Close',
      createHarvestLog: 'Create harvest log',
      harvestDate: 'Harvest date',

      // Validation rules / messages
      seedCountRequired: 'Seed Count is required to be more than 0',
      seasonRequired: 'Season is required',
      seedRequired: 'Seed is required',
      speciesRequired: 'Species is required',
      transplantLocationRequired: 'Transplant location is required',
      selectUnitBeforeHarvest: 'Select a unit before recording the harvest.',
      harvestQtyGreaterThanZero: 'Enter a harvest quantity greater than 0.',
      maintenanceDescriptionRequired: 'Enter a description of the maintenance.',
      milkVolumeGreaterThanZero: 'Enter a milk volume greater than 0.',
      seedCountGreaterThanZero: 'Enter a seed count greater than 0.',
      transplantDestRequired: 'Select a destination location before transplanting.',
      measurementValueRequired: 'Enter a measurement value before recording.',

      // Tooltip
      disableToggleTransplant: 'Disable this toggle if you are directly transplanting.',

      // Action button labels (asset-action chips)
      recordHarvest: 'Record Harvest',
      buyNewSeeds: 'Buy new seeds',
      water: 'Water',
      recordReset: 'Record Reset',
      harvest: 'Harvest',
      transplantPlant: 'Transplant plant',
      plantPlants: 'Plant plants',
      recordMaintenance: 'Maintenance',
      recordMilking: 'Milk',
      weigh: 'Weigh',
      feed: 'Feed',
      manure: 'Manure',

      // Reset-trap action options
      resetTrap: 'Reset trap',
      emptyTrap: 'Empty trap',
      putTogetherAndEmptyTrap: 'Put together and empty trap',

      // Reset-trap action names (used in the log title)
      resetAction: 'Reset',
      emptyAction: 'Empty',
      putTogetherAndEmptyAction: 'Put together and empty',

      // Observation type labels
      obsRainfall: 'Rainfall',
      obsTemperature: 'Temperature',
      obsWindSpeed: 'Wind speed',
      obsHumidity: 'Humidity',
      obsAirPressure: 'Air pressure',
      obsSoilMoisture: 'Soil moisture',

      // Related-equipment panel
      relatedEquipment: 'Related equipment',
      loading: 'Loading…',
      noRelatedEquipment: 'No other equipment found',

      // Log names / runUpdate labels
      harvestedFrom: 'Harvested {count} from {name}',
      recordEggHarvestFor: 'Record egg harvest for {name}',
      recordWoolHarvestFor: 'Record wool harvest for {name}',
      recordHarvestFor: 'Record harvest for {name}',
      recordHarvest: 'Record harvest',
      boughtSeeds: 'Bought {count} seeds',
      buyNewSeedsLabel: 'Buy new seeds',
      waterName: 'Water {name}',
      recordWaterFor: 'Record water for {name}',
      recordResetFor: 'Record reset {name}',
      measuredObs: 'Measured {value} {unit} {label}',
      recordObs: 'Record {label} observation',
      transplantName: 'Transplant {name}',
      transplantFor: 'Transplant {name}',
      plantedSeeds: 'Planted {count} seeds',
      addNewSeeds: 'Add new seeds',
      createPlantsFromSeeds: 'Create {count} plant(s) from seeds',
      plantFromSeeds: 'Plant from seeds',
      createTransplantingLogs: 'Create transplanting logs',
      createHarvestLog: 'Create harvest log',
      harvestName: 'Harvest {name}',
      maintenanceName: 'Maintenance: {name}',
      recordMaintenanceFor: 'Record maintenance for {name}',
      milkedFrom: 'Milked {volume} L from {name}',
      recordMilkFor: 'Record milking for {name}',
      weighedAnimal: 'Weighed {name}',
      recordWeightFor: 'Record weighing for {name}',
      fedTo: 'Fed {name}',
      recordFeedFor: 'Record feeding for {name}',
      recordedManure: 'Manure from {name}',
      recordManureFor: 'Record manure for {name}',

      // Warnings (notify)
      seedsLedgerDisabled: 'Seeds: the farm_ledger module is not enabled, so "{action}" is disabled.',
      seedsLedgerDisabledCaption: 'Enable farm_ledger in farmOS to record seed purchases with price.',
    },
  },
};

// Translate `key` into the active locale, falling back to `fallbackLocale` and
// finally to the key itself. `vars` is an optional `{ placeholder: value }` map
// substituted into `{placeholder}` slots in the string.
export function t(key, vars) {
  const table = config.labels[config.locale] || {};
  const fallback = config.labels[config.fallbackLocale] || {};
  let str = table[key];
  if (str == null) str = fallback[key];
  if (str == null) str = key;
  if (vars && typeof str === 'string') {
    str = str.replace(/\{(\w+)\}/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m);
  }
  return str;
}

// Provide the config + translator as an Asset Link library so the other plugins
// can import them via plugin-library:org.jorblad.farmos_asset_link.config.
export default class Config {
  static onLoad(handle) {
    handle.provideLibrary('org.jorblad.farmos_asset_link.config', (lib) => {
      lib.provides({ config, t });
    });
  }
}
