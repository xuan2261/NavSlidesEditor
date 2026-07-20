import { test, expect } from '../fixtures/test-fixtures.js'
import { apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'

const slides = [
  { id: 'stable-a', elements: [], notes: '', background: { type: 'color', color: '#1e1e2e' } },
  { id: 'stable-b', elements: [], notes: '', background: { type: 'color', color: '#0f172a' } },
]

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector('[data-workspace-tier]')
    const status = document.querySelector('footer[data-density]')
    const critical = document.querySelector('[data-testid="statusbar-critical-controls"]')
    const canvasHost = document.querySelector('.slide-canvas')?.parentElement
    const rect = (node) => node?.getBoundingClientRect()
    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      workspaceOverflow: workspace.scrollWidth - workspace.clientWidth,
      statusOverflow: status.scrollWidth - status.clientWidth,
      canvasWidth: rect(canvasHost)?.width || 0,
      criticalVisible: Boolean(critical && rect(critical).width > 0 && rect(critical).height > 0),
      attributionVisible: Boolean(
        document.querySelector('[data-testid="statusbar-attribution"]') &&
          rect(document.querySelector('[data-testid="statusbar-attribution"]')).width > 0
      ),
      tier: workspace.dataset.workspaceTier,
    }
  })
}

test.describe('responsive editor workspace and status browser metrics', () => {
  for (const viewport of [
    { width: 768, height: 1024, minimumCanvas: 720, attribution: false },
    { width: 1024, height: 768, minimumCanvas: 760, attribution: false },
    { width: 1440, height: 900, minimumCanvas: 960, attribution: true },
  ]) {
    test(`${viewport.width}px keeps workspace and status controls usable`, async ({
      page,
      request,
      testPresentation,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await apiUpdatePresentation(request, testPresentation.id, { slides })
      await new EditorPage(page).gotoPresentation(testPresentation.id)
      await expect(page.locator('[data-workspace-tier]')).toBeVisible()
      await expect(page.getByTestId('statusbar-critical-controls')).toBeVisible()

      await expect.poll(() => layoutMetrics(page)).toMatchObject({
        documentOverflow: expect.any(Number),
        workspaceOverflow: expect.any(Number),
        statusOverflow: expect.any(Number),
        criticalVisible: true,
        attributionVisible: viewport.attribution,
      })
      const metrics = await layoutMetrics(page)
      expect(metrics.documentOverflow).toBeLessThanOrEqual(1)
      expect(metrics.workspaceOverflow).toBeLessThanOrEqual(1)
      expect(metrics.statusOverflow).toBeLessThanOrEqual(1)
      expect(metrics.canvasWidth).toBeGreaterThanOrEqual(viewport.minimumCanvas)
    })
  }

  test('slide navigator exposes list semantics, roving focus and pressed selection', async ({
    page,
    request,
    testPresentation,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await apiUpdatePresentation(request, testPresentation.id, { slides })
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    const navigator = page.getByRole('navigation', { name: 'Slides' })
    await expect(navigator).toBeVisible()
    await expect(navigator.getByRole('listitem')).toHaveCount(2)
    const first = navigator.getByRole('button', { name: 'Select slide 1' })
    const second = navigator.getByRole('button', { name: 'Select slide 2' })
    await expect(first).toHaveAttribute('aria-current', 'true')
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(first).toHaveAttribute('tabindex', '0')
    await expect(second).toHaveAttribute('tabindex', '-1')

    await first.focus()
    await first.press('ArrowDown')
    await expect(second).toBeFocused()
    await expect(first).toHaveAttribute('aria-current', 'true')
    await second.press('Enter')
    await expect(second).toHaveAttribute('aria-current', 'true')
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(first).toHaveAttribute('aria-pressed', 'false')
  })
})
