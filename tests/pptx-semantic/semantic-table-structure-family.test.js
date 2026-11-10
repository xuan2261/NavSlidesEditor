import { beforeAll, describe, expect, it } from 'vitest'
import { familyDocumentsFixture } from './family-documents-fixture'
import { applyPresentationProjectionOperation as apply } from '../../shared/src/pptx-projection-operation'
import { normalizeSemanticPresentation as reopen } from '../../shared/src/pptx-semantic-presentation'
import { materializeFamilyDocument } from '../../shared/src/pptx-family-operations'
import { assertSemanticBaseline } from '../../server/services/pptx-import/semantic-baseline'
import { createTableRowInsertion, createTableColumnInsertion } from '../../shared/src/pptx-table-structure-commands'
import { collectSemanticFontRequests } from '../../shared/src/pptx-source-font-request'

const copy = (value) => JSON.parse(JSON.stringify(value))
const authored = (parent, kind, token) => `${parent}~authored:${kind}:${token}`
let fixture
beforeAll(async () => { fixture = (await familyDocumentsFixture()).table })
function setup() {
  const document = copy(fixture)
  document.instances.sibling = { ...copy(document.instances.occurrence), id: 'sibling' }
  const presentation = reopen({ pptxSemantic: document, slides: [{ id: 's1', elements:
    ['occurrence', 'sibling'].map((id) => ({ id, type: 'table', pptxInstanceId: id })) }] })
  const definition = Object.values(document.definitions)[0]
  const root = definition.content.tableDocument.componentId
  const edit = (input, command) => apply(input, {
    type: 'table.edit', instanceId: 'occurrence', componentId: root, command,
  })
  const effective = (input) => materializeFamilyDocument(definition, input.pptxSemantic.instances.occurrence)
  const initial = effective(presentation)
  const unmerged = edit(presentation, { type: 'unmergeCell', cellId: initial.rows[0].cells[0].componentId })
  return { presentation, definition, root, edit, effective, unmerged }
}
function cell(rowId, token) {
  const componentId = authored(rowId, 'cell', token)
  const body = authored(componentId, 'body', 'text')
  return { componentId, anchorCellId: componentId, merge: {}, properties: {}, textDocument: {
    schemaVersion: 1, componentId: body, paragraphs: [{ componentId: `${body}~authored:p`,
      runs: [{ componentId: `${body}~authored:r`, kind: 'text', text: '' }] }],
  } }
}
function rowCommand(table) {
  const componentId = authored(table.componentId, 'row', 'new')
  return { type: 'insertRow', afterRowId: table.rows[0].componentId,
    row: { componentId, heightEmu: 123456, cells: table.columns.map((_, i) => cell(componentId, `r${i}`)) } }
}
function columnCommand(table) {
  return { type: 'insertColumn', afterColumnId: table.columns[0].componentId,
    column: { componentId: authored(table.componentId, 'column', 'new'), widthEmu: 654321 },
    cells: table.rows.map((row) => cell(row.componentId, 'column-new')) }
}

describe('table structure through the production family projection journal', () => {
  it('inserts, edits and deletes authored structure across JSON save/reopen without changing source or siblings', () => {
    const { presentation, definition, edit, effective, unmerged } = setup()
    const before = copy(presentation)
    const addRow = rowCommand(effective(unmerged))
    const rows = edit(unmerged, addRow)
    expect(effective(rows).rows[1]).toEqual(addRow.row)
    const addColumn = columnCommand(effective(rows))
    const columns = reopen(copy(edit(rows, addColumn)))
    const table = effective(columns)
    expect(table.columns[1]).toEqual(addColumn.column)
    expect(table.rows.every((row) => row.cells.length === table.columns.length)).toBe(true)
    const target = table.rows[1].cells[1]
    const textDocument = copy(target.textDocument)
    textDocument.paragraphs[0].runs[0].text = 'New authored cell'
    const edited = reopen(copy(edit(columns, { type: 'replaceCellText', cellId: target.componentId, textDocument })))
    expect(effective(edited).rows[1].cells[1].textDocument).toEqual(textDocument)
    const deletedRow = edit(edited, { type: 'deleteRow', rowId: addRow.row.componentId })
    const deleted = reopen(copy(edit(deletedRow, { type: 'deleteColumn', columnId: addColumn.column.componentId })))
    expect(effective(deleted)).toEqual(effective(unmerged))
    for (const next of [rows, columns, edited, deleted]) {
      expect(next.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
      expect(next.pptxSemantic.instances.sibling).toEqual(presentation.pptxSemantic.instances.sibling)
      expect(next.slides[0].elements[1]).toEqual(presentation.slides[0].elements[1])
      expect(materializeFamilyDocument(definition, next.pptxSemantic.instances.sibling)).toEqual(definition.content.tableDocument)
      expect(() => assertSemanticBaseline(presentation, next)).not.toThrow()
    }
    expect(presentation).toEqual(before)
  })

  it.each(['row', 'cell', 'body', 'paragraph', 'run'])('rejects forged inserted %s identities atomically', (kind) => {
    const { edit, effective, unmerged } = setup()
    const command = rowCommand(effective(unmerged))
    const inserted = command.row.cells[0]
    const target = { row: command.row, cell: inserted, body: inserted.textDocument,
      paragraph: inserted.textDocument.paragraphs[0], run: inserted.textDocument.paragraphs[0].runs[0] }[kind]
    target.componentId = 'arbitrary-forged-id'
    if (kind === 'cell') inserted.anchorCellId = target.componentId
    const before = copy(unmerged)
    expect(() => edit(unmerged, command)).toThrow(TypeError)
    expect(unmerged).toEqual(before)
  })

  it('rejects foreign columns, source ID reuse, authored parent moves and malformed saved journals', () => {
    const { root, edit, effective, unmerged } = setup()
    const badColumn = columnCommand(effective(unmerged))
    badColumn.column.componentId = authored('foreign-table', 'column', 'new')
    expect(() => edit(unmerged, badColumn)).toThrow(TypeError)
    const badRow = rowCommand(effective(unmerged))
    badRow.row.cells[0] = copy(effective(unmerged).rows[0].cells[0])
    expect(() => edit(unmerged, badRow)).toThrow(TypeError)
    const added = edit(unmerged, rowCommand(effective(unmerged)))
    const original = effective(added).rows[1]
    const deleted = edit(added, { type: 'deleteRow', rowId: original.componentId })
    const moved = rowCommand(effective(deleted))
    moved.row.componentId = authored(root, 'row', 'other')
    moved.row.cells = copy(original.cells)
    expect(() => edit(deleted, moved)).toThrow(TypeError)
    const saved = copy(added)
    saved.pptxSemantic.instances.occurrence.overrides.components[root].familyOperations.commands.at(-1).row.cells[0].textDocument.componentId = 'forged-body'
    expect(() => reopen(saved)).toThrow('Invalid authored table component identity or ownership')
  })

  it('builds beginning insertions with native dimensions and rejects invalid helper targets and tokens', () => {
    const { edit, effective, unmerged } = setup()
    const table = effective(unmerged)
    const row = createTableRowInsertion(table, null, 'row-token')
    const addedRow = edit(unmerged, row)
    expect(effective(addedRow).rows[0].heightEmu).toBe(table.rows[0].heightEmu)
    expect(effective(addedRow).rows[0].cells.every((cell) => cell.textDocument.paragraphs[0].runs[0].text === '')).toBe(true)
    const column = createTableColumnInsertion(effective(addedRow), null, 'column-token')
    const addedColumn = edit(addedRow, column)
    expect(effective(addedColumn).columns[0].widthEmu).toBe(table.columns[0].widthEmu)
    for (const build of [createTableRowInsertion, createTableColumnInsertion]) {
      expect(() => build(table, 'foreign', 'token')).toThrow(TypeError)
      expect(() => build(table, null, 'bad/token')).toThrow(TypeError)
      expect(() => build(table, null, '')).toThrow(TypeError)
    }
  })

  it.each([createTableRowInsertion, createTableColumnInsertion])('retains source typography for newly authored cells (%#)', (build) => {
    const { edit, effective, unmerged } = setup()
    const table = effective(unmerged)
    const target = build === createTableRowInsertion ? table.rows[0].componentId : table.columns[0].componentId
    const added = edit(unmerged, build(table, target, 'font-delivery'))
    expect(collectSemanticFontRequests(added.pptxSemantic).issues.filter((issue) => issue.componentId.includes('~authored:'))).toEqual([])
  })

  it('keeps copied occurrence journals independent instead of promoting authored IDs into shared source', () => {
    const { root, edit, effective, unmerged } = setup()
    const added = edit(unmerged, rowCommand(effective(unmerged)))
    const copied = copy(added)
    copied.pptxSemantic.instances.sibling.overrides = copy(copied.pptxSemantic.instances.occurrence.overrides)
    const reopened = reopen(copied)
    const row = effective(reopened).rows[1]
    const next = apply(reopened, { type: 'table.edit', instanceId: 'sibling', componentId: root,
      command: { type: 'setRowHeight', rowId: row.componentId, heightEmu: 999 } })
    expect(effective(next).rows[1].heightEmu).toBe(123456)
    expect(next.slides[0].elements[1].tableDocument.rows[1].heightEmu).toBe(999)
    expect(next.pptxSemantic.instances.occurrence).toEqual(reopened.pptxSemantic.instances.occurrence)
    expect(next.pptxSemantic.definitions).toEqual(reopened.pptxSemantic.definitions)
  })

  it('never reparents or changes the kind of an authored rich identity across journal commands', () => {
    const { edit, effective, unmerged } = setup()
    const target = effective(unmerged).rows[0].cells[0]
    const body = target.textDocument.componentId
    const original = { schemaVersion: 1, componentId: body, paragraphs: [{
      componentId: `${body}~authored:first`, runs: [{
        componentId: `${body}~authored:retained`, kind: 'text', text: 'owned',
      }],
    }] }
    const replace = (input, textDocument) => edit(input, {
      type: 'replaceCellText', cellId: target.componentId, textDocument,
    })
    const added = replace(unmerged, original)
    const removed = reopen(copy(replace(added, { ...original, paragraphs: [] })))
    const moved = copy(original)
    moved.paragraphs[0].componentId = `${body}~authored:other`
    expect(() => replace(removed, moved)).toThrow(TypeError)
    const changedKind = copy(original)
    changedKind.paragraphs[0].runs[0] = { componentId: `${body}~authored:retained`, kind: 'break' }
    expect(() => replace(removed, changedKind)).toThrow(TypeError)
    expect(replace(removed, original).slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument).toEqual(original)
  })

  it('keeps active merge boundaries and final row/column deletion guards on the production path', () => {
    const { presentation, edit, effective, unmerged } = setup()
    const merged = effective(presentation)
    const vertical = edit(unmerged, { type: 'mergeCells', startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 1 })
    expect(() => edit(vertical, rowCommand(effective(vertical)))).toThrow(TypeError)
    expect(() => edit(presentation, columnCommand(merged))).toThrow(TypeError)
    expect(() => edit(vertical, { type: 'deleteRow', rowId: merged.rows[0].componentId })).toThrow(TypeError)
    expect(() => edit(presentation, { type: 'deleteColumn', columnId: merged.columns[0].componentId })).toThrow(TypeError)
    let minimal = unmerged
    while (effective(minimal).rows.length > 1) minimal = edit(minimal, { type: 'deleteRow', rowId: effective(minimal).rows.at(-1).componentId })
    while (effective(minimal).columns.length > 1) minimal = edit(minimal, { type: 'deleteColumn', columnId: effective(minimal).columns.at(-1).componentId })
    expect(() => edit(minimal, { type: 'deleteRow', rowId: effective(minimal).rows[0].componentId })).toThrow(TypeError)
    expect(() => edit(minimal, { type: 'deleteColumn', columnId: effective(minimal).columns[0].componentId })).toThrow(TypeError)
  })
})
