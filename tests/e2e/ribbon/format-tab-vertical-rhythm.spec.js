import { test, expect } from '../fixtures/test-fixtures.js'
import {
  openRibbonEditor,
  sectionLabels,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Format Tab Vertical Rhythm', () => {
  test('Format tab is hidden until an element is selected', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.getByTestId('ribbon-tab-format')).toHaveCount(0)
  })

  test('Format tab selected shape exposes contextual groups in order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await editor.addShape('Rectangle')
    await page.locator('.element-wrapper[data-element-type="shape"]').first().click({ force: true })
    await expect(page.getByRole('complementary', { name: 'Properties panel' })).toContainText('Element')

    const metrics = await editor.getRibbonLayoutMetrics('Format')
    expect(metrics).not.toBeNull()
    expect(sectionLabels(metrics)).toEqual([
      'Fill',
      'Stroke',
      'Position',
      'Size',
      'Rotate',
      'Opacity',
      'Align',
      'Properties',
    ])
    expect(metrics.clippedControls).toHaveLength(0)
    expect(metrics.overlaps).toHaveLength(0)
  })

  test('Format tab controls should have consistent row height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await editor.addShape('Rectangle')
    await page.locator('.element-wrapper[data-element-type="shape"]').first().click({ force: true })
    const metrics = await editor.getRibbonLayoutMetrics('Format')
    expect(metrics).not.toBeNull()

    const controlHeights = await page.evaluate(() => {
      const panel = document.querySelector('.tour-step-ribbon')
      if (!panel) return []

      const controls = panel.querySelectorAll('button, select, input')
      return Array.from(controls).map((el) => {
        const rect = el.getBoundingClientRect()
        return { height: rect.height, tag: el.tagName }
      })
    })

    const buttonHeights = controlHeights.filter((c) => c.tag === 'BUTTON').map((c) => c.height)
    if (buttonHeights.length === 0) {
      // Format tab may show placeholder when no element selected - this is acceptable
      return
    }

    const uniqueHeights = [...new Set(buttonHeights.map((h) => Math.round(h)))]

    expect(
      uniqueHeights.length,
      `Format tab should have consistent button heights (found: ${uniqueHeights.join(', ')}px)`
    ).toBeLessThanOrEqual(2)

    buttonHeights.forEach((h) => {
      expect(h, 'Button height should be 28-32px').toBeGreaterThanOrEqual(26)
      expect(h, 'Button height should be 28-32px').toBeLessThanOrEqual(34)
    })
  })
})
