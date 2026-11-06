# FarmOS-Asset-link-plugins
Asset-link plugins for farmOS

## Animal
### Harvesting wool
Plugin that lets you record harvested wool.

### Harvesting egg
Records eggs harvested from an animal, with a count and photos. Only shown for animals whose type name contains "chicken".

## Plants
### Harvesting plants
A plugin that lets you choose what unit you want to record the harvest in.

### Plant plants
A modified version of the planting quickform that creates a plant asset and a planting log with the amount of seeds reduced from the seed asset.
It shows up as a option on land and greenhouse assets and place the plant in that location. It preload the species from the seed asset and if you create transplanting or harvest log it preloads the date based on the species maturity_days and transplant_days.
Season, seed asset and species are created if you input something that dosen't exist. The notes field is going to be added to the planting log.

Like the quickform in farmos you can choose to directly transplant, then it is going to be transplanted now in the location of the asset you started it from.

### Harvest log
A log action on pending harvest logs that records the actual harvest (count + unit) and marks the log done.

### Water plants
Records a watering activity on land, greenhouse, or plant assets, with optional photos.

### Transplanting plants
Records a transplanting log moving a plant to a new location, with optional photos.

## Seeds
### Add seeds to inventory
Depends on the farm_ledger module to register the price and creating a purchase log for the amount of bought seeds.

## Mousetraps
### Reset trap
Emptying a trap, either on its own or while putting it back together, increments the `Fångade möss` product inventory by one `St` (the product asset is resolved by name and created automatically if it does not exist yet). Resetting without emptying does not change inventory.

## Weather
### Observe weather
A page for recording a weather observation: rainfall (mm), temperature (°C), wind speed (m/s) and humidity (%). Each maps to a farmOS quantity measure + unit and is saved as an observation log.

## Development
This repo has a lightweight dev environment, a static validation step and a unit-test suite (no live farmOS required for CI).

- `npm run dev` — serve the repo locally so the assetlink dev loader can fetch plugins, e.g. `http://localhost:5173/Plants/HarvestingPlants.alink.vue`.
- `npm run validate` — parse every `.alink.vue` with Vue's compiler and validate `repo.json` (catches broken-plugin / syntax regressions).
- `npm test` — Vitest unit tests for the shared logic (`useFarmOS.js`, `AssetLogsPanel.js`), mocking `quasar`/`assetlink-plugin-api` so they run without a farmOS.
- Renovate keeps the dev dependencies up to date (see `renovate.json`).

See `IDEAS.md` for the backlog, including a Playwright e2e harness targeting a Dockerized farmOS.
