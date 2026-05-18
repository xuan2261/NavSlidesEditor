import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
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
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Restore' }).first().click()
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

  test('template gallery restores default ordering after sort, filter, and favorites changes', async ({
    page,
    request,
  }) => {
    const pres = await apiCreatePresentation(request, 'Template Gallery Ordering Test')
    const editor = new EditorPage(page)
    const pageErrors = []
    const marketplacePayload = {
      categories: [
        { id: 'academic', name: 'Academic', icon: 'graduation-cap' },
        { id: 'dark', name: 'Dark', icon: 'moon' },
      ],
      templates: [
        {
          id: 'tmpl-001',
          title: 'Alpha Fundamentals',
          description: 'Academic foundations',
          category: 'academic',
          tags: ['academic'],
          difficulty: 'advanced',
          slides: [{ id: 's1' }],
        },
        {
          id: 'tmpl-002',
          title: 'Beta Mission',
          description: 'Dark presentation',
          category: 'academic',
          tags: ['dark'],
          difficulty: 'intermediate',
          slides: [{ id: 's2' }, { id: 's3' }],
        },
        {
          id: 'tmpl-003',
          title: 'Zeta Systems',
          description: 'Newest template',
          category: 'academic',
          tags: ['academic'],
          difficulty: 'basic',
          slides: [{ id: 's4' }, { id: 's5' }, { id: 's6' }],
        },
      ],
    }

    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await page.addInitScript(() => {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      window.localStorage.removeItem('navslides-favorite-templates')
    })

    await page.route('**/api/marketplace/templates', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(marketplacePayload),
      })
    })

    await editor.gotoPresentation(pres.id)
    await editor.openTemplateGallery()

    const galleryDialog = page.getByRole('dialog', { name: 'Template Gallery' })
    const galleryTitles = () => galleryDialog.locator('h4')
    const readOrder = async () =>
      (await galleryTitles().allTextContents()).map((title) => title.trim()).filter(Boolean)

    const defaultOrder = await readOrder()
    expect(defaultOrder).toEqual(['Zeta Systems', 'Beta Mission', 'Alpha Fundamentals'])

    await galleryDialog.getByRole('button', { name: 'Add to favorites' }).first().click()
    await galleryDialog.locator('select').selectOption('difficulty')
    await galleryDialog.locator('button').filter({ hasText: 'Yêu thích' }).click()
    await galleryDialog.getByPlaceholder('Tìm template...').fill('Zeta')
    await expect(galleryTitles()).toHaveCount(1)

    await galleryDialog.getByPlaceholder('Tìm template...').fill('')
    await galleryDialog.locator('button').filter({ hasText: 'Tất cả' }).click()
    await galleryDialog.locator('select').selectOption('newest')

    await expect.poll(readOrder).toEqual(defaultOrder)
    expect(pageErrors, pageErrors.join('\n')).toEqual([])

    await apiDeletePresentation(request, pres.id)
  })

  test('editor chrome keeps text editing mounted and toolbar stays within bounds', async ({
    page,
    request,
  }) => {
    const pres = await apiCreatePresentation(request, 'Editor Text Toolbar Regression Test')
    const editor = new EditorPage(page)

    await editor.gotoPresentation(pres.id)
    await editor.addTextNode()
    await editor.startEditingTextElement()
    await editor.typeInTextEditor('Chrome-safe text editing')

    let textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(1)
    expect(textState.toolbarHintVisible).toBe(false)

    const toolbarMetrics = await editor.getToolbarOverflowMetrics()
    expect(toolbarMetrics).not.toBeNull()
    expect(toolbarMetrics.scrollHeight).toBeLessThanOrEqual(toolbarMetrics.height + 1)
    expect(toolbarMetrics.overflowChildren).toBe(0)

    await page.getByRole('tab', { name: 'Insert' }).click()
    textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(1)

    await page.getByRole('tab', { name: 'Home' }).click()
    await editor.clickQuickAccessSave()
    textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(1)

    await editor.openHistoryModal()
    await expect(page.getByRole('dialog', { name: 'Version History' })).toBeVisible()
    textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(1)
    await editor.closeOverlayModal()

    await page.keyboard.press('Escape')
    textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(0)
    expect(textState.toolbarHintVisible).toBe(true)

    await editor.startEditingTextElement()
    await page.locator('.slide-canvas').click({ position: { x: 20, y: 20 } })
    textState = await editor.getTextEditorState()
    expect(textState.proseMirrorCount).toBe(0)

    await apiDeletePresentation(request, pres.id)
  })
})
