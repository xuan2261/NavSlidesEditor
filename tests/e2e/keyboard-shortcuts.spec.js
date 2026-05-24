import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Keyboard Shortcuts', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    // Create presentation with a pre-existing shape element (avoids text editing mode)
    const pres = await apiCreatePresentation(request, 'Keyboard Shortcuts Test')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-shape-1',
              type: 'shape',
              shape: 'rectangle',
              x: 200,
              y: 200,
              width: 150,
              height: 100,
              zIndex: 1,
              color: '#6366f1',
              text: '',
            },
          ],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        },
      ],
    })
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('Ctrl+D duplicates selected element', async () => {
    const initialCount = await editorPage.getElementCount()
    expect(initialCount).toBe(1)

    await editorPage.selectElement(0)
    await editorPage.duplicateElement()

    const afterDuplicate = await editorPage.getElementCount()
    expect(afterDuplicate).toBeGreaterThan(initialCount)
  })

  test('Delete key removes selected element', async () => {
    const initialCount = await editorPage.getElementCount()
    expect(initialCount).toBe(1)

    await editorPage.selectElement(0)
    await editorPage.deleteSelectedElement()

    const afterDelete = await editorPage.getElementCount()
    expect(afterDelete).toBeLessThan(initialCount)
  })

  test('Escape deselects element', async () => {
    await editorPage.selectElement(0)
    await editorPage.deselectAll()
    await expect(
      editorPage.page.locator('.properties-panel h3').filter({ hasText: 'Element' })
    ).toHaveCount(0)
  })

  test('Ctrl+C / Ctrl+V copies and pastes element', async () => {
    const initialCount = await editorPage.getElementCount()

    await editorPage.selectElement(0)
    await editorPage.copyElement()
    await editorPage.pasteElement()

    const afterPaste = await editorPage.getElementCount()
    expect(afterPaste).toBeGreaterThan(initialCount)
  })

  test('Ctrl+F opens Find & Replace', async ({ page }) => {
    await editorPage.openFindReplace()
    await expect(page.locator('.find-replace-bar')).toBeVisible()
  })
})
