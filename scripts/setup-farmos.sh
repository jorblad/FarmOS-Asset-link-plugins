#!/usr/bin/env bash
# Reproducible setup for the local farmOS dev instance used by the e2e suite.
#
# Usage:
#   docker compose up -d            # start db + farmos containers
#   ./scripts/setup-farmos.sh      # install farmOS (first time) + enable modules
#
# Idempotent: safe to re-run. The database lives in the `db-data` volume, so
# farmOS stays installed across `docker compose down`/`up`.
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=farmos
DRUSH="docker compose exec -T $CONTAINER /opt/drupal/vendor/bin/drush"

# Standard farmOS feature modules the Asset-link plugins depend on, plus the
# API surface (farm_api -> /api) and the assetlink module itself.
MODULES=(
  farm_animal farm_plant farm_seed farm_land farm_water farm_structure
  farm_equipment farm_material farm_product farm_group farm_sensor farm_compost
  farm_activity farm_harvest farm_observation farm_seeding farm_transplanting
  farm_input farm_birth farm_maintenance
  farm_plant_type farm_animal_type farm_season
  farm_inventory farm_quick farm_api farm_api_default_consumer
  farm_ledger farmos_asset_link
  jsonapi serialization basic_auth
)

echo "==> Checking farmOS install state..."
BOOTSTRAP="$($DRUSH status --field=bootstrap 2>/dev/null || echo none)"
if [[ "$BOOTSTRAP" == *"None"* || -z "$BOOTSTRAP" ]]; then
  echo "==> Installing farmOS (this can take a few minutes under emulation)..."
  $DRUSH site-install farm -y \
    --db-url=mysql://farmos:farmos@db/farmos \
    --account-name=admin --account-pass=admin \
    --site-name="Dev FarmOS" --locale=en
else
  echo "==> farmOS already installed (bootstrap: $BOOTSTRAP)"
fi

echo "==> Enabling modules..."
$DRUSH en -y "${MODULES[@]}"

echo "==> Clearing caches..."
$DRUSH cr

# ---------------------------------------------------------------------------
# Seed the Asset Link default plugin list server-side.
#
# Asset Link loads these automatically on every boot from
# /alink/backend/default-plugins.repo.json, so the user never has to re-enter
# the plugin list after clearing browser storage / cache. Idempotent: re-running
# only updates URLs that changed.
# ---------------------------------------------------------------------------
echo "==> Seeding Asset Link default plugins..."
docker compose cp jorblads-plugins.repo.json "$CONTAINER:/tmp/plugins.repo.json"
docker compose cp scripts/seed-default-plugins.php "$CONTAINER:/tmp/seed-default-plugins.php"
$DRUSH php:script /tmp/seed-default-plugins.php
docker compose exec -T "$CONTAINER" rm -f /tmp/plugins.repo.json /tmp/seed-default-plugins.php
echo "==> Default plugins served at: http://localhost:8080/alink/backend/default-plugins.repo.json"

# ---------------------------------------------------------------------------
# Neutralize the Asset Link service worker for local dev.
#
# The stock Workbox SW precaches the app shell (so edited plugin code looks
# "old") and intercepts /alink/backend/models.json, re-issuing it from the SW
# context without the session -> 403 HTML -> Asset Link hangs on "Loading
# models". We overwrite it with a pass-through no-op (scripts/asset-link-dev-sw.js)
# so every request hits the network normally. The container is image-baked, so
# this must run on every `setup-farmos.sh` invocation.
# ---------------------------------------------------------------------------
echo "==> Disabling Asset Link service worker caching (dev only)..."
docker compose cp scripts/asset-link-dev-sw.js "$CONTAINER:/tmp/asset-link-dev-sw.js"
docker compose exec -T "$CONTAINER" cp /tmp/asset-link-dev-sw.js \
  /opt/drupal/web/modules/farmos_asset_link/asset-link-dist/service-worker.js
# Best-effort cleanup; the /tmp copy may be immutable in some images.
docker compose exec -T "$CONTAINER" rm -f /tmp/asset-link-dev-sw.js || true
echo "==> Service worker is now a pass-through no-op (no precache / no stale models.json)."

# ---------------------------------------------------------------------------
# Also stop the app from ever re-registering a service worker.
#
# The no-op SW above self-unregisters on activation, which removes any SW that
# was already controlling the page. But until that happens the old SW can keep
# serving a cached app shell. Permanently disabling registration in the app
# shell JS guarantees no SW is ever controlling again, regardless of SW update
# timing. Idempotent: re-running finds nothing left to patch.
# ---------------------------------------------------------------------------
echo "==> Neutralizing service-worker registration in the app shell (dev only)..."
SW_JS="$(docker compose exec -T "$CONTAINER" grep -rl 'navigator.serviceWorker.register' \
  /opt/drupal/web/modules/farmos_asset_link/asset-link-dist/js/ 2>/dev/null | head -1 | tr -d '\r\n')"
if [ -n "$SW_JS" ]; then
  docker compose exec -T "$CONTAINER" sed -i \
    's|navigator\.serviceWorker\.register(e,r)|Promise.resolve({waiting:null,addEventListener:function(){},onupdatefound:null})|' \
    "$SW_JS"
  echo "==> SW registration disabled in $SW_JS"
else
  echo "==> WARNING: could not locate Asset Link app JS to patch SW registration"
fi

echo ""
echo "Done. Asset Link dev instance is available at:"
echo "  http://localhost:8080/alink   (login: admin / admin)"
echo "  JSON:API (farm_api): http://localhost:8080/api"
echo "  Plugins auto-load from the server-side default-plugin list."
