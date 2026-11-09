# Agent Guide — working on the farmOS Asset Link plugins

This file is named `AGENTS.md` so coding agents (Claude Code, OpenCode, Codex,
Copilot, Cursor, …) auto-load it as repo instructions on every session.

This guide is for an AI agent (or a human) picking up this repo cold. It
captures the **hard-won gotchas** that are not obvious from reading the code,
plus the **reference material** you actually need to do useful work here.

For architecture, the development setup, and the farmOS 4.x API notes, **read
`README.md` first** — that is the canonical source for those. This file is the
supplement that tells you what will silently bite you.

---

## TL;DR for an agent

- All shared code lives in **`SharedFarmOS.alink.js`**. Plugins are
  `.alink.vue` files. There is **no relative importing between plugins** —
  use `plugin-library:org.jorblad.farmos_asset_link.helpers`.
- **Tunable constants + UI labels live in `config.alink.js`** (library
  `org.jorblad.farmos_asset_link.config`, exports `config` and `t(key, vars)`).
  This is the single source of truth for unit names, inventory asset / product
  names, the default harvest product name, observation types, and every
  user-facing string. **Do not hardcode those in a plugin** — read
  `config.X` and render text via `t('key', vars)`. `config.locale` defaults to
  `sv` with `en` as fallback. (Quasar i18n / vue-i18n is NOT wired into Asset
  Link, so we use this tiny custom map instead.)
- `SharedFarmOS.alink.js`'s `AssetLogsPanel` strings (`Klara loggar:` /
  `Väntande loggar:` …) are the **one exception**: that file is imported
  directly by the unit tests, which can't resolve `plugin-library:` imports, so
  its four strings are hardcoded Swedish on purpose.
- farmOS 4.x only has `quantity--material` (+ `quantity--price`). Assets
  **require a type term** (`product_type`, `plant_type`, …).
- Orbit record types are **always** `taxonomy_term--<vocab>`, never the bare
  `product_type`.
- Errors thrown inside an Asset Link action are **swallowed** — surface them
  yourself with `notify()`.
- The dev app's **service worker** will hang on "Loading models" unless it is
  disabled (already handled in `setup-farmos.sh`). If you see that symptom in a
  *normal* browser window, it is a stuck old SW, not a code bug.

---

## The gotchas

### 1. "Loading models" is stuck / Asset Link never reaches "Online"

**Symptom:** the Asset Link dev app (`http://localhost:8080/alink`) sits on
"Loading models…" forever; the console shows a `403` for
`/alink/backend/models.json`.

**Root cause:** the stock Asset Link **service worker** (Workbox) precaches the
app shell and intercepts `/alink/backend/models.json`, re-issuing it from the
SW context **without the farmOS session cookie** → Drupal returns `403` HTML →
Asset Link's JSON parse fails → hang. A browser that already had the stock SW
registered keeps serving the cached app shell, so one reload does not fix it.

**Fix (already wired into `scripts/setup-farmos.sh`):**
1. The app-shell JS in the farmOS container is patched so it **never calls
   `navigator.serviceWorker.register()`**. This guarantees no SW ever controls
   the page, independent of SW update timing.
2. The served `service-worker.js` is replaced with a **no-op that
   self-unregisters** on activation (`scripts/asset-link-dev-sw.js`), so any SW
   that was already registered (the user's stuck one) is removed once the
   browser picks up the script.

**How to avoid wasting time:**
- A **private/incognito window** always works (no SW registered).
- A **normal window** that is already stuck: clearing the *HTTP cache* does
  **not** remove a registered SW. Do a **hard reload** (`Cmd/Ctrl+Shift+R`) once,
  or DevTools → Application → Service Workers → **Unregister**, then reload.
  After that one-time unregister it stays fixed because the app no longer
  registers a SW.
- Verify with Playwright: a fresh load should show `0` service-worker
  registrations and the app reaches "Online"; post-login
  `/alink/backend/models.json` returns `200` JSON.

### 2. `Record type 'product_type' does not exist in schema`

**Symptom:** an action that creates a typed asset (e.g. the reset trap, harvest)
blows up with:

```
Validation issues encountered while building a query expression
- record query expression is invalid
  - Record type 'product_type' does not exist in schema
```

…with **no user-facing error**, just a console exception.

**Root cause:** `ensureAsset()` passed the **bare vocabulary name**
(`'product_type'`) as the record type to `ensureTaxonomyTerm()`, which then
built `findRecords('product_type')`. The Orbit.js schema only knows the **full**
record type `taxonomy_term--product_type`, so the query validation fails.

**Fix:** build the full type:
```js
const term = await ensureTaxonomyTerm(assetLink, typeTerm, `taxonomy_term--${vocab}`);
```
`vocab` comes from `ASSET_TYPE_VOCAB` (`product_type`, `plant_type`, …). This
covers every `ensureAsset()` caller (reset trap, harvest plants, harvest log).

**How to avoid:** never query a taxonomy vocabulary by its bare name. Always use
`taxonomy_term--<vocab>`. The same applies to any other Orbit query.

### 3. `TypeError: requireValue is not a function` (or any helper) swallowed

**Symptom:** an action silently does nothing; console shows
`TypeError: X is not a function`, but it is wrapped and discarded by Asset Link's
dispatch so the user sees no error.

**Root cause:** `requireValue()` (or any shared helper) was **not listed in the
`provides({...})` object** of `provideLibrary(...)`. The importer then receives
`undefined` instead of the function, and calling it throws — but Asset Link
swallows action errors.

**Fix / how to avoid:** every helper exported from `SharedFarmOS.alink.js` MUST
be declared in the `handle.provideLibrary('org.jorblad.farmos_asset_link.helpers',
{ ... }).provides({ ... })` object. If you add or rename a helper, add it there
too. When something "does nothing", grep for the missing name in the
`provides({...})` block first.

### 4. Don't use Quasar `Notify` / `Dialog` directly — use `notify()`

**Symptom:** `Notify.create(...)` / `Dialog.create(...)` do nothing or throw.

**Root cause:** Asset Link registers its **own** Quasar instance. The Quasar
that your plugin imports is not the one Asset Link wired up, so `Notify`/`Dialog`
are not installed and have no visual effect.

**Fix:** use the project's self-contained `notify()` helper (console + a
self-built DOM toast) from `SharedFarmOS.alink.js`. It needs no Quasar plugin
registration. This is also the only reliable way to **surface errors to the
user** (see gotcha #3).

### 5. farmOS 4.x data model differences

These differ from older farmOS docs and will 422 / fail silently if ignored
(see also `README.md` → "farmOS 4.x API notes"):

- JSON:API is at **`/api`**, not `/jsonapi`.
- Quantities: **`quantity--material`** (with `measure`, `value` as
  `{decimal}`, a `units` reference, optional `inventory_adjustment` +
  `inventory_asset`). **No `quantity--standard`** exists here.
- Assets require their **type term** (`asset--product` → `product_type`,
  `asset--plant` → `plant_type`, etc.) set at creation.
- **Assets have no `status` attribute** in this build — do not send one (422).
- Log `timestamp` must be `YYYY-MM-DDTHH:MM:SSZ` (no milliseconds); a UNIX
  timestamp also works. Log `status: 'done'` is accepted.

### 6. Plugin list must be seeded server-side (survives cache clears)

**Symptom:** after clearing the browser cache, the plugin list is empty / plugins
don't load.

**Root cause:** the plugin list (`jorblads-plugins.repo.json`) is read from
`/alink/backend/default-plugins.repo.json`, which is backed by
`asset_link_default_plugin` entities. If those aren't seeded, the list is empty
in a fresh browser.

**Fix:** `scripts/setup-farmos.sh` seeds the `asset_link_default_plugin`
entities (with `SharedFarmOS` listed **first**, since other plugins depend on
its `plugin-library:` export). Re-run `setup-farmos.sh` after a container
recreate. `SharedFarmOS.alink.js` must be first in `jorblads-plugins.repo.json`
so its library is registered before other plugins import it.

### 7. The `plugin-library:` import rule

**Symptom:** `Failed to resolve import` / `Unsupported import` at runtime.

**Root cause:** Asset Link's loader only resolves a fixed set of **bare
specifiers** (`vue`, `quasar`, `assetlink-plugin-api`) and `plugin-library:<name>`
imports. It does **not** support relative imports between plugins
(`../something.js` fails).

**How to avoid:**
- Put all shared code in `SharedFarmOS.alink.js` and import it via
  `import { ... } from 'plugin-library:org.jorblad.farmos_asset_link.helpers'`.
- Need a new shared helper? Add it to `SharedFarmOS.alink.js` **and** to the
  `provides({...})` block (gotcha #3).

---

### 8. CI `e2e`: the MariaDB healthcheck must verify TCP, not the socket

**Symptom:** in CI the `e2e` workflow fails at `setup-farmos.sh` with
`SQLSTATE[HY000] [2002] Connection refused` the moment `drush site-install`
runs, even though `docker compose up -d` reported the `db` container healthy.

**Root cause:** the `db` service's healthcheck used
`mariadb-admin ping -h localhost`. For MariaDB clients `localhost` resolves to
the **Unix socket**, which appears during early startup **before** the TCP
listener on `3306` is ready. So `depends_on: db: condition: service_healthy`
passed on a false positive, the `farmos` container started, and drush's TCP
connection to `db:3306` was refused. Locally this never shows because you run
`setup-farmos.sh` long after MariaDB is fully up.

**Fix (already applied):** the healthcheck now forces a real TCP connect
(`bash -c 'exec 3<>/dev/tcp/127.0.0.1/3306'`), and `setup-farmos.sh` retries
`site-install` (up to 30×3s) so a transient refusal doesn't hard-fail.

**How to avoid:** if you touch the `db` service, never use `-h localhost` in a
healthcheck that gates a dependent container on TCP readiness. Verify with
`docker compose config` and a fresh-run (the runner always uses a fresh
`db-data` volume, so MariaDB always does first-time init in CI).

### 9. Cleanup `rm` inside a container needs `|| true`

**Symptom:** `setup-farmos.sh` fails in CI at the very end with
`rm: cannot remove '...': Operation not permitted`, even though the real work
(seeding, SW patching) already succeeded.

**Root cause:** `docker compose cp` drops files into the container's `/tmp` as
**root**. The container's exec user is non-root in CI (but root under Docker
Desktop locally), so `rm` of a root-owned file fails with `EPERM` — and
`set -e` turns that into a hard failure.

**Fix (already applied):** every best-effort container cleanup uses `rm -f ... || true`
(mirrors the existing asset-link SW cleanup).

**How to avoid:** never rely on `rm` (or any non-essential command) succeeding
inside a container under `set -e`; append `|| true` for cleanups.

### 10. A single `repo.json` URL is NOT a valid default-plugin entry

**Symptom:** you add `jorblads-plugins.repo.json` as one entry in farmOS's
Asset Link default-plugin configuration (the `asset_link_default_plugin`
entities) expecting it to pull in all 14 plugins — but **none** of them load
(verified empirically: with only the repo.json registered, Asset Link fetches
the repo.json `200` and then tries to evaluate it as a single plugin module, so
`0` plugin files are ever fetched).

**Root cause:** each `asset_link_default_plugin` entity is treated as **one
plugin URL**, not a nested repository. Asset Link only expands a `repo.json`
when it is loaded as a *plugin list* (the server-side
`default-plugins.repo.json` itself, or a client-side "add plugin repository"
in Manage Plugins). An entry *inside* the default list that happens to point at
another `repo.json` is just another (broken) plugin file.

**How to avoid:**
- **Register each plugin separately** — one `asset_link_default_plugin` entity
  per plugin URL. `scripts/setup-farmos.sh` does this for you by expanding
  `jorblads-plugins.repo.json` into one entity per plugin. If you seed by hand,
  create one entity per URL in the manifest.
- For a one-shot client-side load (won't survive a browser-storage wipe), you
  *can* paste the `repo.json` URL into Asset Link's **Manage Plugins → add a
  plugin repository** — that path expands it. But the server-seeded defaults
  are per-plugin only.
- See `README.md` → "Registering plugins in farmOS" for the same guidance.

## Workflow (PRs + CI)

CI is set up in `.github/workflows/` and runs on **every pull request** (and on
pushes to `main`):

- `ci.yml` → `npm run validate` + `npm test` (unit).
- `e2e.yml` → Playwright against a real farmOS (same `jorblad/farmos-k8s` image
  used locally) — `api.farmos.spec.js` (JSON:API contract) + `ui.assetlink.spec.js`
  (boot/auth smoke) + `plugins-load.spec.js` (every plugin in
  `jorblads-plugins.repo.json` is served, fetched, and executes without errors;
  this catches the seed-drift regression where the server-side default-plugin
  list no longer matches the manifest, and the Service-Worker `models.json` 403
  gotcha — see #1).

**New work goes in a PR, not directly on `main`:**

1. Branch off `main`: `git switch -c <topic>/<short-desc>`.
2. Make the change; keep the suite green locally:
   `npm run validate && npm test` (and `npx playwright test` if you touched
   plugin/API behavior — requires `./scripts/setup-farmos.sh` to be up).
3. Commit, push the branch, open a PR: `gh pr create`.
4. Wait for CI. Both workflows must be green before merge.
5. Merge; `main` is protected by the PR requirement in practice.

---

## Reference links

**Asset Link (the app these plugins extend)**
- Upstream module + source: <https://github.com/symbioquine/farmOS_asset_link>
- Docs home: <https://symbioquine.github.io/farmOS_asset_link/>
- Writing-plugins tutorial (the place to start): <https://symbioquine.github.io/farmOS_asset_link/tutorial-writing-plugins.html>
- User guide: <https://symbioquine.github.io/farmOS_asset_link/tutorial-user-guide.html>
- Development tutorial: <https://symbioquine.github.io/farmOS_asset_link/tutorial-development.html>
- Plugin API (npm): <https://www.npmjs.com/package/assetlink-plugin-api>

**This repo**
- <https://github.com/jorblad/FarmOS-Asset-link-plugins>

**farmOS API & data model**
- farmOS API docs: <https://farmos.org/development/api/>
- farmOS.js client docs: <https://farmos.org/development/farmos-js/>

**JSON:API (the wire format)**
- Spec: <https://jsonapi.org/>
- Drupal JSON:API (what farmOS uses): <https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module>

**Orbit.js (the data layer Asset Link queries through)**
- Intro: <https://orbitjs.com/docs/intro>
- Modeling data (records, types, relationships): <https://orbitjs.com/docs/modeling-data>
- Getting started: <https://orbitjs.com/docs/getting-started>

**Community**
- farmOS Discourse: <https://farmos.discourse.group/>
