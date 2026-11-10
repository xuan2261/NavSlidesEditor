import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { familyDocumentsFixture } from './family-documents-fixture'
const require = createRequire(import.meta.url)
const { applyPresentationProjectionOperation: apply } = require('../../shared/src/pptx-projection-operation')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const copy = (value) => JSON.parse(JSON.stringify(value))
let presentation, table, definition
beforeAll(async () => {
  const document = (await familyDocumentsFixture()).table
  definition = Object.values(document.definitions)[0]
  table = definition.content.tableDocument
  const instance = document.instances.occurrence
  document.instances.sibling = { ...copy(instance), id: 'sibling' }
  presentation = {
    slides: [{
      id: instance.slideId,
      elements: ['occurrence', 'sibling'].map((id) => ({
        id, type: 'table', pptxInstanceId: id, data: [],
      })),
    }],
    pptxSemantic: document,
  }
})
const envelope = (command) => ({
  type: 'table.edit', instanceId: 'occurrence', componentId: table.componentId, command,
})
const family = () => require('../../shared/src/pptx-family-operations')

describe('production table occurrence commands', () => {
  it('changes an occurrence dimension, derives compatibility and preserves source/sibling', () => {
    const before = copy(presentation)
    const next = apply(presentation, envelope({
      type: 'setColumnWidth', columnId: table.columns[0].componentId, widthEmu: 123456,
    }))
    const effective = family().materializeFamilyDocument(definition, next.pptxSemantic.instances.occurrence)
    expect(effective.columns[0].widthEmu).toBe(123456)
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.instances.sibling).toEqual(before.pptxSemantic.instances.sibling)
    expect(presentation).toEqual(before)
    expect(next.slides[0].elements[0].data).toEqual(family().tableCompatibilityData(effective))
    expect(normalizeSemanticPresentation(copy(next))).toEqual(next)
    expect(() => assertSemanticBaseline(presentation, next)).not.toThrow()
  })
  it('retains covered rich content across merge, JSON reopen and unmerge', () => {
    const command = { type: 'mergeCells', startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 2 }
    let next = apply(presentation, envelope({ type: 'unmergeCell', cellId: table.rows[0].cells[0].componentId }))
    next = apply(next, envelope(command))
    next = apply(copy(next), envelope({ type: 'unmergeCell', cellId: table.rows[0].cells[0].componentId }))
    const effective = family().materializeFamilyDocument(definition, next.pptxSemantic.instances.occurrence)
    expect(effective.rows.map((row) => row.cells.map((cell) => cell.textDocument)))
      .toEqual(table.rows.map((row) => row.cells.map((cell) => cell.textDocument)))
    expect(effective.rows[0].cells.every((cell) => cell.anchorCellId === cell.componentId)).toBe(true)
  })
  it('resets only the selected occurrence journal', () => {
    let next = apply(presentation, envelope({
      type: 'setRowHeight', rowId: table.rows[0].componentId, heightEmu: 0,
    }))
    next = apply(copy(next), envelope({ type: 'reset' }))
    expect(next.pptxSemantic.instances.occurrence.overrides).toEqual(
      presentation.pptxSemantic.instances.occurrence.overrides
    )
    expect(family().materializeFamilyDocument(definition, next.pptxSemantic.instances.occurrence)).toEqual(table)
  })
  it('rejects another root, unsupported payload, locked targets and malformed commands atomically', () => {
    const command = { type: 'setRowHeight', rowId: table.rows[0].componentId, heightEmu: 3 }
    for (const mutate of [
      (p, op) => { op.componentId = table.rows[0].componentId },
      (p, op) => { op.command = { type: 'replace', tableDocument: table } },
      (p) => { p.slides[0].locked = true },
      (p) => { p.slides[0].elements[0].locked = true },
      (p) => { p.pptxSemantic.instances.occurrence.overrides.locked = true },
      (p, op) => { op.command.heightEmu = -1 },
    ]) {
      const p = copy(presentation), op = envelope(copy(command))
      mutate(p, op)
      const before = copy(p)
      expect(() => apply(p, op)).toThrow()
      expect(p).toEqual(before)
    }
  })
  it('refuses source-looking new rich IDs and permits explicitly authored descendants', () => {
    const cell = table.rows[0].cells[0], text = copy(cell.textDocument)
    text.paragraphs[0].runs[0].componentId = 'ppt/slides/slide1.xml#text-run:999'
    expect(() => apply(presentation, envelope({
      type: 'replaceCellText', cellId: cell.componentId, textDocument: text,
    }))).toThrow()
    text.paragraphs[0].runs[0].componentId = `${text.componentId}~authored:new-run`
    const next = apply(presentation, envelope({
      type: 'replaceCellText', cellId: cell.componentId, textDocument: text,
    }))
    expect(family().materializeFamilyDocument(definition, next.pptxSemantic.instances.occurrence)
      .rows[0].cells[0].textDocument).toEqual(text)
  })
})
