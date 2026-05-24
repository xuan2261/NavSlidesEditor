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

  test('persists image controls including object fit and filters', async ({ page, request }) => {
    const elementId = 'image-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'image',
      x: 120,
      y: 100,
      width: 320,
      height: 220,
      zIndex: 1,
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>',
      objectFit: 'contain',
      filterBrightness: 100,
      filterContrast: 100,
      filterGrayscale: 0,
      borderRadius: 0,
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-image-object-fit').selectOption('cover')
    await setRangeByTestId(page, 'prop-image-brightness', 120)
    await setRangeByTestId(page, 'prop-image-contrast', 90)
    await setRangeByTestId(page, 'prop-image-grayscale', 30)
    await setRangeByTestId(page, 'prop-image-border-radius', 18)

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          objectFit: el.objectFit,
          filterBrightness: el.filterBrightness,
          filterContrast: el.filterContrast,
          filterGrayscale: el.filterGrayscale,
          borderRadius: el.borderRadius,
        }
      })
      .toEqual({
        objectFit: 'cover',
        filterBrightness: 120,
        filterContrast: 90,
        filterGrayscale: 30,
        borderRadius: 18,
      })
  })

  test('persists code properties and edit dialog changes', async ({ page, request }) => {
    const elementId = 'code-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'code',
      x: 90,
      y: 90,
      width: 560,
      height: 320,
      zIndex: 1,
      content: 'const value = 1;',
      language: 'javascript',
      fontSize: 14,
      borderRadius: 0,
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-code-language').selectOption('python')
    await page.getByTestId('prop-code-font-size').fill('18')
    await setRangeByTestId(page, 'prop-code-border-radius', 12)

    await page.getByTestId('prop-code-edit').click()
    const codeDialog = page.getByRole('dialog')
    await expect(codeDialog.getByRole('heading', { name: 'Code Block' })).toBeVisible()
    await codeDialog.locator('textarea').fill('print("persisted from modal")')
    await codeDialog.getByRole('button', { name: 'Apply' }).click()

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          language: el.language,
          fontSize: el.fontSize,
          borderRadius: el.borderRadius,
          content: el.content,
        }
      })
      .toEqual({
        language: 'python',
        fontSize: 18,
        borderRadius: 12,
        content: 'print("persisted from modal")',
      })
  })

})
