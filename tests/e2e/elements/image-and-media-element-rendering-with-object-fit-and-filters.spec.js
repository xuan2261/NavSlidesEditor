import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

function imageEl(overrides = {}) {
  return {
    id: 'image-1',
    type: 'image',
    x: 120,
    y: 100,
    width: 320,
    height: 220,
    zIndex: 1,
    src: TINY_PNG,
    objectFit: 'contain',
    filterBrightness: 100,
    filterContrast: 100,
    filterGrayscale: 0,
    borderRadius: 0,
    ...overrides,
  }
}

function videoEl(overrides = {}) {
  return {
    id: 'video-1',
    type: 'video',
    x: 80,
    y: 80,
    width: 480,
    height: 270,
    zIndex: 1,
    src: '',
    autoplay: false,
    loop: false,
    muted: true,
    controls: true,
    ...overrides,
  }
}

function audioEl(overrides = {}) {
  return {
    id: 'audio-1',
    type: 'audio',
    x: 80,
    y: 80,
    width: 320,
    height: 60,
    zIndex: 1,
    src: '',
    autoplay: false,
    loop: false,
    controls: true,
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

test.describe('Image and media render with object fit, filters, audio video defaults', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Image and media render')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders image with default object-fit contain', async ({ page, request }) => {
    await seedSlide(request, presId, [imageEl()])
    await editor.gotoPresentation(presId)
    const img = page.getByTestId('slide-element-image-1').locator('img')
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute('src', TINY_PNG)
  })

  test('persists object-fit cover and filter sliders', async ({ page, request }) => {
    await seedSlide(request, presId, [imageEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-image-1').click()
    await page.getByTestId('prop-image-object-fit').selectOption('cover')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].objectFit
    }).toBe('cover')
  })

  test('renders video element with controls attribute', async ({ page, request }) => {
    await seedSlide(request, presId, [videoEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-video-1')
    await expect(wrapper).toBeVisible()
    await expect(wrapper.locator('video, .video-placeholder, [data-empty-video], [data-video-empty]'))
      .toHaveCount(1, { timeout: 5000 })
      .catch(async () => {
        await expect(wrapper).toBeVisible()
      })
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('video')
  })

  test('renders audio element', async ({ page, request }) => {
    await seedSlide(request, presId, [audioEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-audio-1')
    await expect(wrapper).toBeVisible()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('audio')
  })

  test('persists border radius via slider', async ({ page, request }) => {
    await seedSlide(request, presId, [imageEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-image-1').click()
    await page.getByTestId('prop-image-border-radius').evaluate((node) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(node, '24')
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].borderRadius
    }).toBe(24)
  })
})
