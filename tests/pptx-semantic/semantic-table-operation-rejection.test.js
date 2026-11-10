import { describe, expect, it } from 'vitest'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { document, merge } from './table-operations-fixture'

describe('atomic table operation rejection', () => {
  it.each([
    { ...merge, startRow: -1 },
    { ...merge, startColumn: 2 },
    { ...merge, rowSpan: 0 },
    { ...merge, columnSpan: 1.5 },
    { ...merge, rowSpan: 1, columnSpan: 1 },
    { type: 'setRowHeight', rowId: 'row1', heightEmu: -1 },
    { type: 'setColumnWidth', columnId: 'col0', widthEmu: 0.5 },
    { type: 'setColumnWidth', columnId: 'col0', widthEmu: 27273042316901 },
    { type: 'setRowHeight', rowId: 'missing', heightEmu: 1 },
    { type: 'setColumnWidth', columnId: 'row0', widthEmu: 1 },
    { type: 'unmergeCell', cellId: 'cell00' },
    { type: 'replaceCellText', cellId: 'missing', textDocument: {} },
    { type: 'replaceCellText', cellId: 'cell00', textDocument: 'plain string' },
    { type: 'unknown' },
    { ...merge, adapterQualified: true },
    { type: 'setRowHeight', rowId: 'row0' },
    { type: ['mergeCells'], startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 },
  ])('rejects invalid commands atomically: %j', (command) => {
    const source = document()
    const before = JSON.stringify(source),
      commandBefore = JSON.stringify(command)
    expect(() => applyTableOperation(source, command)).toThrow(TypeError)
    expect(JSON.stringify(source)).toBe(before)
    expect(JSON.stringify(command)).toBe(commandBefore)
  })

  it('rejects overlap, partial selections and covered-cell targeting without loss', () => {
    const source = applyTableOperation(document(), merge)
    const before = JSON.stringify(source)
    for (const command of [
      merge,
      { ...merge, startColumn: 1 },
      { ...merge, rowSpan: 3, columnSpan: 3 },
      { type: 'unmergeCell', cellId: 'cell11' },
      {
        type: 'replaceCellText',
        cellId: 'cell11',
        textDocument: source.rows[1].cells[1].textDocument,
      },
    ])
      expect(() => applyTableOperation(source, command)).toThrow(TypeError)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('rejects wrong text owner, duplicate rich identities and hostile command data', () => {
    const source = document()
    const textDocument = structuredClone(source.rows[0].cells[0].textDocument)
    textDocument.componentId = 'cell01:body'
    expect(() =>
      applyTableOperation(source, {
        type: 'replaceCellText',
        cellId: 'cell00',
        textDocument,
      })
    ).toThrow(TypeError)
    textDocument.componentId = 'cell00:body'
    textDocument.paragraphs[0].runs[0].componentId = 'cell01:r'
    expect(() =>
      applyTableOperation(source, {
        type: 'replaceCellText',
        cellId: 'cell00',
        textDocument,
      })
    ).toThrow(TypeError)
    let calls = 0
    const command = { ...merge }
    Object.defineProperty(command, 'type', {
      enumerable: true,
      get() {
        calls++
        return 'mergeCells'
      },
    })
    expect(() => applyTableOperation(source, command)).toThrow(TypeError)
    expect(calls).toBe(0)
    const invalid = document()
    invalid.rows[0].cells[0].merge.hMerge = true
    expect(() => applyTableOperation(invalid, merge)).toThrow(TypeError)
  })
})
