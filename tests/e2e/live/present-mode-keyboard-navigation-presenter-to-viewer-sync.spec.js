import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const SLIDES = [
  { id: 's1', elements: [{ id: 't1', type: 'text', x: 80, y: 100, width: 760, height: 80, content: '<h2>Slide A</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
  { id: 's2', elements: [{ id: 't2', type: 'text', x: 80, y: 100, width: 760, height: 80, content: '<h2>Slide B</h2>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
  { id: 's3', elements: [{ id: 't3', type: 'text', x: 80, y: 100, width: 760, height: 80, content: '<h2>Slide C</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
]

async function openPresenter(context, presId, roomCode, token) {
  const page = await context.newPage()
  await page.goto('about:blank')
  await page.evaluate(
    ({ code, t }) => { window.name = JSON.stringify({ roomCode: code, presenterToken: t }) },
    { code: roomCode, t: token }
  )
  await page.goto(`/api/presentations/${presId}/present?live=${roomCode}`)
  await expect(page.locator('body')).toBeVisible()
  return page
}

async function waitForPresenterRevealReady(page) {
  await expect
    .poll(
      async () => page.evaluate(() => window.Reveal && window.Reveal.isReady?.() === true),
      { timeout: 15000 }
    )
    .toBe(true)
}

async function waitForPresenterSocketJoined(request, roomCode) {
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/live/room/${roomCode}`)
        if (!response.ok()) return false
        const room = await response.json()
        return room.exists === true && room.hasPresenter === true
      },
      { timeout: 15000, intervals: [250, 500, 1000, 2000, 3000] }
    )
    .toBe(true)
}

async function getCurrentSlideTitle(page, title) {
  const handle = await page.locator(`iframe[title="${title}"]`).elementHandle()
  if (!handle) return null
  const frame = await handle.contentFrame()
  if (!frame) return null
  return frame.evaluate(() => {
    const r = window.Reveal
    if (!r || !r.isReady?.()) return null
    const slide = r.getCurrentSlide?.()
    return slide?.querySelector('h1,h2,h3,h4,p')?.textContent?.trim() || null
  })
}

async function getPresenterSlideTitle(page) {
  return page.evaluate(() => {
    const r = window.Reveal
    if (!r || !r.isReady?.()) return null
    const slide = r.getCurrentSlide?.()
    return slide?.querySelector('h1,h2,h3,h4,p')?.textContent?.trim() || null
  })
}

async function waitForPresenterSlideTitle(presenter, expectedTitle, label) {
  await expect
    .poll(
      () => getPresenterSlideTitle(presenter),
      { timeout: 15000, intervals: [250, 500, 1000, 2000, 3000], message: label }
    )
    .toBe(expectedTitle)
}

async function waitForViewerSlideTitle(viewer, expectedTitle, label) {
  await expect
    .poll(
      () => getCurrentSlideTitle(viewer, 'Live Presentation'),
      { timeout: 15000, intervals: [250, 500, 1000, 2000, 3000], message: label }
    )
    .toBe(expectedTitle)
}

async function pressPresenterKeyAndWait(presenter, key, expectedTitle) {
  await presenter.bringToFront()
  await presenter.locator('body').focus()
  await presenter.keyboard.press(key)
  await waitForPresenterSlideTitle(presenter, expectedTitle, `presenter reached ${expectedTitle}`)
}

test.describe('Present mode keyboard navigation propagates from presenter to viewer slide content', () => {
  let presId, roomCode, token

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Keyboard Nav E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const r = await request.post('/api/live/room')
    const room = await r.json()
    roomCode = room.roomCode
    token = room.presenterToken
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('ArrowRight on presenter advances viewer slide index', async ({ context, request }) => {
    const presenter = await openPresenter(context, presId, roomCode, token)
    const viewer = await context.newPage()
    await viewer.goto(`/live/${roomCode}`)
    await waitForPresenterRevealReady(presenter)
    await waitForPresenterSocketJoined(request, roomCode)
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer initial slide')

    await pressPresenterKeyAndWait(presenter, 'ArrowRight', 'Slide B')

    await waitForViewerSlideTitle(viewer, 'Slide B', 'viewer advanced to slide 1')
  })

  test('ArrowLeft on presenter goes back to previous slide on viewer', async ({ context, request }) => {
    const presenter = await openPresenter(context, presId, roomCode, token)
    const viewer = await context.newPage()
    await viewer.goto(`/live/${roomCode}`)
    await waitForPresenterRevealReady(presenter)
    await waitForPresenterSocketJoined(request, roomCode)
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer at first slide')

    await pressPresenterKeyAndWait(presenter, 'ArrowRight', 'Slide B')
    await waitForViewerSlideTitle(viewer, 'Slide B', 'viewer at second slide')

    await pressPresenterKeyAndWait(presenter, 'ArrowLeft', 'Slide A')
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer back at first slide')
  })

  test('Home key brings presenter and viewer back to first slide', async ({ context, request }) => {
    const presenter = await openPresenter(context, presId, roomCode, token)
    const viewer = await context.newPage()
    await viewer.goto(`/live/${roomCode}`)
    await waitForPresenterRevealReady(presenter)
    await waitForPresenterSocketJoined(request, roomCode)
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer at first')

    await pressPresenterKeyAndWait(presenter, 'End', 'Slide C')
    await waitForViewerSlideTitle(viewer, 'Slide C', 'viewer at third slide')

    await pressPresenterKeyAndWait(presenter, 'Home', 'Slide A')
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer back at first')
  })

  test('end-of-deck navigation lands on last slide for viewer', async ({ context, request }) => {
    const presenter = await openPresenter(context, presId, roomCode, token)
    const viewer = await context.newPage()
    await viewer.goto(`/live/${roomCode}`)
    await waitForPresenterRevealReady(presenter)
    await waitForPresenterSocketJoined(request, roomCode)
    await waitForViewerSlideTitle(viewer, 'Slide A', 'viewer ready')

    await pressPresenterKeyAndWait(presenter, 'End', 'Slide C')

    await waitForViewerSlideTitle(viewer, 'Slide C', 'viewer at last slide')
  })
})
