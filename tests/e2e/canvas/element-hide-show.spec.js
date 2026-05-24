import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import {
  openSelectionPane,
  seedElements,
  slideElement,
  textElement,
} from '../pages/canvas-actions-helper.js'

test.describe('element hide/show', () => {
  test('selection pane eye toggles element visibility on canvas', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await expect(slideElement(page, 'text-a')).toBeVisible()
    await openSelectionPane(page)
    const visibilityToggle = page.getByTestId('selection-pane-toggle-visibility-text-a')

    await visibilityToggle.click()
    await expect(slideElement(page, 'text-a')).toHaveCount(0)

    await visibilityToggle.click()
    await expect(slideElement(page, 'text-a')).toBeVisible()
  })

  test('hidden element persists across reload', async ({ page, request, testPresentation }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    const editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(testPresentation.id)

    await openSelectionPane(page)
    await page.getByTestId('selection-pane-toggle-visibility-text-a').click()
    await expect(slideElement(page, 'text-a')).toHaveCount(0)

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        return saved.slides[0].elements.find((el) => el.id === 'text-a')?.hidden
      })
      .toBe(true)

    await page.reload()
    await editorPage.waitForReady()
    await expect(slideElement(page, 'text-a')).toHaveCount(0)
  })
})
