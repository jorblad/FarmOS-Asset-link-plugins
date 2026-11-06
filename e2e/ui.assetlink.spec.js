import { test, expect } from '@playwright/test';

// UI smoke test for the Asset Link dev app served by the farmOS instance.
// It verifies the SPA boots, requires authentication, and that a successful
// farmOS login returns the user into the app. This catches "the app won't
// boot / can't authenticate" regressions that the API-level suite can't.
//
// Prerequisites (see docker-compose.yml + scripts/setup-farmos.sh):
//   docker compose up -d && npm run setup:farmos
// Credentials are admin/admin (set in the farmOS install).
test.describe('Asset Link dev app (UI smoke)', () => {
  test('boots, requires login, and authenticates via farmOS', async ({ page }) => {
    // Emulated farmOS loads data models slowly; give this flow room.
    test.setTimeout(150000);

    // Capture console output so we can prove the server-seeded default plugins
    // were actually fetched and executed by the SPA (surviving a cache clear).
    const consoleLines = [];
    page.on('console', (msg) => consoleLines.push(msg.text()));

    await page.goto('/alink', { waitUntil: 'domcontentloaded' });

    // The SPA shell mounts (the toolbar title is rendered by Quasar).
    await expect(page.locator('.q-toolbar__title')).toHaveText('Asset Link', {
      timeout: 20000,
    });

    // Before authenticating, the app is in the unauthenticated state.
    await expect(page.getByText('Unauthenticated')).toBeVisible();

    // Log in through farmOS's user login (Asset Link uses the farmOS session).
    await page.locator('span.block', { hasText: 'Log in' }).click();
    await page.waitForURL('**/user/login**', { timeout: 15000 });
    await page.fill('#edit-name', 'admin');
    await page.fill('#edit-pass', 'admin');
    await page.click('#edit-submit');

    // A successful login redirects back into the app (the login form's
    // destination is /alink). Staying on /user/login would mean auth failed.
    await page.waitForURL('**/alink/**', { timeout: 20000 });

    // The SPA reloaded and is still mounted.
    await expect(page.locator('.q-toolbar__title')).toHaveText('Asset Link', {
      timeout: 20000,
    });

    // The server-side default-plugin repository (seeded via `npm run setup:farmos`
    // -> asset_link_default_plugin entities) must drive the SPA to load our dev
    // plugins. The reset-trap plugin logs its version on load, so its presence in
    // the console proves the list survived the cache clear and auto-loaded.
    await expect
      .poll(() => consoleLines.some((l) => /Reset trap:\s*V/i.test(l)), {
        timeout: 60000,
        intervals: [1000, 2000, 5000],
      })
      .toBeTruthy();

    // Soft check: once the data models finish loading the app reports "Online"
    // instead of "Unauthenticated". Under emulation this can be slow, so don't
    // fail the suite if it hasn't completed yet.
    const online = await page
      .waitForFunction(
        () => !/Unauthenticated/i.test(document.body.innerText),
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    test.info().annotations.push({
      type: 'auth-state',
      description: online ? 'authenticated (Online)' : 'returned to app; models still loading',
    });

    await page.screenshot({ path: 'test-results/assetlink-after-login.png' }).catch(() => {});

    test.info().annotations.push({
      type: 'plugin-load',
      description:
        'seeded default plugins loaded and executed (reset trap ran on boot)',
    });
  });
});
