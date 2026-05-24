import { test, expect } from '../fixtures/test-fixtures.js'
import { CONFIGURED_STATUS, installRcloneMocks } from '../fixtures/rclone-mock.js'

async function openSyncFromEditor(page, presentationId) {
  await page.addInitScript(() => {
    window.__E2E__ = true
    window.localStorage.setItem('navSlidesTutorialSeen', 'true')
    window.localStorage.setItem('navSlidesProductTourSeen', 'true')
  })
  await page.goto(`/editor/${presentationId}`)
  await page.getByTestId('ribbon-file-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Sync to Cloud' }).click()
  await expect(page.getByTestId('sync-modal-dialog')).toBeVisible()
}

test.describe('rclone Proton Drive sync', () => {
  test('opens sync modal from Settings', async ({ page, testPresentation: _testPresentation }) => {
    await installRcloneMocks(page)
    await page.goto('/settings')
    await page.getByTestId('settings-open-sync').click()
    await expect(page.getByTestId('sync-modal-dialog')).toBeVisible()
  })

  test('configures Proton Drive credentials from Settings', async ({ page, testPresentation: _testPresentation }) => {
    await installRcloneMocks(page, {
      statusSequence: [
        { installed: true, version: 'rclone v1.68.0', hasConfig: false, remotes: [] },
        { installed: true, version: 'rclone v1.68.0', hasConfig: false, remotes: [] },
        CONFIGURED_STATUS,
      ],
    })
    await page.goto('/settings')
    await page.getByTestId('settings-open-sync').click()

    await expect(page.getByTestId('sync-modal-dialog')).toBeVisible()
    await expect(page.getByTestId('sync-provider-proton-drive')).toBeVisible()
    await page.getByPlaceholder('user@proton.me').fill('user@proton.me')
    await page.getByPlaceholder('Password').fill('correct horse battery staple')
    await page.getByPlaceholder('protondrive').fill('protondrive')
    await page.getByTestId('sync-configure-confirm').click()

    await expect(page.getByTestId('sync-status-configured')).toContainText('protondrive')
    await expect(page.getByTestId('sync-push-result')).toContainText('Connected to Proton Drive')
  })

  test('syncs all presentations through /api/rclone/sync', async ({ page, testPresentation: _testPresentation }) => {
    await installRcloneMocks(page, { statusSequence: [CONFIGURED_STATUS] })
    await page.goto('/settings')
    await page.getByTestId('settings-open-sync').click()
    await page.getByTestId('sync-pull-btn').click()
    await expect(page.getByTestId('sync-pull-result')).toContainText('12')
  })

  test('syncs one presentation through /api/rclone/sync-single', async ({ page, testPresentation }) => {
    await installRcloneMocks(page, { statusSequence: [CONFIGURED_STATUS] })
    await openSyncFromEditor(page, testPresentation.id)
    await page.getByTestId('sync-push-btn').click()
    await expect(page.getByTestId('sync-push-result')).toContainText('protondrive:/slides-backup')
  })

  test('handles 500 from /api/rclone/sync gracefully', async ({ page, testPresentation: _testPresentation }) => {
    await installRcloneMocks(page, {
      statusSequence: [CONFIGURED_STATUS],
      syncStatus: 500,
      sync: { error: 'rclone not installed' },
    })
    await page.goto('/settings')
    await page.getByTestId('settings-open-sync').click()
    await page.getByTestId('sync-pull-btn').click()
    await expect(page.getByTestId('sync-error-toast')).toContainText(/rclone not installed/i)
  })
})
