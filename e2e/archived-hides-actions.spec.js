import { test, expect } from '@playwright/test';
import { createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// Regression test for the archived-animal predicate bug: animal actions keyed off
// the non-existent `status` attribute (animals use the `archived` boolean) wrongly
// stayed visible on archived animals. After archiving, the ongoing-activity actions
// (Milking / Weight / Feeding / Manure) must disappear; the once-only actions
// (Exit / Birth) already gated on `archived !== true`.
//
// We archive through the Exit UI action (rather than a raw API PATCH) because that
// updates Asset Link's in-memory Orbit cache, so the action chips re-evaluate and
// hide on the same page without depending on a server refetch (which can serve a
// stale cached asset right after a write — see gotcha #11).
//
// Positive control: a dairy-type animal shows "Mjölka" before archiving.

const run = Date.now();
const ANIMAL_NAME = `Cow-archived-${run}`;
const ANIMAL_TYPE = `Cow-${run}`;

test.describe('Archived animals hide ongoing-activity actions', () => {
  test('Mjölka/Wäg/Utfodra/Gödsel disappear once the animal is archived', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const animalType = await createTerm(request, 'animal_type', ANIMAL_TYPE);
    const animal = await createAsset(request, 'animal', ANIMAL_NAME, {
      vocab: 'animal_type',
      id: animalType.id,
    });
    const animalId = animal.attributes.drupal_internal__id;
    expect(animalId, 'animal has a numeric internal id').toBeTruthy();

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
    await expect(page.locator('.q-toolbar__title')).toHaveText('Asset Link', { timeout: 20000 });
    await expect(page.getByText('Unauthenticated')).toBeVisible();
    await page.locator('span.block', { hasText: 'Log in' }).click();
    await page.waitForURL('**/user/login**', { timeout: 15000 });
    await page.fill('#edit-name', 'admin');
    await page.fill('#edit-pass', 'admin');
    await page.click('#edit-submit');
    await page.waitForURL('**/alink/**', { timeout: 20000 });

    // Positive control: before archiving, "Mjölka" is available for a dairy animal.
    const milkBtn = await gotoAssetAndLocateAction(page, animalId, 'Mjölka');
    expect(milkBtn, 'Mjölka visible before archiving').toBeTruthy();

    // Archive via the Exit action (archive toggle is on by default; leave meat
    // weight / notes empty — the save button is enabled by the archive toggle).
    const exitBtn = await gotoAssetAndLocateAction(page, animalId, 'Avsluta / slakta / sälj');
    await exitBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'exit dialog opens').toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: 'Spara' }).click();

    // The Exit action archives the animal in the local cache, so the action chips
    // re-evaluate and the ongoing-activity actions disappear on this same page.
    await expect(
      page.getByRole('button', { name: 'Mjölka' }),
      'Mjölka hidden after archiving',
    ).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Väg' })).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Utfodra' })).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Gödsel' })).toHaveCount(0, { timeout: 5000 });
  });
});
