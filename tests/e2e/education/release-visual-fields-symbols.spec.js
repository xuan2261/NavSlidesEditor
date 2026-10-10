import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  styleOf,
  fieldEvidence,
  insideBounds,
} from './release-visual-fields.js'
import { inspectOrdinary } from './release-ordinary-observers.js'

test('icon gallery changes actual glyph and authored stroke/color', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'icon', { iconName: 'Star' })
  await expect(s.root.locator('svg polygon')).toBeVisible()
  const before = await s.root.locator('svg').innerHTML()
  await page.getByTestId('prop-icon-change').click()
  await page.getByRole('textbox', { name: 'Search icons', exact: true }).fill('Heart')
  await page.getByRole('button', { name: 'Insert Heart icon', exact: true }).press('Enter')
  await colorControl(page, 'Icon color', '#be123c')
  await fillControl(page, 'Icon stroke width', 4)
  const persisted = await s.reload({ iconName: 'Heart', iconColor: '#be123c', iconStrokeWidth: 4 })
  const svg = s.root.locator('svg'),
    glyph = await svg.innerHTML()
  expect(glyph).not.toBe(before)
  await expect(svg).toHaveCSS('stroke', 'rgb(190, 18, 60)')
  await expect(svg).toHaveAttribute('stroke-width', '4')
  await expect(svg.locator('path')).toHaveAttribute('d', /[Cc]/)
  const geometry = await insideBounds(svg, s.root)
  await fieldEvidence(
    info,
    page,
    'icon',
    ['iconName', 'iconColor', 'iconStrokeWidth', 'color', 'stroke', 'bounds'],
    { glyph: 'Heart', strokeWidth: 4, color: '#be123c', contained: true },
    { persisted, glyph, geometry }
  )
})

test('callout number, background, foreground and font are visibly effective', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'callout')
  await fillControl(page, 'Callout Number', 37)
  await fillControl(page, 'Callout Font Size', 32)
  await colorControl(page, 'Callout BG Color', '#1d4ed8')
  await colorControl(page, 'Callout Text Color', '#fef08a')
  const persisted = await s.reload({
    calloutNumber: 37,
    fontSize: 32,
    calloutColor: '#1d4ed8',
    calloutTextColor: '#fef08a',
  })
  const badge = s.root.locator('[data-element-content] > div')
  await expect(badge).toHaveText('37')
  await expect(badge).toHaveCSS('background-color', 'rgb(29, 78, 216)')
  await expect(badge).toHaveCSS('color', 'rgb(254, 240, 138)')
  await expect(badge).toHaveCSS('font-size', '32px')
  const effective = await styleOf(badge, ['color', 'backgroundColor', 'fontSize'])
  await fieldEvidence(
    info,
    page,
    'callout',
    ['calloutNumber', 'calloutColor', 'calloutTextColor', 'fontSize', 'number', 'colors', 'font'],
    { readableNumber: 37, fontPixels: 32, background: '#1d4ed8', foreground: '#fef08a' },
    { persisted, text: await badge.textContent(), effective }
  )
})

async function qrBitmap(root) {
  const image = root.locator('img')
  await expect
    .poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0))
    .toBe(true)
  return image.evaluate((node) => {
    const c = document.createElement('canvas')
    c.width = node.naturalWidth
    c.height = node.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(node, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    const colors = {},
      ink = []
    for (let i = 0; i < data.length; i += 4) {
      const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`
      colors[key] = (colors[key] || 0) + 1
      ink.push(data[i] < 128 ? 1 : 0)
    }
    return { colors, ink: ink.join(''), width: c.width, height: c.height }
  })
}

test('QR author data, both paints and correction level decode the actual rendered bitmap', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'qrcode', {
    qrErrorLevel: 'L',
    qrData: 'BEFORE-QR',
  })
  await fillControl(page, 'QR code data or URL', 'https://example.com/visual-authored-37')
  await colorControl(page, 'QR code Foreground color', '#112233')
  await colorControl(page, 'QR code Background color', '#f8fafc')
  await s.reload({
    qrData: 'https://example.com/visual-authored-37',
    qrColor: '#112233',
    qrBgColor: '#f8fafc',
    qrErrorLevel: 'L',
  })
  const low = await qrBitmap(s.root)
  const lowDecoded = await inspectOrdinary(page, s.root, await s.read(), 'canvas')
  await page.getByLabel('QR code error correction level', { exact: true }).selectOption('H')
  const persisted = await s.reload({ qrErrorLevel: 'H' })
  const bitmap = await qrBitmap(s.root)
  const decoded = await inspectOrdinary(page, s.root, persisted, 'canvas')
  expect(bitmap.colors['17,34,51,255']).toBeGreaterThan(100)
  expect(bitmap.colors['248,250,252,255']).toBeGreaterThan(100)
  expect(bitmap.ink).not.toBe(low.ink)
  expect(decoded.decodedPayload).toBe('https://example.com/visual-authored-37')
  expect(lowDecoded.decodedPayload).toBe(decoded.decodedPayload)
  await fieldEvidence(
    info,
    page,
    'qrcode',
    ['qrData', 'qrColor', 'qrBgColor', 'qrErrorLevel', 'colors', 'errorLevel', 'decodedPayload'],
    {
      payload: 'https://example.com/visual-authored-37',
      correctionChangesSymbol: true,
      foreground: '#112233',
      background: '#f8fafc',
    },
    {
      persisted,
      decoded,
      lowDecoded,
      renderedColors: bitmap.colors,
      symbolChanged: bitmap.ink !== low.ink,
    }
  )
})
