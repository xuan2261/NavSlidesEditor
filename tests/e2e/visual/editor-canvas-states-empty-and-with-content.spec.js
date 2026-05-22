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

test.describe('Editor canvas visual baselines across content states', () => {
  skipNonLinuxVisualSnapshots()

  let presId

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('empty canvas with thumb panel renders at 1280x800', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const pres = await apiCreatePresentation(request, 'Empty Canvas')
    presId = pres.id
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await expectStableScreenshot(page, 'editor-empty-canvas-1280x800.png')
  })

  test('empty canvas at smaller 1024x768 viewport', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const pres = await apiCreatePresentation(request, 'Empty 1024')
    presId = pres.id
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await expectStableScreenshot(page, 'editor-empty-canvas-1024x768.png')
  })

  test('canvas with text and shape elements', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const pres = await apiCreatePresentation(request, 'Text+Shape')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1', notes: '', background: { type: 'color', color: '#1e1e2e' },
        elements: [
          { id: 'tx', type: 'text', x: 100, y: 80, width: 600, height: 60, content: '<h1>Visual Baseline</h1>' },
          { id: 'sh', type: 'shape', shape: 'rect', x: 100, y: 200, width: 300, height: 160, fill: '#6366f1', stroke: '#fff', strokeWidth: 2, text: 'Box', textColor: '#fff' },
        ],
      }],
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await page.locator('[data-testid="slide-element-sh"]').waitFor({ timeout: 10000 })
    await expectStableScreenshot(page, 'editor-canvas-with-text-and-shape.png')
  })

  test('canvas with chart and code elements', async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const pres = await apiCreatePresentation(request, 'Chart+Code')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1', notes: '', background: { type: 'color', color: '#1e1e2e' },
        elements: [
          { id: 'ch', type: 'chart', x: 80, y: 80, width: 480, height: 280, chartType: 'bar', chartData: { labels: ['A','B','C'], datasets: [{ label: 'Vals', data: [10,20,15], color: '#22c55e' }] } },
          { id: 'cd', type: 'code', x: 580, y: 80, width: 360, height: 280, language: 'javascript', content: 'const x = 1;\nconsole.log(x)' },
        ],
      }],
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await page.locator('[data-testid="slide-element-ch"]').waitFor({ timeout: 10000 })
    await expectStableScreenshot(page, 'editor-canvas-with-chart-and-code.png')
  })
})
