import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// End-to-end test for the Feeding log plugin (Animals/FeedAnimals.alink.vue).
//
// It drives the real user flow — open an animal asset, click "Utfodra", enter an
// amount + unit, save — and verifies a `log--input` is created referencing the
// animal with a `quantity--material` that decrements the shared `Foder` (feed)
// material inventory.

const run = Date.now();
const ANIMAL_NAME = `Cow-feed-${run}`;
const AMOUNT = 2.5;

test.describe('Feeding log plugin', () => {
  test('records feeding on an animal asset and decrements the feed inventory', async ({
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
    const feedBtn = await gotoAssetAndLocateAction(page, animalId, 'Utfodra');

    // --- Act: open the dialog, enter an amount, save --------------------
    await feedBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'feeding dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Hur mycket foder gav du ${ANIMAL_NAME}`)),
      'dialog shows the feeding heading',
    ).toBeVisible();

    const amountInput = dialog.locator('input[type="number"]').first();
    await amountInput.fill(String(AMOUNT));

    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled after entering an amount').toBeEnabled({
      timeout: 5000,
    });
    await saveBtn.click();

    // --- Assert: feed log created ---------------------------------------
    const expectedLogName = `Utfodrade ${ANIMAL_NAME}`;
    await expect
      .poll(
        async () => {
          // The emulated farmOS dev instance occasionally resets the API
          // connection (ECONNRESET) under load; treat a transient fetch failure
          // as "not found yet" and let the poll retry rather than aborting.
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/input');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          return logs.find((l) => l.attributes.name === expectedLogName);
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: the feed quantity decrements the shared Foder material ---
    // Resolve the Foder material's id, then confirm a material quantity with
    // inventory_adjustment 'decrement' references it with our amount.
    const feedMaterialRes = await apiCall(request, 'GET', '/api/asset/material');
    const feedMaterial = (feedMaterialRes.json?.data || []).find(
      (a) => a.attributes.name === 'Foder',
    );
    expect(feedMaterial, 'Foder material inventory exists').toBeTruthy();

    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(
              request,
              'GET',
              '/api/quantity/material?filter%5Bia%5D%5Bcondition%5D%5Bpath%5D=inventory_adjustment&filter%5Bia%5D%5Bcondition%5D%5Bvalue%5D=decrement',
            );
          } catch {
            return false;
          }
          const quantities = res.json?.data || [];
          return quantities.find(
            (q) =>
              q.attributes.value?.decimal === String(AMOUNT) &&
              q.relationships?.inventory_asset?.data?.id === feedMaterial.id,
          );
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();
  });
});
