import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function createTextSlide(id, label) {
  return {
    id,
    elements: [
      {
        id: `${id}-text`,
        type: 'text',
        x: 80,
        y: 100,
        width: 500,
        height: 120,
        zIndex: 1,
        content: `<p>${label}</p>`,
      },
    ],
    notes: `${label} notes`,
    background: { type: 'color', color: '#1e1e2e' },
  }
}

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
    await expect(page.getByText('Slide Background')).toBeVisible()

    const initialBgColor = await page.evaluate(() => {
      const el = document.querySelector('.slide-canvas')
      return el ? window.getComputedStyle(el).backgroundColor : ''
    })

    await page.getByRole('button', { name: 'color' }).click()
    const swatches = page.getByRole('button', { name: /^Background / }).filter({ visible: true })
    await expect(swatches.first()).toBeVisible()
    await swatches.nth(1).click()
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const el = document.querySelector('.slide-canvas')
            return el ? window.getComputedStyle(el).backgroundColor : ''
          }),
        { timeout: 5000 }
      )
      .not.toBe(initialBgColor)
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

  test('can open slide context menu from slide panel', async ({ page }) => {
    await page.locator('.slide-panel .slide-item').first().click({ button: 'right' })

    await expect(page.locator('button').filter({ hasText: 'Duplicate' }).last()).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Move Down' })).toBeVisible()
  })

  test('multiple slide templates are available in modal', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await editorPage.addSlideBtn.click()
    await page.waitForSelector('.fixed.inset-0 h2:has-text("Add Slide")')

    const blankBtn = page.locator('.fixed.inset-0 button').filter({ hasText: 'Blank' })
    await expect(blankBtn).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Add Slide' })).toHaveCount(0)
    expect(pageErrors, pageErrors.join('\n')).toEqual([])
  })

  test('add slide modal keeps body clicks inside and closes on overlay click', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await editorPage.addSlideBtn.click()
    await page.waitForSelector('.fixed.inset-0 h2:has-text("Add Slide")')

    const overlay = page.locator('.fixed.inset-0').last()
    const modal = page.locator('.fixed.inset-0 > div').last()

    await modal.click()
    await expect(page.locator('h2:has-text("Add Slide")')).toBeVisible()

    await overlay.click({ position: { x: 10, y: 10 } })
    await expect(page.locator('h2:has-text("Add Slide")')).toHaveCount(0)
    expect(pageErrors, pageErrors.join('\n')).toEqual([])
  })

  test('multi-select duplicate keeps the duplicated block selected in order', async ({ request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createTextSlide('slide-a', 'Slide A'),
        createTextSlide('slide-b', 'Slide B'),
        createTextSlide('slide-c', 'Slide C'),
        createTextSlide('slide-d', 'Slide D'),
      ],
    })

    await editorPage.gotoPresentation(presId)
    await editorPage.selectSlide(1)
    await editorPage.toggleSlideSelection(2)
    await editorPage.duplicateSelectedSlides()

    await editorPage.waitForSlideCount(6)
    await expect(editorPage.thumbnailsLocator.nth(4)).toHaveClass(/border-accent/, { timeout: 5000 })
    await editorPage.waitForAutoSave()

    await expect
      .poll(async () => {
        const presentation = await apiGetPresentation(request, presId)
        return presentation.slides.length
      })
      .toBe(6)
  })

})
