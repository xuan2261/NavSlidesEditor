import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Parallax Features E2E', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Parallax Features Test')
    presId = pres.id
    pres.slides[0].elements = []
    await apiUpdatePresentation(request, presId, pres)
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('insert Timeline element from insert menu', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Timeline')
    await editorPage.waitForElementCount(prevCount + 1)
    await expect(page.locator('[data-testid="timeline-svg"]')).toBeVisible()
  })

  test('insert Kinetic Text from insert menu opens modal', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Kinetic Text')
    await expect(page.locator('.fixed').filter({ hasText: 'Kinetic Text' })).toBeVisible()
    await page.locator('.fixed button:has-text("Insert")').first().click()
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
    await expect(page.locator('.element-wrapper iframe')).toBeVisible()
  })

  test('insert Math Grid from insert menu opens modal', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Math Grid')
    await expect(page.locator('.fixed').filter({ hasText: 'Math Grid' })).toBeVisible()
    await page.locator('.fixed button:has-text("Insert")').first().click()
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
    await expect(page.locator('.element-wrapper iframe')).toBeVisible()
  })

  test('insert Anime.js animation from insert menu opens modal', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Anime.js')
    await expect(page.locator('.fixed').filter({ hasText: 'Anime.js Animation' })).toBeVisible()
    await page.locator('.fixed button:has-text("Insert")').first().click()
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
    await expect(page.locator('.element-wrapper iframe')).toBeVisible()
  })

  test('insert Three.js scene from insert menu opens modal', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Three.js')
    await expect(page.locator('.fixed').filter({ hasText: 'Three.js 3D Scene' })).toBeVisible()
    await page.locator('.fixed button:has-text("Insert")').first().click()
    await page.waitForFunction(
      (prev) => document.querySelectorAll('.element-wrapper').length > prev,
      prevCount,
      { timeout: 5000 }
    )
    await expect(page.locator('.element-wrapper iframe')).toBeVisible()
  })

  test('FontWeight control visible in properties panel for text', async ({ page }) => {
    await editorPage.insert.addTextNode()
    await editorPage.startEditingTextElement(0)

    const fontWeightSelect = page.locator('[data-testid="font-weight-select"]').first()
    await expect(fontWeightSelect).toBeVisible()
    await fontWeightSelect.selectOption('700')
    await expect(editorPage.elementsCountLocator).toHaveCount(1)
  })

  test('LineHeight control visible in properties panel for text', async ({ page }) => {
    await editorPage.insert.addTextNode()
    await editorPage.startEditingTextElement(0)

    await page.getByRole('button', { name: 'Paragraph' }).click()
    const menu = page.getByRole('menu')
    const lineHeightSelect = menu.locator('select')
    await expect(lineHeightSelect).toBeVisible()
    await lineHeightSelect.selectOption('1.5')
    await expect(editorPage.elementsCountLocator).toHaveCount(1)
  })

  test('Ctrl+K does not crash when editing text', async ({ page }) => {
    await editorPage.insert.addTextNode()
    await editorPage.canvas.selectElement(0)
    const element = page.locator('.element-wrapper').first()
    await element.dblclick()
    await page.keyboard.press('Control+k')
    // Just verify no crash — link modal may or may not be implemented
    await expect(editorPage.elementsCountLocator).toHaveCount(1)
  })

  test('Video element with URL renders in canvas via API seed', async ({ page }) => {
    const pres = await apiGetPresentation(page.request, presId)
    pres.slides[0].elements.push({
      id: 'video-url-e2e',
      type: 'video',
      videoUrl: 'https://example.com/sample.mp4',
      x: 100, y: 100, width: 480, height: 270, zIndex: 2,
      startTime: 0, endTime: 0, playbackRate: 1,
    })
    await apiUpdatePresentation(page.request, presId, pres)
    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(1)
    const video = page.locator('.element-wrapper video').first()
    await expect(video).toBeVisible({ timeout: 5000 })
  })

  test('Timeline element renders SVG in canvas via API seed', async ({ page }) => {
    const pres = await apiGetPresentation(page.request, presId)
    pres.slides[0].elements.push({
      id: 'timeline-e2e',
      type: 'timeline',
      x: 50, y: 100, width: 800, height: 400, zIndex: 2,
      startDate: '2000', endDate: '2025', tickSpacing: 'auto',
      lineColor: '#6366f1', dotColor: '#6366f1', textColor: '#ffffff', fontSize: 12,
      items: [{ id: 'evt-1', date: '2010', label: 'Launch', description: 'Product launch', side: 'top' }],
    })
    await apiUpdatePresentation(page.request, presId, pres)
    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(1)
    const svg = page.locator('.element-wrapper svg').first()
    await expect(svg).toBeVisible({ timeout: 5000 })
  })

  test('LaTeX element with custom font size renders via API seed', async ({ page }) => {
    const pres = await apiGetPresentation(page.request, presId)
    pres.slides[0].elements.push({
      id: 'latex-e2e',
      type: 'latex',
      content: 'E=mc^2',
      x: 100, y: 100, width: 300, height: 200, zIndex: 2,
      fontSize: 28, textColor: '#10b981',
    })
    await apiUpdatePresentation(page.request, presId, pres)
    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(1)
    const iframe = page.locator('.element-wrapper iframe').first()
    await expect(iframe).toBeVisible({ timeout: 5000 })
  })

  test('Image with citation renders in canvas via API seed', async ({ page }) => {
    const pres = await apiGetPresentation(page.request, presId)
    pres.slides[0].elements.push({
      id: 'img-cite-e2e',
      type: 'image',
      src: '/uploads/test.jpg',
      x: 100, y: 100, width: 400, height: 300, zIndex: 2,
      citationText: 'Photo by Test Author',
      citationColor: '#808080',
    })
    await apiUpdatePresentation(page.request, presId, pres)
    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(1)
  })

})
