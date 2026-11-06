# Ideas backlog

Collected plugin and cross-cutting ideas for the FarmOS Asset-link plugins repo.
Nothing here is implemented yet — use this as a working list.

## New plugins (farmOS domain, fit the farm)
- **Milking log** — record milk volume → increment a `Mjölk` (milk) product
  inventory. Near-duplicate of the egg/wool harvest flow; low effort.
- **Feeding log** — record feed given to animals, decrementing a feed material
  inventory. Common daily task.
- **Animal exit / butchering / sale** — archive an animal asset
  (`status: 'archived'`/`deceased`) and optionally create a meat product
  inventory. Closes a real lifecycle gap (animals are only "harvested" for
  eggs/wool today).
- **Birth / litter log** — like `PlantPlantsFromSeed` creates N plant assets,
  create a litter of new animal assets from a parent, with a birth log.
- **Maintenance log on equipment** — farmOS already has a `maintenance` log
  type; a quick action on equipment/structure assets (the trap already targets
  `asset--equipment`) would be trivial and useful.
- **Manure / compost** — record manure production → material inventory for
  compost.
- **Weight / measurement observation** — track animal or asset weight over time
  via observation logs (growth tracking). Natural sibling to ObserveWeather.

## Cross-cutting / tooling
- **`config.js` module** — centralize the tunables currently scattered around:
  `EGG_ANIMAL_TYPE_MATCHES`, unit names (`St`, `mm`, `st`, `°C`, …), inventory
  asset names, default harvest product name. Single file instead of constants
  buried in each plugin. (This is the "truly configurable" version of #15.)
- **i18n / Swedish labels** — the farm is Swedish but most UI labels are
  English ("Reset trap", "Record Harvest", "Water"). A label map or Quasar i18n
  would make the app feel native.
- **Hide `TestMap` from production** — it's a dev/debug utility; keep it in the
  repo but out of the shipped `repo.json`, or gate it behind a debug flag.
- **Make the egg/wool/sheep animal-type predicates configurable at runtime** —
  today they're editable lists in code; a settings screen or a farmOS taxonomy
  to pick from would avoid code edits.
- **ObserveWeather measures** — add more observation types (air pressure, soil
  moisture, …) and double-check farmOS accepts the `measure` enum values used.
- **Home-page Done/Pending slot id** — `HomeAssetLogs.alink.vue` guesses
  `se.jorblad.farmos_asset_link.slots.v0.home`; verify it actually renders on
  the start page and adjust if needed.

## Verification TODO (not yet confirmed at runtime)
- Relative sibling imports (`../usePhotoCapture.js`, `../useFarmOS.js`,
  `../AssetLogsPanel.js`) — confirmed to compile, but not yet verified to load
  in the running app. Load the photo-dialog plugins and the shared-helper
  plugins once to confirm.
