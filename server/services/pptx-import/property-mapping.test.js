import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import mapperModule from './mapper'

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

describe('pptx property mapping hardening', () => {
  it('preserves text style metadata and text inset sidecar for text elements', async () => {
    await withTempDir('pptx-props-text-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'text.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'text',
                  left: 20,
                  top: 30,
                  width: 300,
                  height: 120,
                  fontFace: 'Arial',
                  fontSz: 24,
                  fontColor: '#123456',
                  textAlign: 'center',
                  lIns: 12,
                  rIns: 8,
                  tIns: 6,
                  bIns: 4,
                  content:
                    '<p style="text-align:center"><span style="font-size:24pt;font-family:Arial;color:#123456">Hello</span></p>',
                },
              ],
            },
          ],
        },
      })
      const text = result.presentation.slides[0].elements[0]
      expect(text.type).toBe('text')
      expect(text.fontFamily).toBe('Arial')
      expect(text.fontSize).toBe(32)
      expect(text.textColor).toBe('#123456')
      expect(text.textAlign).toBe('center')
      expect(text._pptxImportMeta.textInsets).toEqual({
        left: 16,
        right: 10.7,
        top: 8,
        bottom: 5.3,
      })
      expect(text._pptxImportMeta.textInsetsUnit).toBe('px')
      expect(text._pptxImportMeta).toMatchObject({
        version: 1,
        textFit: 'wrap',
        sourceFontSizePx: 32,
        fitFontSizePx: 32,
        sourceBox: { width: 300, height: 120 },
      })
      expect(text.content).not.toContain('font-size')
    })
  })

  it('preserves shape fill/stroke/opacity/rotation and shape text inset metadata', async () => {
    await withTempDir('pptx-props-shape-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'shape.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'shape',
                  shapType: 'rect',
                  left: 100,
                  top: 80,
                  width: 240,
                  height: 160,
                  fill: '#aabbcc',
                  borderColor: '#112233',
                  borderWidth: 3,
                  opacity: 0.75,
                  rotate: 20,
                  lIns: 5,
                  content:
                    '<p style="text-align:right"><span style="font-size:20pt;font-family:Calibri;color:#ffffff">Shape</span></p>',
                },
              ],
            },
          ],
        },
      })
      const shape = result.presentation.slides[0].elements[0]
      expect(shape.type).toBe('shape')
      expect(shape.fill).toBe('#aabbcc')
      expect(shape.stroke).toBe('#112233')
      expect(shape.strokeWidth).toBe(4)
      expect(shape.opacity).toBe(0.75)
      expect(shape.rotation).toBe(20)
      expect(shape.textAlign).toBe('right')
      expect(shape._pptxImportMeta.textInsets.left).toBe(6.7)
      expect(shape._pptxImportMeta.textInsetsUnit).toBe('px')
      expect(shape._pptxImportMeta).toMatchObject({
        version: 1,
        textFit: 'wrap',
        sourceFontSizePx: 26.7,
        fitFontSizePx: 26.7,
        sourceBox: { width: 240, height: 160 },
      })
      expect(shape.textHtml).not.toContain('font-size')
    })
  })

  it('fits imported text boxes inside the editor canvas', async () => {
    await withTempDir('pptx-props-text-fit-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'text-fit.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'text', left: -2, top: 10, width: 962, height: 40, content: '<p>Wide</p>' }] }],
        },
      })
      const text = result.presentation.slides[0].elements[0]
      expect(text.x).toBe(0)
      expect(text.x + text.width).toBeLessThanOrEqual(1136)
    })
  })

  it('clamps crop rect values and maps to editor-native image crop model', async () => {
    await withTempDir('pptx-props-image-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'image.pptx',
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
                  width: 300,
                  height: 200,
                  base64: PNG_DATA_URL,
                  rect: { l: -100, r: 1200, t: 100, b: 50 },
                  borderColor: '#f97316',
                  borderWidth: 2,
                  isFlipH: true,
                },
              ],
            },
          ],
        },
      })
      const image = result.presentation.slides[0].elements[0]
      expect(image.type).toBe('image')
      expect(image.imageW).toBeGreaterThan(0)
      expect(image.imageH).toBeGreaterThan(0)
      expect(Number.isFinite(image.imageOffsetX)).toBe(true)
      expect(Number.isFinite(image.imageOffsetY)).toBe(true)
      expect(image._pptxImportMeta.cropData).toEqual({
        left: 0,
        right: 1,
        top: 0.1,
        bottom: 0.05,
      })
      expect(image.borderColor).toBe('#f97316')
      expect(image.borderWidth).toBe(2.7)
      expect(image.flipH).toBe(true)
    })
  })

  it('preserves table sizing arrays and cell styles', async () => {
    await withTempDir('pptx-props-table-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'table.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'table',
                  left: 10,
                  top: 10,
                  width: 400,
                  height: 240,
                  colWidths: [120, 140],
                  rowHeights: [40, 50],
                  data: [
                    [
                      { text: 'A', fontColor: '#111111', fillColor: '#eeeeee', fontBold: true },
                      { text: 'B' },
                    ],
                    [{ text: 'C' }, { text: 'D', align: 'right', vAlign: 'bottom' }],
                  ],
                },
              ],
            },
          ],
        },
      })
      const table = result.presentation.slides[0].elements[0]
      expect(table.type).toBe('table')
      expect(table.colWidths).toEqual([120, 140])
      expect(table.rowHeights).toEqual([40, 50])
      expect(table.cellStyles.textColors[0][0]).toBe('#111111')
      expect(table.cellStyles.bgColors[0][0]).toBe('#eeeeee')
      expect(table.cellStyles.isBold[0][0]).toBe(true)
      expect(table.cellStyles.aligns[1][1]).toBe('right')
      expect(table.cellStyles.vAligns[1][1]).toBe('bottom')
    })
  })

  it('preserves chart datasets and chart sidecar metadata', async () => {
    await withTempDir('pptx-props-chart-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'chart.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  type: 'chart',
                  left: 40,
                  top: 40,
                  width: 320,
                  height: 200,
                  chartType: 'lineChart',
                  grouping: 'clustered',
                  data: [
                    { key: 'S1', values: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }] },
                    { key: 'S2', values: [{ x: 'A', y: 15 }, { x: 'B', y: 25 }] },
                  ],
                  colors: ['#6366f1', '#ef4444'],
                },
              ],
            },
          ],
        },
      })
      const chart = result.presentation.slides[0].elements[0]
      expect(chart.type).toBe('chart')
      expect(chart.chartType).toBe('line')
      expect(chart.chartData.labels).toEqual(['A', 'B'])
      expect(chart.chartData.datasets).toHaveLength(2)
      expect(chart._pptxChartMeta).toMatchObject({
        originalType: 'lineChart',
        grouping: 'clustered',
      })
    })
  })

  it('fits imported math boxes inside the editor canvas', async () => {
    await withTempDir('pptx-props-math-fit-', async (dir) => {
      const result = await mapPptxOutput({
        zip: new JSZip(),
        originalName: 'math-fit.pptx',
        uploadsDir: dir,
        output: {
          size: { width: 960, height: 540 },
          slides: [{ elements: [{ type: 'math', left: 30, top: 200, width: 940, height: 120, latex: 'x' }] }],
        },
      })
      const math = result.presentation.slides[0].elements[0]
      expect(math.type).toBe('latex')
      expect(math.x + math.width).toBeLessThanOrEqual(1136)
    })
  })
})
