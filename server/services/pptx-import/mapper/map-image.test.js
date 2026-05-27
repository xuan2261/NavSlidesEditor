import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import imageMapper from './map-image.js'

const { mapImage } = imageMapper
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])

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
        filters: { brightness: 120000, contrast: 80000, saturation: 0, sharpen: 5 },
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
        borderWidth: 3.6,
        filterBrightness: 120,
        filterContrast: 80,
        filterGrayscale: 100,
        imageW: 166,
        imageH: 50,
        imageOffsetX: -17,
      })
      expect(result[0]._pptxImportMeta._pptxSharpen).toBe(5)
      expect(result[0]._pptxImportMeta.cropData.left).toBe(0.1)
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
})
