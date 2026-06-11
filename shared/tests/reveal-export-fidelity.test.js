import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

const base = { id: 'el-1', x: 0, y: 0, width: 200, height: 100, zIndex: 1 }

describe('Phase 5 reveal: image border', () => {
  it('emits a border from borderColor + borderWidth', () => {
    const html = renderElement(
      { ...base, type: 'image', src: '/x.png', borderColor: '#ff0000', borderWidth: 2 },
      {},
      {}
    )
    expect(html).toContain('border:2px solid #ff0000')
  })

  it('composes border with border-radius', () => {
    const html = renderElement(
      { ...base, type: 'image', src: '/x.png', borderColor: '#ff0000', borderWidth: 2, borderRadius: 8 },
      {},
      {}
    )
    expect(html).toContain('border:2px solid #ff0000')
    expect(html).toContain('border-radius:8px')
  })

  it('emits no border when border fields are absent', () => {
    const html = renderElement({ ...base, type: 'image', src: '/x.png' }, {}, {})
    expect(html).not.toContain('border:')
  })
})

describe('Phase 5 reveal: table merged cells (colspan/rowspan)', () => {
  const tableEl = {
    ...base,
    type: 'table',
    data: [
      ['A', 'B'],
      ['C', 'D'],
    ],
    mergedCells: [{ row: 0, col: 0, colSpan: 2, rowSpan: 1 }],
  }

  it('emits colspan on the anchor cell and omits the covered cell', () => {
    const html = renderElement(tableEl, {}, {})
    expect(html).toContain('colspan="2"')
    // First row should have exactly ONE cell (the merged anchor), B omitted
    const firstRow = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)[1]
    const cellCount = (firstRow.match(/<td/g) || []).length
    expect(cellCount).toBe(1)
  })

  it('emits rowspan for a vertical merge', () => {
    const html = renderElement(
      { ...tableEl, mergedCells: [{ row: 0, col: 0, colSpan: 1, rowSpan: 2 }] },
      {},
      {}
    )
    expect(html).toContain('rowspan="2"')
  })

  it('renders a plain grid when there are no merges', () => {
    const html = renderElement({ ...tableEl, mergedCells: [] }, {}, {})
    expect(html).not.toContain('colspan')
    expect(html).not.toContain('rowspan')
  })
})

describe('Phase 5 reveal: table headerTextColor + borderStyle parity with canvas', () => {
  const base = { id: 'tbl', x: 0, y: 0, width: 200, height: 100, zIndex: 1, type: 'table' }

  it('applies headerTextColor to header-row cells', () => {
    const html = renderElement(
      { ...base, data: [['H1', 'H2'], ['a', 'b']], headerRow: true, headerTextColor: '#ff0000' },
      {},
      {}
    )
    // Header row is the first <tr>; its cells carry the header text color.
    const firstRow = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)[1]
    expect(firstRow).toContain('color:#ff0000')
  })

  it('applies table-level borderStyle to the default cell border', () => {
    const html = renderElement(
      { ...base, data: [['a', 'b']], borderStyle: 'dashed', borderColor: '#555555' },
      {},
      {}
    )
    expect(html).toContain('dashed')
  })

  it('defaults to solid border when borderStyle is unset', () => {
    const html = renderElement({ ...base, data: [['a']], borderColor: '#555555' }, {}, {})
    expect(html).toContain('solid')
  })
})

