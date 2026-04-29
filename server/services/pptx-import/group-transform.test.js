import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import mapperModule from './mapper.js'

const { mapPptxOutput } = mapperModule

async function withTempDir(prefix, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await run(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

describe('pptx group and transform fidelity', () => {
  it('flattens nested rotated/flipped groups into deterministic child bounds', async () => {
    await withTempDir('pptx-group-affine-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'nested-group.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'group',
                  left: 200,
                  top: 120,
                  width: 220,
                  height: 160,
                  rotate: 30,
                  isFlipH: true,
                  elements: [
                    {
                      type: 'group',
                      left: 20,
                      top: 10,
                      width: 140,
                      height: 100,
                      rotate: -15,
                      elements: [
                        {
                          type: 'shape',
                          shapType: 'rect',
                          left: 10,
                          top: 12,
                          width: 40,
                          height: 30,
                          fill: '#22c55e',
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
      expect(shape.rotation).toBe(15)
    })
  })

  it('normalizes grouped line endpoints with reversed directions', async () => {
    await withTempDir('pptx-group-line-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'group-line.pptx',
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
                  width: 200,
                  height: 100,
                  rotate: 10,
                  elements: [
                    {
                      type: 'shape',
                      shapType: 'line',
                      left: 20,
                      top: 10,
                      width: 120,
                      height: 40,
                      x1: 120,
                      y1: 40,
                      x2: 0,
                      y2: 0,
                    },
                  ],
                },
              ],
            },
          ],
        },
      })

      const [line] = result.presentation.slides[0].elements
      expect(line.type).toBe('line')
      expect(line.width).toBeGreaterThan(0)
      expect(line.height).toBeGreaterThan(0)
      expect(Number.isFinite(line.x1)).toBe(true)
      expect(Number.isFinite(line.y1)).toBe(true)
      expect(Number.isFinite(line.x2)).toBe(true)
      expect(Number.isFinite(line.y2)).toBe(true)
    })
  })

  it('keeps stable zIndex ordering while flattening grouped children', async () => {
    await withTempDir('pptx-group-z-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'group-order.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'group',
                  left: 30,
                  top: 40,
                  width: 240,
                  height: 140,
                  elements: [
                    { type: 'shape', shapType: 'rect', left: 10, top: 10, width: 40, height: 40, fill: '#ef4444' },
                    { type: 'shape', shapType: 'rect', left: 60, top: 10, width: 40, height: 40, fill: '#22c55e' },
                    { type: 'shape', shapType: 'rect', left: 110, top: 10, width: 40, height: 40, fill: '#3b82f6' },
                  ],
                },
              ],
            },
          ],
        },
      })

      const elements = result.presentation.slides[0].elements
      const zIndexes = elements.map((element) => element.zIndex)
      expect(elements).toHaveLength(3)
      expect(new Set(zIndexes).size).toBe(3)
      expect(zIndexes[0]).toBeLessThan(zIndexes[1])
      expect(zIndexes[1]).toBeLessThan(zIndexes[2])
    })
  })
})
