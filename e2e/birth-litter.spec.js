import { test, expect } from '@playwright/test';
import { apiCall, createTerm, createAsset, gotoAssetAndLocateAction } from './helpers.js';

// End-to-end test for the Birth / litter plugin (Animals/BirthLitter.alink.vue).
//
// It drives the real user flow — open a parent animal asset, click "Födsel /
// kull", set a litter size, keep the (pre-filled) animal type, save — and
// verifies:
//   * a `log--birth` is created referencing exactly `count` newborn animals;
//   * each referenced animal exists and is linked to the parent via `parent`.

const run = Date.now();
const PARENT_NAME = `Cow-parent-${run}`;
const ANIMAL_TYPE = `Bovine-${run}`;
const LITTER_SIZE = 3;
const NOTES = `Birth recorded at ${run}`;

test.describe('Birth / litter plugin', () => {
  test('creates a litter of animals linked to the parent and a birth log', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    // --- Arrange: a parent animal the action should appear on -------------
    const animalType = await createTerm(request, 'animal_type', ANIMAL_TYPE);
    const parent = await createAsset(request, 'animal', PARENT_NAME, {
      vocab: 'animal_type',
      id: animalType.id,
    });
    const parentId = parent.attributes.drupal_internal__id;
    const parentUuid = parent.id;
    expect(parentId, 'parent has a numeric internal id').toBeTruthy();

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

    // --- Navigate to the parent asset page and locate the action --------
    const birthBtn = await gotoAssetAndLocateAction(page, parentId, 'Födsel / kull');

    // --- Act: open the dialog, set the litter size, save ----------------
    await birthBtn.click();

    const dialog = page.locator('.q-dialog');
    await expect(dialog, 'birth dialog opens').toBeVisible({ timeout: 10000 });
    await expect(
      dialog.getByText(new RegExp(`Hur många ungar föddes av ${PARENT_NAME}`)),
      'dialog shows the birth heading',
    ).toBeVisible();

    const countInput = dialog.locator('input[type="number"]').first();
    await countInput.fill(String(LITTER_SIZE));

    // The offspring type defaults to the parent's type; re-fill to be
    // deterministic regardless of async pre-fill timing.
    const typeInput = dialog.locator('input[type="text"]');
    await typeInput.fill(ANIMAL_TYPE);

    const notesInput = dialog.locator('textarea');
    await notesInput.fill(NOTES);

    const saveBtn = dialog.getByRole('button', { name: 'Spara' });
    await expect(saveBtn, 'save enabled').toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // --- Assert: birth log created --------------------------------------
    const expectedLogName = `Födsel ${PARENT_NAME} (${LITTER_SIZE} ungar)`;
    let offspringIds = [];
    await expect
      .poll(
        async () => {
          let res;
          try {
            res = await apiCall(request, 'GET', '/api/log/birth');
          } catch {
            return false;
          }
          const logs = res.json?.data || [];
          const log = logs.find((l) => l.attributes.name === expectedLogName);
          if (!log) return false;
          const assets = log.relationships?.asset?.data || [];
          if (assets.length !== LITTER_SIZE) return false;
          offspringIds = assets.map((a) => a.id);
          return true;
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();

    // --- Assert: each offspring is linked to the parent ------------------
    await expect
      .poll(
        async () => {
          try {
            for (const id of offspringIds) {
              const res = await apiCall(request, 'GET', `/api/asset/animal/${id}`);
              const a = res.json?.data;
              // `parent` is a has-many relationship, so `data` is an array.
              const parentRef = a?.relationships?.parent?.data;
              const linkedToParent = Array.isArray(parentRef) &&
                parentRef.some((p) => p.id === parentUuid);
              if (!linkedToParent) {
                return false;
              }
            }
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 40000, intervals: [1000, 2000, 5000] },
      )
      .toBeTruthy();
  });
});
