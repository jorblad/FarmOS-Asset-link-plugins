import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// End-to-end test for the Milking log plugin (Animals/MilkingLog.alink.vue).
//
// It exercises the full user flow — open an animal asset, click "Mjölka", enter a
// milk volume, save — and verifies the two side effects the plugin promises:
//   1. a harvest log is created referencing the animal, and
//   2. a `quantity--material` (measure: volume) increments the shared `Mjölk`
//      product inventory via `inventory_adjustment: 'increment'`.
//
// The inventory-increment primitive is shared with the seeds/harvest plugins and
// is covered by api.farmos.spec.js; this test locks in the *wiring* (action
// visibility, dialog, slot id, config labels) and proves the two records are
// actually created by the running Asset Link client.

const run = Date.now();
const COW_NAME = `Cow-${run}`;
const VOLUME = 12.5;

test.describe('Milking log plugin', () => {
  test('records a milking, creates a harvest log, and increments the Mjölk inventory', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    // --- Arrange: a dairy animal the milking action should appear on ----------
    const animalType = await createTerm(request, 'animal_type', `Cow-${run}`);
    const cow = await createAsset(request, 'animal', COW_NAME, {
      vocab: 'animal_type',
      id: animalType.id,
    });
    const cowId = cow.attributes.drupal_internal__id;
    expect(cowId, 'cow has a numeric internal id').toBeTruthy();

    // --- Boot + login into Asset Link ----------------------------------------
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

    // --- Navigate to the cow's asset page and locate the milking action ------
    // The asset route uses the numeric drupal_internal__id (see RelatedEquipment).
    // The action chip only renders once animal_type is in the cache, which is
    // racy under emulation — gotoAssetAndLocateAction retries across reloads.
    const milkBtn = await gotoAssetAndLocateAction(page, cowId, 'Mjölka');

    // --- Act: open the dialog, enter a volume, save ---------------------------
    await milkBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'milking dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Hur mycket mjölk mjölkade du från ${COW_NAME}`)),
      'dialog shows the milk heading',
    ).toBeVisible();

    const volumeInput = dialog.locator('input[type="number"]').first();
    await volumeInput.fill(String(VOLUME));

    // The "Spara" (record) button is disabled until volume > 0.
    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled after entering volume').toBeEnabled({
      timeout: 5000,
    });
    await saveBtn.click();

    // --- Assert: harvest log created ------------------------------------------
    const expectedLogName = `Mjölkade ${VOLUME} L från ${COW_NAME}`;
    await expect
      .poll(
        async () => {
          const res = await apiCall(request, 'GET', '/api/log/harvest');
          const logs = res.json?.data || [];
          return logs.some((l) => l.attributes.name === expectedLogName);
        },
        { timeout: 30000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: Mjölk product inventory incremented --------------------------
    // The milk product is ensured by name; find it, then confirm a material
    // quantity references it with inventory_adjustment 'increment' and our volume.
    const milkProductRes = await apiCall(request, 'GET', '/api/asset/product');
    const milkProduct = (milkProductRes.json?.data || []).find(
      (a) => a.attributes.name === 'Mjölk',
    );
    expect(milkProduct, 'Mjölk product inventory exists').toBeTruthy();

    await expect
      .poll(
        async () => {
          const res = await apiCall(
            request,
            'GET',
            '/api/quantity/material?filter%5Bqm%5D%5Bcondition%5D%5Bpath%5D=measure&filter%5Bqm%5D%5Bcondition%5D%5Bvalue%5D=volume&filter%5Bia%5D%5Bcondition%5D%5Bpath%5D=inventory_adjustment&filter%5Bia%5D%5Bcondition%5D%5Bvalue%5D=increment',
          );
          const quantities = res.json?.data || [];
          return quantities.find(
            (q) =>
              q.attributes.value?.decimal === String(VOLUME) &&
              q.relationships?.inventory_asset?.data?.id === milkProduct.id,
          );
        },
        { timeout: 30000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();
  });
});
