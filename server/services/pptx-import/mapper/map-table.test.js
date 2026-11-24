import { describe, expect, it } from 'vitest'
import tableMapper from './map-table.js'
import { tableCellText } from 'revealjs-shared'

const { mapTable, normalizeBorderSet, sanitizeCssColor } = tableMapper

function context() {
  return {
    scale: { x: 1, y: 1 },
    zIndex: 2,
    slideIndex: 0,
    warnings: [],
    stats: { tableCount: 0, placeholderCount: 0 },
  }
}

describe('pptx mapTable', () => {
  it('normalizes per-side borders with uniform fallback', () => {
    expect(normalizeBorderSet({
      color: '#111111',
      width: 2,
      bottom: { color: '#222222', width: 3, style: 'dashed' },
    })).toMatchObject({
      top: { color: '#111111', width: 2, style: 'solid' },
      bottom: { color: '#222222', width: 3, style: 'dashed' },
    })
  })

  it('drops unsafe border CSS values during normalization', () => {
    const result = normalizeBorderSet({
      color: '#111111',
      width: 2,
      top: { color: 'red;display:block', width: -5, style: 'solid;background:url(x)' },
    })

    expect(result.top).toEqual({ color: '#111111', width: 2, style: 'solid' })
    expect(sanitizeCssColor('rgb(1, 2, 3)', '#000000')).toBe('rgb(1, 2, 3)')
  })

  it('maps table data, cell styles, merged cells, and per-side borders', () => {
    const ctx = context()
    const result = mapTable({
      type: 'table',
      left: 0,
      top: 0,
      width: 200,
      height: 80,
      fill: { type: 'color', value: '#eeeeee' },
      borderColor: '#999999',
      borderWidth: 1,
      data: [
        [
          {
            text: '<b>A</b>',
            fontColor: '#111111',
            fillColor: '#ffffff',
            fontBold: true,
            align: 'center',
            vAlign: 'top',
            rowSpan: 2,
            borders: { left: { color: '#ff0000', width: 2 } },
          },
          { text: 'B' },
        ],
        [{ vMerge: 0 }, { text: 'C', colSpan: 2 }],
      ],
    }, ctx)[0]

    expect(ctx.stats.tableCount).toBe(1)
    expect(result).toMatchObject({
      type: 'table',
      rows: 2,
      cols: 2,
      data: [[expect.any(Object), 'B'], ['', 'C']],
      headerBgColor: '#eeeeee',
      mergedCells: [
        { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
        { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      ],
    })
    expect(result.data.map((row) => row.map(tableCellText))).toEqual([['A', 'B'], ['', 'C']])
    expect(result.cellStyles.textColors[0][0]).toBe('#111111')
    expect(result.cellStyles.isBold[0][0]).toBe(true)
    expect(result.cellStyles.aligns[0][0]).toBe('center')
    expect(result.cellStyles.vAligns[0][0]).toBe('top')
    expect(result.cellStyles.borders[0][0].left).toMatchObject({ color: '#ff0000', width: 2 })
  })

  it('captures per-cell font size/family and scales row/column dimensions', () => {
    const result = mapTable({
      type: 'table',
      width: 300,
      height: 80,
      colWidths: [100, 200],
      rowHeights: [30, 50],
      data: [
        [{ text: 'Header', fontSize: 18, fontFace: 'Arial' }, { text: 'B' }],
        [{ text: 'C', fontSize: 12, fontFamily: 'Aptos' }, { text: 'D' }],
      ],
    }, { ...context(), scale: { x: 4 / 3, y: 2 } })[0]

    // Cell font follows scale.y (height-proportional): 18pt × 2 = 36, 12pt × 2 = 24.
    // Old code did 18 × 96/72 = 24, ignoring scale entirely.
    expect(result.cellStyles.fontSizes[0][0]).toBe(36)
    expect(result.cellStyles.fontFamilies[0][0]).toBe('Arial')
    expect(result.cellStyles.fontSizes[1][0]).toBe(24)
    expect(result.cellStyles.fontFamilies[1][0]).toBe('Aptos')
    expect(result.cellStyles.fontSizes[0][1]).toBeNull()
    expect(result.cellStyles.fontFamilies[0][1]).toBeNull()
    expect(result.colWidths).toEqual([133, 267])
    expect(result.rowHeights).toEqual([60, 100])
  })

  it('maps a standard-deck cell font 1pt→1px (no 96-DPI inflation)', () => {
    const result = mapTable({
      type: 'table',
      width: 200,
      height: 80,
      data: [[{ text: 'A', fontSize: 18 }]],
    }, context())[0]
    expect(result.cellStyles.fontSizes[0][0]).toBe(18)
  })

  it('extracts parser HTML typography while preserving explicit false/zero and asymmetric cell insets', () => {
    const html = '<p style="text-align:right"><span style="font-size:11pt;color:#000000;font-family:Aptos;font-weight:bold">Header</span></p>'
    const result = mapTable({ type: 'table', width: 240, height: 90, headerRow: false, headerIsBold: false, cellPadding: 0, borderWidth: 0,
      colWidths: [60, 180], rowHeights: [30, 60], data: [
        [{ text: html, vAlign: 'up', insets: { top: 0, right: 2, bottom: 3, left: 4 }, rowSpan: 2 }, { text: html, fontBold: false }],
        [{ vMerge: 0 }, { text: '<b>short</b> ordinary text' }],
      ],
    }, context())[0]
    expect(result).toMatchObject({ headerRow: false, headerIsBold: false, cellPadding: 0, borderWidth: 0, colWidths: [60, 180], rowHeights: [30, 60], mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 1 }] })
    expect(result.cellStyles.fontSizes[0]).toEqual([11, 11])
    expect(result.cellStyles.textColors[0]).toEqual(['#000000', '#000000'])
    expect(result.cellStyles.fontFamilies[0]).toEqual(['Aptos', 'Aptos'])
    expect(result.cellStyles.isBold).toEqual([[true, false], [false, false]])
    expect(result.cellStyles.aligns[0]).toEqual(['right', 'right'])
    expect(result.cellStyles.vAligns[0][0]).toBe('top')
    expect(result.cellStyles.insets).toEqual([[{ top: 0, right: 2, bottom: 3, left: 4 }, null], [null, null]])
  })

  it('returns placeholder for unusable table structure', () => {
    const ctx = context()
    const result = mapTable({ type: 'table' }, ctx)
    expect(result[0].importPlaceholderType).toBe('table-unusable')
    expect(ctx.warnings[0]).toMatchObject({ type: 'table-unusable' })
  })
})
