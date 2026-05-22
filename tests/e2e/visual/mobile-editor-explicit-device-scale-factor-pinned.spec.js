import { test } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import {
  expectStableScreenshot,
  skipNonLinuxVisualSnapshots,
  suppressTutorialAndOverlays,
} from '../pages/visual-snapshot-deterministic-freeze-and-helper.js'

test.describe('Mobile editor visual baseline pinned to deviceScaleFactor 2', () => {
  skipNonLinuxVisualSnapshots()

  let presId

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('mobile editor at 390x844 with explicit DPR 2 renders deterministic baseline', async ({ browser, request }) => {
    const pres = await apiCreatePresentation(request, 'Mobile Editor Visual')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 's1', notes: '', background: { type: 'color', color: '#1e1e2e' },
        elements: [{ id: 't1', type: 'text', x: 100, y: 200, width: 600, height: 80, content: '<h2>Mobile</h2>' }],
      }],
    })

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await ctx.newPage()
    await suppressTutorialAndOverlays(page)
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas, body', { timeout: 15000 })
    await page.waitForTimeout(500)
    await expectStableScreenshot(page, 'mobile-editor-390x844-dpr2.png')
    await ctx.close()
  })
})
