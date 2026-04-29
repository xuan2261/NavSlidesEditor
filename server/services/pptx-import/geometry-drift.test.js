import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import mapperModule from './mapper.js'

const { mapPptxOutput } = mapperModule
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

async function withTempDir(prefix, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await run(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe('pptx geometry drift coverage', () => {
  it('preserves left/top zero instead of falling back to x/y', async () => {
    await withTempDir('pptx-drift-zero-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'zero.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'rect',
                  left: 0,
                  top: 0,
                  x: 400,
                  y: 300,
                  width: 120,
                  height: 60,
                },
              ],
            },
          ],
        },
      })
      const el = result.presentation.slides[0].elements[0]
      expect(el.x).toBe(0)
      expect(el.y).toBe(0)
      expect(el.width).toBe(120)
      expect(el.height).toBe(60)
    })
  })

  it('normalizes coordinates from non-16:9 source size to 960x540 canvas', async () => {
    await withTempDir('pptx-drift-scale-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'scaled.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 1920, height: 1080 },
          slides: [
            {
              elements: [
                { type: 'shape', shapType: 'rect', left: 960, top: 540, width: 192, height: 108 },
              ],
            },
          ],
        },
      })
      const el = result.presentation.slides[0].elements[0]
      expect(el.x).toBe(480)
      expect(el.y).toBe(270)
      expect(el.width).toBe(96)
      expect(el.height).toBe(54)
      expect(result.presentation.resolution).toEqual({ width: 1920, height: 1080 })
    })
  })

  it('converts absolute line endpoints into local endpoints inside wrapper box', async () => {
    await withTempDir('pptx-drift-line-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'line-abs.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'line',
                  left: 10,
                  top: 10,
                  width: 80,
                  height: 20,
                  x1: 300,
                  y1: 120,
                  x2: 200,
                  y2: 20,
                },
              ],
            },
          ],
        },
      })
      const line = result.presentation.slides[0].elements[0]
      expect(line.type).toBe('line')
      expect(line.x).toBe(200)
      expect(line.y).toBe(20)
      expect(line.width).toBe(100)
      expect(line.height).toBe(100)
      expect(line.x1).toBe(100)
      expect(line.y1).toBe(100)
      expect(line.x2).toBe(0)
      expect(line.y2).toBe(0)
    })
  })

  it('maps pptx image crop rect into editor-native crop fields', async () => {
    await withTempDir('pptx-drift-crop-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'crop.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'image',
                  left: 10,
                  top: 10,
                  width: 200,
                  height: 100,
                  base64: PNG_DATA_URL,
                  rect: { l: 100, r: 200, t: 50, b: 150 },
                },
              ],
            },
          ],
        },
      })
      const image = result.presentation.slides[0].elements[0]
      expect(image.imageW).toBeGreaterThan(200)
      expect(image.imageH).toBeGreaterThan(100)
      expect(image.imageOffsetX).toBeLessThan(0)
      expect(image.imageOffsetY).toBeLessThan(0)
      expect(image.cropData).toBeUndefined()
      expect(image._pptxImportMeta?.cropData).toEqual({
        left: 0.1,
        right: 0.2,
        top: 0.05,
        bottom: 0.15,
      })
    })
  })

  it('keeps nested group children within deterministic transformed bounds', async () => {
    await withTempDir('pptx-drift-group-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'group.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'group',
                  left: 100,
                  top: 100,
                  width: 300,
                  height: 200,
                  rotate: 15,
                  elements: [
                    {
                      type: 'group',
                      left: 30,
                      top: 40,
                      width: 150,
                      height: 90,
                      rotate: -20,
                      elements: [
                        {
                          type: 'shape',
                          shapType: 'rect',
                          left: 10,
                          top: 20,
                          width: 60,
                          height: 30,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
      const [shape] = result.presentation.slides[0].elements
      expect(shape.type).toBe('shape')
      expect(shape.x).toBeGreaterThanOrEqual(0)
      expect(shape.y).toBeGreaterThanOrEqual(0)
      expect(shape.width).toBeGreaterThan(0)
      expect(shape.height).toBeGreaterThan(0)
    })
  })
})
