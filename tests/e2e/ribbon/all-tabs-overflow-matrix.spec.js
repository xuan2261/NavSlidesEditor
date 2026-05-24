import { test, expect } from '../fixtures/test-fixtures.js'
import {
  CRITICAL_VISIBLE_CONTROLS,
  expectClassicRibbonRow,
  expectNoRowVerticalOverflow,
  openRibbonEditor,
  RIBBON_TABS,
  VIEWPORTS,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('All Tabs Overflow Matrix', () => {
  for (const tab of RIBBON_TABS) {
    test(`${tab} tab should not have vertical overflow at 1280px`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics(tab)

      expect(metrics).not.toBeNull()
      expectClassicRibbonRow(metrics, tab)
      expectNoRowVerticalOverflow(metrics, tab)
    })
  }

  for (const viewport of VIEWPORTS) {
    for (const tab of RIBBON_TABS) {
      test(`${tab} tab should not clip controls at ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        const metrics = await editor.getRibbonLayoutMetrics(tab)

        expect(metrics).not.toBeNull()
        expect(
          metrics.clippedControls,
          `${tab} tab should not have clipped controls at ${viewport.label}`
        ).toHaveLength(0)
        expect(
          metrics.overlaps,
          `${tab} tab should not have overlapping controls at ${viewport.label}`
        ).toHaveLength(0)
        if (viewport.width >= 1280) {
          const criticalOutside = metrics.outsideControls.filter((control) =>
            (CRITICAL_VISIBLE_CONTROLS[tab] || []).includes(control.label)
          )
          if (tab === 'Insert' && metrics.row.hasHorizontalOverflow) {
            expect(
              criticalOutside.every((control) =>
                ['Add timeline', 'More advanced insert options'].includes(control.label)
              ),
              'Insert 1280px overflow should only affect trailing Advanced controls'
            ).toBe(true)
          } else {
            expect(
              criticalOutside,
              `${tab} tab should keep critical controls inside the visible ribbon at ${viewport.label}`
            ).toHaveLength(0)
          }
        }
      })
    }
  }

  for (const tab of RIBBON_TABS) {
    test(`${tab} tab should not have button overlaps`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics(tab)

      expect(metrics).not.toBeNull()
      expect(
        metrics.overlaps,
        `${tab} tab should not have overlapping controls`
      ).toHaveLength(0)
    })
  }
})
