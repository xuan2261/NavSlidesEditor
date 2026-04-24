import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const writeFileMock = vi.fn()
const slides = []

vi.mock('pptxgenjs', () => ({
  default: class MockPptx {
    constructor() {
      this.ShapeType = { rect: 'rect', ellipse: 'ellipse', line: 'line' }
      this.ChartType = { bar: 'bar', line: 'line', pie: 'pie', doughnut: 'doughnut', radar: 'radar' }
    }

    defineLayout() {}

    addSlide() {
      const slide = {
        addChart: vi.fn(),
        addImage: vi.fn(),
        addNotes: vi.fn(),
        addShape: vi.fn(),
        addTable: vi.fn(),
        addText: vi.fn(),
      }
      slides.push(slide)
      return slide
    }

    async writeFile() {
      return await writeFileMock()
    }
  },
}))

import { exportToPptx } from './exportPptx'

describe('exportPptx', () => {
  const originalDocument = globalThis.document
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window

  beforeEach(() => {
    slides.length = 0
    writeFileMock.mockReset()
  })

  afterEach(() => {
    globalThis.document = originalDocument
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  })

  it('exports native shapes without relying on static ShapeType enums', async () => {
    const warnings = await exportToPptx({
      title: 'Runtime enum regression',
      slides: [
        {
          elements: [
            {
              id: 'shape-1',
              type: 'shape',
              shape: 'rounded-rect',
              x: 10,
              y: 20,
              width: 200,
              height: 80,
              fill: '#334155',
              stroke: '#94a3b8',
              borderRadius: 18,
            },
            {
              id: 'line-1',
              type: 'line',
              x: 40,
              y: 160,
              width: 240,
              height: 10,
              stroke: '#ffffff',
            },
            {
              id: 'callout-1',
              type: 'callout',
              x: 320,
              y: 40,
              width: 64,
              height: 64,
              calloutNumber: 3,
            },
          ],
        },
      ],
    })

    expect(warnings).toEqual([])
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(slides).toHaveLength(1)
    expect(slides[0].addShape).toHaveBeenNthCalledWith(1, 'roundRect', expect.any(Object))
    expect(slides[0].addShape).toHaveBeenNthCalledWith(2, 'line', expect.any(Object))
    expect(slides[0].addShape).toHaveBeenNthCalledWith(3, 'ellipse', expect.any(Object))
  })

  it('exports images and native charts without fallback warnings', async () => {
    const warnings = await exportToPptx({
      title: 'Image chart export',
      slides: [
        {
          elements: [
            {
              id: 'image-1',
              type: 'image',
              src: 'data:image/png;base64,abc',
              x: 0,
              y: 0,
              width: 240,
              height: 120,
              objectFit: 'contain',
            },
            {
              id: 'chart-1',
              type: 'chart',
              chartType: 'bar',
              x: 260,
              y: 0,
              width: 260,
              height: 180,
              chartData: {
                labels: ['A', 'B'],
                datasets: [{ label: 'Series', data: [2, 5], color: '#ef4444' }],
              },
            },
          ],
        },
      ],
    })

    expect(warnings).toEqual([])
    expect(slides[0].addImage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'data:image/png;base64,abc',
        sizing: expect.objectContaining({ type: 'contain' }),
      })
    )
    expect(slides[0].addChart).toHaveBeenCalledWith(
      'bar',
      [expect.objectContaining({ name: 'Series', labels: ['A', 'B'], values: [2, 5] })],
      expect.objectContaining({ chartColors: ['EF4444'] })
    )
  })

  it('inserts a placeholder when an unsupported element cannot be rasterized', async () => {
    const warnings = await exportToPptx({
      title: 'Fallback export',
      slides: [
        {
          elements: [
            {
              id: 'audio-1',
              type: 'audio',
              x: 10,
              y: 20,
              width: 200,
              height: 80,
            },
          ],
        },
      ],
    })

    expect(warnings).toContain('Slide 1: inserted placeholder for audio')
    expect(slides[0].addShape).toHaveBeenCalledWith('rect', expect.any(Object))
    expect(slides[0].addText).toHaveBeenCalledWith(
      'Audio preview unavailable',
      expect.objectContaining({ fit: 'shrink' })
    )
  })

  it('warns when gradient backgrounds cannot be rasterized', async () => {
    const warnings = await exportToPptx({
      title: 'Gradient fallback',
      slides: [
        {
          background: { type: 'gradient', gradient: 'linear-gradient(90deg, #111827, #f8fafc)' },
          elements: [],
        },
      ],
    })

    expect(warnings).toContain('Slide 1: background fallback used during PPTX export')
    expect(slides[0].background).toEqual({ color: '1E1E2E' })
  })

  it('keeps native elements editable while using server rasters for HTML and LaTeX', async () => {
    globalThis.window = {}
    globalThis.document = {}
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rasters: {
          'html-1': 'data:image/png;base64,html',
          'latex-1': 'data:image/png;base64,latex',
        },
      }),
    })

    const warnings = await exportToPptx({
      title: 'Hybrid export',
      slides: [
        {
          elements: [
            {
              id: 'text-1',
              type: 'text',
              content: '<p>Editable</p>',
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            {
              id: 'html-1',
              type: 'html',
              content: '<div>HTML</div>',
              x: 220,
              y: 0,
              width: 200,
              height: 80,
            },
            {
              id: 'latex-1',
              type: 'latex',
              content: String.raw`x^2`,
              x: 440,
              y: 0,
              width: 200,
              height: 80,
            },
          ],
        },
      ],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/presentations/raster-elements',
      expect.objectContaining({ method: 'POST' })
    )
    expect(slides[0].addText).toHaveBeenCalledWith(expect.any(Array), expect.any(Object))
    expect(slides[0].addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'data:image/png;base64,html' })
    )
    expect(slides[0].addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'data:image/png;base64,latex' })
    )
    expect(warnings).toEqual([
      'Slide 1: rasterized html with server renderer',
      'Slide 1: rasterized latex with server renderer',
    ])
  })
})
