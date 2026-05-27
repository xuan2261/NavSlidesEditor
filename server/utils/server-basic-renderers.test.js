import { describe, expect, it, vi } from 'vitest'
import renderersModule from './server-basic-renderers.js'

const {
  addLineElement,
  addShapeElement,
  addTableElement,
  addTextElement,
} = renderersModule

describe('server-basic-renderers', () => {
  it('adds formatted text runs to slide', () => {
    const slide = { addText: vi.fn() }
    addTextElement(
      slide,
      {
        content: '<strong>Hello</strong> <em>World</em>',
        textColor: '#ffffff',
        fontSize: 18,
      },
      { x: 0, y: 0, w: 4, h: 1 }
    )

    expect(slide.addText).toHaveBeenCalledTimes(1)
  })

  it('maps shape and line options', () => {
    const slide = { addShape: vi.fn(), addText: vi.fn() }
    addShapeElement(
      slide,
      {
        shape: 'circle',
        fill: '#22c55e',
        stroke: '#111827',
        strokeWidth: 2,
      },
      { x: 0, y: 0, w: 2, h: 2 }
    )

    expect(slide.addShape).toHaveBeenCalled()

    addLineElement(
      slide,
      {
        stroke: '#ffffff',
        strokeWidth: 2,
        dashArray: '4 2',
        arrowEnd: 'arrow',
        width: 100,
        height: 20,
      },
      { x: 0, y: 0, w: 1, h: 1 },
      { width: 960, height: 540 },
      { width: 10, height: 5.625 }
    )

    expect(slide.addShape).toHaveBeenCalledTimes(2)
  })

  it('uses rich text runs for imported shape text', () => {
    const slide = { addShape: vi.fn(), addText: vi.fn() }
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

    expect(slide.addText).toHaveBeenCalledTimes(1)
    const [runs, options] = slide.addText.mock.calls[0]
    expect(Array.isArray(runs)).toBe(true)
    expect(runs.some((run) => run.text === 'Hello' && run.options.bold)).toBe(true)
    expect(runs[0].options.align).toBe('right')
    expect(options).toMatchObject({ align: 'right', color: '123456', fontFace: 'Arial', fontSize: 15 })
  })

  it('preserves merged table cell metadata and per-cell sizing styles', () => {
    const slide = { addTable: vi.fn() }
    addTableElement(
      slide,
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
        colWidths: [120, 240],
        rowHeights: [40, 80],
        cellStyles: {
          fontSizes: [[24, null], [null, null]],
          fontFamilies: [['Arial', null], [null, null]],
        },
      },
      { x: 0, y: 0, w: 4, h: 2 }
    )

    expect(slide.addTable).toHaveBeenCalledTimes(1)
    const rows = slide.addTable.mock.calls[0][0]
    expect(rows[0][0].options.colspan).toBe(2)
    expect(rows[0][0].options.fontSize).toBe(18)
    expect(rows[0][0].options.fontFace).toBe('Arial')
    expect(slide.addTable.mock.calls[0][1].colW).toEqual([1.33, 2.67])
    expect(slide.addTable.mock.calls[0][1].rowH).toEqual([0.67, 1.33])
  })

  it('drops unsafe table font family during server pptx export', () => {
    const slide = { addTable: vi.fn() }
    addTableElement(
      slide,
      {
        data: [['A']],
        cellStyles: {
          fontSizes: [[24]],
          fontFamilies: [['Arial; background:url(javascript:bad)']],
        },
      },
      { x: 0, y: 0, w: 4, h: 2 }
    )

    const cell = slide.addTable.mock.calls[0][0][0][0]
    expect(cell.options.fontSize).toBe(18)
    expect(cell.options.fontFace).toBeUndefined()
  })
})
