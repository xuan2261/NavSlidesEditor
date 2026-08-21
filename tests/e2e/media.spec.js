import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Media Library & Templates', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Media Test Presentation')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can open Media Library and see tabs', async ({ page }) => {
    await editorPage.openMediaLibrary()
    await expect(page.locator('button').filter({ hasText: /unsplash/i })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /giphy/i })).toBeVisible()
  })

  test('can search Unsplash with mocked response', async ({ page }) => {
    await page.route('https://api.unsplash.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              urls: {
                small: 'https://via.placeholder.com/200',
                regular: 'https://via.placeholder.com/600',
              },
              alt_description: 'test image',
            },
          ],
        }),
      })
    })

    await editorPage.openMediaLibrary()
    await page
      .locator('button')
      .filter({ hasText: /unsplash/i })
      .click()

    const searchInput = page.locator('input[placeholder*="earch"]').first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('nature')
    await searchInput.press('Enter')
    await expect(page.locator('text=Loading...')).toHaveCount(0, { timeout: 5000 })
    await expect(page.getByTestId('media-library-item').first()).toBeVisible({ timeout: 5000 })
  })

  test('can add a slide from Template in the modal', async ({ page }) => {
    await editorPage.addSlideBtn.click()
    await page.waitForSelector('h2:has-text("Add Slide")')

    const blankBtn = page.locator('.fixed.inset-0 button').filter({ hasText: 'Blank' })
    await blankBtn.click()
    const count = await editorPage.getSlideCount()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
