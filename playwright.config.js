const path = require('path')
const { defineConfig, devices } = require('@playwright/test')
const clientPort = process.env.PLAYWRIGHT_CLIENT_PORT || '4173'
const serverPort = process.env.PLAYWRIGHT_SERVER_PORT || '3202'
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://127.0.0.1:${clientPort}`
const apiTarget = `http://127.0.0.1:${serverPort}`
const runId =
  process.env.PLAYWRIGHT_RUN_ID ||
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const runRoot = path.join(__dirname, '.playwright', 'runs', runId)
const dataDir = path.join(runRoot, 'data')
const uploadsDir = path.join(runRoot, 'uploads')

process.env.PLAYWRIGHT_TEST_BASE_URL = baseURL

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'html',
  timeout: process.env.CI ? 60000 : 30000,
  use: {
    baseURL,
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 100,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /tests\/e2e\/live(?:\.spec\.js$|\/.*\.spec\.js$)/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-live',
      testMatch: /tests\/e2e\/live(?:\.spec\.js$|\/.*\.spec\.js$)/,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.PLAYWRIGHT_MOBILE_CHROMIUM
      ? [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }]
      : []),
  ],
  webServer: {
    command: `npx concurrently "npm run dev --workspace=server" "npm run dev --workspace=client -- --host 127.0.0.1 --port ${clientPort}"`,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      PORT: serverPort,
      SLIDES_DATA_DIR: dataDir,
      SLIDES_UPLOADS_DIR: uploadsDir,
      VITE_API_PROXY_TARGET: apiTarget,
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
})
