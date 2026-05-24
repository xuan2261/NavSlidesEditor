import { test, expect } from '../fixtures/test-fixtures.js'
import {
  openRibbonEditor,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Header Responsive Pressure', () => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 600 },
  ]) {
    test(`Header should not cause document overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })

      expect(overflow, `Document should not have horizontal overflow at ${viewport.width}px`).toBe(
        false
      )
    })

    test(`Critical header actions should be visible at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)

      const actions = await page.evaluate(() => {
        const results = {}
        const selectors = {
          File: '[aria-label="File menu"]',
          AI: '[aria-label="AI"]',
          Share: '[aria-label="Share"]',
          Present: '[aria-label="Present"]',
        }

        for (const [name, selector] of Object.entries(selectors)) {
          const el = document.querySelector(selector)
          if (el) {
            const rect = el.getBoundingClientRect()
            results[name] = {
              found: true,
              visible: rect.width > 0 && rect.height > 0 && rect.right <= window.innerWidth,
            }
          } else {
            results[name] = { found: false, visible: false }
          }
        }
        return results
      })

      for (const [name, status] of Object.entries(actions)) {
        expect(status.found, `${name} button should exist`).toBe(true)
        expect(status.visible, `${name} button should be visible at ${viewport.width}px`).toBe(
          true
        )
      }
    })
  }

  test('Tab navigation should work at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 600 })

    const tabs = ['Home', 'Insert', 'Design', 'View']
    for (const tabName of tabs) {
      await editor.switchRibbonTab(tabName)
      const activeTab = await page.evaluate(() => {
        const active = document.querySelector('[role="tab"][data-state="active"]')
        return active?.getAttribute('aria-label') || active?.textContent?.trim()
      })
      expect(activeTab).toBe(tabName)
    }
  })
})
