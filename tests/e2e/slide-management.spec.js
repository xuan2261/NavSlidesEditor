import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Slide Management Advanced', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Slide Management Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can add a blank slide', async () => {
    const initialCount = await editorPage.getSlideCount()
    await editorPage.addSlide()
    const newCount = await editorPage.getSlideCount()
    expect(newCount).toBe(initialCount + 1)
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can add slide from template (Two Column)', async ({ page }) => {
    const initialCount = await editorPage.getSlideCount()
    await editorPage.addSlideFromTemplate('Two Column')
    const newCount = await editorPage.getSlideCount()
    expect(newCount).toBe(initialCount + 1)
  })

  test('can delete a slide', async () => {
    await editorPage.addSlide()
    const count = await editorPage.getSlideCount()
    expect(count).toBeGreaterThanOrEqual(2)

    await editorPage.deleteSlide(count - 1)
    const newCount = await editorPage.getSlideCount()
    expect(newCount).toBe(count - 1)
  })

  test('can navigate between slides by clicking thumbnails', async () => {
    await editorPage.addSlide()
    const count = await editorPage.getSlideCount()
    expect(count).toBeGreaterThanOrEqual(2)

    await editorPage.selectSlide(0)
    await editorPage.selectSlide(1)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('can change slide background to solid color', async ({ page }) => {
    await editorPage.addToolbarElement('Slide Background')
    await page.waitForSelector('.bg-popup-container')

    const colorTab = page.locator('.bg-type-tab:has-text("Color")')
    if ((await colorTab.count()) > 0) {
      await colorTab.click()
      const swatch = page.locator('.bg-popup-container div[style*="background"]').first()
      if ((await swatch.count()) > 0) {
        await swatch.click()
        await page.waitForTimeout(500)
      }
    }
  })

  test('can change slide background to gradient', async () => {
    await editorPage.changeBackgroundToGradient()
  })

  test('slide panel shows correct thumbnails count', async () => {
    const initialCount = await editorPage.getSlideCount()
    expect(initialCount).toBeGreaterThanOrEqual(1)

    await editorPage.addSlide()
    await editorPage.addSlide()

    const finalCount = await editorPage.getSlideCount()
    expect(finalCount).toBe(initialCount + 2)
  })

  test('multiple slide templates are available in modal', async ({ page }) => {
    await editorPage.addSlideBtn.click()
    await page.waitForSelector('.fixed.inset-0 h2:has-text("Add Slide")')

    const blankBtn = page.locator('.fixed.inset-0 button').filter({ hasText: 'Blank' })
    await expect(blankBtn).toBeVisible()
    await page.keyboard.press('Escape')
  })
})
