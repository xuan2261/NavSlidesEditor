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

describe('Phase 3 pptx: image crop and accepted filter/radius limits', () => {
  it('maps cropData to pptxgenjs crop sizing', () => {
    const slide = mockSlide()
    addImageElement(
      slide,
      {
        type: 'image',
        src: 'https://example.com/x.png',
        cropData: { left: 0.1, right: 0.2, top: 0.05, bottom: 0.15 },
      },
      bounds,
      resolution,
      layout
    )

    const sizing = slide.addImage.mock.calls[0][0].sizing
    expect(sizing.type).toBe('crop')
    expect(sizing.x).toBeCloseTo(1 - (4 * 0.1) / 0.7)
    expect(sizing.y).toBeCloseTo(1 - (3 * 0.05) / 0.8)
    expect(sizing.w).toBeCloseTo(4 / 0.7)
    expect(sizing.h).toBeCloseTo(3 / 0.8)
  })

  it('maps legacy image dimensions and offsets to crop sizing', () => {
    const slide = mockSlide()
    addImageElement(
      slide,
      {
        type: 'image',
        src: 'https://example.com/x.png',
        imageW: 800,
        imageH: 600,
        imageOffsetX: -64,
        imageOffsetY: -36,
      },
      bounds,
      resolution,
      layout
    )

    const sizing = slide.addImage.mock.calls[0][0].sizing
    expect(sizing.type).toBe('crop')
    expect(sizing.x).toBeCloseTo(0.5)
    expect(sizing.y).toBeCloseTo(0.2815)
    expect(sizing.w).toBeCloseTo(6.25)
    expect(sizing.h).toBeCloseTo(4.691666666666666)
  })

  it('maps objectFit cover to cover sizing and other fits to contain sizing', () => {
    const coverSlide = mockSlide()
    addImageElement(coverSlide, { type: 'image', src: 'https://example.com/x.png', objectFit: 'cover' }, bounds, resolution, layout)
    expect(coverSlide.addImage.mock.calls[0][0].sizing).toEqual({ type: 'cover', w: 4, h: 3 })

    const fillSlide = mockSlide()
    addImageElement(fillSlide, { type: 'image', src: 'https://example.com/x.png', objectFit: 'fill' }, bounds, resolution, layout)
    expect(fillSlide.addImage.mock.calls[0][0].sizing).toEqual({ type: 'contain', w: 4, h: 3 })
  })

  it('exports borderColor/borderWidth as a rectangular overlay without claiming rounded image corners', () => {
    const slide = mockSlide()
    addImageElement(
      slide,
      {
        type: 'image',
        src: 'https://example.com/x.png',
        borderColor: '#336699',
        borderWidth: 2,
        borderRadius: 24,
      },
      bounds,
      resolution,
      layout
    )

    expect(slide.addShape).toHaveBeenCalledWith(
      'rect',
      expect.objectContaining({
        fill: { color: 'FFFFFF', transparency: 100 },
        line: { color: '336699', transparency: undefined, width: 2 },
      })
    )
    expect(slide.addShape.mock.calls[0][1].rectRadius).toBeUndefined()
    expect(slide.addImage.mock.calls[0][0].borderRadius).toBeUndefined()
  })

  it('does not silently map CSS image filters to native PPTX image options', () => {
    const slide = mockSlide()
    addImageElement(
      slide,
      {
        type: 'image',
        src: 'https://example.com/x.png',
        filterBrightness: 140,
        filterContrast: 80,
        filterGrayscale: 25,
        filterSaturate: 160,
      },
      bounds,
      resolution,
      layout
    )

    const options = slide.addImage.mock.calls[0][0]
    expect(options).not.toHaveProperty('filterBrightness')
    expect(options).not.toHaveProperty('filterContrast')
    expect(options).not.toHaveProperty('filterGrayscale')
    expect(options).not.toHaveProperty('filterSaturate')
  })
})
