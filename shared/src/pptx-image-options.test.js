import { describe, expect, it } from 'vitest'
import imageOptions from './pptx-image-options.js'

const { buildPptxImageOptions, getPptxImageSemanticWarning } = imageOptions
const source = { path: 'image.png' }
const bounds = { x: 1, y: 2, w: 3, h: 4 }
const resolution = { width: 960, height: 540 }
const layout = { width: 13.333, height: 7.5 }

describe('PPTX image sizing options', () => {
  it('leaves stretched images on the authored bounds instead of converting them to contain', () => {
    const options = buildPptxImageOptions(
      source,
      { type: 'image', objectFit: 'fill' },
      bounds,
      resolution,
      layout
    )

    expect(options).toMatchObject({ ...source, ...bounds })
    expect(options.sizing).toBeUndefined()
  })

  it.each([
    ['contain', 'contain'],
    ['cover', 'cover'],
  ])('preserves %s sizing intent', (objectFit, sizingType) => {
    const options = buildPptxImageOptions(
      source,
      { type: 'image', objectFit },
      bounds,
      resolution,
      layout
    )

    expect(options.sizing).toEqual({ type: sizingType, w: bounds.w, h: bounds.h })
  })
  it('preserves authored image alternative text but omits decorative alternatives', () => {
    expect(buildPptxImageOptions(source, { type: 'image', alt: 'Chart summary' }, bounds, resolution, layout).altText).toBe('Chart summary')
    expect(buildPptxImageOptions(source, { type: 'image', alt: 'ignored', decorative: true }, bounds, resolution, layout).altText).toBeUndefined()
  })

  it('warns deterministically when PPTX cannot preserve image-only semantics', () => {
    expect(getPptxImageSemanticWarning({ type: 'image', decorative: true, longDescription: 'Detail' }, 4)).toBe('Slide 4: image decorative status and long description are not preserved in PPTX')
  })
})
