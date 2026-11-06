import { defineConfig } from '@playwright/test';

// End-to-end suite against a real farmOS dev instance (see docker-compose.yml
// + scripts/setup-farmos.sh). The plugin dev server is managed automatically;
// the farmOS instance must already be running on FARMOS_URL (default
// http://localhost:8080) with admin/admin credentials.
//
// Run the dev instance first:
//   docker compose up -d
//   npm run setup:farmos
// Then:
//   npm run test:e2e
const FARMOS_URL = process.env.FARMOS_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The API e2e creates shared records; keep it deterministic with one worker.
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: FARMOS_URL,
    // farmOS basic_auth (enabled in setup-farmos.sh) — used by both the
    // `request` fixture and the browser for UI tests.
    httpCredentials: { username: 'admin', password: 'admin' },
    trace: 'retain-on-failure',
  },
  webServer: {
    // Serves the plugins so the Asset Link app can load them cross-origin.
    command: 'node scripts/dev-server.mjs',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
