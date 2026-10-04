const path = require('node:path')
const { defineConfig } = require('@playwright/test')
const browserConfig = require('./playwright.config.js')
const { desktopProjects } = require('./tests/e2e/education/desktop-runtime-config.cjs')

// Desktop journeys launch their own real app/API and never consume the hosted browser server.
module.exports = defineConfig({
  ...browserConfig,
  testDir: path.join(__dirname, 'tests/e2e'),
  globalSetup: undefined,
  webServer: undefined,
  workers: 1,
  retries: 0,
  projects: desktopProjects(),
})
