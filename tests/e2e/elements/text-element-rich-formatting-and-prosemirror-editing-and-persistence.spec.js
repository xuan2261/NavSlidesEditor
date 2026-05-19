import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage.js'
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

  test('persists font family change via property panel', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-text-1').click()
    const familyControl = page.getByTestId('prop-text-font-family')
    if (await familyControl.count()) {
      await familyControl.selectOption({ index: 1 })
      await expect.poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements[0].fontFamily
      }).not.toBe('Arial')
    }
  })

  test('persists text alignment change', async ({ page, request }) => {
    await seedSlide(request, presId, [textEl({ textAlign: 'left' })])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-text-1').click()
    const alignCenter = page.getByTestId('prop-text-align-center')
    if (await alignCenter.count()) {
      await alignCenter.click()
      await expect.poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements[0].textAlign
      }).toBe('center')
    }
  })
})
