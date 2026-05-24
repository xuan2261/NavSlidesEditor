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
