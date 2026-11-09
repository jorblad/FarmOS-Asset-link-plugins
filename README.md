# FarmOS-Asset-link-plugins

Asset-link plugins for farmOS

For the gotchas and key reference links (Asset Link, farmOS API, Orbit.js,
JSON:API), see [`AGENTS.md`](AGENTS.md).

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

A page for recording a weather observation: rainfall (mm), temperature (°C), wind speed (m/s), humidity (%), air pressure (hPa) and soil moisture (%). Each maps to a farmOS quantity measure + unit and is saved as an observation log. The available observation types live in `config.observationTypes` (see "Customizing configuration" below).

## Logs

### Done and pending logs

A toolbar button (sv: "Loggar", en: "Logs", visible on every page including the
start page) opens the **`/jorblad-logs`** page, which lists the farm's done
("Klara loggar") and pending ("Väntande loggar") logs together. Unlike the
start page's built-in Tasks view (which groups by upcoming / late / recent),
this page mirrors the asset-page done/pending panels but across the whole farm.
It is implemented as an Asset Link route plus a `toolbar-item` slot
(`HomeAssetLogs.alink.vue`).

## Customizing configuration (per-instance config)

Every tunable constant and user-facing string lives in **`config.alink.js`**:
unit names, inventory/product names, the default harvest product name, the
weather observation types (`config.observationTypes`), the animal-type
predicates (`config.animalTypeMatches`), and the bilingual label map used by
`t(key, vars)`. It is both an Asset Link plugin (consumed via
`plugin-library:org.jorblad.farmos_asset_link.config`) and a plain ESM module the
unit tests import directly.

### Why a file, not a runtime settings screen?

A settings screen inside Asset Link would store the values in the **browser**
(localStorage / IndexedDB), so they would be **per-device**, not per farmOS
instance. For instance-wide settings the right layer is this single source file,
edited once per deployment. (Per-device overrides are therefore intentionally
not supported — if you need them, see the override-plugin caveat below.)

### Running your own config without editing the plugins

1. **Fork this repo (or keep a branch off `main`).** Edit `config.alink.js` to
   suit your farm — rename units, change the default harvest product, add
   observation types, or adjust the animal-type substrings. Nothing else needs
   to change; `config.alink.js` is listed first in `jorblads-plugins.repo.json`
   and every plugin reads it through the shared `config`/`t` imports.
2. **Serve your fork.** Either point your farmOS default-plugin configuration at
   your fork's `jorblads-plugins.repo.json` (see "Registering plugins in farmOS"
   below), or run your own dev server (`npm run dev`) and point Asset Link at
   `http://<host>:5173/jorblads-plugins.repo.json`.
3. **Keep in sync.** Merge upstream `main` periodically. The only file you
   routinely diverge on is `config.alink.js`, so conflicts are easy to resolve.

> **Override-plugin caveat.** An alternative is to leave the upstream plugins
> untouched and add a *separate* plugin that provides a second
> `org.jorblad.farmos_asset_link.config` library on top. That requires a code
> change to the plugins so they *merge* such overrides (not just read the base
> config), and is **not** implemented today. The fork/branch approach above is
> the supported one.

### Registering plugins in farmOS

The farmOS **default-plugin configuration** (`asset_link_default_plugin`
entities, served from `/alink/backend/default-plugins.repo.json`) loads plugins
automatically on every boot and survives clearing browser storage. Each entity is
a **single plugin URL** — it is *not* expanded. In practice:

- **You must register each plugin separately.** Adding the single
  `jorblads-plugins.repo.json` URL as one default-plugin entry does **not** load
  all the plugins: Asset Link fetches the repo.json and then tries to evaluate it
  as a single plugin file, so **zero** plugins end up loading (verified
  empirically against the dev instance).
- `jorblads-plugins.repo.json` is the *manifest* of what should be registered;
  `scripts/setup-farmos.sh` expands it into one `asset_link_default_plugin`
  entity per plugin for you. If you are not using that script, add each plugin
  URL from the manifest as its own entity (or use Asset Link's "Manage Plugins"
  → add a *plugin repository*, which is a client-side list that *does* expand a
  repo.json — but that will not survive a browser-storage wipe the way the
  server-seeded defaults do).

## Development

### Quick checks (no farmOS needed)

- `npm run validate` — parse every `.alink.vue` with Vue's compiler and Node-syntax-check `SharedFarmOS.alink.js`; validates `repo.json` (catches broken-plugin / syntax regressions).
- `npm test` — Vitest unit tests for the shared logic in `SharedFarmOS.alink.js`, mocking `quasar`/`assetlink-plugin-api` so they run without a farmOS.
- `npm run dev` — serve the repo locally (CORS-enabled) so the Asset Link app can fetch plugins cross-origin, e.g. `http://localhost:5173/jorblads-plugins.repo.json`.

### Shared helper library (important)

Asset Link's loader **only resolves a fixed set of bare specifiers** (`vue`, `quasar`, `assetlink-plugin-api`, …) and `plugin-library:<name>` imports — it does **not** support relative imports between plugins. Importing e.g. `../useFarmOS.js` fails at runtime with `Unsupported import`.

All shared code therefore lives in **`SharedFarmOS.alink.js`**, which is both:

- an Asset Link **plugin** (its default export provides the library via `handle.provideLibrary('org.jorblad.farmos_asset_link.helpers', …)`), and
- a plain ESM module (named exports) so the unit tests can import it directly.

Every plugin consumes it through a single import:

```js
import { ensureAsset, ensureTaxonomyTerm, runUpdate, usePhotoCapture, AssetLogsPanel }
  from 'plugin-library:org.jorblad.farmos_asset_link.helpers';
```

`jorblads-plugins.repo.json` lists `SharedFarmOS.alink.js` **first** so the library is registered before the plugins that need it are loaded. (URLs are relative so the same file works locally on `:5173` and, once pushed, on GitHub raw.)

### Local dev instance (farmOS in Docker)

A real farmOS instance (image `jorblad/farmos-k8s`, the same image this project targets) is provided via `docker-compose.yml`. On Apple Silicon it runs emulated (`--platform linux/amd64`); on x86 it runs natively.

```sh
docker compose up -d          # start db + farmOS (port 8080)
./scripts/setup-farmos.sh    # install farmOS (first time) + enable required modules
```

farmOS is then available at:

- `http://localhost:8080/alink` — the Asset Link app (login **admin / admin**)
- `http://localhost:8080/api` — the farmOS JSON:API used by the plugins

Point Asset Link's plugin loader / `jorblads-plugins.repo.json` at the dev server
(`http://localhost:5173/…`) to load the plugins from this repo. The database lives
in a Docker volume, so `docker compose down`/`up` keeps farmOS installed; re-run
`setup-farmos.sh` only after wiping the volume.

### Demo data

`scripts/seed-farmos.mjs` populates the running dev instance with a small,
idempotent set of demo data (units, plant/animal/product/seed/land assets, plus
an observation and a harvest log) so the plugins have something to click through.
Re-running it is safe — existing records (matched by name) are reused.

```sh
node scripts/seed-farmos.mjs            # against http://localhost:8080 (default)
FARMOS_URL=http://other:8080 node scripts/seed-farmos.mjs
```

### End-to-end tests (Playwright)

`npm run test:e2e` runs the suite in `e2e/`:

- `api.farmos.spec.js` — the JSON:API contract the plugins depend on (units, plant/product assets, quantities with measures, inventory adjustment, observation/harvest logs). These are real writes against the dev farmOS.
- `ui.assetlink.spec.js` — the Asset Link SPA boots and authenticates via farmOS.

The dev instance above must be running first. A separate GitHub Actions workflow
(`.github/workflows/e2e.yml`) spins up farmOS in CI and runs the same suite.

### farmOS 4.x API notes (important for plugin authors)

This farmOS version differs from older docs in ways that affect the plugins:

- The JSON:API is served at **`/api`** (the `farm_api` module), **not** `/jsonapi`.
- Quantities use **`quantity--material`** (with a `measure`, `value` as `{decimal}`, a `units` reference, and optional `inventory_adjustment` + `inventory_asset`). There is **no `quantity--standard`** resource in this version — plugins must target `quantity--material`.
- Assets require their type term: `asset--plant` needs a `plant_type`, `asset--product` needs a `product_type`, etc.
- Assets have **no `status` attribute** in this build — they default to active, so do not send one (it 422s). `land_type` is a `list_string` attribute whose value must be an existing `land_type` entity id (only `other` exists by default).
- Log `timestamp` must be `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds); a UNIX timestamp also works.
- Renovate keeps the dev dependencies up to date (see `renovate.json`).

See `IDEAS.md` for the backlog.
