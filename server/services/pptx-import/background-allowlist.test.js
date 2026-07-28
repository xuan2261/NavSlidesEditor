import { afterEach, describe, expect, it } from 'vitest'
import presentationMapper from './mapper/map-presentation.js'
import shared from 'revealjs-shared'

const { mapPptxOutput } = presentationMapper
const { getBackgroundAttrs } = shared

function runWithBackgroundFill(fill) {
  return mapPptxOutput({
    output: { size: { width: 960, height: 540 }, slides: [{ fill, elements: [] }] },
    zip: { files: {} },
    originalName: 'bg.pptx',
    uploadsDir: '/tmp',
  })
}

afterEach(() => {
  delete process.env.PPTX_IMPORT_MEDIA_ORIGINS
})

describe('I-R6.1 — slide background src must pass the media gate for all schemes', () => {
  it('blocks a background image on a non-allowlisted http host', async () => {
    const result = await runWithBackgroundFill({
      type: 'image',
      value: { src: 'https://evil.example.com/bg.png' },
    })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').not.toContain('evil.example.com')
  })

  it('blocks a data:text/html background', async () => {
    const result = await runWithBackgroundFill({
      type: 'image',
      value: { src: 'data:text/html,<script>alert(1)</script>' },
    })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').not.toContain('text/html')
  })

  it('blocks a protocol-relative //evil.tld background', async () => {
    const result = await runWithBackgroundFill({
      type: 'image',
      value: { src: '//evil.tld/bg.png' },
    })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').not.toContain('evil.tld')
  })

  it('allows a data:image background within reason', async () => {
    const pixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/I2BAAAAAElFTkSuQmCC'
    const result = await runWithBackgroundFill({ type: 'image', value: { src: pixel } })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').toContain('data:image/png')
  })

  it('charges data:image backgrounds against shared mediaBudget when provided', async () => {
    const { gateBackgroundImageSrc } = await import('./mapper/map-media.js')
    const { createMediaBudget } = await import('./resource-budgets.js')
    const pixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/I2BAAAAAElFTkSuQmCC'
    const mediaBudget = createMediaBudget(10)
    const warnings = []
    const blocked = gateBackgroundImageSrc(pixel, { mediaBudget, warnings })
    expect(blocked).toBeNull()
    expect(warnings.some((w) => w.code === 'media-budget-exceeded')).toBe(true)
  })

  it('charges one repeated background image once across every slide using it', async () => {
    const { gateBackgroundImageSrc } = await import('./mapper/map-media.js')
    const { createMediaBudget } = await import('./resource-budgets.js')
    const pixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/I2BAAAAAElFTkSuQmCC'
    // A deck template puts the same background on every slide. Charging it per
    // slide would exhaust the budget on content that is one image.
    const mediaBudget = createMediaBudget(1024)
    const warnings = []
    for (let slide = 0; slide < 40; slide += 1) {
      expect(gateBackgroundImageSrc(pixel, { mediaBudget, warnings })).toBe(pixel)
    }
    expect(warnings).toEqual([])
    // Exactly one charge, not merely a bounded one: a `tryReserve` that charged
    // nothing at all would satisfy any upper bound while failing this test's name.
    const payload = pixel.slice(pixel.indexOf('base64,') + 'base64,'.length)
    expect(mediaBudget.usedBytes).toBe(Math.floor((payload.length * 3) / 4))
  })

  it('blocks localhost backgrounds by default', async () => {
    const result = await runWithBackgroundFill({
      type: 'image',
      value: { src: 'http://localhost/bg.png' },
    })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').not.toContain('localhost')
  })

  it('allows only an explicitly configured full origin', async () => {
    process.env.PPTX_IMPORT_MEDIA_ORIGINS = 'https://cdn.example.com:8443'
    const result = await runWithBackgroundFill({
      type: 'image',
      value: { src: 'https://cdn.example.com:8443/bg.png' },
    })
    const bg = result.presentation.slides[0].background
    expect(bg.src || bg.image || '').toContain('https://cdn.example.com:8443')
  })
})

describe('I-R6.1 — emitted background URL is attribute-escaped', () => {
  it('escapes a double-quote in the background image src so it cannot break out of the attribute', () => {
    const attrs = getBackgroundAttrs({ type: 'image', image: '/x" onload="alert(1)' })
    expect(attrs).not.toContain('" onload="')
    expect(attrs).toContain('&quot;')
  })
})
