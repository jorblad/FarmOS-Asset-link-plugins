import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

// Resolve the two runtime-only modules (provided by the assetlink loader) to
// lightweight stubs so the shared logic can be unit-tested without a live
// farmOS or a Quasar build.
const stub = (p) => fileURLToPath(new URL('./tests/' + p, import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
  resolve: {
    alias: {
      quasar: stub('quasar-stub.js'),
      'assetlink-plugin-api': stub('assetlink-api-stub.js'),
    },
  },
});
