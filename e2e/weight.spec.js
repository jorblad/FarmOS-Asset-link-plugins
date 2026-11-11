import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// End-to-end test for the Weight / measurement plugin (Animals/WeighAnimal.alink.vue).
//
// It drives the real user flow — open an animal asset, click "Väg", enter a
// weight + unit, save — and verifies a `log--observation` is created referencing
// the animal with a `quantity--material` (measure: weight) carrying the amount.

const run = Date.now();
const ANIMAL_NAME = `Cow-weigh-${run}`;
const WEIGHT = 420.5;

test.describe('Weight / measurement plugin', () => {
  test('records a weight observation on an animal asset', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    // --- Arrange: an animal asset the action should appear on --------------
    const animalType = await createTerm(request, 'animal_type', `Bovine-${run}`);
    const animal = await createAsset(request, 'animal', ANIMAL_NAME, {
      vocab: 'animal_type',
      id: animalType.id,
    });
    const animalId = animal.attributes.drupal_internal__id;
    expect(animalId, 'animal has a numeric internal id').toBeTruthy();

    // --- Boot + login into Asset Link ------------------------------------
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

    // --- Navigate to the animal asset page and locate the action --------
    const weighBtn = await gotoAssetAndLocateAction(page, animalId, 'Väg');

    // --- Act: open the dialog, enter a weight, save ---------------------
    await weighBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'weight dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Hur mycket vägde ${ANIMAL_NAME}`)),
      'dialog shows the weight heading',
    ).toBeVisible();

    const weightInput = dialog.locator('input[type="number"]').first();
    await weightInput.fill(String(WEIGHT));

    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled after entering a weight').toBeEnabled({
      timeout: 5000,
    });
    await saveBtn.click();

    // --- Assert: observation log created --------------------------------
    const expectedLogName = `Vägde ${ANIMAL_NAME}`;
    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/observation');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          return logs.find((l) => l.attributes.name === expectedLogName);
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: the weight quantity carries measure=weight + our value --
    // Resolve it precisely via the log's quantity relationship (avoids scanning
    // the full, paginated /api/quantity/material list, which hides the match).
    let weightLog = null;
    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/observation');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          weightLog = logs.find((l) => l.attributes.name === expectedLogName) || null;
          return weightLog;
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    const qtyId = weightLog.relationships.quantity.data[0].id;
    const qtyRes = await apiCall(request, 'GET', `/api/quantity/material/${qtyId}`);
    const qtyAttrs = qtyRes.json.data.attributes;
    expect(qtyAttrs.measure).toBe('weight');
    expect(qtyAttrs.value?.decimal).toBe(String(WEIGHT));
  });
});
