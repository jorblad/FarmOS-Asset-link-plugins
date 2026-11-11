import { test, expect } from '@playwright/test';

// Verifies the ObserveWeather top-bar button (a `toolbar-item` slot rendered into
// the app toolbar on every page). It must be present once logged in and must
// navigate to the /observe-weather page. This guards the "add a weather button to
// the top bar" feature so a regression (e.g. the slot not registering, or the
// route path drifting) is caught.
//
// The button label comes from config.weatherToolbarButton; config.locale defaults
// to 'sv', so the visible text is "Väder" (en fallback: "Weather").

const WEATHER_BUTTON = process.env.WEATHER_BUTTON_LABEL || 'Väder';

test.describe('ObserveWeather top-bar button', () => {
  test('shows a "Väder" button in the toolbar that opens /observe-weather', async ({ page }) => {
    test.setTimeout(150000);

    // The stock Asset Link service worker intercepts /alink/backend/models.json
    // without the farmOS session cookie and hangs the app (AGENTS.md gotcha #1).
    // Kill any registered SW before booting so we always reach "Online".
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

    // The toolbar button is rendered into the app toolbar, present on the start page.
    // A QBtn with a `to` prop renders as an <a> (router-link), so match it as a link.
    const weatherBtn = page.getByRole('link', { name: WEATHER_BUTTON });
    await expect(weatherBtn, 'weather button visible in toolbar').toBeVisible({ timeout: 20000 });

    // Clicking it navigates to the weather observation page.
    await weatherBtn.click();
    await page.waitForURL('**/observe-weather**', { timeout: 15000 });
    await expect(page.getByText('Registrera en väderobservation')).toBeVisible({ timeout: 15000 });
  });
});
