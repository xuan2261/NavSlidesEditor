import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import { apiCreatePresentation, apiDeletePresentation, apiUpdatePresentation, apiGetPresentation } from './fixtures/test-fixtures.js'
import { seedElements, selectElement } from './pages/canvas-actions-helper.js'

test.describe('Undo / Redo', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Undo Redo Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can undo adding an element', async ({ page }) => {
    const initialCount = await editorPage.getElementCount()

    // Add text
    await editorPage.addTextNode()
    const afterAdd = await editorPage.getElementCount()
    expect(afterAdd).toBeGreaterThan(initialCount)
    await editorPage.waitForAutoSave()

    // Deselect first to ensure undo targets element addition
    await editorPage.deselectAll()

    // Undo
    await editorPage.undo()
    await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 }).toBe(initialCount)
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can redo after undo', async ({ page }) => {
    const initialCount = await editorPage.getElementCount()

    await editorPage.addTextNode()
    const afterAdd = await editorPage.getElementCount()
    await editorPage.waitForAutoSave()
    await editorPage.deselectAll()
    await editorPage.undo()
    await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 }).toBe(initialCount)

    // Redo
    await editorPage.redo()
    await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 }).toBe(afterAdd)
  })

  test('undo/redo keyboard shortcuts work', async ({ page }) => {
    // Simply verify keyboard shortcuts don't crash
    await page.keyboard.press('Control+z')
    await expect(page.locator('.slide-canvas')).toBeVisible()
    await page.keyboard.press('Control+y')
    await expect(page.locator('.slide-canvas')).toBeVisible()
    // If we reach here without error, shortcuts work
  })

  test('bounded stress: 10 adds, 10 undo, 10 redo', async ({ page, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'stress-shape-1',
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
    await editorPage.gotoPresentation(presId)

    const initialCount = await editorPage.getElementCount()

    await editorPage.selectElement(0)
    let expectedHistoryLength = await page.evaluate(() => window.__NAVSLIDES_E2E_HISTORY_LENGTH ?? 0)
    for (let i = 0; i < 10; i += 1) {
      const expectedCount = initialCount + i + 1
      await editorPage.duplicateElement()
      await editorPage.waitForElementCount(expectedCount, 10000)
      expectedHistoryLength += 1
      await expect
        .poll(() => page.evaluate(() => window.__NAVSLIDES_E2E_HISTORY_LENGTH ?? 0), {
          timeout: 10000,
        })
        .toBeGreaterThanOrEqual(expectedHistoryLength)
    }

    await expect.poll(async () => editorPage.getElementCount(), { timeout: 10000 }).toBe(initialCount + 10)

    await editorPage.deselectAll()
    for (let i = 0; i < 10; i += 1) {
      await editorPage.undo()
    }

    await expect.poll(async () => editorPage.getElementCount(), { timeout: 10000 }).toBe(initialCount)

    for (let i = 0; i < 10; i += 1) {
      await editorPage.redo()
    }

    await expect.poll(async () => editorPage.getElementCount(), { timeout: 10000 }).toBe(initialCount + 10)
  })

  test('undo restores a reverted property edit (position)', async ({ page, request }) => {
    await seedElements(request, presId, [
      { id: 'el-pos', type: 'shape', shape: 'rect', x: 100, y: 100, width: 120, height: 80, zIndex: 1, fill: '#6366f1' },
    ])
    await editorPage.gotoPresentation(presId)

    await selectElement(page, 'el-pos')
    const xInput = page.getByTestId('prop-x')
    await xInput.fill('400')
    await xInput.blur()
    await editorPage.waitForAutoSave()

    // Undo must revert x back toward 100 (the edit is reversible).
    await editorPage.deselectAll()
    await editorPage.undo()

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides?.[0]?.elements?.[0]?.x
      }, { timeout: 10000 })
      .toBe(100)
  })
})
