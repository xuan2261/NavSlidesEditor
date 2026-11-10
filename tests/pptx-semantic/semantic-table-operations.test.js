import { describe, expect, it } from 'vitest'
import { normalizeTableDocument } from '../../shared/src/pptx-table-document'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { document, merge } from './table-operations-fixture'

describe('immutable typed table operation reducer', () => {
  it('merges the exact rectangle without losing covered rich cells or unrelated declarations', () => {
    const source = normalizeTableDocument(document())
    const before = JSON.stringify(source)
    const result = applyTableOperation(source, merge)
    expect(result).toEqual(applyTableOperation(source, merge))
    expect(JSON.stringify(source)).toBe(before)
    expect(result).not.toBe(source)
    expect(result.rows.map((row) => row.cells.length)).toEqual([3, 3, 3])
    expect(result.rows.slice(0, 2).map((row) => row.cells.slice(0, 2).map((c) => c.merge))).toEqual(
      [
        [{ gridSpan: 2, rowSpan: 2 }, { hMerge: true }],
        [{ vMerge: true }, { hMerge: true, vMerge: true }],
      ]
    )
    for (const [r, row] of result.rows.entries()) {
      for (const [c, cell] of row.cells.entries()) {
        expect(cell.componentId).toBe(source.rows[r].cells[c].componentId)
        expect(cell.textDocument).toEqual(source.rows[r].cells[c].textDocument)
        expect(cell.properties).toEqual(source.rows[r].cells[c].properties)
        expect(cell.anchorCellId).toBe(r < 2 && c < 2 ? 'cell00' : cell.componentId)
        if (r >= 2 || c >= 2) expect(cell).toEqual(source.rows[r].cells[c])
      }
    }
    expect(Object.isFrozen(result.rows[1].cells[1].textDocument.paragraphs[0].runs)).toBe(true)
    expect(normalizeTableDocument(JSON.parse(JSON.stringify(result)))).toEqual(result)
    const restored = applyTableOperation(result, { type: 'unmergeCell', cellId: 'cell00' })
    expect(restored).toEqual(source)
  })

  it.each([
    [1, 3],
    [3, 1],
    [3, 3],
  ])('supports %i by %i spans', (rowSpan, columnSpan) => {
    const source = document()
    const result = applyTableOperation(source, { ...merge, rowSpan, columnSpan })
    expect(normalizeTableDocument(result)).toEqual(result)
    expect(applyTableOperation(result, { type: 'unmergeCell', cellId: 'cell00' })).toEqual(source)
  })

  it.each([
    { type: 'setRowHeight', rowId: 'row1', heightEmu: 0 },
    { type: 'setRowHeight', rowId: 'row1', heightEmu: 27273042316900 },
    { type: 'setColumnWidth', columnId: 'col2', widthEmu: 1828801 },
  ])('changes only the targeted native dimension: %j', (command) => {
    const source = document()
    const expected = structuredClone(source)
    if (command.type === 'setRowHeight') expected.rows[1].heightEmu = command.heightEmu
    else expected.columns[2].widthEmu = command.widthEmu
    const before = JSON.stringify(source)
    expect(applyTableOperation(source, command)).toEqual(expected)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('replaces canonical rich text, preserving body identity, fields, breaks and all other cells', () => {
    const source = document()
    const textDocument = structuredClone(source.rows[0].cells[0].textDocument)
    const runs = textDocument.paragraphs[0].runs
    runs[0].text = ' \tEdited & rich\n'
    runs[0].properties.color = { kind: 'scheme', value: 'accent2' }
    runs.push({ componentId: 'new:break', kind: 'break' })
    runs.push({
      componentId: 'new:field',
      kind: 'field',
      text: '17',
      field: { id: '{field-id}', type: 'slidenum' },
      proofing: { smtClean: false },
    })
    const expected = structuredClone(source)
    expected.rows[0].cells[0].textDocument = structuredClone(textDocument)
    const command = { type: 'replaceCellText', cellId: 'cell00', textDocument }
    const result = applyTableOperation(source, command)
    expect(result).toEqual(expected)
    textDocument.paragraphs[0].runs[0].text = 'caller mutation'
    expect(result).toEqual(expected)
    expect(normalizeTableDocument(JSON.parse(JSON.stringify(result)))).toEqual(expected)
    expect(source).toEqual(document())
  })

  it('keeps covered rich content through anchor edits, merged sizing and JSON reopen/unmerge', () => {
    const source = document()
    const merged = applyTableOperation(source, merge)
    const textDocument = structuredClone(merged.rows[0].cells[0].textDocument)
    textDocument.paragraphs[0].runs[0].text = 'edited anchor'
    const edited = applyTableOperation(merged, {
      type: 'replaceCellText',
      cellId: 'cell00',
      textDocument,
    })
    const resized = applyTableOperation(edited, {
      type: 'setColumnWidth',
      columnId: 'col1',
      widthEmu: 700003,
    })
    const restored = applyTableOperation(JSON.parse(JSON.stringify(resized)), {
      type: 'unmergeCell',
      cellId: 'cell00',
    })
    const expected = structuredClone(source)
    expected.rows[0].cells[0].textDocument = textDocument
    expected.columns[1].widthEmu = 700003
    expect(restored).toEqual(expected)
    expect(source).toEqual(document())
  })

  it('supports disjoint offset merges without changing the earlier region', () => {
    const source = document()
    const first = applyTableOperation(source, {
      ...merge,
      rowSpan: 1,
      columnSpan: 3,
    })
    const second = applyTableOperation(first, {
      ...merge,
      startRow: 1,
      startColumn: 1,
    })
    expect(second.rows[0]).toEqual(first.rows[0])
    expect(second.rows[2].cells[2].anchorCellId).toBe('cell11')
    expect(second.rows[2].cells[2].merge).toEqual({ hMerge: true, vMerge: true })
    const last = applyTableOperation(second, { type: 'unmergeCell', cellId: 'cell11' })
    expect(last).toEqual(first)
  })

  it('unmerges imported redundant continuations while retaining every physical cell', () => {
    const source = structuredClone(applyTableOperation(document(), merge))
    source.rows[0].cells[1].merge.rowSpan = 2
    source.rows[1].cells[0].merge.gridSpan = 2
    const before = JSON.stringify(source)
    expect(applyTableOperation(source, { type: 'unmergeCell', cellId: 'cell00' })).toEqual(
      document()
    )
    expect(JSON.stringify(source)).toBe(before)
  })
})
