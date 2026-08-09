// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import renderers from '../utils/server-renderers.js'
import fallback from '../utils/server-fallback.js'
import rasterModule from '../utils/server-raster.js'
import elementRenderers from '../../shared/src/element-renderers.js'

const { addElementToPptxSlide } = renderers
const { addFallbackElement } = fallback
const { getServerRasters } = rasterModule
const { renderElement } = elementRenderers

function makeSlide() {
  return {
    addImage: vi.fn(),
    addShape: vi.fn(),
    addText: vi.fn(),
    addTable: vi.fn(),
    addChart: vi.fn(),
  }
}

const resolution = { width: 960, height: 540 }
const layout = { width: 10, height: 5.63 }

describe('image visual fallback routing', () => {
  it('preserves bounds, rotation, opacity, and alt text on a rasterized image frame', async () => {
    const slide = makeSlide()
    const warnings = []
    const image = {
      id: 'rounded-image',
      type: 'image',
      x: 96,
      y: 54,
      width: 384,
      height: 216,
      rotation: 18,
      opacity: 0.4,
      altText: 'Rounded image',
      borderRadius: 16,
    }

    await addElementToPptxSlide({
      slide,
      element: image,
      resolution,
      layout,
      warnings,
      slideNumber: 1,
      rasterOverrides: { 'rounded-image': 'data:image/png;base64,rounded' },
    })

    expect(slide.addImage).toHaveBeenCalledWith({
      data: 'data:image/png;base64,rounded',
      x: 1,
      y: 0.563,
      w: 4,
      h: 2.252,
      rotate: 18,
      transparency: 60,
      altText: 'Rounded image',
    })
    expect(warnings).toEqual([
      'Slide 1: rasterized image to preserve CSS filters or rounded corners',
    ])
  })
})

describe('per-element rasterization isolation (I-R3.1)', () => {
  it('one element rasterizer throwing does not abort the whole slide; failing element becomes a placeholder', async () => {
    const slide = makeSlide()
    const warnings = []

    // inject a rasterizer stub that throws only for the "boom" element
    const rasterize = vi.fn(async (element) => {
      if (element.id === 'boom') throw new Error('synthetic raster failure')
      return 'data:image/png;base64,ok'
    })

    const elements = [
      { id: 'good', type: 'html', x: 0, y: 0, width: 100, height: 80 },
      { id: 'boom', type: 'html', x: 120, y: 0, width: 100, height: 80 },
    ]

    for (const element of elements) {
      // must resolve for every element, never throw the whole export
      await expect(
        addElementToPptxSlide({
          slide,
          element,
          resolution,
          layout,
          warnings,
          slideNumber: 1,
          strictRaster: true,
          allowFallback: false,
          rasterizeElement: rasterize,
        })
      ).resolves.toBeUndefined()
    }

    // good element rasterized as image
    expect(slide.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'data:image/png;base64,ok' })
    )
    // failing element fell back to a gray placeholder (rect + text) and export continued
    expect(slide.addShape).toHaveBeenCalledWith('rect', expect.any(Object))
    expect(slide.addText).toHaveBeenCalledWith(
      'html preview unavailable',
      expect.objectContaining({ fit: 'shrink' })
    )
  })
})

describe('chart export routing', () => {
  it('intentionally rasterizes polar area charts without a native export error', async () => {
    const slide = makeSlide()
    const warnings = []
    const rasterize = vi.fn(async () => 'data:image/png;base64,polar')
    const polarArea = {
      id: 'polar-1',
      type: 'chart',
      chartType: 'polarArea',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
    }

    await addElementToPptxSlide({
      slide,
      element: polarArea,
      resolution,
      layout,
      warnings,
      slideNumber: 1,
      rasterizeElement: rasterize,
    })

    expect(rasterize).toHaveBeenCalledWith(polarArea, expect.any(Object))
    expect(slide.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'data:image/png;base64,polar' })
    )
    expect(slide.addChart).not.toHaveBeenCalled()
    expect(warnings).toEqual(['Slide 1: rasterized chart fallback'])
  })

  it('keeps radar charts native and editable', async () => {
    const slide = makeSlide()
    const warnings = []
    const rasterize = vi.fn()
    const radar = {
      id: 'radar-1',
      type: 'chart',
      chartType: 'radar',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      chartData: { labels: ['A'], datasets: [{ label: 'Series', data: [1] }] },
    }

    await addElementToPptxSlide({
      slide,
      element: radar,
      resolution,
      layout,
      pptx: { ChartType: { radar: 'radar' } },
      warnings,
      slideNumber: 1,
      rasterizeElement: rasterize,
    })

    expect(slide.addChart).toHaveBeenCalledWith(
      'radar',
      [{ name: 'Series', labels: ['A'], values: [1] }],
      expect.objectContaining({ x: 0, y: 0 })
    )
    expect(rasterize).not.toHaveBeenCalled()
    expect(warnings).toEqual([])
  })
})

describe('table export routing', () => {
  it('keeps rotated tables native and reports the accepted rotation limit', async () => {
    const slide = makeSlide()
    const warnings = []
    const table = {
      id: 'table-rotation',
      type: 'table',
      rotation: 15,
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      data: [['Native table']],
    }

    await addElementToPptxSlide({
      slide,
      element: table,
      resolution,
      layout,
      warnings,
      slideNumber: 1,
    })

    expect(slide.addTable).toHaveBeenCalledTimes(1)
    expect(slide.addImage).not.toHaveBeenCalled()
    expect(warnings.exportReport.warnings).toEqual([
      expect.objectContaining({
        elementId: 'table-rotation',
        elementType: 'table',
        control: 'table-layout-rotation',
        matrixRowId: 'table.table-layout-rotation.pptx-export',
        fallback: 'native-table-unrotated',
        severity: 'warning',
      }),
    ])
  })
})

describe('strict-mode timeline/game routing (I-R3.3)', () => {
  it('does NOT throw in strict mode for timeline and game, routing them to the rasterizer', async () => {
    const slide = makeSlide()
    const warnings = []
    const rasterize = vi.fn(async () => 'data:image/png;base64,raster')

    const timeline = {
      id: 'tl-1',
      type: 'timeline',
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      events: [{ date: '2010', title: 'Launch', imageUrl: '/uploads/a.png' }],
    }
    const game = { id: 'g-1', type: 'game', gameType: 'jeopardy', x: 0, y: 0, width: 400, height: 300 }

    await expect(
      addFallbackElement(slide, timeline, { x: 0, y: 0, w: 8, h: 4 }, warnings, 1, {
        strictRaster: true,
        allowFallback: false,
        resolution,
        rasterizeElement: rasterize,
      })
    ).resolves.toBeUndefined()

    await expect(
      addFallbackElement(slide, game, { x: 0, y: 0, w: 4, h: 3 }, warnings, 1, {
        strictRaster: true,
        allowFallback: false,
        resolution,
        rasterizeElement: rasterize,
      })
    ).resolves.toBeUndefined()

    // routed to rasterizer (not the strict throw / not a gray placeholder)
    expect(rasterize).toHaveBeenCalledTimes(2)
    expect(slide.addImage).toHaveBeenCalledTimes(2)
    // NOT a placeholder
    expect(slide.addText).not.toHaveBeenCalledWith(
      expect.stringContaining('preview unavailable'),
      expect.anything()
    )
  })

  it('shared renderer emits Phase-4 content: timeline keeps the event image href; game keeps its label + badge', () => {
    const timelineHtml = renderElement(
      {
        id: 'tl-1',
        type: 'timeline',
        width: 800,
        height: 400,
        events: [{ date: '2010', title: 'Launch', imageUrl: 'https://cdn.example.com/a.png' }],
      },
      { elements: [] },
      { forPrint: true }
    )
    // proves it is the real Phase-4 static render, not a gray placeholder
    expect(timelineHtml).toContain('<image')
    expect(timelineHtml).toContain('https://cdn.example.com/a.png')

    const gameHtml = renderElement(
      { id: 'g-1', type: 'game', gameType: 'jeopardy', title: 'Final Round', width: 400, height: 300 },
      { elements: [] },
      { forPrint: true }
    )
    expect(gameHtml).toContain('data-game-fallback="true"')
    expect(gameHtml).toContain('Final Round')
    expect(gameHtml).toContain('jeopardy')
  })
})

describe('per-export cache isolation (M3)', () => {
  it('two interleaved exports do not share or wipe each other cache', async () => {
    // Each export passes its own cache Map. The injected capture returns a value
    // tagged with the presentation id so we can prove no cross-contamination.
    const capture = vi.fn(async (_html, targets) => {
      const out = {}
      for (const t of targets) out[t.id] = `data:image/png;base64,${t.id}`
      return out
    })

    const deckA = {
      id: 'deckA',
      resolution,
      slides: [{ id: 's', elements: [{ id: 'html-a', type: 'html', x: 0, y: 0, width: 10, height: 10 }] }],
    }
    const deckB = {
      id: 'deckB',
      resolution,
      slides: [{ id: 's', elements: [{ id: 'html-b', type: 'html', x: 0, y: 0, width: 10, height: 10 }] }],
    }

    const cacheA = new Map()
    const cacheB = new Map()

    // interleave the two exports
    const [resA, resB] = await Promise.all([
      getServerRasters(deckA, { cache: cacheA, capture }),
      getServerRasters(deckB, { cache: cacheB, capture }),
    ])

    expect(resA).toEqual({ 'html-a': 'data:image/png;base64,html-a' })
    expect(resB).toEqual({ 'html-b': 'data:image/png;base64,html-b' })

    // re-running deck A with its own cache must hit the cache (capture not re-invoked)
    const calls = capture.mock.calls.length
    const resA2 = await getServerRasters(deckA, { cache: cacheA, capture })
    expect(resA2).toEqual(resA)
    expect(capture.mock.calls.length).toBe(calls) // served from cacheA, untouched by deckB
  })
})

describe('golden-fixture HTML-render seam (Test 4)', () => {
  // Pin the consolidated engine's HTML-render seam output (the screenshot source)
  // for a sample element. Pixel fidelity is covered by test:pptx:browser-audit;
  // this guards against silent fidelity drift in the render that feeds the raster.
  it('game element render matches committed reference structure', () => {
    const html = renderElement(
      { id: 'g-1', type: 'game', gameType: 'quiz', title: 'Sample', width: 400, height: 300 },
      { elements: [] },
      { forPrint: true }
    )
    expect(html).toContain('data-game-type="quiz"')
    expect(html).toContain('Interactive game')
    expect(html).toContain('Sample')
  })
})
