import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import {
  openViewTab,
  seedElements,
  slideElement,
  textElement,
} from '../pages/canvas-actions-helper.js'

async function dragElementToward(page, elementId, targetCanvasPosition) {
  const elementBox = await slideElement(page, elementId).boundingBox()
  const canvasBox = await page.getByTestId('canvas-area').boundingBox()
  expect(elementBox).toBeTruthy()
  expect(canvasBox).toBeTruthy()
  const scale = canvasBox.width / 960

  await page.mouse.move(elementBox.x + elementBox.width / 2, elementBox.y + elementBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    canvasBox.x + targetCanvasPosition.x * scale,
    canvasBox.y + targetCanvasPosition.y * scale,
    { steps: 12 }
  )
}

test.describe('smart guides', () => {
  test('toggle is visible in ribbon View tab', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await openViewTab(page)
    await expect(page.getByTestId('canvas-controls-toggle-smart-guides')).toBeVisible()
  })

  test('shows guide when element drags near sibling edge', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [
      textElement('text-a', 100, 100),
      textElement('text-b', 300, 180),
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await dragElementToward(page, 'text-b', { x: 180, y: 215 })
    await expect(page.getByTestId('smart-guide-x')).toBeVisible()
    await page.mouse.up()
  })

  test('smart guide toggle off suppresses guides during drag', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [
      textElement('text-a', 100, 100),
      textElement('text-b', 300, 180),
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await openViewTab(page)
    const toggle = page.getByTestId('canvas-controls-toggle-smart-guides')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await dragElementToward(page, 'text-b', { x: 180, y: 215 })
    await expect(page.getByTestId('smart-guide-x')).toHaveCount(0)
    await page.mouse.up()
  })
})
