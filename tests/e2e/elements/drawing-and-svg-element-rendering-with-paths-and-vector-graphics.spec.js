import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function drawingEl(overrides = {}) {
  return {
    id: 'drawing-1',
    type: 'drawing',
    x: 60,
    y: 60,
    width: 480,
    height: 320,
    zIndex: 1,
    paths: [
      { d: 'M 10 10 L 100 100 L 200 50', stroke: '#22c55e', strokeWidth: 4 },
      { d: 'M 50 200 Q 150 100 250 200', stroke: '#ef4444', strokeWidth: 3 },
    ],
    strokeColor: '#ffffff',
    strokeWidth: 3,
    ...overrides,
  }
}

function svgEl(overrides = {}) {
  return {
    id: 'svg-1',
    type: 'svg',
    x: 60,
    y: 60,
    width: 240,
    height: 240,
    zIndex: 1,
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="100%" height="100%"><circle cx="120" cy="120" r="80" fill="orange" stroke="white" stroke-width="4"/></svg>',
    ...overrides,
  }
}

async function seedSlide(request, presId, elements) {
  await apiUpdatePresentation(request, presId, {
    slides: [{
      id: 'slide-1',
      elements,
      notes: '',
      background: { type: 'color', color: '#1e1e2e' },
    }],
  })
}

test.describe('Drawing and SVG element rendering with paths and vector graphics', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Drawing and SVG render')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders drawing strokes from seeded paths', async ({ page, request }) => {
    await seedSlide(request, presId, [drawingEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-drawing-1')
    await expect(wrapper).toBeVisible()
    const paths = wrapper.locator('svg path')
    await expect(paths).toHaveCount(2)
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].paths).toHaveLength(2)
  })

  test('renders empty drawing placeholder', async ({ page, request }) => {
    await seedSlide(request, presId, [drawingEl({ paths: [] })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-drawing-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.getByText(/Drawing \(empty\)/i)).toBeVisible()
  })

  test('renders SVG content with embedded shapes', async ({ page, request }) => {
    await seedSlide(request, presId, [svgEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-svg-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('svg')).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('svg')
    expect(saved.slides[0].elements[0].content).toContain('circle')
  })

  test('renders multiple drawings co-existing', async ({ page, request }) => {
    await seedSlide(request, presId, [
      drawingEl({ id: 'drawing-1', x: 30 }),
      drawingEl({ id: 'drawing-2', x: 560, paths: [{ d: 'M 0 0 L 100 100', stroke: '#3b82f6', strokeWidth: 2 }] }),
    ])
    await editor.gotoPresentation(presId)
    await expect(page.getByTestId('slide-element-drawing-1')).toBeVisible()
    await expect(page.getByTestId('slide-element-drawing-2')).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements).toHaveLength(2)
  })

  test('persists drawing path stroke updates via API', async ({ page, request }) => {
    await seedSlide(request, presId, [drawingEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-drawing-1').waitFor({ state: 'visible' })
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [drawingEl({ paths: [{ d: 'M 0 0 L 50 50', stroke: '#a855f7', strokeWidth: 8 }] })],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].paths).toHaveLength(1)
    expect((saved.slides[0].elements[0].paths[0].stroke || '').toLowerCase()).toBe('#a855f7')
  })
})
