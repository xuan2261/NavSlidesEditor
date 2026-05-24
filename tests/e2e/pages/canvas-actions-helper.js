import { expect } from '../fixtures/test-fixtures.js'
import { apiGetPresentation, apiUpdatePresentation } from '../fixtures/test-fixtures.js'

export function textElement(id, x, y, overrides = {}) {
  return {
    id,
    type: 'text',
    x,
    y,
    width: 160,
    height: 70,
    content: `<p>${id}</p>`,
    zIndex: 1,
    ...overrides,
  }
}

export function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

export async function seedElements(request, presentationId, elements) {
  await apiUpdatePresentation(request, presentationId, {
    slides: [seededSlide(elements)],
  })
}

export function slideElement(page, id) {
  return page.getByTestId(`slide-element-${id}`)
}

export async function getElementPosition(page, id) {
  return slideElement(page, id).evaluate((el) => ({
    x: Math.round(parseFloat(el.style.left)),
    y: Math.round(parseFloat(el.style.top)),
  }))
}

export async function selectElement(page, id) {
  await slideElement(page, id).click()
  await expect(slideElement(page, id)).toBeVisible()
  await expect(page.locator('.properties-panel')).toBeVisible()
}

export async function openViewTab(page) {
  await page.getByTestId('ribbon-tab-view').click()
  await expect(page.getByTestId('ribbon-tab-view-content')).toBeVisible()
}

export async function openSelectionPane(page) {
  if ((await page.locator('[data-element-type]').count()) > 0) {
    const id = await page.locator('[data-element-type]').first().getAttribute('data-element-id')
    await selectElement(page, id)
  }
  await openViewTab(page)
  const toggle = page.getByTestId('view-toggle-selection-pane')
  if ((await page.locator('.selection-pane').count()) === 0) {
    if ((await page.locator('.properties-panel').count()) === 0) {
      await toggle.click()
      await expect(page.locator('.properties-panel')).toBeVisible()
    }
    const selectionPaneHeader = page.getByText('Selection Pane', { exact: true })
    await selectionPaneHeader.click()
  }
  await expect(page.locator('.selection-pane')).toBeVisible()
}

export async function waitForElementIds(request, presentationId, expectedCount) {
  await expect
    .poll(async () => {
      const saved = await apiGetPresentation(request, presentationId)
      return saved.slides[0].elements.length
    })
    .toBe(expectedCount)
}
