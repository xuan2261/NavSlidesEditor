import { describe, expect, it } from 'vitest'
import sharedColorUtils from '../src/shared-color-utils.js'
import sharedHtmlParser from '../src/shared-html-parser.js'
import sharedTextRuns from '../src/shared-text-runs.js'
import sharedPptxCore from '../src/shared-pptx-core.js'

const { normalizeCssColor } = sharedColorUtils
const { parseHtmlTree } = sharedHtmlParser
const { htmlToPptTextRuns, stripHtmlToPlainText } = sharedTextRuns
const {
  getPresentationResolution,
  getPptxExportLayout,
  getShapeType,
  mapArrowType,
  mapLineDashType,
  scaleElementBounds,
} = sharedPptxCore

describe('shared pptx utilities', () => {
  it('normalizes CSS colors to PPTX-compatible values', () => {
    expect(normalizeCssColor('#ff00aa').color).toBe('FF00AA')
    expect(normalizeCssColor('rgba(255, 0, 0, 0.5)').transparency).toBe(50)
    expect(normalizeCssColor('transparent').transparency).toBe(100)
  })

  it('parses html trees and text runs with inline style metadata', () => {
    const tree = parseHtmlTree('<p><strong>Hello</strong> <em>World</em></p>')
    expect(tree.children).toHaveLength(1)

    const runs = htmlToPptTextRuns('<p><strong>Hello</strong> <em>World</em></p>')
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.some((run) => run.options.bold)).toBe(true)
    expect(runs.some((run) => run.options.italic)).toBe(true)
  })

  it('converts CSS px and pt text run sizes to PowerPoint points', () => {
    const pxRuns = htmlToPptTextRuns('<span style="font-size:32px;letter-spacing:2.7px">large</span>')
    expect(pxRuns[0].options.fontSize).toBe(24)
    expect(pxRuns[0].options.charSpacing).toBe(2)

    const ptRuns = htmlToPptTextRuns('<span style="font-size:24pt;letter-spacing:2pt">large</span>')
    expect(ptRuns[0].options.fontSize).toBe(24)
    expect(ptRuns[0].options.charSpacing).toBe(2)
  })

  it('strips HTML for fingerprint-safe text comparison', () => {
    expect(stripHtmlToPlainText('<p>Hello<br>World</p>')).toBe('Hello\nWorld')
  })

  it('maps core shape/line helpers and scales bounds', () => {
    expect(getShapeType('circle')).toBe('ellipse')
    expect(mapArrowType('triangle')).toBe('triangle')
    expect(mapLineDashType('4 2')).toBe('sysDot')

    expect(
      scaleElementBounds(
        { x: 96, y: 54, width: 192, height: 108 },
        { width: 960, height: 540 },
        { width: 10, height: 5.625 }
      )
    ).toEqual({ x: 1, y: 0.5625, w: 2, h: 1.125 })
  })

  it('separates canvas resolution from PPTX export layout size', () => {
    const presentation = {
      resolution: { width: 960, height: 540 },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
    }

    expect(getPresentationResolution(presentation)).toEqual({ width: 960, height: 540 })
    expect(getPptxExportLayout(presentation)).toEqual({ width: 720, height: 540 })
  })

  it('falls back to canvas resolution for native NavSlides export layout', () => {
    expect(getPptxExportLayout({ resolution: { width: 960, height: 540 } })).toEqual({
      width: 960,
      height: 540,
    })
  })
})
