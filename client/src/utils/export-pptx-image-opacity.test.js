import { describe, expect, it, vi } from 'vitest'
import { addImageElement } from './export-pptx-basic-renderers'

function mockSlide() {
  return { addImage: vi.fn(), addShape: vi.fn(), addText: vi.fn() }
}

const bounds = { x: 1, y: 1, w: 4, h: 3 }
const resolution = { width: 1280, height: 720 }
const layout = { width: 10, height: 5.63 }

describe('Phase 1 pptx: image opacity → transparency', () => {
  it('maps opacity 0.5 to transparency 50 on addImage', () => {
    const slide = mockSlide()
    addImageElement(slide, { type: 'image', src: 'https://example.com/x.png', opacity: 0.5 }, bounds, resolution, layout)
    const opts = slide.addImage.mock.calls[0][0]
    expect(opts.transparency).toBe(50)
  })

  it('does not set transparency when opacity is unset or 1', () => {
    const slide = mockSlide()
    addImageElement(slide, { type: 'image', src: 'https://example.com/x.png' }, bounds, resolution, layout)
    expect(slide.addImage.mock.calls[0][0].transparency).toBeUndefined()

    const slide2 = mockSlide()
    addImageElement(slide2, { type: 'image', src: 'https://example.com/x.png', opacity: 1 }, bounds, resolution, layout)
    expect(slide2.addImage.mock.calls[0][0].transparency).toBeUndefined()
  })
})
