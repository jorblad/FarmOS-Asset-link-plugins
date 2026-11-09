import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Smoke test that EVERY plugin listed in `jorblads-plugins.repo.json` actually
// loads and resolves its `plugin-library:` imports in the running Asset Link app.
//
// This guards against two regression classes that a single "reset trap logged
// its version" check cannot catch:
//
//   1. Seed drift — the server-side default-plugin list (the
//      `asset_link_default_plugin` entities seeded by `npm run setup:farmos`)
//      no longer matches the manifest. If e.g. `config.alink.js` is missing
//      from the seeded set, every plugin that does
//      `import { config, t } from 'plugin-library:org.jorblad.farmos_asset_link.config'`
//      fails to evaluate and its actions silently never appear.
//
//   2. The Service Worker gotcha (AGENTS.md #1) — if the SW is active it
//      intercepts `/alink/backend/models.json` without the session cookie,
//      farmOS returns 403 HTML, the JSON parse throws, and the app is stuck on
//      "Loading models" (no data models => no plugin actions), even though the
//      plugin *files* fetched fine.
//
// Prerequisites (see docker-compose.yml + scripts/setup-farmos.sh):
//   docker compose up -d && npm run setup:farmos
// Credentials are admin/admin.

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const DEV_SERVER = `http://localhost:${process.env.PORT || 5173}`;

// Plugins that print a version banner on load. Their presence is positive proof
// that a plugin module executed end-to-end (and therefore resolved its
// `plugin-library:` imports). At least one of these is a config consumer, so it
// also proves the shared config library loaded.
const VERSION_MARKER_RES = [
  /Reset trap:\s*V/i,
  /Harvest log:\s*V/i,
  /Planting plugin:\s*V/i,
  /Transplanting plugin:\s*V/i,
  /Water log:\s*V/i,
];

// Signatures of a plugin that failed to load/evaluate. Asset Link swallows most
// action errors, but a plugin that fails to *load* (unresolved `plugin-library:`
// import, a missing helper from a `provides({...})` block, a syntax error, or a
// runtime TypeError during module evaluation) surfaces as a console error or an
// uncaught pageerror.
// Uncached exceptions (pageerrors) are always real failures during boot, so we
// capture the error *name* too — the SW gotcha surfaces as a `SyntaxError`
// ("Unexpected token '<' ... is not valid JSON" when models.json 403s). A
// transient/recovered models.json 403 (the SW gotcha) surfaces as an uncaught
// SyntaxError pageerror but the app retries and still reaches "Online", so that
// specific error is NOT matched here — the "Online" assertion (step 5) is what
// catches a *persistent* SW regression. The generic "Failed to load resource"
// console line is also not matched, since benign 404s (e.g. favicon) would
// otherwise cause false positives.
const LOAD_FAILURE_RE = [
  /Unsupported import/i,
  /plugin-library:/i,
  /Could not (load|resolve)/i,
  /is not (a |an )?function/i,
  /Cannot read propert/i,
  /TypeError/i,
];

test.describe('All seeded plugins load and resolve imports', () => {
  test('every manifest plugin is served, fetched, and executes without errors', async ({
    page,
    request,
  }) => {
    test.setTimeout(150000);

    // 1) The manifest is the source of truth for which plugins must load.
    const manifest = JSON.parse(
      readFileSync(resolve(repoRoot, 'jorblads-plugins.repo.json'), 'utf8'),
    );
    const pluginUrls = manifest.plugins.map((p) => String(p.url).replace(/^\/+/, ''));
    expect(pluginUrls.length, 'manifest has no plugins').toBeGreaterThan(0);

    // 2) Every plugin file must be retrievable from the dev server. A 404/500
    //    here means the file is missing / misnamed or the dev server is down,
    //    before Asset Link even attempts to import it.
    for (const url of pluginUrls) {
      const resp = await request.get(`${DEV_SERVER}/${url}`);
      expect(resp.status(), `plugin not served by dev server: ${url}`).toBe(200);
    }

    // Record which plugin files the browser actually fetched during boot, and
    // any that failed — this proves Asset Link attempted to load each entry
    // (driven by the server-seeded default-plugin list), not just that the file
    // exists on disk.
    const fetched = new Map(); // relative url -> status
    const onResponse = (r) => {
      const u = r.url();
      if (!u.startsWith(DEV_SERVER)) return;
      const rel = u.slice(DEV_SERVER.length + 1);
      if (pluginUrls.includes(rel)) fetched.set(rel, r.status());
    };
    page.on('response', onResponse);

    // Capture all console output + uncaught page errors during boot.
    const consoleLines = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleLines.push(msg.text()));
    page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));

    // Make the boot deterministic with respect to the Service Worker gotcha
    // (AGENTS.md #1): if a stale *stock* SW is still registered in this browser
    // profile (e.g. from a previous run before the no-op SW was deployed), it
    // would intercept /alink/backend/models.json and 403 it. Unregister any
    // existing SW before the app boots so models.json loads cleanly. This keeps
    // the test self-contained regardless of the host's SW state; the no-op
    // service-worker.js (deployed by setup-farmos.sh) handles re-registration.
    await page.addInitScript(() => {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker) {
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
            .catch(() => {});
        }
      } catch (e) {}
    });

    await page.goto('/alink', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.q-toolbar__title')).toHaveText('Asset Link', {
      timeout: 20000,
    });
    await expect(page.getByText('Unauthenticated')).toBeVisible();
    await page.locator('span.block', { hasText: 'Log in' }).click();
    await page.waitForURL('**/user/login**', { timeout: 15000 });
    await page.fill('#edit-name', 'admin');
    await page.fill('#edit-pass', 'admin');
    await page.click('#edit-submit');
    await page.waitForURL('**/alink/**', { timeout: 20000 });

    // Give plugins time to fetch and evaluate.
    await page.waitForTimeout(8000);

    // 3) Asset Link actually fetched every manifest plugin from the dev server.
    const notFetched = pluginUrls.filter((u) => !fetched.has(u));
    expect(notFetched, `plugins Asset Link never fetched: ${notFetched.join(', ')}`).toEqual(
      [],
    );
    const fetchFailures = [...fetched.entries()].filter(([, s]) => s >= 400);
    expect(
      fetchFailures.map(([u, s]) => `${u} -> ${s}`),
      'plugin fetch failures',
    ).toEqual([]);

    // 4) No plugin-load failures in console or as uncaught page errors. This is
    //    the check that catches a missing/renamed `plugin-library:` dependency
    //    (e.g. the config library dropped from the seeded set) and any helper
    //    that was used but not declared in `provides({...})`.
    const failures = [
      ...consoleLines.filter((l) => LOAD_FAILURE_RE.some((re) => re.test(l))),
      ...pageErrors.filter((l) => LOAD_FAILURE_RE.some((re) => re.test(l))),
    ];
    expect(failures, `plugin load failures:\n${failures.join('\n')}`).toEqual([]);

    // 5) The app reached "Online": proves the data models loaded, which only
    //    happens when the Service Worker is NOT intercepting /alink/backend/*.
    //    A stuck "Loading models" state means the SW 403'd models.json.
    await expect
      .poll(() => page.evaluate(() => document.body.innerText), {
        timeout: 60000,
        intervals: [1000, 2000, 5000],
      })
      .toMatch(/Online/i);

    // 6) Positive proof that the shared `plugin-library:` dependency (config)
    //    resolved and at least one consumer executed end-to-end.
    await expect
      .poll(
        () => consoleLines.some((l) => VERSION_MARKER_RES.some((re) => re.test(l))),
        { timeout: 60000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    test.info().annotations.push({
      type: 'plugin-load',
      description: `all ${pluginUrls.length} manifest plugins fetched + executed; app Online`,
    });
  });
});
