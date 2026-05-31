import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function shape(id, x, y, width = 100, height = 80, zIndex = 1) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    width,
    height,
    zIndex,
    fill: '#6366f1',
  }
}

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

test.describe('Coverage Gaps: Editor controls and UI contracts', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Coverage Gaps')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presId)
  })

  test('covers resize aspect lock, rotation handle snap, rulers, and persistent guides', async ({
    page,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [seededSlide([shape('a', 120, 120, 120, 80)])],
    })
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-a').click()

    const handle = await page.getByTestId('resize-handle-se').boundingBox()
    expect(handle).toBeTruthy()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.keyboard.down('Shift')
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + 120, handle.y + handle.height / 2 + 90, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await editor.waitForAutoSave()

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        const el = saved.slides[0].elements.find((item) => item.id === 'a')
        return el.width > 120 && el.height > 80
      })
      .toBe(true)

    const rotationHandle = await page.getByTestId('rotation-handle').boundingBox()
    expect(rotationHandle).toBeTruthy()
    await page.keyboard.down('Shift')
    await page.mouse.move(rotationHandle.x + rotationHandle.width / 2, rotationHandle.y + rotationHandle.height / 2)
    await page.mouse.down()
    await page.mouse.move(rotationHandle.x + 80, rotationHandle.y - 40, { steps: 6 })
    await page.mouse.up()
    await page.keyboard.up('Shift')

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        const rotation = saved.slides[0].elements.find((item) => item.id === 'a').rotation || 0
        return rotation % 15
      })
      .toBe(0)

    await page.getByRole('tab', { name: 'View' }).click()
    await page.getByRole('button', { name: 'Toggle rulers' }).click()
    await expect(page.getByTestId('top-ruler')).toBeVisible()
    const topRuler = await page.getByTestId('top-ruler').boundingBox()
    expect(topRuler).toBeTruthy()
    await page.mouse.move(topRuler.x + 140, topRuler.y + 8)
    await page.mouse.down()
    await page.mouse.move(topRuler.x + 180, topRuler.y + 80)
    await page.mouse.up()
    await expect(page.getByTestId('persistent-guide-x')).toBeVisible()
    await page.getByTestId('persistent-guide-x').dblclick()
    await expect(page.getByTestId('persistent-guide-x')).toHaveCount(0)
  })

})
