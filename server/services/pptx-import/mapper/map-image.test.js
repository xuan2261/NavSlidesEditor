import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import imageMapper from './map-image.js'

const { mapImage, mapImageFilters } = imageMapper
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])
// EMF magic: EMR_HEADER record type 0x00000001 (little-endian) at offset 0.
const EMF = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

function context(dir) {
  return {
    mediaIndex: { files: new Map() },
    uploadsDir: dir,
    scale: { x: 1, y: 1 },
    zIndex: 4,
    slideIndex: 0,
    warnings: [],
    stats: { imageCount: 0, placeholderCount: 0 },
  }
}

describe('pptx mapImageFilters', () => {
  it('maps brightness offset fractions to CSS percent, neutral-guarded', () => {
    // pptxtojson@2.0.2 emits a14:brightnessContrast/@bright as parseInt/1e5,
    // an offset fraction (neutral 0). CSS brightness% = round((1 + b) × 100).
    expect(mapImageFilters({ brightness: 0.2 }).filterBrightness).toBe(120)
    expect(mapImageFilters({ brightness: -0.5 }).filterBrightness).toBe(50)
    expect(mapImageFilters({ brightness: 0 }).filterBrightness).toBeUndefined()
  })

  it('maps contrast offset fractions to CSS percent, neutral-guarded', () => {
    expect(mapImageFilters({ contrast: 0.8 }).filterContrast).toBe(180)
    expect(mapImageFilters({ contrast: 0 }).filterContrast).toBeUndefined()
  })

  it('maps saturation multiplier to grayscale/saturate, neutral-guarded', () => {
    // Saturation is a multiplier (neutral 1.0). Below 1 desaturates → grayscale;
    // 0 (or below) is fully gray; above 1 oversaturates → saturate().
    expect(mapImageFilters({ saturation: 1.0 }).filterGrayscale).toBeUndefined()
    expect(mapImageFilters({ saturation: 1.0 }).filterSaturate).toBeUndefined()
    expect(mapImageFilters({ saturation: 0 }).filterGrayscale).toBe(100)
    expect(mapImageFilters({ saturation: 0.3 }).filterGrayscale).toBe(70)
    expect(mapImageFilters({ saturation: 1.5 }).filterSaturate).toBe(150)
    expect(mapImageFilters({ saturation: 1.5 }).filterGrayscale).toBeUndefined()
  })

  it('clamps negative CSS percents to zero', () => {
    expect(mapImageFilters({ brightness: -2 }).filterBrightness).toBe(0)
  })

  it('emits no filter fields for a fully-neutral correction (image unchanged)', () => {
    expect(mapImageFilters({ brightness: 0, contrast: 0, saturation: 1.0 })).toEqual({})
    expect(mapImageFilters({})).toEqual({})
    expect(mapImageFilters(undefined)).toEqual({})
  })
})

describe('pptx mapImage', () => {
  it('maps inline image payload with filters, crop, flip, border, and alt text', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-'))
    try {
      const ctx = { ...context(dir), scale: { x: 4 / 3, y: 1 } }
      const result = await mapImage({
        type: 'image',
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        base64: `data:image/png;base64,${PNG.toString('base64')}`,
        fill: 'cover',
        alt: '<p>Alt <strong>text</strong></p>',
        isFlipH: true,
        borderColor: '#123456',
        borderWidth: 2,
        filters: { brightness: 0.2, contrast: -0.2, saturation: 0, sharpen: 5 },
        rect: { l: 10, r: 10, t: 0, b: 0 },
      }, ctx)

      expect(ctx.stats.imageCount).toBe(1)
      expect(result[0]).toMatchObject({
        type: 'image',
        src: expect.stringMatching(/^\/uploads\/.+\.png$/),
        objectFit: 'cover',
        alt: 'Alt text',
        flipH: true,
        borderColor: '#123456',
        borderWidth: 2.7,
        filterBrightness: 120,
        filterContrast: 80,
        filterGrayscale: 100,
        imageW: 166,
        imageH: 50,
        imageOffsetX: -17,
      })
      expect(result[0]._pptxImportMeta._pptxSharpen).toBe(5)
      expect(result[0]._pptxImportMeta.cropData.left).toBe(0.1)
      expect(result[0]._pptxImportMeta.sourceCrop).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('maps uncropped images without offset overflow fields', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-plain-'))
    try {
      const ctx = context(dir)
      const result = await mapImage({
        type: 'image',
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        base64: `data:image/png;base64,${PNG.toString('base64')}`,
      }, ctx)

      expect(result[0].objectFit).toBe('contain')
      expect(result[0].imageW).toBeUndefined()
      expect(result[0].imageH).toBeUndefined()
      expect(result[0].imageOffsetX).toBeUndefined()
      expect(result[0].imageOffsetY).toBeUndefined()
      expect(result[0]._pptxImportMeta?.sourceCrop).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fits image boxes within slide bounds without dropping source crop metadata', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-bounds-'))
    try {
      const ctx = context(dir)
      const result = await mapImage({
        type: 'image',
        left: 930,
        top: 500,
        width: 180,
        height: 160,
        base64: `data:image/png;base64,${PNG.toString('base64')}`,
        rect: { l: 10, r: 10, t: 0, b: 0 },
      }, ctx)

      const image = result[0]
      expect(image.x + image.width).toBeLessThanOrEqual(1136)
      expect(image.y + image.height).toBeLessThanOrEqual(639)
      expect(image._pptxImportMeta.sourceCrop).toBe(true)
      expect(image.imageW).toBeGreaterThan(image.width)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a locked placeholder when media cannot be detected', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-missing-'))
    try {
      const ctx = context(dir)
      const result = await mapImage({ type: 'image', blob: 'data:image/png;base64,bm90LWltYWdl' }, ctx)
      expect(result[0].importPlaceholderType).toBe('media-missing')
      expect(ctx.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'image-detect-failed' }),
        expect.objectContaining({ type: 'media-missing' }),
      ]))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('renders an EMF image as a labelled placeholder, preserving box geometry', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-emf-'))
    try {
      const ctx = context(dir)
      const result = await mapImage({
        type: 'image',
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        base64: `data:image/x-emf;base64,${EMF.toString('base64')}`,
      }, ctx)

      const el = result[0]
      expect(el.importPlaceholderType).toBe('unsupported-image')
      expect(el.text).toMatch(/EMF\/WMF/i)
      // Original box geometry is preserved so layout stays intact.
      expect(el).toMatchObject({ x: 10, y: 20, width: 100, height: 50 })
      expect(ctx.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'unsupported-image' }),
      ]))
      // It must NOT be persisted as a live <img>.
      expect(el.type).toBe('shape')
      expect(el.src).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('leaves supported PNG media as a normal image (regression lock)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-map-image-png-ok-'))
    try {
      const ctx = context(dir)
      const result = await mapImage({
        type: 'image',
        left: 10,
        top: 20,
        width: 100,
        height: 50,
        base64: `data:image/png;base64,${PNG.toString('base64')}`,
      }, ctx)

      expect(result[0].type).toBe('image')
      expect(result[0].src).toMatch(/^\/uploads\/.+\.png$/)
      expect(result[0].importPlaceholderType).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
