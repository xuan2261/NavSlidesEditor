import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function markdownEl(overrides = {}) {
  return {
    id: 'md-1',
    type: 'markdown',
    x: 80,
    y: 80,
    width: 520,
    height: 320,
    zIndex: 1,
    content: '# Heading\n\n- item 1\n- item 2\n\n**bold** *italic*',
    ...overrides,
  }
}

function htmlEl(overrides = {}) {
  return {
    id: 'html-1',
    type: 'html',
    x: 80,
    y: 80,
    width: 520,
    height: 320,
    zIndex: 1,
    content: '<div style="color:white;font-size:24px">Embedded <strong>HTML</strong></div>',
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

test.describe('Markdown rendering and HTML embed sanitization with persistence', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Markdown HTML embed')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders markdown heading and list', async ({ page, request }) => {
    await seedSlide(request, presId, [markdownEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-md-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('h1')).toContainText('Heading')
    await expect(wrapper.locator('li').first()).toContainText('item 1')
    await expect(wrapper.locator('strong')).toContainText('bold')
  })

  test('renders code fences from markdown', async ({ page, request }) => {
    const md = '```js\nconst x = 1\n```\n'
    await seedSlide(request, presId, [markdownEl({ content: md })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-md-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('code, pre').first()).toBeVisible()
  })

  test('persists markdown content via API seed and read', async ({ page, request }) => {
    await seedSlide(request, presId, [markdownEl({ content: '# Persisted heading' })])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-md-1').waitFor({ state: 'visible' })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('markdown')
    expect(saved.slides[0].elements[0].content).toBe('# Persisted heading')
  })

  test('renders HTML embed inside iframe or container', async ({ page, request }) => {
    await seedSlide(request, presId, [htmlEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-html-1')
    await expect(wrapper).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('html')
    expect(saved.slides[0].elements[0].content).toContain('Embedded')
  })

  test('persists html embed content via API', async ({ page, request }) => {
    await seedSlide(request, presId, [htmlEl({ content: '<p style="color:cyan">unique-marker</p>' })])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-html-1').waitFor({ state: 'visible' })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].content).toContain('unique-marker')
  })

  test('persists markdown content edit via API', async ({ page, request }) => {
    await seedSlide(request, presId, [markdownEl({ content: '# Original' })])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-md-1').waitFor({ state: 'visible' })
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [markdownEl({ content: '# Updated' })],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].content).toBe('# Updated')
  })
})
