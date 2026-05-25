import { describe, expect, it } from 'vitest'
import tableMapper from './map-table.js'

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
      data: [['A', 'B'], ['', 'C']],
      headerBgColor: '#eeeeee',
      mergedCells: [
        { row: 0, col: 0, rowSpan: 2, colSpan: 1 },
        { row: 1, col: 1, rowSpan: 1, colSpan: 2 },
      ],
    })
    expect(result.cellStyles.textColors[0][0]).toBe('#111111')
    expect(result.cellStyles.isBold[0][0]).toBe(true)
    expect(result.cellStyles.aligns[0][0]).toBe('center')
    expect(result.cellStyles.vAligns[0][0]).toBe('top')
    expect(result.cellStyles.borders[0][0].left).toMatchObject({ color: '#ff0000', width: 2 })
  })

  it('returns placeholder for unusable table structure', () => {
    const ctx = context()
    const result = mapTable({ type: 'table' }, ctx)
    expect(result[0].importPlaceholderType).toBe('table-unusable')
    expect(ctx.warnings[0]).toMatchObject({ type: 'table-unusable' })
  })
})
