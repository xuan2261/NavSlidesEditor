import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function textEl(overrides = {}) {
  return {
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    zIndex: 1,
    content: '<p>Hello world</p>',
    fontSize: 24,
    fontFamily: 'Arial',
    color: '#ffffff',
    textAlign: 'left',
    bold: false,
    italic: false,
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

test.describe('Text element rich formatting bold italic underline alignment and color', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Text rich formatting')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders seeded text and persists rich content', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ content: '<p><strong>Bold</strong> and <em>italic</em></p>' })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-text-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('strong')).toContainText('Bold')
    await expect(wrapper.locator('em')).toContainText('italic')
  })

  test('inserts text via Insert tab', async ({ page, request }) => {
    await editor.gotoPresentation(presId)
    const before = await editor.getElementCount()
    await editor.addTextNode()
    await expect(page.locator('.element-wrapper')).toHaveCount(before + 1)
    const saved = await apiGetPresentation(request, presId)
    const inserted = saved.slides[0].elements[saved.slides[0].elements.length - 1]
    expect(inserted.type).toBe('text')
  })

  test('applies bold via toolbar while editing', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ content: '<p>plain text</p>' })])
    await editor.gotoPresentation(presId)
    await editor.startEditingTextElement(0)
    await editor.selectAllText()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('Escape')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return /<strong>|<b>/.test(saved.slides[0].elements[0].content)
    }, { timeout: 8000 }).toBe(true)
  })

  test('applies italic via toolbar while editing', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ content: '<p>plain text</p>' })])
    await editor.gotoPresentation(presId)
    await editor.startEditingTextElement(0)
    await editor.selectAllText()
    await page.keyboard.press('Control+i')
    await page.keyboard.press('Escape')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return /<em>|<i>/.test(saved.slides[0].elements[0].content)
    }, { timeout: 8000 }).toBe(true)
  })

  test('persists font family change via toolbar while editing', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ content: '<p>plain text</p>' })])
    await editor.gotoPresentation(presId)
    await editor.startEditingTextElement(0)
    await editor.selectAllText()
    await page.locator('select[title="Font family"]').first().selectOption({ index: 1 })
    await page.keyboard.press('Escape')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return /font-family/i.test(saved.slides[0].elements[0].content)
    }, { timeout: 8000 }).toBe(true)
  })

  test('persists text alignment change via toolbar while editing', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ content: '<p>plain text</p>' })])
    await editor.gotoPresentation(presId)
    await editor.startEditingTextElement(0)
    await editor.selectAllText()
    // On the Home tab the alignment buttons live inside the compact "Paragraph"
    // dropdown, so open it before clicking Align center.
    await page.getByRole('button', { name: 'Paragraph' }).click()
    await page.getByRole('button', { name: 'Align center' }).click()
    await page.keyboard.press('Escape')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return /text-align:\s*center/i.test(saved.slides[0].elements[0].content)
    }, { timeout: 8000 }).toBe(true)
  })
})
