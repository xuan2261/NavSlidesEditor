import { test, expect } from '../fixtures/test-fixtures.js'
import {
  openRibbonEditor,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Responsive Pressure Points', () => {
  test('Insert tab should gracefully handle 900px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 })
    const metrics = await editor.getRibbonLayoutMetrics('Insert')

    expect(metrics).not.toBeNull()
    expect(metrics.buttonCount).toBeGreaterThan(0)

    const criticalButtons = ['Add text', 'Insert shape', 'Add chart', 'More advanced insert options']
    const clipping = await editor.getButtonClippingStatus(criticalButtons)

    Object.entries(clipping).forEach(([label, status]) => {
      expect(status.found, `"${label}" should exist`).toBe(true)
      expect(status.isClipped, `"${label}" should not be clipped`).toBe(false)
    })
  })

  test('Home tab should remain usable at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 600 })
    const metrics = await editor.getRibbonLayoutMetrics('Home')

    expect(metrics).not.toBeNull()
    expect(metrics.buttonCount).toBeGreaterThan(0)
    expect(metrics.overlaps).toHaveLength(0)
  })
})
