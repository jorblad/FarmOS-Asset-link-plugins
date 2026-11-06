<?php
/**
 * Seeds farmOS Asset Link "default plugins" from a repo.json manifest.
 *
 * Asset Link serves these (when enabled) from
 * /alink/backend/default-plugins.repo.json and loads them automatically on every
 * boot, so the user never has to re-enter the plugin list after clearing browser
 * storage / cache.
 *
 * Run inside the farmOS container via drush, e.g.:
 *   drush php:script scripts/seed-default-plugins.php
 *
 * Environment overrides:
 *   REPO_JSON_PATH  absolute path (inside container) to the repo.json manifest
 *                   (default: /tmp/plugins.repo.json)
 *   DEV_SERVER_URL  base URL the dev server serves the plugins from
 *                   (default: http://localhost:5173)
 *   PLUGIN_AUTHOR   prefix used for the generated entity machine ids
 *                   (default: jorblad)
 */

$repoPath = getenv('REPO_JSON_PATH') ?: '/tmp/plugins.repo.json';
$baseUrl  = rtrim(getenv('DEV_SERVER_URL') ?: 'http://localhost:5173', '/');
$author   = getenv('PLUGIN_AUTHOR') ?: 'jorblad';

if (!file_exists($repoPath)) {
  fwrite(STDERR, "seed-default-plugins: repo.json not found at $repoPath\n");
  exit(1);
}

$manifest = json_decode(file_get_contents($repoPath), TRUE);
if (!is_array($manifest) || empty($manifest['plugins'])) {
  fwrite(STDERR, "seed-default-plugins: no plugins found in $repoPath\n");
  exit(1);
}

$storage = \Drupal::entityTypeManager()->getStorage('asset_link_default_plugin');

$created = 0;
$updated = 0;
$skipped = 0;

foreach ($manifest['plugins'] as $plugin) {
  $rel = trim($plugin['url'] ?? '', '/');
  if ($rel === '') {
    continue;
  }

  // Derive a stable machine id from the (author, relative path) pair.
  $slug = preg_replace('/[^a-z0-9]+/', '_', strtolower($rel));
  $slug = trim($slug, '_');
  if (strlen($slug) > 48) {
    $slug = substr($slug, 0, 48);
  }
  $id = $author . '_' . $slug;

  $url = $baseUrl . '/' . $rel;

  $existing = $storage->load($id);
  if ($existing) {
    // Keep existing entities but make sure they point at the current dev server
    // and are enabled (so a port/host change propagates on re-run).
    if ($existing->url() !== $url || !$existing->status()) {
      $existing->set('url', $url);
      $existing->set('status', TRUE);
      $existing->save();
      $updated++;
      echo "updated: $id -> $url\n";
    } else {
      $skipped++;
    }
    continue;
  }

  $entity = $storage->create([
    'id' => $id,
    'url' => $url,
    'status' => TRUE,
    'user_defined' => TRUE,
  ]);
  $entity->save();
  $created++;
  echo "created: $id -> $url\n";
}

echo "\nDone. created=$created updated=$updated skipped=$skipped\n";
