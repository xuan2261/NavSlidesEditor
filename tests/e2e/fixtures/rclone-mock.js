const DEFAULT_STATUS = {
  installed: true,
  version: 'rclone v1.68.0',
  hasConfig: false,
  remotes: [],
}

const CONFIGURED_STATUS = {
  installed: true,
  version: 'rclone v1.68.0',
  hasConfig: true,
  remotes: ['protondrive'],
}

export async function installRcloneMocks(page, overrides = {}) {
  let statusCalls = 0
  let configured = false
  const statusSequence = overrides.statusSequence || [
    overrides.status || DEFAULT_STATUS,
    overrides.configuredStatus || CONFIGURED_STATUS,
  ]
  const configuredStatus = overrides.configuredStatus || CONFIGURED_STATUS

  function assertMethod(route, expectedMethod) {
    const actualMethod = route.request().method()
    if (actualMethod !== expectedMethod) {
      throw new Error(
        `Unexpected ${route.request().url()} method: expected ${expectedMethod}, got ${actualMethod}`
      )
    }
  }

  await page.route('**/api/rclone/status', (route) => {
    assertMethod(route, 'GET')
    // Once /config has been POSTed the remote is configured, so report it as such
    // regardless of how many times the UI polls status on mount. This mirrors the
    // real server and keeps the test independent of mount-poll count, which differs
    // between dev (StrictMode double-invokes effects) and a production build.
    if (configured) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(configuredStatus),
      })
    }
    const index = Math.min(statusCalls, statusSequence.length - 1)
    statusCalls += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusSequence[index]),
    })
  })

  await page.route('**/api/rclone/config', (route) =>
    {
      assertMethod(route, 'POST')
      configured = true
      return route.fulfill({
        status: overrides.configStatus || 200,
        contentType: 'application/json',
        body: JSON.stringify(overrides.config || { success: true, remote: 'protondrive' }),
      })
    }
  )

  await page.route('**/api/rclone/sync', (route) =>
    {
      assertMethod(route, 'POST')
      return route.fulfill({
        status: overrides.syncStatus || 200,
        contentType: 'application/json',
        body: JSON.stringify(
          overrides.sync || {
            success: true,
            synced: 12,
            destination: 'protondrive:/slides-backup',
          }
        ),
      })
    }
  )

  await page.route('**/api/rclone/sync-single', (route) =>
    {
      assertMethod(route, 'POST')
      return route.fulfill({
        status: overrides.syncSingleStatus || 200,
        contentType: 'application/json',
        body: JSON.stringify(
          overrides.syncSingle || {
            success: true,
            destination: 'protondrive:/slides-backup/auto_e2e_fixture',
          }
        ),
      })
    }
  )
}

export { CONFIGURED_STATUS, DEFAULT_STATUS }
