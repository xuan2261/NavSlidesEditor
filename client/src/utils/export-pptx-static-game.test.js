import { describe, expect, it, vi } from 'vitest'
import { chromium } from 'playwright'
import pptxgen from 'pptxgenjs'
import JSZip from 'jszip'
import { addElementToPptxSlide } from './export-pptx-renderers'
import { addFallbackElement } from './export-pptx-fallback-renderer'
import { renderStaticGameSnapshot } from '../../../shared/src/education/static-snapshot.js'
import { createDefaultGameConfig } from '../../../shared/src/education/game-defaults.js'
import { addChartElement } from './export-pptx-basic-renderers'

const game = {
  id: 'visible-game',
  type: 'game',
  gameType: 'quiz',
  x: 96,
  y: 54,
  width: 640,
  height: 400,
  rotation: 25,
  quiz: createDefaultGameConfig('quiz'),
  action: { kind: 'next' },
}
const parsePngSize = (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) })

describe('PPTX static education rendering', () => {
  it('embeds a real authored PNG at the element geometry with element-specific static limits', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 640, height: 400 } })
      await page.setContent(
        `<html><body style="margin:0;width:640px;height:400px;">${renderStaticGameSnapshot(game)}</body></html>`
      )
      expect(await page.locator('[data-static-section]').first().innerText()).toContain(
        'What is the capital of France?'
      )
      expect(await page.locator('[data-static-solution]').count()).toBe(0)
      const image = await page.screenshot({ type: 'png' })
      expect(parsePngSize(image)).toEqual({ width: 640, height: 400 })
      const data = `data:image/png;base64,${image.toString('base64')}`
      const pptx = new pptxgen()
      pptx.defineLayout({ name: 'TEST', width: 10, height: 5.625 })
      pptx.layout = 'TEST'
      const warnings = []
      await addElementToPptxSlide({
        slide: pptx.addSlide(),
        element: game,
        resolution: { width: 960, height: 540 },
        layout: { width: 10, height: 5.625 },
        pptx,
        warnings,
        slideNumber: 1,
        rasterOverrides: { [game.id]: data },
      })
      const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
      const xml = await zip.file('ppt/slides/slide1.xml').async('string')
      expect(xml).toContain('rot="1500000"')
      expect(xml).toContain('<a:off x="914400" y="514350"/>')
      expect(warnings.exportReport.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            elementId: game.id,
            fallback: 'browser-only-game-interactivity',
            severity: 'warning',
          }),
          expect.objectContaining({
            elementId: game.id,
            fallback: 'browser-only-element-action',
            severity: 'warning',
          }),
        ])
      )
      expect(
        warnings.exportReport.warnings.some(
          (item) => item.fallback === 'placeholder' || item.severity === 'error'
        )
      ).toBe(false)
    } finally {
      await browser.close()
    }
  }, 30000)

  it('rejects unavailable raster runtime for a valid authored game', async () => {
    vi.stubGlobal('document', undefined)
    try {
      const pptx = new pptxgen(),
        slide = pptx.addSlide()
      await expect(
        addFallbackElement(slide, game, { x: 1, y: 1, w: 4, h: 3 }, [], 1)
      ).rejects.toThrow(/capture/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects a failed native game capture rather than writing a placeholder', async () => {
    const pptx = new pptxgen(),
      slide = pptx.addSlide(),
      warnings = []
    const invalid = { ...game, quiz: { ...game.quiz, questions: [] } }
    await expect(
      addFallbackElement(slide, invalid, { x: 1, y: 1, w: 4, h: 3 }, warnings, 1)
    ).rejects.toThrow()
    expect(warnings.some((warning) => /placeholder/i.test(warning))).toBe(false)
  })

  it('exports authored timeline labels, range, descriptions and exact event/connector positions without a raster placeholder', async () => {
    const pptx = new pptxgen(),
      slide = pptx.addSlide()
    const element = {
      id: 'authored-timeline',
      type: 'timeline',
      x: 80,
      y: 40,
      width: 780,
      height: 440,
      timelineStart: '2000',
      timelineEnd: '2020',
      tickSpacing: 'auto',
      textColor: '#111111',
      events: [
        {
          date: '2010',
          title: 'Authored event',
          description: 'Authored detail',
          connectorLength: 40,
          side: 'top',
        },
      ],
    }
    await addElementToPptxSlide({
      slide,
      element,
      pptx,
      resolution: { width: 960, height: 540 },
      layout: { width: 10, height: 5.625 },
      warnings: [],
      slideNumber: 1,
    })
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
    const xml = await zip.file('ppt/slides/slide1.xml').async('string')
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((match) => match[0])
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1])
    expect(text).toEqual(
      expect.arrayContaining(['2000', '2020', '2010', 'Authored event', 'Authored detail'])
    )
    const event = shapes.find((shape) => shape.includes('<a:t>Authored event</a:t>'))
    const offset = event.match(/<a:off x="(\d+)" y="(\d+)"/),
      size = event.match(/<a:ext cx="(\d+)" cy="(\d+)"/)
    // Bounds round to four decimal inches before EMU serialization (< 0.01 px).
    expect(Math.abs((Number(offset[1]) + Number(size[1]) / 2) / 9525 - 470)).toBeLessThan(0.01)
    expect(Math.abs(Number(offset[2]) / 9525 - 8)).toBeLessThan(0.01)
  })

  it.each([undefined, false])(
    'renders a single authored chart series legend unless explicitly hidden (%s)',
    async (showLegend) => {
      const pptx = new pptxgen(),
        slide = pptx.addSlide()
      addChartElement(
        slide,
        {
          type: 'chart',
          chartType: 'bar',
          showLegend,
          chartData: {
            labels: ['Alpha', 'Beta'],
            datasets: [{ label: 'Authored series', data: [5, 12] }],
          },
        },
        { x: 1, y: 1, w: 5, h: 3 },
        pptx
      )
      const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
      const parseXml = (source) => new DOMParser().parseFromString(source, 'application/xml')
      const slideXml = parseXml(await zip.file('ppt/slides/slide1.xml').async('string'))
      const chartId = slideXml.getElementsByTagName('c:chart')[0].getAttribute('r:id')
      const relationships = parseXml(
        await zip.file('ppt/slides/_rels/slide1.xml.rels').async('string')
      )
      const relationship = [...relationships.getElementsByTagName('Relationship')].find(
        (item) => item.getAttribute('Id') === chartId
      )
      const target = new URL(
        relationship.getAttribute('Target'),
        'https://pptx.invalid/ppt/slides/'
      ).pathname.slice(1)
      const chart = parseXml(await zip.file(target).async('string'))
      expect(chart.getElementsByTagName('c:legend').length > 0).toBe(showLegend !== false)
      expect([...chart.getElementsByTagName('c:v')].map((value) => value.textContent)).toEqual(
        expect.arrayContaining(['Authored series', 'Alpha', 'Beta', '5', '12'])
      )
    }
  )
})
