import { test, expect } from '../fixtures/test-fixtures.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
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

  test('pasting a copied group gives the copies a NEW shared groupId (not merged with source)', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [
      textElement('grp-a', 100, 100, { groupId: 'g1' }),
      textElement('grp-b', 300, 100, { groupId: 'g1' }),
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    // Both elements share groupId 'g1', so clicking one auto-selects the whole
    // group (2 elements). Do NOT shift-click the second — that would toggle it
    // back off. Then copy + paste the group.
    await slideElement(page, 'grp-a').click()
    await expect(page.locator('.properties-panel')).toContainText('2 elements selected')
    await page.keyboard.press('Control+C')
    await page.keyboard.press('Control+V')

    await expect(page.locator('[data-element-type="text"]')).toHaveCount(4)

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        return (saved.slides[0].elements || []).length
      }, { timeout: 10000 })
      .toBe(4)

    const saved = await apiGetPresentation(request, testPresentation.id)
    const groupIds = (saved.slides[0].elements || []).map((e) => e.groupId)

    // Source pair keeps 'g1'; the two pasted copies share ONE new groupId that is not 'g1'.
    const distinct = [...new Set(groupIds)]
    expect(distinct).toHaveLength(2)
    expect(distinct).toContain('g1')
    const pastedGroupId = distinct.find((g) => g !== 'g1')
    expect(pastedGroupId).toBeTruthy()
    expect(groupIds.filter((g) => g === pastedGroupId)).toHaveLength(2)
  })

  test('Ctrl+D does not clobber the clipboard — a prior Ctrl+C still pastes', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectElement(page, 'text-a')
    await page.keyboard.press('Control+C')
    await page.keyboard.press('Control+D') // duplicate (must NOT overwrite clipboard)
    await expect(page.locator('[data-element-type="text"]')).toHaveCount(2)

    await page.keyboard.press('Control+V') // pastes the originally copied element
    await expect(page.locator('[data-element-type="text"]')).toHaveCount(3)
  })
})
