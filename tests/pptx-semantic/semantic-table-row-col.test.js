import { describe, expect, it } from 'vitest'
import { normalizeTableDocument } from '../../shared/src/pptx-table-document'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { document, merge } from './table-operations-fixture'

function makeCell(id, text = '') {
  return {
    componentId: id,
    merge: {},
    anchorCellId: id,
    properties: { marginLeftEmu: 0 },
    textDocument: {
      schemaVersion: 1,
      componentId: `${id}:body`,
      body: { wrap: true },
      paragraphs: [
        {
          componentId: `${id}:p`,
          properties: { alignment: 'l' },
          runs: [
            {
              componentId: `${id}:r`,
              kind: 'text',
              text: text || ` ${id} `,
              properties: { bold: false, fontSizePt: 12 },
            },
          ],
        },
      ],
    },
  }
}

describe('table row and column insertion and deletion', () => {
  it('inserts a row at the beginning, middle or end', () => {
    const source = normalizeTableDocument(document())
    const newRow = {
      componentId: 'rowNew',
      heightEmu: 500000,
      cells: [makeCell('cNew0'), makeCell('cNew1'), makeCell('cNew2')],
    }
    
    // Insert after row0 (middle)
    const afterMiddle = applyTableOperation(source, {
      type: 'insertRow',
      afterRowId: 'row0',
      row: newRow,
    })
    expect(afterMiddle.rows.length).toBe(4)
    expect(afterMiddle.rows[1].componentId).toBe('rowNew')
    expect(afterMiddle.rows[1].heightEmu).toBe(500000)
    expect(afterMiddle.rows[1].cells.map((c) => c.componentId)).toEqual(['cNew0', 'cNew1', 'cNew2'])
    expect(normalizeTableDocument(afterMiddle)).toEqual(afterMiddle)

    // Insert at start (afterRowId: null)
    const atStart = applyTableOperation(source, {
      type: 'insertRow',
      afterRowId: null,
      row: newRow,
    })
    expect(atStart.rows.length).toBe(4)
    expect(atStart.rows[0].componentId).toBe('rowNew')
  })

  it('deletes an unmerged row', () => {
    const source = normalizeTableDocument(document())
    const result = applyTableOperation(source, {
      type: 'deleteRow',
      rowId: 'row1',
    })
    expect(result.rows.length).toBe(2)
    expect(result.rows.map((r) => r.componentId)).toEqual(['row0', 'row2'])
    expect(normalizeTableDocument(result)).toEqual(result)
  })

  it('rejects deleting the only remaining row or column', () => {
    const minimal = {
      schemaVersion: 1,
      componentId: 'tableMin',
      properties: {},
      columns: [{ componentId: 'col0', widthEmu: 100000 }],
      rows: [
        {
          componentId: 'row0',
          heightEmu: 100000,
          cells: [makeCell('c0')],
        },
      ],
    }
    expect(() => applyTableOperation(minimal, { type: 'deleteRow', rowId: 'row0' })).toThrow(TypeError)
    expect(() => applyTableOperation(minimal, { type: 'deleteColumn', columnId: 'col0' })).toThrow(TypeError)
  })

  it('rejects deleting a row or column that intersects an active merge span', () => {
    const source = normalizeTableDocument(document())
    const merged = applyTableOperation(source, merge)
    // row0 and row1 have a 2x2 merged span
    expect(() => applyTableOperation(merged, { type: 'deleteRow', rowId: 'row0' })).toThrow(TypeError)
    expect(() => applyTableOperation(merged, { type: 'deleteRow', rowId: 'row1' })).toThrow(TypeError)
    expect(() => applyTableOperation(merged, { type: 'deleteColumn', columnId: 'col0' })).toThrow(TypeError)
    expect(() => applyTableOperation(merged, { type: 'deleteColumn', columnId: 'col1' })).toThrow(TypeError)
    
    // row2 is not merged - deletion must succeed
    const deletedRow2 = applyTableOperation(merged, { type: 'deleteRow', rowId: 'row2' })
    expect(deletedRow2.rows.length).toBe(2)

    // col2 is not merged - deletion must succeed
    const deletedCol2 = applyTableOperation(merged, { type: 'deleteColumn', columnId: 'col2' })
    expect(deletedCol2.columns.length).toBe(2)
  })

  it('inserts a column with cells matching row count', () => {
    const source = normalizeTableDocument(document())
    const newCol = { componentId: 'colNew', widthEmu: 1200000 }
    const cells = [makeCell('cR0'), makeCell('cR1'), makeCell('cR2')]

    const result = applyTableOperation(source, {
      type: 'insertColumn',
      afterColumnId: 'col1',
      column: newCol,
      cells,
    })
    expect(result.columns.length).toBe(4)
    expect(result.columns[2].componentId).toBe('colNew')
    expect(result.rows.every((r) => r.cells.length === 4)).toBe(true)
    expect(result.rows.map((r) => r.cells[2].componentId)).toEqual(['cR0', 'cR1', 'cR2'])
    expect(normalizeTableDocument(result)).toEqual(result)
  })

  it('deletes an unmerged column', () => {
    const source = normalizeTableDocument(document())
    const result = applyTableOperation(source, {
      type: 'deleteColumn',
      columnId: 'col1',
    })
    expect(result.columns.length).toBe(2)
    expect(result.columns.map((c) => c.componentId)).toEqual(['col0', 'col2'])
    expect(result.rows.every((r) => r.cells.length === 2)).toBe(true)
    expect(normalizeTableDocument(result)).toEqual(result)
  })
})
