import { test, expect } from '../fixtures/test-fixtures.js'
import {
  openRibbonEditor,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Icon+Text Button Clipping', () => {
  test('Insert tab buttons with text labels should not clip content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const metrics = await editor.getRibbonLayoutMetrics('Insert')

    expect(metrics).not.toBeNull()
    expect(metrics.clippedControls).toHaveLength(0)
  })

  test('Home tab buttons should not clip content at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const metrics = await editor.getRibbonLayoutMetrics('Home')

    expect(metrics).not.toBeNull()
    expect(metrics.clippedControls).toHaveLength(0)
  })
})
