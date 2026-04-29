import { describe, expect, it } from 'vitest'
import {
  getPptxLayout,
  htmlToPptTextRuns,
  mapArrowType,
  normalizeCssColor,
  normalizeImageSource,
} from './export-pptx-core'
import { addImageElement, addShapeElement, addTableElement } from './export-pptx-basic-renderers'

describe('export-pptx-core', () => {
  it('derives landscape and portrait layouts from aspect ratio', () => {
    expect(getPptxLayout({ width: 960, height: 540 })).toEqual({ width: 10, height: 5.625 })
    expect(getPptxLayout({ width: 960, height: 720 })).toEqual({ width: 10, height: 7.5 })
    expect(getPptxLayout({ width: 540, height: 960 })).toEqual({ width: 5.625, height: 10 })
    expect(getPptxLayout({ width: 1920, height: 1080 })).toEqual({ width: 10, height: 5.625 })
  })

  it('normalizes hex and rgba colors to PPT format', () => {
    expect(normalizeCssColor('#abc')).toEqual({ color: 'AABBCC', transparency: undefined })
    expect(normalizeCssColor('rgba(255, 0, 0, 0.25)')).toEqual({ color: 'FF0000', transparency: 75 })
    expect(normalizeCssColor('transparent', 'FFFFFF')).toEqual({ color: 'FFFFFF', transparency: 100 })
  })

  it('chooses data for data URIs and path for URLs', () => {
    expect(normalizeImageSource('data:image/png;base64,abc')).toEqual({
      data: 'data:image/png;base64,abc',
    })
    expect(normalizeImageSource('/uploads/figure.png')).toEqual({ path: '/uploads/figure.png' })
  })

  it('converts rich HTML into PPT runs with bullets and emphasis', () => {
    const runs = htmlToPptTextRuns(
      '<h2 style="text-align:center">Heading</h2><p>Hello <strong>bold</strong> and <em>italic</em></p><ul><li>One</li><li><u>Two</u></li></ul>'
    )

    expect(runs[0].text).toBe('Heading')
    expect(runs[0].options.bold).toBe(true)
    expect(runs[0].options.align).toBe('center')
    expect(runs.some((run) => run.text === 'bold' && run.options.bold)).toBe(true)
    expect(runs.some((run) => run.text === 'italic' && run.options.italic)).toBe(true)
    expect(runs.some((run) => run.text === 'One' && run.options.bullet?.type === 'bullet')).toBe(true)
    expect(runs.some((run) => run.text === 'Two' && run.options.underline)).toBe(true)
  })

  it('maps explicit PowerPoint arrow marker subtypes', () => {
    expect(mapArrowType('circle')).toBe('oval')
    expect(mapArrowType('oval')).toBe('oval')
    expect(mapArrowType('stealth')).toBe('stealth')
    expect(mapArrowType('triangle')).toBe('triangle')
    expect(mapArrowType('diamond')).toBe('diamond')
  })

  it('exports image crop, flip, alt text, and border overlay', () => {
    const calls = []
    const slide = {
      addImage: (options) => calls.push(['image', options]),
      addShape: (type, options) => calls.push(['shape', type, options]),
    }

    addImageElement(
      slide,
      {
        src: 'data:image/png;base64,abc',
        cropData: { left: 0.1, right: 0.2, top: 0.05, bottom: 0.15 },
        flipH: true,
        flipV: true,
        alt: 'Chart screenshot',
        borderColor: '#ff0000',
        borderWidth: 2,
      },
      { x: 1, y: 2, w: 3, h: 4 },
      { width: 960, height: 540 },
      { width: 10, height: 5.625 }
    )

    const image = calls.find((call) => call[0] === 'image')?.[1]
    expect(image.flipH).toBe(true)
    expect(image.flipV).toBe(true)
    expect(image.altText).toBe('Chart screenshot')
    expect(image.sizing?.type).toBe('crop')

    const border = calls.find((call) => call[0] === 'shape')
    expect(border?.[1]).toBe('rect')
    expect(border?.[2].line).toMatchObject({ color: 'FF0000', width: 2 })
    expect(border?.[2].fill.transparency).toBe(100)
  })

  it('exports imported shape rich text as PPT runs', () => {
    const calls = []
    const slide = {
      addShape: (type, options) => calls.push(['shape', type, options]),
      addText: (text, options) => calls.push(['text', text, options]),
    }

    addShapeElement(
      slide,
      {
        shape: 'rect',
        fill: '#22c55e',
        stroke: '#111827',
        text: 'Hello',
        textHtml: '<p style="text-align:right"><strong>Hello</strong></p>',
        textAlign: 'right',
        textColor: '#123456',
        fontFamily: 'Arial',
        fontSize: 20,
      },
      { x: 0, y: 0, w: 2, h: 1 }
    )

    const textCall = calls.find((call) => call[0] === 'text')
    expect(Array.isArray(textCall?.[1])).toBe(true)
    expect(textCall[1].some((run) => run.text === 'Hello' && run.options.bold)).toBe(true)
    expect(textCall[1][0].options.align).toBe('right')
    expect(textCall[2]).toMatchObject({ align: 'right', color: '123456', fontFace: 'Arial', fontSize: 20 })
  })

  it('exports merged table cells and per-cell styles', () => {
    const calls = []
    const slide = {
      addTable: (rows, options) => calls.push({ rows, options }),
    }

    addTableElement(
      slide,
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
        cellStyles: {
          textColors: [['#112233', null], [null, null]],
          bgColors: [['#ddeeff', null], [null, null]],
          isBold: [[true, false], [false, false]],
          aligns: [['center', 'left'], ['left', 'left']],
          vAligns: [['bottom', 'middle'], ['middle', 'middle']],
        },
        borderColor: '#010203',
        borderWidth: 3,
        fontSize: 14,
      },
      { x: 0, y: 0, w: 4, h: 2 }
    )

    const cell = calls[0].rows[0][0]
    expect(cell.text).toBe('A')
    expect(cell.options).toMatchObject({
      colspan: 2,
      rowspan: 2,
      color: '112233',
      bold: true,
      align: 'center',
      valign: 'bottom',
    })
    expect(cell.options.fill.color).toBe('DDEEFF')
    expect(cell.options.border).toMatchObject({ color: '010203', pt: 3 })
  })
})
