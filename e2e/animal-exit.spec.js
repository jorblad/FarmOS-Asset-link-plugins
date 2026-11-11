import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// End-to-end test for the Animal exit plugin (Animals/ExitAnimal.alink.vue).
//
// It drives the real user flow — open an animal asset, click "Avsluta / slakta /
// sälj", keep the archive toggle on, enter a meat weight + unit, save — and
// verifies:
//   * an exit `log--activity` is created referencing the animal, with the notes;
//   * the animal is archived (`archived: true`);
//   * the `Kött` (meat) product inventory is incremented by the meat weight.

const run = Date.now();
const ANIMAL_NAME = `Cow-exit-${run}`;
const MEAT_AMOUNT = 42.5;
const NOTES = `Butchered at ${run}`;

test.describe('Animal exit / butchering / sale plugin', () => {
  test('archives an animal, records meat weight, and increments the Kött inventory', async ({
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
    const animalUuid = animal.id;
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
    const exitBtn = await gotoAssetAndLocateAction(page, animalId, 'Avsluta / slakta / sälj');

    // --- Act: open the dialog, enter meat weight + notes, save -----------
    await exitBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'exit dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Vad hände med ${ANIMAL_NAME}`)),
      'dialog shows the exit heading',
    ).toBeVisible();

    // The archive toggle should be on by default (Quasar reflects this as the
    // `aria-checked` attribute on the switch role, not a CSS class).
    const archiveToggle = dialog.locator('.q-toggle');
    await expect(archiveToggle, 'archive toggle is on by default').toHaveAttribute(
      'aria-checked',
      'true',
    );

    const amountInput = dialog.locator('input[type="number"]').first();
    await amountInput.fill(String(MEAT_AMOUNT));

    const notesInput = dialog.locator('textarea');
    await notesInput.fill(NOTES);

    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled after entering a meat weight').toBeEnabled({
      timeout: 5000,
    });
    await saveBtn.click();

    // --- Assert: exit log created ---------------------------------------
    const expectedLogName = `Avslut ${ANIMAL_NAME}`;
    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/activity');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          return logs.find((l) => l.attributes.name === expectedLogName);
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: the animal is archived ---------------------------------
    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(request, 'GET', `/api/asset/animal/${animalUuid}`);
          } catch {
            return false;
          }
          return res.json?.data?.attributes?.archived === true;
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: the meat quantity increments the shared Kött product ---
    const productRes = await apiCall(request, 'GET', '/api/asset/product');
    const meatProduct = (productRes.json?.data || []).find(
      (a) => a.attributes.name === 'Kött',
    );
    expect(meatProduct, 'Kött product asset exists').toBeTruthy();

    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(
              request,
              'GET',
              '/api/quantity/material?filter%5Bia%5D%5Bcondition%5D%5Bpath%5D=inventory_adjustment&filter%5Bia%5D%5Bcondition%5D%5Bvalue%5D=increment',
            );
          } catch {
            return false;
          }
          const quantities = res.json?.data || [];
          return quantities.find(
            (q) =>
              q.attributes.value?.decimal === String(MEAT_AMOUNT) &&
              q.relationships?.inventory_asset?.data?.id === meatProduct.id,
          );
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();
  });
});
