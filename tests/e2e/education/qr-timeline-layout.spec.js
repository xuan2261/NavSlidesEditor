import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'

async function waitForAuthoredQrInk(canvas) {
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        for (let i = 0; i < pixels.length; i += 4) {
          if (
            pixels[i] === 17 &&
            pixels[i + 1] === 34 &&
            pixels[i + 2] === 51 &&
            pixels[i + 3] === 255
          )
            return true
        }
        return false
      })
    )
    .toBe(true)
}

async function populate(request, title, element) {
  const deck = await apiCreatePresentation(request, title)
  await apiUpdatePresentation(request, deck.id, {
    resolution: { width: 1280, height: 720 },
    slides: [
      {
        id: 'layout',
        background: { type: 'color', color: '#f8fafc' },
        elements: [{ id: 'layout-element', x: 100, y: 140, zIndex: 1, ...element }],
      },
    ],
  })
  return deck
}

for (const dimensions of [
  { width: 520, height: 220 },
  { width: 180, height: 380 },
]) {
  test(`generated QR stays wholly inside ${dimensions.width}x${dimensions.height} geometry`, async ({
    page,
    request,
  }) => {
    const deck = await populate(request, 'Rectangular QR regression', {
      type: 'qrcode',
      ...dimensions,
      qrData: 'AUDIT-19-AUTHORED',
      qrColor: '#112233',
      qrBgColor: '#ffffff',
      qrErrorLevel: 'H',
    })
    let popup
    try {
      await new EditorPage(page).gotoPresentation(deck.id)
      ;({ popup } = await launchPresentPopup(page))
      const qr = popup.frameLocator('iframe').locator('canvas#c')
      await waitForAuthoredQrInk(qr)
      const geometry = await qr.evaluate((c) => {
        const r = c.getBoundingClientRect()
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: innerWidth,
          height: innerHeight,
        }
      })
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.top).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(geometry.width)
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.height)
      await popup.close()
      await page.getByRole('button', { name: 'File menu', exact: true }).click()
      const printing = page.waitForEvent('popup')
      await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
      popup = await printing
      const printed = popup.locator('canvas[data-qr-config]')
      await waitForAuthoredQrInk(printed)
      const printBounds = await printed.evaluate((c) => {
        const r = c.getBoundingClientRect(),
          p = c.parentElement.getBoundingClientRect()
        return {
          left: r.left - p.left,
          top: r.top - p.top,
          right: r.right - p.right,
          bottom: r.bottom - p.bottom,
        }
      })
      expect(printBounds.left).toBeGreaterThanOrEqual(0)
      expect(printBounds.top).toBeGreaterThanOrEqual(0)
      expect(printBounds.right).toBeLessThanOrEqual(0)
      expect(printBounds.bottom).toBeLessThanOrEqual(0)
    } finally {
      await popup?.close()
      await apiDeletePresentation(request, deck.id)
    }
  })
}

test('automatic timeline labels remain separated in editor and generated output', async ({
  page,
  request,
}) => {
  const deck = await populate(request, 'Timeline auto spacing regression', {
    type: 'timeline',
    width: 520,
    height: 220,
    timelineStart: '-20',
    timelineEnd: '2025',
    tickSpacing: 'auto',
    fontSize: 16,
    textColor: '#166534',
    events: [],
    items: [],
  })
  const inspect = async (locator) => {
    const bounds = await locator.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return { text: n.textContent, left: r.left, right: r.right }
      })
    )
    expect(Number(bounds[0].text)).toBeLessThanOrEqual(0)
    expect(Number(bounds.at(-1).text)).toBeGreaterThanOrEqual(2000)
    for (let i = 1; i < bounds.length; i++)
      expect(bounds[i].left).toBeGreaterThan(bounds[i - 1].right)
  }
  let popup
  try {
    await new EditorPage(page).gotoPresentation(deck.id)
    await inspect(page.locator('[data-testid="slide-element-layout-element"] svg text[transform]'))
    ;({ popup } = await launchPresentPopup(page))
    await inspect(popup.locator('svg text[transform]'))
  } finally {
    await popup?.close()
    await apiDeletePresentation(request, deck.id)
  }
})

test('timeline connector offsets keep event text visible when selection is cleared', async ({
  page,
  request,
}) => {
  const event = {
    id: 'event',
    date: '2013',
    title: 'Authored event',
    description: 'Authored detail',
    side: 'top',
    connectorLength: 72,
    connectorOffset: 72,
  }
  const deck = await populate(request, 'Timeline event overflow regression', {
    type: 'timeline',
    width: 520,
    height: 220,
    y: 150,
    timelineStart: '-20',
    timelineEnd: '2025',
    tickSpacing: 'auto',
    fontSize: 16,
    textColor: '#166534',
    events: [event],
    items: [event],
  })
  const inspect = async (svg) => {
    const clipped = await svg.locator('text:not([transform])').evaluateAll((nodes) =>
      nodes.flatMap((n) => {
        const text = n.getBoundingClientRect(),
          clips = []
        for (let p = n.parentElement; p; p = p.parentElement) {
          const style = getComputedStyle(p),
            rect = p.getBoundingClientRect()
          if (
            /hidden|clip|auto|scroll/.test(style.overflowX) &&
            (text.left < rect.left - 1 || text.right > rect.right + 1)
          )
            clips.push(n.textContent)
          if (
            /hidden|clip|auto|scroll/.test(style.overflowY) &&
            (text.top < rect.top - 1 || text.bottom > rect.bottom + 1)
          )
            clips.push(n.textContent)
        }
        return clips
      })
    )
    await expect(svg.locator('text:not([transform])')).toHaveText([
      'Authored event',
      'Authored detail',
      '2013',
    ])
    expect(clipped).toEqual([])
  }
  let popup
  try {
    await new EditorPage(page).gotoPresentation(deck.id)
    const wrapper = page.locator('[data-testid="slide-element-layout-element"]')
    await wrapper.click()
    await inspect(wrapper.locator('svg'))
    await page.keyboard.press('Escape')
    await inspect(wrapper.locator('svg'))
    ;({ popup } = await launchPresentPopup(page))
    await inspect(popup.locator('svg'))
  } finally {
    await popup?.close()
    await apiDeletePresentation(request, deck.id)
  }
})
