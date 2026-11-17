# Ideas backlog

Collected plugin and cross-cutting ideas for the FarmOS Asset-link plugins repo.
Nothing here is implemented yet — use this as a working list.

## New plugins (farmOS domain, fit the farm)

- **Milking log** — **DONE** (PR #45): record milk volume → increment a `Mjölk`
  (milk) product inventory. Near-duplicate of the egg/wool harvest flow.
- **Milking log** — **DONE** (`Animals/MilkingLog.alink.vue`): records a milk
  volume (litres) and increments a shared `Mjölk` product inventory
  (`quantity--material`, measure `volume`, `inventory_adjustment: 'increment'`
  against the `Mjölk` product, referenced by a harvest log). Shown for animals
  whose type name contains "cow"/"ko" or "goat"/"get". Configurable via
  `config.milk` + `config.animalTypeMatches.milk` + `config.units.milk`.
  Verified end-to-end with `e2e/milking.spec.js`.
- **Feeding log** — **DONE** (`Animals/FeedAnimals.alink.vue`): records feed
  given to animals and decrements a shared `Foder` material inventory via a
  `log--input` with a `quantity--material` (`inventory_adjustment: 'decrement'`).
  Shown for all animals. Configurable via `config.feed` (material name/type,
  unit→measure map). Verified end-to-end with `e2e/feeding.spec.js`.
- **Animal exit / butchering / sale** — **DONE** (`Animals/ExitAnimal.alink.vue`):
  a per-animal action that archives the animal (via the `archived` boolean — farmOS
  4.x assets have no `status` attribute, so a plain PATCH of `archived: true`
  returns 200; see AGENTS.md #5) and optionally records a meat weight that
  increments a shared `Kött` (meat) product inventory. Always writes an exit
  `log--activity` referencing the animal, with optional notes (sent as `{ value }`,
  the `text_with_summary` shape). Configurable via `config.exit` (meat product
  name/type + unit→measure map) with sv/en labels. Verified end-to-end with
  `e2e/animal-exit.spec.js`.
- **Birth / litter log** — **DONE** (`Animals/BirthLitter.alink.vue`): a
  per-animal action that creates a litter of N new `asset--animal` assets from a
  parent (each linked via the has-many `parent` relationship, sharing the chosen
  `animal_type`, defaulting to the parent's own type) and writes a single
  `log--birth` referencing all the newborns. Notes are sent as `{ value }`
  (text_with_summary). Configurable via `config.birth` with sv/en labels.
  Verified end-to-end with `e2e/birth-litter.spec.js`.
- **Maintenance log on equipment** — **DONE** (PR #46): farmOS has a
  `maintenance` log type; a quick action on `asset--equipment` /
  `asset--structure` assets opens a dialog for a free-text description and
  creates a `log--maintenance` referencing the asset.
- **Manure / compost** — **DONE** (`Animals/RecordManure.alink.vue`): records
  manure collected from an animal and increments a shared `Gödsel` (manure)
  compost asset inventory. Requires the `farm_compost` module (enabled in
  `setup-farmos.sh`). The amount is a `quantity--material` with
  `inventory_adjustment: 'increment'` pointing at the `asset--compost` inventory,
  referenced by an input log (`log--input`). Shown for all animals; the dialog lets
  you pick the amount and the unit (each unit maps to a measure via
  `config.compost.units`). Verified end-to-end with `e2e/manure-compost.spec.js`.
- **Weight / measurement observation** — **DONE** (`Animals/WeighAnimal.alink.vue`):
  records an animal's weight as a `quantity--material` (measure `weight`)
  referenced by an observation log (`log--observation`). Shown for all animals;
  the dialog offers an amount + unit (mapped to a measure via `config.weight.units`).
  Verified end-to-end with `e2e/weight.spec.js`.

## Cross-cutting / tooling

- **`config.js` module** — **DONE**: implemented as `config.alink.js` (library
  `org.jorblad.farmos_asset_link.config`, exports `config` + `t(key, vars)`). It
  centralizes the tunables previously scattered across plugins — unit names
  (`St`, `mm`, `st`, `°C`, …), inventory asset / product names, default harvest
  product name, observation types, and every user-facing string. Merged in PR #35.
- **i18n / Swedish labels** — **DONE**: `config.alink.js` ships a tiny custom
  label map (`config.locale` defaults to `sv` with `en` fallback) and a `t()`
  helper; plugins now render Swedish UI via `t('key', vars)` instead of hardcoded
  English. (Quasar i18n / vue-i18n is NOT wired into Asset Link, so the custom map
  is used instead.) Merged in PR #35.
- **Hide `TestMap` from production** — **DONE**: `TestMap.alink.vue` already lives
  in the repo but is NOT listed in `jorblads-plugins.repo.json`, so it never ships.
  Confirmed via grep; no further action needed.
- **Make the egg/wool/sheep animal-type predicates configurable at runtime** —
  **DEFERRED (decided)**: the substrings are already centralized in
  `config.animalTypeMatches` (editable in one place, no code duplication). A
  runtime settings screen was considered but **rejected** — it would store
  values in the browser, making them *per-device*, whereas these are
  instance-wide settings. Instead, per-instance customization is done by
  forking/branching and editing `config.alink.js` (documented in README →
  "Customizing configuration (per-instance config)"). A runtime editor remains
  an option only if per-device overrides are ever actually wanted.
- **Single `repo.json` for default-plugin registration?** — **ANSWERED (no)**:
  verified empirically that adding the single `jorblads-plugins.repo.json` URL
  as one farmOS `asset_link_default_plugin` entry does **not** load the plugins
  (Asset Link treats each default-plugin entry as one plugin file, not a nested
  repo). You must register each plugin separately; `scripts/setup-farmos.sh`
  expands the manifest into one entity per plugin. Documented in README →
  "Registering plugins in farmOS" and AGENTS.md #10.
- **ObserveWeather measures** — **DONE (verify)**: added `obsAirPressure`
  (`measure: 'pressure'`) and `obsSoilMoisture` (`measure: 'ratio'`) to
  `config.observationTypes` + labels. The `measure` enum values must be
  confirmed against the running farmOS (esp. `'pressure'`) — that's the exact
  "double-check farmOS accepts the measure enum" caveat from the original idea.
- **Home-page Done/Pending slot id** — **SKIPPED (superseded by built-in
  Tasks page)**: verified that Asset Link has **no** home/start-page `page-slot`
  — the start page is the route-based `tasks_page` (a built-in plugin) which
  already lists the farm's logs (upcoming / late / recent) and does not consume
  plugin page-slots, so a custom home logs page was redundant. The
  `HomeAssetLogs` route + toolbar button was removed. The per-asset
  `DoneAssetLogs` / `PendingAssetLogs` panels (which also rendered
  `AssetLogsPanel`) were later removed as well — the built-in Tasks page already
  covers the same logs view. With no remaining consumers, the `AssetLogsPanel`
  component itself was also removed from `SharedFarmOS.alink.js` along with its
  unit test (`tests/AssetLogsPanel.test.js`) and the `tests/quasar-stub.js` helper
  it alone used.
- **Related-equipment panel** — **DONE**: new `Equipment/RelatedEquipment.alink.vue`
  renders a `page-slot` on any `asset--equipment` page listing the first ~10 other
  equipment assets (clickable to navigate). Registered in `repo.json`.
- **Reset-trap comments field** — **DONE**: added a `notes` textarea to the
  reset-trap dialog; the value is stored on the resulting `log--activity`'s
  `notes` attribute (same shape as the planting log).

## Verification TODO (not yet confirmed at runtime)

- Relative sibling imports (`../usePhotoCapture.js`, `../useFarmOS.js`) —
  confirmed to compile, but not yet verified to load
  in the running app. Load the photo-dialog plugins and the shared-helper
  plugins once to confirm.

## E2E test harness (DONE)

- A Playwright suite now drives a real farmOS dev instance (the
  `jorblad/farmos-k8s:v4.0.9.2` image) — see `docker-compose.yml`,
  `scripts/setup-farmos.sh`, `playwright.config.js`, `e2e/`.
  - `e2e/api.farmos.spec.js`: JSON:API contract the plugins depend on (units,
    plant/product assets, `quantity--material` with measures, inventory
    adjustment, observation/harvest logs).
  - `e2e/ui.assetlink.spec.js`: Asset Link SPA boots and authenticates via farmOS.
  - `e2e/plugins-load.spec.js`: smoke test that **every** plugin in
    `jorblads-plugins.repo.json` is served 200, fetched by the browser, and
    executes without errors — guards against server-side default-plugin seed
    drift and the Service-Worker `models.json` 403 gotcha (AGENTS.md #1). It also
    asserts the app reaches "Online" and that a config-consumer version marker
    appears (proves the shared `config.alink.js` `plugin-library:` dependency
    resolved).
- CI: `.github/workflows/e2e.yml` spins up farmOS in CI (x86 → native, fast) and
  runs the suite.
- Key farmOS 4.x findings captured in README: API base is `/api` (farm_api), not
  `/jsonapi`; quantities are `quantity--material` (no `quantity--standard`);
  assets need their type term (plant_type, product_type, …). These affect plugin
  code — `quantity--standard` references in plugins have been migrated to
  `quantity--material` (HarvestingWool, HarvestingEgg, resetTrap, ObserveWeather,
  HarvestLogPlants, HarvestingPlants). Product-inventory quantities keep their
  `inventory_asset` → `asset--product` relationship and use `quantity--material`.
