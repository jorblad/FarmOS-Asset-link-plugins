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

echo ""
echo "Done. Asset Link dev instance is available at:"
echo "  http://localhost:8080/alink   (login: admin / admin)"
echo "  JSON:API (farm_api): http://localhost:8080/api"
