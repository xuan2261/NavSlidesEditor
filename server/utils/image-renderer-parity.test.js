// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { addImageElement as addClientImageElement } from '../../client/src/utils/export-pptx-basic-renderers.js'
import serverRenderers from './server-basic-renderers.js'

const { addImageElement: addServerImageElement } = serverRenderers
const bounds = { x: 1, y: 1, w: 4, h: 3 }
const resolution = { width: 1280, height: 720 }
const layout = { width: 10, height: 5.63 }

function createSlide() {
  return { addImage: vi.fn(), addShape: vi.fn() }
}

function renderWithBoth(element) {
  const clientSlide = createSlide()
  const serverSlide = createSlide()

  addClientImageElement(clientSlide, element, bounds, resolution, layout)
  addServerImageElement(serverSlide, element, bounds, resolution, layout)

  expect(clientSlide.addImage.mock.calls).toEqual(serverSlide.addImage.mock.calls)
  expect(clientSlide.addShape.mock.calls).toEqual(serverSlide.addShape.mock.calls)
  return clientSlide
}

describe('PPTX image renderer parity', () => {
  it('applies equivalent crop, transform, alt text, and border options', () => {
    renderWithBoth({
      type: 'image',
      src: 'data:image/png;base64,abc',
      rotation: 27,
      opacity: 0.35,
      flipH: true,
      flipV: true,
      alt: 'Representative image',
      cropData: { left: 0.1, right: 0.2, top: 0.05, bottom: 0.15 },
      borderColor: '#33669980',
      borderWidth: 2,
    })
  })

  it('keeps legacy sizing and fill objectFit parity, mapping fill to contain', () => {
    const legacySlide = renderWithBoth({
      type: 'image',
      src: 'data:image/png;base64,abc',
      imageW: 800,
      imageH: 600,
      imageOffsetX: -64,
      imageOffsetY: -36,
    })
    expect(legacySlide.addImage.mock.calls[0][0].sizing).toMatchObject({
      type: 'crop',
      x: 0.5,
      w: 6.25,
      h: 4.691666666666666,
    })
    expect(legacySlide.addImage.mock.calls[0][0].sizing.y).toBeCloseTo(0.2815)

    const fillSlide = renderWithBoth({
      type: 'image',
      src: 'data:image/png;base64,abc',
      objectFit: 'fill',
    })
    expect(fillSlide.addImage.mock.calls[0][0].sizing).toEqual({ type: 'contain', w: 4, h: 3 })
  })
})
