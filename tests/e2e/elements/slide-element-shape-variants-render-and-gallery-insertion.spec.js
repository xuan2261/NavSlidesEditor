import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const SHAPE_VARIANTS = [
  'rect',
  'rounded-rect',
  'circle',
  'triangle',
  'diamond',
  'hexagon',
  'pentagon',
  'arrow-right',
  'star',
  'cloud',
  'cylinder',
  'parallelogram',
  'trapezoid',
]

function seedShape(shape) {
  return {
    id: `shape-${shape}`,
    type: 'shape',
    shape,
    x: 100,
    y: 100,
    width: 200,
    height: 160,
    zIndex: 1,
    fill: '#6366f1',
    stroke: '#ffffff',
    strokeWidth: 2,
  }
}

test.describe('Shape variants render and gallery insertion', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Shape variants render')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  for (const shape of SHAPE_VARIANTS) {
    test(`renders ${shape}`, async ({ page, request }) => {
      await apiUpdatePresentation(request, presId, {
        slides: [{
          id: 'slide-1',
          elements: [seedShape(shape)],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        }],
      })
      await editor.gotoPresentation(presId)
      const wrapper = page.getByTestId(`slide-element-shape-${shape}`)
      await expect(wrapper).toBeVisible()
      await expect(wrapper.locator('svg')).toBeVisible()
      const saved = await apiGetPresentation(request, presId)
      expect(saved.slides[0].elements[0].shape).toBe(shape)
    })
  }

  test('renders multiple shapes on one slide', async ({ page, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [
          { ...seedShape('star'), id: 'shape-star', x: 50 },
          { ...seedShape('circle'), id: 'shape-circle', x: 280 },
          { ...seedShape('triangle'), id: 'shape-triangle', x: 510 },
        ],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    await editor.gotoPresentation(presId)
    await expect(page.getByTestId('slide-element-shape-star')).toBeVisible()
    await expect(page.getByTestId('slide-element-shape-circle')).toBeVisible()
    await expect(page.getByTestId('slide-element-shape-triangle')).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements).toHaveLength(3)
  })
})
