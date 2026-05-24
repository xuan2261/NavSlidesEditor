import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import {
  getElementPosition,
  seedElements,
  selectElement,
  slideElement,
  textElement,
} from '../pages/canvas-actions-helper.js'

test.describe('canvas clipboard shortcuts', () => {
  test('Ctrl+C then Ctrl+V duplicates the selected element', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectElement(page, 'text-a')
    await page.keyboard.press('Control+C')
    await page.keyboard.press('Control+V')

    await expect(page.locator('[data-element-type="text"]')).toHaveCount(2)
  })

  test('Ctrl+X removes selected element then Ctrl+V restores it', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectElement(page, 'text-a')
    await page.keyboard.press('Control+X')
    await expect(page.locator('[data-element-type="text"]')).toHaveCount(0)

    await page.keyboard.press('Control+V')
    await expect(page.locator('[data-element-type="text"]')).toHaveCount(1)
  })

  test('Ctrl+D duplicates with +20/+20 offset', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectElement(page, 'text-a')
    const before = await getElementPosition(page, 'text-a')
    await page.keyboard.press('Control+D')

    const elements = page.locator('[data-element-type="text"]')
    await expect(elements).toHaveCount(2)
    const duplicateId = await elements.nth(1).getAttribute('data-element-id')
    const after = await getElementPosition(page, duplicateId)
    expect(after).toEqual({ x: before.x + 20, y: before.y + 20 })
  })

  test('Ctrl+V paste applies +20/+20 offset from copied source', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectElement(page, 'text-a')
    const before = await getElementPosition(page, 'text-a')
    await page.keyboard.press('Control+C')
    await page.keyboard.press('Control+V')

    const elements = page.locator('[data-element-type="text"]')
    await expect(elements).toHaveCount(2)
    await expect(slideElement(page, 'text-a')).toBeVisible()
    const pastedId = await elements.nth(1).getAttribute('data-element-id')
    const after = await getElementPosition(page, pastedId)
    expect(after).toEqual({ x: before.x + 20, y: before.y + 20 })
  })
})
