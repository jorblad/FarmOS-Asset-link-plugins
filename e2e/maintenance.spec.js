import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset } from './helpers.js';

// Navigate to an asset's page and locate an asset-action button by its accessible
// name, retrying across reloads.
//
// The asset page only renders its action chips after the asset's relationships
// are in Asset Link's synchronous cache, which is racy under the emulated farmOS
// dev instance, so the chip is occasionally absent on the first paint. Re-loading
// gives the cache another chance before `showIf` evaluates. (Kept local to this
// spec to avoid touching the shared helpers.js on a separate PR branch.)
async function gotoAssetAndLocateAction(page, assetId, actionButtonName, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      await page.goto(`/alink/asset/${assetId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page.locator('.q-toolbar__title').waitFor({ timeout: 20000 });
    try {
      const btn = page.getByRole('button', { name: actionButtonName });
      await btn.waitFor({ state: 'visible', timeout: 20000 });
      return btn;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// End-to-end test for the Maintenance log plugin (Equipment/MaintenanceLog.alink.vue).
//
// It drives the real user flow — open an equipment asset, click "Underhåll", enter
// a description, save — and verifies a `log--maintenance` is created referencing
// the asset with the entered notes.

const run = Date.now();
const EQUIP_NAME = `Tractor-${run}`;
const DESCRIPTION = `Oljebyte ${run}`;

test.describe('Maintenance log plugin', () => {
  test('records maintenance on an equipment asset with a description', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    // --- Arrange: an equipment asset the action should appear on ------------
    const equipType = await createTerm(request, 'equipment_type', `Tool-${run}`);
    const equip = await createAsset(request, 'equipment', EQUIP_NAME, {
      vocab: 'equipment_type',
      id: equipType.id,
    });
    const equipId = equip.attributes.drupal_internal__id;
    expect(equipId, 'equipment has a numeric internal id').toBeTruthy();

    // --- Boot + login into Asset Link --------------------------------------
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

    // Diagnostics capture (cheap; only printed on failure below).
    const consoleLines = [];
    page.on('console', (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => consoleLines.push(`PAGEERROR: ${err.name}: ${err.message}`));

    // --- Navigate to the equipment asset page and locate the action --------
    let maintBtn;
    try {
      maintBtn = await gotoAssetAndLocateAction(page, equipId, 'Underhåll');
    } catch (e) {
      console.log('=== MAINTENANCE DIAGNOSTICS (button not found) ===');
      console.log('URL:', page.url());
      const buttons = await page.locator('button').allInnerTexts().catch(() => []);
      console.log('BUTTONS ON PAGE:', JSON.stringify(buttons));
      console.log('BODY (first 800 chars):', (await page.locator('body').innerText().catch(() => '')).slice(0, 800));
      console.log('ASSET VIA API:', JSON.stringify(
        (await apiCall(request, 'GET', `/api/asset/equipment/${equipId}`)).json?.data?.attributes || 'NOT FOUND',
      ));
      console.log('CONSOLE (last 30):\n' + consoleLines.slice(-30).join('\n'));
      throw e;
    }

    // --- Act: open the dialog, enter a description, save -------------------
    await maintBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'maintenance dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Beskriv underhållet för ${EQUIP_NAME}`)),
      'dialog shows the maintenance heading',
    ).toBeVisible();

    const descInput = dialog.locator('textarea').first();
    await descInput.fill(DESCRIPTION);

    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled after entering a description').toBeEnabled({
      timeout: 5000,
    });
    await saveBtn.click();

    // --- Assert: maintenance log created -----------------------------------
    const expectedLogName = `Underhåll: ${EQUIP_NAME}`;
    await expect
      .poll(
        async () => {
          // The emulated farmOS dev instance occasionally resets the API
          // connection (ECONNRESET) under load; treat a transient fetch failure
          // as "not found yet" and let the poll retry rather than aborting.
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/maintenance');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          return logs.find(
            (l) =>
              l.attributes.name === expectedLogName &&
              // farmOS returns the `notes` text_with_summary field as
              // `{ value, format, processed }`; the saved description is `value`.
              l.attributes.notes?.value === DESCRIPTION,
          );
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();
  });
});
