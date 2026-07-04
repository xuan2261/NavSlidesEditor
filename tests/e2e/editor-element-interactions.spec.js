import { test, expect } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'
import { seedElements, slideElement } from './pages/canvas-actions-helper.js'

async function clickLineStroke(page, id, button = 'left') {
  const box = await slideElement(page, id).boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button })
}

async function clickLineBoxAwayFromStroke(page, id) {
  const box = await slideElement(page, id).boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.click(box.x + box.width / 2, box.y + 3)
}

async function outlineFor(page, id) {
  return slideElement(page, id).evaluate((el) => window.getComputedStyle(el).outlineStyle)
}

test.describe('editor element interaction regression smoke', () => {
  test('line stroke is selectable without the whole bounding box hijacking clicks', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      {
        id: 'line-smoke',
        type: 'line',
        x: 180,
        y: 180,
        width: 260,
        height: 40,
        x1: 0,
        y1: 20,
        x2: 260,
        y2: 20,
        stroke: '#ffffff',
        strokeWidth: 2,
        zIndex: 2,
      },
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await clickLineStroke(page, 'line-smoke')
    await expect.poll(() => outlineFor(page, 'line-smoke')).toBe('solid')

    await page.keyboard.press('Escape')
    await clickLineBoxAwayFromStroke(page, 'line-smoke')
    await expect.poll(() => outlineFor(page, 'line-smoke')).not.toBe('solid')
  })

  test('line stroke opens the element context menu', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      {
        id: 'line-context',
        type: 'line',
        x: 180,
        y: 180,
        width: 260,
        height: 40,
        x1: 0,
        y1: 20,
        x2: 260,
        y2: 20,
        stroke: '#ffffff',
        strokeWidth: 2,
        zIndex: 2,
      },
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await clickLineStroke(page, 'line-context', 'right')

    await expect(page.getByRole('button', { name: 'Cut (Ctrl+X)' })).toBeVisible()
  })
})
