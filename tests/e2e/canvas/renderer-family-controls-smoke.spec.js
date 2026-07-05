import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { openSelectionPane, seedElements, slideElement } from '../pages/canvas-actions-helper.js'

const FAMILY_REPRESENTATIVES = [
  { id: 'text-1', type: 'text', content: '<p>Text</p>' },
  { id: 'image-1', type: 'image', src: '', alt: 'empty image' },
  { id: 'shape-1', type: 'shape', shape: 'rect', fill: '#6366f1' },
  { id: 'code-1', type: 'code', content: 'const x = 1', language: 'javascript' },
  { id: 'html-1', type: 'html', content: '<div style="color:white">HTML</div>' },
  { id: 'chart-1', type: 'chart', chartType: 'bar', chartData: { labels: ['A'], datasets: [{ label: 'One', data: [1], color: '#6366f1' }] } },
  { id: 'table-1', type: 'table', data: [['A', 'B'], ['1', '2']], headerRow: true },
  { id: 'qrcode-1', type: 'qrcode', qrData: 'https://example.com' },
  { id: 'icon-1', type: 'icon', iconName: 'Star', iconColor: '#ffffff' },
  { id: 'svg-1', type: 'svg', content: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#6366f1"/></svg>' },
]

function withBox(element, index) {
  const col = index % 5
  const row = Math.floor(index / 5)
  return {
    x: 30 + col * 180,
    y: 30 + row * 115,
    width: 120,
    height: 70,
    zIndex: index + 1,
    ...element,
  }
}

async function savedElement(request, presentationId, id) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[0].elements.find((el) => el.id === id)
}

test.describe('renderer family shared controls smoke', () => {
  test('renderer family representatives support select, geometry, lock, visibility, and delete', async ({
    page,
    request,
    testPresentation,
  }) => {
    test.setTimeout(120000)
    const editor = new EditorPage(page)
    const elements = FAMILY_REPRESENTATIVES.map((element, index) => withBox(element, index))

    await seedElements(request, testPresentation.id, elements)
    await editor.gotoPresentation(testPresentation.id)

    for (const element of elements) {
      await expect(slideElement(page, element.id)).toBeVisible()
      await slideElement(page, element.id).click({ force: true })
      await expect(page.locator('.properties-panel')).toBeVisible()
      await page.getByTestId('prop-x').fill(String(element.x + 10))
      await page.getByTestId('prop-width').fill(String(element.width + 10))
      await expect
        .poll(async () => {
          const el = await savedElement(request, testPresentation.id, element.id)
          return { x: el?.x, width: el?.width }
        })
        .toEqual({ x: element.x + 10, width: element.width + 10 })
      await page.getByTestId('prop-lock-toggle').check()
      await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)

      await openSelectionPane(page)
      await page.getByTestId(`selection-pane-toggle-visibility-${element.id}`).click()
      await expect(slideElement(page, element.id)).toBeHidden()
      await page.getByTestId(`selection-pane-toggle-visibility-${element.id}`).click()
      await expect(slideElement(page, element.id)).toBeVisible()
      await page.getByTestId(`selection-pane-toggle-lock-${element.id}`).click()
      await slideElement(page, element.id).click({ force: true })
      await page.getByTestId('prop-delete').click()

      await expect
        .poll(async () => {
          const el = await savedElement(request, testPresentation.id, element.id)
          return el ? { x: el.x, width: el.width, locked: !!el.locked, hidden: !!el.hidden } : null
        })
        .toBeNull()
    }
  })
})
