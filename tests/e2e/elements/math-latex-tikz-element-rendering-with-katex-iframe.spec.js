import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function latexEl(overrides = {}) {
  return {
    id: 'latex-1',
    type: 'latex',
    x: 80,
    y: 80,
    width: 480,
    height: 220,
    zIndex: 1,
    content: 'E = mc^2',
    fontSize: 18,
    textColor: '#ffffff',
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

test.describe('Math LaTeX and TikZ rendering with KaTeX iframe and content persistence', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Math LaTeX TikZ')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders LaTeX equation in iframe', async ({ page, request }) => {
    await seedSlide(request, presId, [latexEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-latex-1')
    await expect(wrapper).toBeVisible()
    const iframe = wrapper.locator('iframe')
    await expect(iframe).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].content).toBe('E = mc^2')
  })

  test('renders inline TikZ block', async ({ page, request }) => {
    const tikzContent = '\\begin{tikzpicture}\\draw (0,0) -- (2,2);\\end{tikzpicture}'
    await seedSlide(request, presId, [latexEl({ id: 'tikz-1', content: tikzContent })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-tikz-1')
    await expect(wrapper).toBeVisible()
    const iframe = wrapper.locator('iframe')
    await expect(iframe).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].content).toContain('tikzpicture')
  })

  test('renders complex math expression with fractions and integrals', async ({ page, request }) => {
    const expr = '\\int_0^\\infty \\frac{1}{1+x^2} dx = \\frac{\\pi}{2}'
    await seedSlide(request, presId, [latexEl({ content: expr })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-latex-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('iframe')).toBeVisible()
  })

  test('renders multiple latex equations side by side', async ({ page, request }) => {
    await seedSlide(request, presId, [
      latexEl({ id: 'latex-1', content: 'a^2 + b^2 = c^2', x: 60 }),
      latexEl({ id: 'latex-2', content: 'e^{i\\pi} + 1 = 0', x: 580 }),
    ])
    await editor.gotoPresentation(presId)
    await expect(page.getByTestId('slide-element-latex-1')).toBeVisible()
    await expect(page.getByTestId('slide-element-latex-2')).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements).toHaveLength(2)
  })
})
