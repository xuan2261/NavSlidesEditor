import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiCreateSnapshot,
  apiDeletePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Editor POM Workflow', () => {
  test('should create presentation and change background using POM', async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'E2E POM Editor Test')
    const editor = new EditorPage(page)

    await editor.gotoPresentation(pres.id)

    // Verify slide background feature
    await editor.changeBackgroundToGradient()

    await apiDeletePresentation(request, pres.id)
  })

  test('Sync and Version History modals close on Escape and overlay without runtime errors', async ({
    page,
    request,
  }) => {
    const pres = await apiCreatePresentation(request, 'Editor Modal Regression Test')
    const editor = new EditorPage(page)
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await editor.gotoPresentation(pres.id)

    await editor.openSyncModal()
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toHaveCount(0)

    await editor.openSyncModal()
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
    await editor.closeOverlayModal()
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toHaveCount(0)

    await editor.openHistoryModal()
    await expect(page.getByRole('dialog', { name: 'Version History' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Version History' })).toHaveCount(0)

    await editor.openHistoryModal()
    await expect(page.getByRole('dialog', { name: 'Version History' })).toBeVisible()
    await editor.closeOverlayModal()
    await expect(page.getByRole('dialog', { name: 'Version History' })).toHaveCount(0)

    expect(pageErrors, pageErrors.join('\n')).toEqual([])

    await apiDeletePresentation(request, pres.id)
  })

  test('Version History shows inline errors and retry flows without crashing the page', async ({
    page,
    request,
  }) => {
    const pres = await apiCreatePresentation(request, 'Editor History Error Regression Test')
    await apiCreateSnapshot(request, pres.id, 'Seed Snapshot')

    const editor = new EditorPage(page)
    const pageErrors = []
    let failSnapshotList = true
    let failSave = false
    let failRestore = false
    let failDelete = false

    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await page.route(`**/api/presentations/${pres.id}/snapshots`, async (route) => {
      if (failSnapshotList) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Snapshot list failed' }),
        })
        return
      }

      await route.continue()
    })

    await page.route(`**/api/presentations/${pres.id}/snapshot`, async (route) => {
      if (failSave) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Save snapshot failed' }),
        })
        return
      }

      await route.continue()
    })

    await page.route(`**/api/presentations/${pres.id}/restore/*`, async (route) => {
      if (failRestore) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Restore snapshot failed' }),
        })
        return
      }

      await route.continue()
    })

    await page.route(`**/api/presentations/${pres.id}/snapshots/*`, async (route) => {
      if (failDelete && route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Delete snapshot failed' }),
        })
        return
      }

      await route.continue()
    })

    await editor.gotoPresentation(pres.id)
    await editor.openHistoryModal()

    const historyDialog = page.getByRole('dialog', { name: 'Version History' })
    await expect(historyDialog).toBeVisible()
    await expect(page.getByText('Snapshot list failed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    failSnapshotList = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('Seed Snapshot')).toBeVisible()

    failSave = true
    await page.getByPlaceholder('Snapshot name (optional)').fill('Broken Save')
    await historyDialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Save snapshot failed')).toBeVisible()
    await expect(historyDialog).toBeVisible()
    failSave = false

    failRestore = true
    await page.getByRole('button', { name: 'Restore' }).first().click()
    await page
      .getByRole('dialog', { name: 'Restore snapshot' })
      .getByRole('button', { name: 'Restore', exact: true })
      .click()
    await expect(page.getByText('Restore snapshot failed')).toBeVisible()
    await expect(historyDialog).toBeVisible()
    failRestore = false

    failDelete = true
    await page.locator('button[title="Delete snapshot"]').first().click()
    await expect(page.getByText('Delete snapshot failed')).toBeVisible()
    await expect(historyDialog).toBeVisible()

    expect(pageErrors, pageErrors.join('\n')).toEqual([])

    await apiDeletePresentation(request, pres.id)
  })

})
