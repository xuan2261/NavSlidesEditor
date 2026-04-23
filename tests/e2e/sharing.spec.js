import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
  getBaseUrl,
} from './fixtures/test-fixtures.js'

test.describe('Sharing & Privacy', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Share Test')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can open Share Modal in editor', async ({ page }) => {
    const editor = new EditorPage(page)
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await editor.gotoPresentation(presId)

    await editor.openShareModal()
    await expect(page.getByRole('dialog', { name: 'Share Presentation' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Share Presentation' })).toHaveCount(0)

    await editor.openShareModal()
    await expect(page.getByRole('dialog', { name: 'Share Presentation' })).toBeVisible()
    await editor.closeOverlayModal()
    await expect(page.getByRole('dialog', { name: 'Share Presentation' })).toHaveCount(0)

    expect(pageErrors, pageErrors.join('\n')).toEqual([])
  })

  test('share link via API returns valid token', async ({ request }) => {
    const result = await apiCreateShareLink(request, presId)
    expect(result.token).toBeTruthy()
    expect(result.shared).toBe(true)
  })

  test('can view shared presentation in new browser context', async ({ browser, request }) => {
    const result = await apiCreateShareLink(request, presId)
    const token = result.token
    expect(token).toBeTruthy()

    const viewerContext = await browser.newContext()
    const viewerPage = await viewerContext.newPage()

    await viewerPage.goto(new URL(`/share/${token}`, getBaseUrl()).toString(), { timeout: 15000 })
    await expect(viewerPage.locator('.reveal')).toBeVisible({ timeout: 10000 })

    await viewerContext.close()
  })
})
