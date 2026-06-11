// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import basicRenderers from './server-basic-renderers.js'

const { addImageElement } = basicRenderers

function makeSlide() {
  return {
    addImage: vi.fn(),
    addShape: vi.fn(),
    addText: vi.fn(),
  }
}

const bounds = { x: 1, y: 1, w: 4, h: 3 }
const resolution = { width: 960, height: 540 }
const layout = { width: 10, height: 5.63 }

describe('server image opacity export (I-R3.2)', () => {
  it('maps element.opacity 0.5 to pptxgenjs transparency 50', () => {
    const slide = makeSlide()
    addImageElement(
      slide,
      { id: 'img-1', type: 'image', src: 'data:image/png;base64,abc', opacity: 0.5 },
      bounds,
      resolution,
      layout
    )

    expect(slide.addImage).toHaveBeenCalledTimes(1)
    expect(slide.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'data:image/png;base64,abc', transparency: 50 })
    )
  })

  it('omits transparency for fully opaque images (opacity 1)', () => {
    const slide = makeSlide()
    addImageElement(
      slide,
      { id: 'img-2', type: 'image', src: 'data:image/png;base64,abc', opacity: 1 },
      bounds,
      resolution,
      layout
    )

    const args = slide.addImage.mock.calls[0][0]
    expect(args.transparency).toBeUndefined()
  })

  it('omits transparency when opacity is absent', () => {
    const slide = makeSlide()
    addImageElement(
      slide,
      { id: 'img-3', type: 'image', src: 'data:image/png;base64,abc' },
      bounds,
      resolution,
      layout
    )

    const args = slide.addImage.mock.calls[0][0]
    expect(args.transparency).toBeUndefined()
  })
})
