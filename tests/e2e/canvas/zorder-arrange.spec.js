import { test, expect } from '../fixtures/test-fixtures.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { seedElements, slideElement } from '../pages/canvas-actions-helper.js'

function shapeElement(id, x, y, overrides = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    width: 120,
    height: 80,
    fill: '#6366f1',
    zIndex: 1,
    ...overrides,
  }
}

// Regression net for z-order bring-forward via the properties panel.
// NOTE: the marquee drag-select case is covered by the unit test
// rubber-band-marquee-selection.test.js instead — a synthetic pointer drag is
// flaky in headless Chromium (Stream B pointer-coords coverage note), so the
// hidden/locked-exclusion invariant is asserted directly on endRubberBand.
test.describe('z-order arrange', () => {
  test('bring forward swaps zIndex with the neighbor above', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      shapeElement('s-low', 100, 100, { zIndex: 1 }),
      shapeElement('s-high', 400, 100, { zIndex: 2 }),
    ])
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    await slideElement(page, 's-low').click()
    await expect(page.locator('.properties-panel')).toBeVisible()
    await page.getByTestId('prop-layer-forward').click()

    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          const byId = Object.fromEntries(
            (saved.slides[0].elements || []).map((e) => [e.id, e.zIndex])
          )
          // s-low should now be above s-high after bring-forward.
          return byId['s-low'] > byId['s-high']
        },
        { timeout: 10000 }
      )
      .toBe(true)
  })
})
