import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Animation Preview', () => {
  test('opens as an accessible narrow-viewport dialog and closes on Escape', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 768, height: 844 })
    const pres = await apiCreatePresentation(request, 'Animation Preview E2E')

    try {
      await apiUpdatePresentation(request, pres.id, {
        slides: [
          {
            id: 'slide-1',
            background: { type: 'color', color: '#1e1e2e' },
            elements: [
              {
                id: 'title',
                type: 'text',
                x: 120,
                y: 80,
                width: 420,
                height: 90,
                zIndex: 1,
                content: '<h2>Preview title</h2>',
              },
              {
                id: 'fragment-1',
                type: 'text',
                x: 160,
                y: 220,
                width: 360,
                height: 80,
                zIndex: 2,
                fragment: true,
                fragmentIndex: 1,
                content: '<p>First fragment</p>',
              },
            ],
          },
        ],
      })

      const editor = new EditorPage(page)
      await editor.gotoPresentation(pres.id)

      await page.getByRole('tab', { name: 'View' }).evaluate((tab) => tab.click())
      const viewPanel = page.getByRole('tabpanel', { name: 'View' })
      await viewPanel.evaluate((panel) => panel.scrollIntoView({ block: 'nearest', inline: 'start' }))
      await viewPanel.getByRole('button', { name: 'Animation Timeline' }).evaluate((button) => button.click())
      await expect(page.getByText('Animation Timeline')).toBeVisible()

      await page.getByRole('button', { name: /Preview/ }).click()
      const dialog = page.getByRole('dialog', { name: 'Animation Preview' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeFocused()

      const overflow = await page.evaluate(() => ({
        pageScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
      expect(overflow.pageScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1)

      const modalMetrics = await dialog.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          viewportWidth: window.innerWidth,
        }
      })
      expect(modalMetrics.left).toBeGreaterThanOrEqual(0)
      expect(modalMetrics.right).toBeLessThanOrEqual(modalMetrics.viewportWidth)
      expect(modalMetrics.scrollWidth).toBeLessThanOrEqual(modalMetrics.clientWidth + 1)

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    } finally {
      await apiDeletePresentation(request, pres.id)
    }
  })
})
