import { describe, expect, it } from 'vitest'
import { normalizeTableDocument } from '../../shared/src/pptx-table-document'
import { assertTableOccurrenceIdentity } from '../../shared/src/pptx-table-operations-identity'

function document() {
  const cell = (id, merge = {}, anchorCellId = id) => ({
    componentId: id, merge, anchorCellId, properties: {},
    textDocument: { schemaVersion: 1, componentId: `${id}:body`,
      paragraphs: [{ componentId: `${id}:p`, runs: [
        { componentId: `${id}:r`, kind: 'text', text: ` ${id} `, properties: { fontSizePt: 12.34 } },
      ] }] },
  })
  return { schemaVersion: 1, componentId: 'table', properties: {},
    columns: [{ componentId: 'col0', widthEmu: 914401, identity: { value: 0, componentId: 'native-col0' } }, { componentId: 'col1', widthEmu: 1828801 }],
    rows: [
      { componentId: 'row0', heightEmu: 457201, identity: { value: 0, componentId: 'native-row0' },
        cells: [cell('a', { gridSpan: 2, rowSpan: 2 }), cell('b', { hMerge: true, rowSpan: 2 }, 'a')] },
      { componentId: 'row1', heightEmu: 457202,
        cells: [cell('c', { vMerge: true, gridSpan: 2 }, 'a'), cell('d', { hMerge: true, vMerge: true }, 'a')] },
    ] }
}

describe('canonical source table document', () => {
  it('keeps every physical rich cell and native dimension immutable through JSON reopen', () => {
    const input = document(), before = JSON.stringify(input), result = normalizeTableDocument(input)
    expect(result).toEqual(input)
    expect(result).not.toBe(input)
    expect(Object.isFrozen(result.rows[1].cells[0].textDocument.paragraphs[0].runs)).toBe(true)
    expect(normalizeTableDocument(JSON.parse(JSON.stringify(result)))).toEqual(result)
    input.rows[0].cells[0].textDocument.paragraphs[0].runs[0].text = 'changed'
    expect(JSON.stringify(result)).toBe(before)
  })

  it.each([
    ['out of bounds', (d) => { d.rows[0].cells[0].merge.gridSpan = 3 }],
    ['missing continuation', (d) => { d.rows[1].cells[1].merge.vMerge = false }],
    ['orphan continuation', (d) => { d.rows[0].cells[0].merge.hMerge = true }],
    ['wrong anchor', (d) => { d.rows[1].cells[1].anchorCellId = 'b' }],
    ['overlap', (d) => { d.rows[1].cells[1].merge.gridSpan = 2 }],
    ['ragged row', (d) => { d.rows[1].cells.pop() }],
    ['negative dimension', (d) => { d.columns[0].widthEmu = -1 }],
    ['fractional dimension', (d) => { d.rows[0].heightEmu = 0.5 }],
    ['duplicate cell identity', (d) => { d.rows[1].cells[0].componentId = 'a' }],
    ['duplicate text identity', (d) => { d.rows[1].cells[0].textDocument.componentId = 'a:body' }],
    ['unknown style', (d) => { d.rows[0].cells[0].properties.css = 'red' }],
    ['unknown rich text', (d) => { d.rows[0].cells[0].textDocument.html = '<p>flattened</p>' }],
    ['zero span', (d) => { d.rows[0].cells[0].merge.rowSpan = 0 }],
    ['string merge flag', (d) => { d.rows[0].cells[1].merge.hMerge = '1' }],
    ['authority injection', (d) => { d.adapterQualified = true }],
    ['negative native identity', (d) => { d.columns[0].identity.value = -1 }],
    ['overflowed native identity', (d) => { d.rows[0].identity.value = 4294967296 }],
    ['fractional native identity', (d) => { d.columns[0].identity.value = 0.5 }],
    ['native identity authority injection', (d) => { d.rows[0].identity.namespaceUri = 'foreign' }],
    ['duplicate native column value', (d) => { d.columns[1].identity = { value: 0, componentId: 'native-col1' } }],
    ['duplicate native row value', (d) => { d.rows[1].identity = { value: 0, componentId: 'native-row1' } }],
    ['native component collision', (d) => { d.columns[0].identity.componentId = 'row1' }],
  ])('rejects %s without mutating input', (_label, mutate) => {
    const input = document()
    mutate(input)
    const before = JSON.stringify(input)
    expect(() => normalizeTableDocument(input)).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  describe.each(['columns', 'rows'])('%s native provenance', collection => {
    it.each(['value', 'component', 'removal', 'new owner'])('rejects occurrence %s forgery', change => {
      const source = normalizeTableDocument(document()), edited = structuredClone(source)
      const entry = edited[collection][0]
      if (change === 'value') entry.identity.value = 1
      if (change === 'component') entry.identity.componentId = 'forged-native'
      if (change === 'removal') delete entry.identity
      if (change === 'new owner') edited[collection][1].identity = { value: 1, componentId: 'forged-native' }
      expect(() => assertTableOccurrenceIdentity(source, normalizeTableDocument(edited)))
        .toThrow(/native identity/)
    })
  })

  it('rejects accessors without executing them and rejects sparse/cyclic data', () => {
    let calls = 0
    const accessor = document()
    Object.defineProperty(accessor, 'rows', { enumerable: true, get: () => { calls++; return [] } })
    expect(() => normalizeTableDocument(accessor)).toThrow()
    expect(calls).toBe(0)
    const cyclic = document()
    cyclic.rows[0].cells[0].properties = cyclic
    expect(() => normalizeTableDocument(cyclic)).toThrow()
    const sparse = document()
    delete sparse.rows[0].cells[0]
    expect(() => normalizeTableDocument(sparse)).toThrow()
  })
})
