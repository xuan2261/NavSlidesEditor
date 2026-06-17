import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import {
  getElementPosition,
  openSelectionPane,
  seedElements,
  slideElement,
  textElement,
} from '../pages/canvas-actions-helper.js'

async function savedElements(request, presentationId) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[0].elements || []
}

async function dragBy(page, locator, dx, dy) {
  const box = await locator.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
  await page.mouse.up()
}

test.describe('selection lock and visibility', () => {
  test('locked selected element ignores delete, drag, resize, and rotate', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [textElement('locked-a', 140, 140)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await slideElement(page, 'locked-a').click()
    await page.getByTestId('prop-lock-toggle').check()
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
    await expect(page.getByTestId('rotation-handle')).toHaveCount(0)

    const before = await getElementPosition(page, 'locked-a')
    await page.keyboard.press('Delete')
    await dragBy(page, slideElement(page, 'locked-a'), 120, 60)

    await expect
      .poll(async () => {
        const elements = await savedElements(request, testPresentation.id)
        const el = elements.find((item) => item.id === 'locked-a')
        return { count: elements.length, x: el?.x, y: el?.y, locked: el?.locked }
      })
      .toEqual({ count: 1, x: before.x, y: before.y, locked: true })
  })

  test('selection pane hide and lock toggles update canvas affordances and persisted state', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await openSelectionPane(page)
    await page.getByTestId('selection-pane-toggle-lock-text-a').click()
    await slideElement(page, 'text-a').click()
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)

    await page.getByTestId('selection-pane-toggle-visibility-text-a').click()
    await expect(slideElement(page, 'text-a')).toHaveCount(0)

    await expect
      .poll(async () => {
        const el = (await savedElements(request, testPresentation.id)).find((item) => item.id === 'text-a')
        return { hidden: el?.hidden, locked: el?.locked }
      })
      .toEqual({ hidden: true, locked: true })

    await page.getByTestId('selection-pane-toggle-visibility-text-a').click()
    await expect(slideElement(page, 'text-a')).toBeVisible()
    await page.getByTestId('selection-pane-toggle-lock-text-a').click()
    await slideElement(page, 'text-a').click()
    await expect(page.getByTestId('resize-handle-se')).toBeVisible()
  })
})
