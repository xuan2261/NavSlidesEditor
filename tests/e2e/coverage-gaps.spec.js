import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
} from './fixtures/test-fixtures.js'

function shape(id, x, y, width = 100, height = 80, zIndex = 1) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    width,
    height,
    zIndex,
    fill: '#6366f1',
  }
}

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

async function openInsert(page) {
  await page.getByRole('tab', { name: 'Insert' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Insert' })).toBeVisible()
}

async function getInsertItem(page, label) {
  await openInsert(page)
  const aliases = {
    'Image (URL)': 'Add image',
    Video: 'Add video',
    Audio: 'Audio / Upload',
    'Audio / Upload': 'Audio / Upload',
    'QR Code': 'Add QR code',
    Icon: 'Add icon',
    'Drawing Canvas': 'Add drawing',
    SVG: 'Add SVG',
  }
  const panel = page.getByRole('tabpanel', { name: 'Insert' })
  const target = aliases[label] || label
  return panel.getByRole('button', { name: target, exact: true })
}

async function insertItem(page, label) {
  const previousCount = await page.locator('.element-wrapper').count()
  await (await getInsertItem(page, label)).click()
  if (label === 'Icon') {
    await expect(page.getByTestId('icon-gallery-grid')).toBeVisible()
    await page.locator('[data-testid^="icon-gallery-item-"]').first().click()
  }
  await expect(page.locator('.element-wrapper')).toHaveCount(previousCount + 1, { timeout: 10000 })
}

async function selectedCanvasElementIds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-element-id]'))
      .filter((el) => el.style.outline && el.style.outline !== 'none')
      .map((el) => el.getAttribute('data-element-id'))
      .sort()
  )
}

async function selectElements(page, ids) {
  const expected = []
  await page.keyboard.press('Escape')
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([])

  await page.getByTestId(`slide-element-${ids[0]}`).click({ force: true })
  expected.push(ids[0])
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([...expected].sort())

  for (const id of ids.slice(1)) {
    await page.keyboard.down('Shift')
    await page.getByTestId(`slide-element-${id}`).click({ force: true })
    await page.keyboard.up('Shift')
    expected.push(id)
    await expect.poll(() => selectedCanvasElementIds(page)).toEqual([...expected].sort())
  }

  await expect(page.locator('.tour-step-ribbon')).toContainText('Arrange', { timeout: 5000 })
}

test.describe('Coverage Gaps: Editor controls and UI contracts', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Coverage Gaps')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presId)
  })

  test('covers extended insert menu elements: image, video, audio, QR, icon, drawing, SVG', async ({
    page,
    request,
  }) => {
    await editor.gotoPresentation(presId)

    await (await getInsertItem(page, 'Image (URL)')).click()
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/image.png')
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.locator('.element-wrapper')).toHaveCount(2)

    await (await getInsertItem(page, 'Video')).click()
    await page.locator('input[placeholder="https://..."]').first().fill('https://example.com/video.mp4')
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.locator('.element-wrapper')).toHaveCount(3)

    await insertItem(page, 'QR Code')
    await insertItem(page, 'Drawing Canvas')

    await insertItem(page, 'Icon')
    await expect(page.locator('.element-wrapper')).toHaveCount(6)

    const svgChooser = page.waitForEvent('filechooser')
    await (await getInsertItem(page, 'SVG')).click()
    await (await svgChooser).setFiles({
      name: 'diagram.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    })
    await expect(page.locator('.element-wrapper')).toHaveCount(7)

    const audioChooser = page.waitForEvent('filechooser')
    await (await getInsertItem(page, 'Audio / Upload')).click()
    await (await audioChooser).setFiles({
      name: 'sample.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake audio bytes'),
    })
    await expect(page.locator('.element-wrapper')).toHaveCount(8, { timeout: 10000 })

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.map((el) => el.type).sort().join(',')
      })
      .toContain('audio')

    const saved = await apiGetPresentation(request, presId)
    const types = saved.slides[0].elements.map((el) => el.type)
    expect(types).toEqual(expect.arrayContaining(['image', 'video', 'qrcode', 'drawing', 'icon', 'svg', 'audio']))
  })

})
