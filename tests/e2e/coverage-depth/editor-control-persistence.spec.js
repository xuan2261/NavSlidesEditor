import fs from 'node:fs/promises'
import { test, expect, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { seedElements, selectElement } from '../pages/canvas-actions-helper.js'

function shapeElement(id, overrides = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x: 80,
    y: 90,
    width: 140,
    height: 80,
    rotation: 0,
    fill: '#334155',
    stroke: '#0f172a',
    opacity: 1,
    zIndex: 1,
    ...overrides,
  }
}

test.describe('Phase 4 coverage depth: editor control persistence', () => {
  test('[cap:control.format.position depth:persistence] property edits persist and rehydrate after reload', async ({
    page,
    request,
    testPresentation,
  }) => {
    const elementId = 'phase4-shape-control-persist'
    await seedElements(request, testPresentation.id, [shapeElement(elementId)])

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await selectElement(page, elementId)

    await page.getByTestId('prop-x').fill('245')
    await page.getByTestId('prop-y').fill('155')
    await page.getByTestId('prop-width').fill('210')
    await page.getByTestId('prop-height').fill('115')
    await page.getByTestId('prop-rotation').fill('45')
    await page.getByTestId('prop-shape-fill').fill('#22c55e')

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        const shape = saved.slides[0].elements.find((el) => el.id === elementId)
        return shape && {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rotation: shape.rotation,
          fill: shape.fill,
        }
      }, { timeout: 10000 })
      .toEqual({
        x: 245,
        y: 155,
        width: 210,
        height: 115,
        rotation: 45,
        fill: '#22c55e',
      })

    await page.reload()
    await editor.waitForReady()
    await selectElement(page, elementId)

    await expect(page.getByTestId('prop-x')).toHaveValue('245')
    await expect(page.getByTestId('prop-y')).toHaveValue('155')
    await expect(page.getByTestId('prop-width')).toHaveValue('210')
    await expect(page.getByTestId('prop-height')).toHaveValue('115')
    await expect(page.getByTestId('prop-rotation')).toHaveValue('45')
    await expect(page.getByTestId('prop-shape-fill')).toHaveValue('#22c55e')
  })

  test('[cap:export.html depth:export] element property edits are emitted in exported HTML', async ({
    page,
    request,
    testPresentation,
  }) => {
    const elementId = 'phase4-shape-export-property'
    await seedElements(request, testPresentation.id, [shapeElement(elementId)])

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await selectElement(page, elementId)

    await page.getByTestId('prop-rotation').fill('30')
    await page.getByTestId('prop-shape-fill').fill('#f97316')

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        const shape = saved.slides[0].elements.find((el) => el.id === elementId)
        return shape && { rotation: shape.rotation, fill: shape.fill }
      }, { timeout: 10000 })
      .toEqual({ rotation: 30, fill: '#f97316' })

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await editor.menubar.openFileMenuItem('Export HTML')
    const download = await downloadPromise
    const path = await download.path()
    expect(path).toBeTruthy()
    const html = await fs.readFile(path, 'utf8')
    expect(html).toContain('transform:rotate(30deg);')
    expect(html).toContain('#f97316')
  })
})
