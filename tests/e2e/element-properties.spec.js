import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

async function seedSingleElement(request, presentationId, element) {
  await apiUpdatePresentation(request, presentationId, {
    slides: [seededSlide([element])],
  })
}

async function savedElement(request, presentationId, elementId) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[0].elements.find((el) => el.id === elementId)
}

async function setRangeByTestId(page, testId, value) {
  await page.getByTestId(testId).evaluate((node, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    descriptor.set.call(node, String(nextValue))
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test.describe('Element Properties Persistence', () => {
  let editor
  let presentationId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Element Properties Persistence')
    presentationId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presentationId)
  })

  test('persists common position, rotation, lock, and shadow controls', async ({ page, request }) => {
    const elementId = 'shape-common-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 120,
      width: 220,
      height: 140,
      zIndex: 1,
      fill: '#6366f1',
      stroke: '#ffffff',
      strokeWidth: 1,
      text: '',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-x').fill('240')
    await page.getByTestId('prop-y').fill('180')
    await page.getByTestId('prop-width').fill('360')
    await page.getByTestId('prop-height').fill('200')
    await page.getByTestId('prop-rotation').fill('45')

    await page.getByTestId('prop-lock-toggle').check()
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
    await page.getByTestId('prop-lock-toggle').uncheck()

    await page.getByTestId('prop-shadow-x').fill('6')
    await page.getByTestId('prop-shadow-y').fill('8')
    await page.getByTestId('prop-shadow-blur').fill('12')
    await page.getByTestId('prop-shadow-color').fill('#112233')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          locked: el.locked || false,
          shadowX: el.shadowX,
          shadowY: el.shadowY,
          shadowBlur: el.shadowBlur,
          shadowColor: (el.shadowColor || '').toLowerCase(),
        }
      })
      .toEqual({
        x: 240,
        y: 180,
        width: 360,
        height: 200,
        rotation: 45,
        locked: false,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
  })

  test('persists shape controls including fill, stroke, radius, and label styling', async ({
    page,
    request,
  }) => {
    const elementId = 'shape-style-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'shape',
      shape: 'rect',
      x: 80,
      y: 80,
      width: 240,
      height: 140,
      zIndex: 1,
      fill: '#6366f1',
      stroke: '#ffffff',
      strokeWidth: 2,
      opacity: 1,
      borderRadius: 0,
      text: 'Initial',
      fontSize: 16,
      textColor: '#ffffff',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-shape-fill').fill('#a855f7')
    await page.getByTestId('prop-shape-stroke').fill('#f97316')
    await setRangeByTestId(page, 'prop-shape-stroke-width', 5)
    await setRangeByTestId(page, 'prop-shape-opacity', 85)
    await setRangeByTestId(page, 'prop-shape-border-radius', 24)
    await page.getByTestId('prop-shape-label').fill('Updated Label')
    await page.getByTestId('prop-shape-text-size').fill('22')
    await page.getByTestId('prop-shape-text-color').fill('#10b981')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          fill: (el.fill || '').toLowerCase(),
          stroke: (el.stroke || '').toLowerCase(),
          strokeWidth: el.strokeWidth,
          opacity: el.opacity,
          borderRadius: el.borderRadius,
          text: el.text,
          fontSize: el.fontSize,
          textColor: (el.textColor || '').toLowerCase(),
        }
      })
      .toEqual({
        fill: '#a855f7',
        stroke: '#f97316',
        strokeWidth: 5,
        opacity: 0.85,
        borderRadius: 24,
        text: 'Updated Label',
        fontSize: 22,
        textColor: '#10b981',
      })
  })

})
