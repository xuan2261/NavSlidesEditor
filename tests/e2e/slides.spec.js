import { EditorPage } from './pages/editor-page.js'
import { test, expect } from './fixtures/test-fixtures.js'

test.describe('Slides Management', () => {
  test('can add and delete slides in SlidePanel', async ({ page, testPresentation }) => {
    const editor = new EditorPage(page)

    await editor.gotoPresentation(testPresentation.id)

    let count = await editor.getSlideCount()
    expect(count).toBeGreaterThanOrEqual(1)

    await editor.addSlide()
    let newCount = await editor.getSlideCount()
    expect(newCount).toBe(count + 1)

    await editor.deleteSlide(newCount - 1)
    let finalCount = await editor.getSlideCount()
    expect(finalCount).toBe(count)
  })
})
