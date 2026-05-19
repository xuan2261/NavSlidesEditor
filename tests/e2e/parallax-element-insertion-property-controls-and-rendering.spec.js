import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
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
    await page.waitForTimeout(500)
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

  test('HTML embed element renders iframe in canvas via API seed', async ({ page }) => {
    const pres = await apiGetPresentation(page.request, presId)
    pres.slides[0].elements.push({
      id: 'html-e2e',
      type: 'html',
      content: '<div style="color:white">Hello Embed</div>',
      x: 100, y: 100, width: 400, height: 300, zIndex: 2,
    })
    await apiUpdatePresentation(page.request, presId, pres)
    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(1)
    const iframe = page.locator('.element-wrapper iframe').first()
    await expect(iframe).toBeVisible({ timeout: 5000 })
  })

  test('ported element properties persist and export to present HTML', async ({ page, request }) => {
    const pres = await apiGetPresentation(request, presId)
    pres.slides[0].elements.push(
      {
        id: 'text-rich-e2e',
        type: 'text',
        content: '<p style="line-height: 1.5"><span style="font-weight: 700">Weighted text</span></p>',
        x: 40, y: 40, width: 320, height: 120, zIndex: 1,
      },
      {
        id: 'video-export-e2e',
        type: 'video',
        videoUrl: 'https://example.com/video.mp4',
        startTime: 4,
        endTime: 9,
        playbackRate: 1.5,
        x: 80, y: 170, width: 320, height: 180, zIndex: 2,
      },
      {
        id: 'timeline-export-e2e',
        type: 'timeline',
        timelineStart: '2000',
        timelineEnd: '2025',
        tickSpacing: 'auto',
        events: [{ id: 'evt-1', date: '2010', title: 'Launch', description: 'Milestone' }],
        x: 420, y: 80, width: 460, height: 260, zIndex: 3,
      },
      {
        id: 'image-citation-export-e2e',
        type: 'image',
        src: '/uploads/test.jpg',
        citationText: 'Photo by Test Author',
        citationLink: 'https://example.com/source',
        citationColor: '#808080',
        x: 60, y: 360, width: 240, height: 140, zIndex: 4,
      }
    )
    await apiUpdatePresentation(request, presId, pres)

    const reloaded = await apiGetPresentation(request, presId)
    const ids = reloaded.slides[0].elements.map((el) => el.id)
    expect(ids).toEqual(expect.arrayContaining([
      'text-rich-e2e',
      'video-export-e2e',
      'timeline-export-e2e',
      'image-citation-export-e2e',
    ]))

    await editorPage.gotoPresentation(presId)
    await expect(page.locator('.element-wrapper')).toHaveCount(4)
    await expect(page.locator('[data-testid="timeline-svg"]')).toBeVisible()

    const exportRes = await request.get(`/api/presentations/${presId}/present?preview=true`)
    expect(exportRes.ok()).toBeTruthy()
    const html = await exportRes.text()
    expect(html).toContain('font-weight: 700')
    expect(html).toContain('line-height: 1.5')
    expect(html).toContain('https://example.com/video.mp4#t=4,9')
    expect(html).toContain('this.playbackRate=1.5')
    expect(html).toContain('Launch')
    expect(html).toContain('Photo by Test Author')
  })
})
