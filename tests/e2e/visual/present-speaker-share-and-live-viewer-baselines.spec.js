import { test } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import {
  expectStableScreenshot,
  suppressTutorialAndOverlays,
} from '../pages/visual-snapshot-deterministic-freeze-and-helper.js'

const SLIDES = [
  { id: 's1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 760, height: 80, content: '<h1>Visual Slide A</h1>' }], notes: 'Speaker notes A', background: { type: 'color', color: '#1e1e2e' } },
  { id: 's2', elements: [{ id: 't2', type: 'text', x: 100, y: 100, width: 760, height: 80, content: '<h1>Visual Slide B</h1>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
]

test.describe('Present, speaker, share landing, live viewer visual baselines', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Present Visual Baseline')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
  })

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('present mode renders reveal scaffold at 1920x1080', async ({ page }) => {
    await suppressTutorialAndOverlays(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`/api/presentations/${presId}/present?preview=true`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })
    await expectStableScreenshot(page, 'present-mode-1920x1080.png')
  })

  test('share landing page renders for unprotected token', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const { token } = await apiCreateShareLink(request, presId)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/share/${token}`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })
    await expectStableScreenshot(page, 'share-landing-1280x800.png')
  })

  test('live viewer initial state without presenter renders', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const r = await request.post('/api/live/room')
    const room = await r.json()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/live/${room.roomCode}`)
    await page.waitForSelector('iframe[title="Live Presentation"], body', { timeout: 15000 })
    await page.waitForTimeout(500)
    await expectStableScreenshot(page, 'live-viewer-no-presenter.png')
  })

  test('speaker view renders notes panel and thumbnails', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const r = await request.post('/api/live/room')
    const room = await r.json()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/speaker/${room.roomCode}`)
    await page.waitForTimeout(800)
    await expectStableScreenshot(page, 'speaker-view-1280x800.png')
  })
})
