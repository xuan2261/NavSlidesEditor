import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const writeFileMock = vi.fn()
const slides = []

vi.mock('pptxgenjs', () => ({
  default: class MockPptx {
    constructor() {
      this.ShapeType = { rect: 'rect', ellipse: 'ellipse', line: 'line' }
      this.ChartType = {
        bar: 'bar',
        line: 'line',
        pie: 'pie',
        doughnut: 'doughnut',
        radar: 'radar',
      }
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
  const originalCreateElement = originalDocument?.createElement?.bind(originalDocument)
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window

  beforeEach(() => {
    slides.length = 0
    writeFileMock.mockReset()
    // Mock Image to immediately fire onload for data URIs (JSDOM doesn't support this natively)
    // Mock Image and canvas.getContext for rasterization tests
    globalThis.Image = class MockImage {
      constructor() {
        this.onload = null
        this.onerror = null
      }
      set src(value) {
        Promise.resolve().then(() => this.onload && this.onload())
      }
      get src() {
        return ''
      }
    }
    // Ensure canvas has getContext
    if (!globalThis.document?.createElement('canvas').getContext) {
      const origCreateElement = globalThis.document?.createElement.bind(globalThis.document)
      if (origCreateElement) {
        globalThis.document.createElement = (tag) => {
          const el = origCreateElement(tag)
          if (tag === 'canvas') {
            const origGetContext = el.getContext.bind(el)
            el.getContext = (type) => {
              if (type === '2d') return origGetContext('2d')
              return null
            }
          }
          return el
        }
      }
    }
  })

  afterEach(() => {
    globalThis.document = originalDocument
    if (globalThis.document && originalCreateElement) {
      globalThis.document.createElement = originalCreateElement
    }
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
    expect(warnings.exportReport).toEqual({
      surface: 'pptx-export',
      warningCount: 1,
      warnings: [
        expect.objectContaining({
          elementId: 'audio-1',
          elementType: 'audio',
          control: 'audio-source-playback',
          surface: 'pptx-export',
          matrixRowId: 'audio.audio-source-playback.pptx-export',
          severity: 'warning',
          fallback: 'placeholder',
          slideNumber: 1,
        }),
      ],
    })
    expect(slides[0].addShape).toHaveBeenCalledWith('rect', expect.any(Object))
    expect(slides[0].addText).toHaveBeenCalledWith(
      'Audio preview unavailable',
      expect.objectContaining({ fit: 'shrink' })
    )
  })

  it('[cap:element.game depth:export] inserts a placeholder warning for live-only game elements', async () => {
    const warnings = await exportToPptx({
      title: 'Game fallback export',
      slides: [
        {
          elements: [
            {
              id: 'game-1',
              type: 'game',
              gameType: 'name-picker',
              x: 10,
              y: 20,
              width: 320,
              height: 180,
            },
          ],
        },
      ],
    })

    expect(warnings).toContain('Slide 1: inserted placeholder for game')
    expect(warnings.exportReport.warnings[0]).toEqual(
      expect.objectContaining({
        elementId: 'game-1',
        elementType: 'game',
        control: 'game-subtype-live-policy',
        matrixRowId: 'game.game-subtype-live-policy.pptx-export',
        fallback: 'placeholder',
      })
    )
    expect(slides).toHaveLength(1)
    expect(slides[0].addShape).toHaveBeenCalledWith('rect', expect.any(Object))
    expect(slides[0].addText).toHaveBeenCalledWith(
      'game preview unavailable',
      expect.objectContaining({ fit: 'shrink' })
    )
  })

  it('[cap:element.code depth:export] keeps code readable and warns when walkthrough semantics are static', async () => {
    const warnings = await exportToPptx({
      title: 'Code walkthrough export',
      slides: [
        {
          elements: [
            {
              id: 'code-1',
              type: 'code',
              x: 10,
              y: 20,
              width: 320,
              height: 180,
              content: 'const a = 1\nreturn a',
              language: 'javascript',
              walkthroughSteps: [{ label: 'Return', startLine: 2, endLine: 2 }],
              defaultStepIndex: 0,
            },
          ],
        },
      ],
    })

    expect(slides[0].addText).toHaveBeenCalledWith(
      'const a = 1\nreturn a',
      expect.objectContaining({ fontFace: 'Courier New' })
    )
    expect(warnings).toContain('Slide 1: code walkthrough steps exported as static readable code')
    expect(warnings.exportReport.warnings[0]).toEqual(
      expect.objectContaining({
        elementId: 'code-1',
        elementType: 'code',
        control: 'code-walkthrough-controls',
        matrixRowId: 'code.code-walkthrough-controls.pptx-export',
        fallback: 'static-code',
      })
    )
  })

  it('[cap:element.html depth:export] reports Mermaid PPTX fallback with the Mermaid matrix row', async () => {
    globalThis.window = {}
    globalThis.document = {}
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rasters: { 'mermaid-1': 'data:image/png;base64,mermaid' } }),
    })
    const warnings = await exportToPptx({
      title: 'Mermaid fallback export',
      slides: [
        {
          elements: [
            {
              id: 'mermaid-1',
              type: 'html',
              embedKind: 'mermaid',
              mermaidSource: 'flowchart TD\nA-->B',
              x: 10,
              y: 20,
              width: 320,
              height: 180,
            },
          ],
        },
      ],
    })

    expect(warnings.exportReport.warnings[0]).toEqual(
      expect.objectContaining({
        elementId: 'mermaid-1',
        elementType: 'html',
        control: 'mermaid-authoring',
        matrixRowId: 'html.mermaid-authoring.pptx-export',
        fallback: 'server-raster',
      })
    )
  })

  it('[cap:element.html depth:export] reports STEM simulation PPTX fallback matrix row', async () => {
    globalThis.window = {}
    globalThis.document = {}
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rasters: { 'stem-1': 'data:image/png;base64,stem' } }),
    })
    const warnings = await exportToPptx({
      title: 'STEM fallback export',
      slides: [
        {
          elements: [
            {
              id: 'stem-1',
              type: 'html',
              embedKind: 'stem-simulation',
              provider: 'desmos',
              sourceUrl: 'https://www.desmos.com/calculator/calc123',
              content: '<iframe src="https://www.desmos.com/calculator/calc123"></iframe>',
              x: 10,
              y: 20,
              width: 320,
              height: 180,
            },
          ],
        },
      ],
    })

    expect(warnings.exportReport.warnings[0]).toEqual(
      expect.objectContaining({
        elementId: 'stem-1',
        elementType: 'html',
        control: 'stem-simulation-embed-presets',
        matrixRowId: 'html.stem-simulation-embed-presets.pptx-export',
        fallback: 'server-raster',
      })
    )
  })

  it('warns when gradient backgrounds cannot be rasterized', { timeout: 60000 }, async () => {
    // Mock canvas operations for gradient rasterization
    const origCreateElement = globalThis.document?.createElement
    globalThis.document = globalThis.document || {}
    globalThis.document.createElement = (tag) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => null }
      }
      return origCreateElement ? origCreateElement(tag) : {}
    }
    // Ensure window and fetch are available
    globalThis.window = globalThis.window || {}
    globalThis.fetch = globalThis.fetch || (() => Promise.resolve({ ok: false }))
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0)
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
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
    expect(warnings.exportReport.warnings[0]).toEqual(
      expect.objectContaining({
        elementId: 'slide-1-background',
        elementType: 'slide-background',
        control: 'slide-background-export',
        matrixRowId: 'slide-background.slide-background-export.pptx-export',
        fallback: 'background-color',
      })
    )
    expect(slides[0].background).toEqual({ color: '1E1E2E' })
  })

  it('reports unsupported chart variants with the matrix chart row id', async () => {
    const warnings = await exportToPptx({
      title: 'Unsupported chart fallback',
      slides: [
        {
          elements: [
            {
              id: 'chart-polar',
              type: 'chart',
              chartType: 'polarArea',
              x: 20,
              y: 20,
              width: 300,
              height: 180,
              chartData: {
                labels: ['A', 'B'],
                datasets: [{ label: 'Series', data: [1, 2] }],
              },
            },
          ],
        },
      ],
    })

    expect(warnings).toContain('Slide 1: chart export failed (Unsupported chart type: polarArea)')
    expect(warnings.exportReport.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: 'chart-polar',
          elementType: 'chart',
          control: 'chart-data-options',
          matrixRowId: 'chart.chart-data-options.pptx-export',
          fallback: 'export-error',
          severity: 'error',
        }),
        expect.objectContaining({
          elementId: 'chart-polar',
          elementType: 'chart',
          control: 'chart-data-options',
          matrixRowId: 'chart.chart-data-options.pptx-export',
          fallback: expect.stringMatching(/^(client-raster|placeholder)$/),
        }),
      ])
    )
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

  it('omits hidden elements from client PPTX export output', async () => {
    const warnings = await exportToPptx({
      title: 'Hidden client export',
      slides: [
        {
          elements: [
            {
              id: 'visible-text',
              type: 'text',
              content: '<p>Visible PPTX marker</p>',
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            {
              id: 'hidden-text',
              type: 'text',
              hidden: true,
              content: '<p>Hidden PPTX marker</p>',
              x: 0,
              y: 100,
              width: 200,
              height: 80,
            },
          ],
        },
      ],
    })

    expect(warnings).toEqual([])
    expect(slides).toHaveLength(1)
    expect(slides[0].addText).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(slides[0].addText.mock.calls)).toContain('Visible PPTX marker')
    expect(JSON.stringify(slides[0].addText.mock.calls)).not.toContain('Hidden PPTX marker')
  })

  it('ignores hidden HTML and LaTeX elements during server raster pre-pass', async () => {
    globalThis.window = {}
    globalThis.document = {}
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rasters: {
          'html-visible': 'data:image/png;base64,html',
        },
      }),
    })

    const warnings = await exportToPptx({
      title: 'Hidden raster pre-pass',
      slides: [
        {
          elements: [
            {
              id: 'html-visible',
              type: 'html',
              content: '<div>Visible HTML</div>',
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            {
              id: 'html-hidden',
              type: 'html',
              hidden: true,
              content: '<div>Hidden HTML</div>',
              x: 0,
              y: 100,
              width: 200,
              height: 80,
            },
            {
              id: 'latex-hidden',
              type: 'latex',
              hidden: true,
              content: String.raw`x^2`,
              x: 0,
              y: 200,
              width: 200,
              height: 80,
            },
          ],
        },
      ],
    })

    const requestBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    const requestedIds = requestBody.presentation.slides[0].elements.map((element) => element.id)

    expect(requestedIds).toEqual(['html-visible'])
    expect(warnings).toEqual(['Slide 1: rasterized html with server renderer'])
    expect(slides[0].addImage).toHaveBeenCalledTimes(1)
  })
})
