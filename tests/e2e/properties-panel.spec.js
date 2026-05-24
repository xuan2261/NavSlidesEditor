import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Properties Panel', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Properties Panel Test')
    presId = pres.id
    // Pre-seed with a shape element to avoid text edit mode
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-shape-1',
              type: 'shape',
              shape: 'rectangle',
              x: 150,
              y: 150,
              width: 200,
              height: 120,
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

  test('selecting an element shows properties panel', async ({ page }) => {
    await editorPage.selectElement(0)

    const panel = page.locator('.properties-panel')
    await expect(panel).toBeVisible({ timeout: 5000 })
  })

  test('deselecting hides active element state', async () => {
    await editorPage.selectElement(0)
    await editorPage.deselectAll()
    await expect(editorPage.page.locator('.properties-panel h3').filter({ hasText: 'Element' })).toHaveCount(
      0
    )
  })

  test('properties panel shows position/size inputs', async ({ page }) => {
    await editorPage.selectElement(0)

    const panel = page.locator('.properties-panel')
    await expect(panel).toBeVisible({ timeout: 5000 })

    const inputs = panel.locator('input[type="number"]')
    const inputCount = await inputs.count()
    expect(inputCount).toBeGreaterThanOrEqual(2)
  })

  test('can modify element position via properties panel', async ({ page }) => {
    await editorPage.selectElement(0)

    const panel = page.locator('.properties-panel')
    await expect(panel).toBeVisible({ timeout: 5000 })

    const xInput = panel.locator('input[type="number"]').first()
    await xInput.fill('200')
    await xInput.press('Enter')
    await expect(xInput).toHaveValue('200')
  })

  test('clearing numeric input does not persist NaN', async ({ page, request }) => {
    await editorPage.selectElement(0)
    const panel = page.locator('.properties-panel')
    const xInput = panel.locator('input[type="number"]').first()

    await xInput.fill('')
    await xInput.blur()
    await editorPage.waitForAutoSave()

    const saved = await apiGetPresentation(request, presId)
    const element = saved.slides[0].elements.find((el) => el.id === 'el-shape-1')
    expect(Number.isFinite(element.x)).toBe(true)
  })

  test('speaker notes save through the canonical notes field', async ({ page, request }) => {
    const notesInput = page.locator('textarea[placeholder="Add speaker notes here..."]')

    await expect(notesInput).toBeVisible({ timeout: 5000 })
    await notesInput.fill('Presenter note persists across reload')
    await editorPage.waitForAutoSave()

    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].notes).toBe('Presenter note persists across reload')
    expect(saved.slides[0].speakerNotes).toBeUndefined()
    await expect(notesInput).toHaveValue('Presenter note persists across reload')
  })
})
