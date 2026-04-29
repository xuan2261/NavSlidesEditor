import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
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

test.describe('Element Property Interactions', () => {
  let editor
  let presentationId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Element Interaction Properties')
    presentationId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presentationId)
  })

  test('latex edit flow opens dialog and persists applied content', async ({ page, request }) => {
    const elementId = 'latex-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'latex',
      x: 90,
      y: 90,
      width: 500,
      height: 320,
      zIndex: 1,
      content: '\\frac{a}{b}',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.getByTestId('prop-latex-edit').click()

    const latexDialog = page.getByRole('dialog')
    await expect(latexDialog.getByRole('heading', { name: 'LaTeX / TikZ' })).toBeVisible()
    await latexDialog.locator('textarea').fill('\\int_0^1 x^2 dx')
    await latexDialog.getByRole('button', { name: 'Apply' }).click()

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return el.content
      })
      .toBe('\\int_0^1 x^2 dx')
  })

  test('html edit flow opens dialog and persists trusted content', async ({ page, request }) => {
    const elementId = 'html-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'html',
      x: 90,
      y: 90,
      width: 500,
      height: 320,
      zIndex: 1,
      content: '<div>Initial</div>',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.getByTestId('prop-html-edit').click()

    const htmlDialog = page.getByRole('dialog')
    await expect(htmlDialog.getByRole('heading', { name: 'HTML / D3 Embed' })).toBeVisible()
    const trustedSnippet = '<script>window.__e2eTrusted = true;</script><div id="e2e">Trusted HTML</div>'
    await htmlDialog.locator('textarea').fill(trustedSnippet)
    await htmlDialog.getByRole('button', { name: 'Apply' }).click()

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return el.content
      })
      .toBe(trustedSnippet)
  })
})
