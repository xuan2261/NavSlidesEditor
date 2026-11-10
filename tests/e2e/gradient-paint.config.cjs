const { defineConfig } = require('@playwright/test')

// Offline production-SVG regressions need Chromium, not a storage/API server.
module.exports = defineConfig({
  testDir: '.',
  testMatch: 'pptx-gradient-path-shade.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  forbidOnly: true,
  use: { browserName: 'chromium', headless: true, screenshot: 'only-on-failure' },
})
