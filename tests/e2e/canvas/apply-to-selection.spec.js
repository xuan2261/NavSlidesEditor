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

// Regression net for multi-select apply-to-selection (element-update-fanout).
// jsdom can't exercise real shift-click selection + pointer chrome.
test.describe('apply to selection (multi-select fan-out)', () => {
  test('changing fill applies to all selected shapes', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [
      shapeElement('s-a', 100, 100),
      shapeElement('s-b', 300, 100),
      shapeElement('s-c', 500, 100),
    ])
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    await slideElement(page, 's-a').click()
    await slideElement(page, 's-b').click({ modifiers: ['Shift'] })
    await slideElement(page, 's-c').click({ modifiers: ['Shift'] })
    await expect(page.locator('.properties-panel')).toContainText('3 elements selected')

    const fill = page.getByTestId('prop-shape-fill')
    await fill.fill('#ff0000')
    await fill.blur()

    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          return (saved.slides[0].elements || []).map((e) => e.fill)
        },
        { timeout: 10000 }
      )
      .toEqual(['#ff0000', '#ff0000', '#ff0000'])
  })

  test('setting X shifts all selected by the same delta', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [
      shapeElement('s-a', 100, 100),
      shapeElement('s-b', 300, 200),
    ])
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    await slideElement(page, 's-a').click()
    await slideElement(page, 's-b').click({ modifiers: ['Shift'] })
    await expect(page.locator('.properties-panel')).toContainText('2 elements selected')

    // Setting X applies a uniform delta to every selected element (fan-out), so
    // the relative spacing is preserved and both move. Assert the invariant
    // rather than a guessed primary baseline.
    const xInput = page.getByTestId('prop-x')
    await xInput.fill('150')
    await xInput.blur()

    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          const byId = Object.fromEntries((saved.slides[0].elements || []).map((e) => [e.id, e.x]))
          // spacing preserved (both shifted by the same delta) and positions changed
          return { spacing: byId['s-b'] - byId['s-a'], moved: byId['s-a'] !== 100 || byId['s-b'] !== 300 }
        },
        { timeout: 10000 }
      )
      .toEqual({ spacing: 200, moved: true })
  })
})
