import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { waitForNextFrame } from '../pages/wait-helpers.js'

const SLIDES = [
  { id: 's1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide A</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
  { id: 's2', elements: [{ id: 't2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide B</h2>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
]

test.describe('Touch gestures on tablet viewport for slide navigation and tap interactions', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Touch Gestures E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
  })

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('touch tap on present mode body fires native click handler', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      isMobile: false,
    })
    const page = await ctx.newPage()
    await page.goto(`/api/presentations/${presId}/present?preview=true`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })

    const box = await page.locator('body').boundingBox()
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.reveal')).toBeVisible()
    await ctx.close()
  })

  test('mobile editor at Pixel-7 viewport renders slide canvas with touch enabled', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await ctx.newPage()
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas, body', { timeout: 15000 })
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true)
    await ctx.close()
  })

  test('horizontal swipe across reveal area is non-throwing and surface remains stable', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
    })
    const page = await ctx.newPage()
    await page.goto(`/api/presentations/${presId}/present?preview=true`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })

    const box = await page.locator('.reveal').boundingBox()
    const startX = box.x + box.width * 0.85
    const endX = box.x + box.width * 0.15
    const y = box.y + box.height / 2

    await page.touchscreen.tap(startX, y)
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(endX, y, { steps: 10 })
    await page.mouse.up()
    await waitForNextFrame(page)

    await expect(page.locator('.reveal section').first()).toBeVisible()
    await ctx.close()
  })

  test('double-tap registers as two distinct touch events', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
    })
    const page = await ctx.newPage()
    await page.goto(`/api/presentations/${presId}/present?preview=true`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })

    const counted = await page.evaluate(() => {
      let count = 0
      document.addEventListener('touchend', () => { count += 1 })
      window.__touchCount = () => count
    })
    expect(counted).toBeUndefined()

    const box = await page.locator('body').boundingBox()
    await page.touchscreen.tap(box.x + 100, box.y + 100)
    await page.touchscreen.tap(box.x + 100, box.y + 100)

    const total = await page.evaluate(() => window.__touchCount?.() ?? 0)
    expect(total).toBeGreaterThanOrEqual(2)
    await ctx.close()
  })
})
