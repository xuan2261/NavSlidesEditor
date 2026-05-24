import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const LANGUAGES = ['javascript', 'python', 'go', 'rust', 'java', 'sql']

function codeEl(overrides = {}) {
  return {
    id: 'code-1',
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

test.describe('Code element syntax highlighting language switching and theme selection', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Code syntax highlighting')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  for (const language of LANGUAGES) {
    test(`renders code block in ${language}`, async ({ page, request }) => {
      await seedSlide(request, presId, [codeEl({ id: `code-${language}`, language, content: `// ${language} sample` })])
      await editor.gotoPresentation(presId)
      const wrapper = page.getByTestId(`slide-element-code-${language}`)
      await expect(wrapper).toBeVisible()
      const codeBox = wrapper.locator('pre, code, .code-block, [class*="hljs"]')
      await expect(codeBox.first()).toBeVisible()
      const saved = await apiGetPresentation(request, presId)
      expect(saved.slides[0].elements[0].language).toBe(language)
    })
  }

  test('switches language via property panel', async ({ page, request }) => {
    await seedSlide(request, presId, [codeEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-code-1').click()
    await page.getByTestId('prop-code-language').selectOption('python')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].language
    }).toBe('python')
  })

  test('persists font size change via property panel', async ({ page, request }) => {
    await seedSlide(request, presId, [codeEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-code-1').click()
    await page.getByTestId('prop-code-font-size').fill('22')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].fontSize
    }).toBe(22)
  })

  test('opens code editor modal and persists content', async ({ page, request }) => {
    await seedSlide(request, presId, [codeEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-code-1').click()
    await page.getByTestId('prop-code-edit').click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByRole('heading', { name: 'Code Block' })).toBeVisible()
    await dlg.locator('textarea').fill('def hello():\n    return 42\n')
    await dlg.getByRole('button', { name: 'Apply' }).click()
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].content
    }).toBe('def hello():\n    return 42\n')
  })
})
