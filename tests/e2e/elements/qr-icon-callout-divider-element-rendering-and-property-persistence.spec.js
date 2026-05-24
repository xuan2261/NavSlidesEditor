import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function qrEl(overrides = {}) {
  return {
    id: 'qr-1',
    type: 'qrcode',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    zIndex: 1,
    qrData: 'https://navslides.test/example',
    qrColor: '#000000',
    qrBgColor: '#ffffff',
    qrErrorLevel: 'M',
    ...overrides,
  }
}

function iconEl(overrides = {}) {
  return {
    id: 'icon-1',
    type: 'icon',
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    zIndex: 1,
    iconName: 'Star',
    iconColor: '#fbbf24',
    iconStrokeWidth: 2,
    ...overrides,
  }
}

function calloutEl(overrides = {}) {
  return {
    id: 'callout-1',
    type: 'callout',
    x: 100,
    y: 100,
    width: 60,
    height: 60,
    zIndex: 1,
    calloutNumber: 1,
    calloutColor: '#ef4444',
    calloutTextColor: '#ffffff',
    fontSize: 24,
    ...overrides,
  }
}

function dividerEl(overrides = {}) {
  return {
    id: 'divider-1',
    type: 'line',
    x: 96,
    y: 270,
    width: 768,
    height: 40,
    zIndex: 1,
    strokeColor: '#ffffff',
    strokeWidth: 3,
    arrowStart: 'none',
    arrowEnd: 'none',
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

test.describe('QR icon callout divider element rendering and property persistence', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'QR icon callout divider')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders QR code with seeded data', async ({ page, request }) => {
    await seedSlide(request, presId, [qrEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-qr-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('img[alt="QR Code"]')).toBeVisible({ timeout: 5000 })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].qrData).toBe('https://navslides.test/example')
  })

  test('persists QR data update via API', async ({ page, request }) => {
    await seedSlide(request, presId, [qrEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-qr-1').waitFor({ state: 'visible' })
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [qrEl({ qrData: 'https://navslides.test/updated' })],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].qrData).toBe('https://navslides.test/updated')
  })

  test('renders icon SVG with seeded name', async ({ page, request }) => {
    await seedSlide(request, presId, [iconEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-icon-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('svg')).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].iconName).toBe('Star')
  })

  test('renders different icon names', async ({ page, request }) => {
    await seedSlide(request, presId, [
      iconEl({ id: 'icon-star', iconName: 'Star', x: 50 }),
      iconEl({ id: 'icon-heart', iconName: 'Heart', x: 200 }),
      iconEl({ id: 'icon-check', iconName: 'Check', x: 350 }),
    ])
    await editor.gotoPresentation(presId)
    await expect(page.getByTestId('slide-element-icon-star')).toBeVisible()
    await expect(page.getByTestId('slide-element-icon-heart')).toBeVisible()
    await expect(page.getByTestId('slide-element-icon-check')).toBeVisible()
  })

  test('renders callout with number badge', async ({ page, request }) => {
    await seedSlide(request, presId, [calloutEl({ calloutNumber: 7 })])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-callout-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper).toContainText('7')
  })

  test('renders multiple callouts with sequential numbers', async ({ page, request }) => {
    await seedSlide(request, presId, [
      calloutEl({ id: 'callout-1', calloutNumber: 1, x: 50 }),
      calloutEl({ id: 'callout-2', calloutNumber: 2, x: 200 }),
      calloutEl({ id: 'callout-3', calloutNumber: 3, x: 350 }),
    ])
    await editor.gotoPresentation(presId)
    await expect(page.getByTestId('slide-element-callout-1')).toContainText('1')
    await expect(page.getByTestId('slide-element-callout-2')).toContainText('2')
    await expect(page.getByTestId('slide-element-callout-3')).toContainText('3')
  })

  test('renders divider as horizontal line element', async ({ page, request }) => {
    await seedSlide(request, presId, [dividerEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-divider-1')
    await expect(wrapper).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('line')
    expect(saved.slides[0].elements[0].width).toBe(768)
  })

  test('persists callout color update via API', async ({ page, request }) => {
    await seedSlide(request, presId, [calloutEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-callout-1').waitFor({ state: 'visible' })
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [calloutEl({ calloutColor: '#0ea5e9' })],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    const saved = await apiGetPresentation(request, presId)
    expect((saved.slides[0].elements[0].calloutColor || '').toLowerCase()).toBe('#0ea5e9')
  })
})
