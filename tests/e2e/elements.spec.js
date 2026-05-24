import { EditorPage } from './pages/editor-page.js'
import { test, expect } from './fixtures/test-fixtures.js'

test.describe('Elements Insertion', () => {
  let editorPage

  test.beforeEach(async ({ page, testPresentation }) => {
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(testPresentation.id)
  })

  test('can insert text, shape and handle prompt for table', async () => {
    let initialCount = await editorPage.getElementCount()

    // 1. Thêm Text node
    await editorPage.addTextNode()
    let textCount = await editorPage.getElementCount()
    expect(textCount).toBeGreaterThan(initialCount)

    // 2. Thêm Shape
    await editorPage.addShape('Star')
    let shapeCount = await editorPage.getElementCount()
    expect(shapeCount).toBeGreaterThan(textCount)

    // 3. Xử lý Prompts (Table không còn dùng prompt, dùng grid picker)
    await editorPage.addTable(3, 3)

    let finalCount = await editorPage.getElementCount()
    expect(finalCount).toBeGreaterThan(shapeCount)
  })
})
