// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TableProperties from '../../client/src/components/properties/table-properties'
import { familyDocumentsFixture } from './family-documents-fixture'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { document as tableDocument, merge } from './table-operations-fixture'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation'
import { createTableRowInsertion, createTableColumnInsertion } from '../../shared/src/pptx-table-structure-commands'
import { assertTableOccurrenceIdentity } from '../../shared/src/pptx-table-operations-identity'
import { normalizeTableDocument } from '../../shared/src/pptx-table-document'

afterEach(cleanup)

describe('semantic table editing acceptance', () => {
  it('persists rich-cell edits, merge topology and row insertion without changing other source cells or occurrences', async () => {
    const document = (await familyDocumentsFixture()).table
    document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: ['occurrence', 'sibling'].map((id) => ({
          id, type: 'table', pptxInstanceId: id, data: [],
        })),
      }],
      pptxSemantic: document,
    })
    const original = JSON.stringify(input)
    const originalTable = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])
      .tableDocument
    const unaffectedCell = structuredClone(originalTable.rows.at(-1).cells.at(-1))
    let latest = input

    function Harness() {
      const [presentation, setPresentation] = useState(input)
      const element = familyCompatibilityElement(
        presentation.pptxSemantic,
        presentation.slides[0].elements[0]
      )
      return <TableProperties element={element} onSemanticOperation={(operation) => {
        latest = applyPresentationProjectionOperation(presentation, operation)
        setPresentation(latest)
      }} />
    }

    render(<Harness />)
    const firstRun = screen.getByLabelText('Cell 1,1 paragraph 1 run 1')
    fireEvent.change(firstRun, { target: { value: 'edited rich cell' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    fireEvent.change(screen.getByLabelText('Merge column span'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected rectangle' }))
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].merge.gridSpan).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert native table row after selected cell' }))

    const effective = latest.slides[0].elements[0].tableDocument
    expect(effective.rows).toHaveLength(originalTable.rows.length + 1)
    expect(effective.rows[0].cells[0].textDocument.paragraphs[0].runs[0].text).toBe('edited rich cell')
    expect(effective.rows.at(-1).cells.at(-1)).toEqual(unaffectedCell)
    expect(latest.pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(latest.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(latest.slides[0].elements[1]).toEqual(input.slides[0].elements[1])
    expect(JSON.stringify(input)).toBe(original)
    expect(latest.pptxSemantic.instances.occurrence.overrides.components[effective.componentId]
      .familyOperations.commands.map(({ type }) => type)).toEqual([
      'replaceCellText', 'unmergeCell', 'mergeCells', 'unmergeCell', 'insertRow',
    ])
  })

  it('authors cell insets, fill color, and borders via UI while preserving unaffected cells', async () => {
    const document = (await familyDocumentsFixture()).table
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'occurrence', type: 'table', pptxInstanceId: 'occurrence', data: [] }],
      }],
      pptxSemantic: document,
    })
    let latest = input

    function Harness() {
      const [presentation, setPresentation] = useState(input)
      const element = familyCompatibilityElement(
        presentation.pptxSemantic,
        presentation.slides[0].elements[0]
      )
      return <TableProperties element={element} onSemanticOperation={(operation) => {
        latest = applyPresentationProjectionOperation(presentation, operation)
        setPresentation(latest)
      }} />
    }

    render(<Harness />)

    // Edit insets
    fireEvent.change(screen.getByLabelText('Cell left inset (EMU)'), { target: { value: '45720' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].properties.marginLeftEmu).toBe(45720)

    // Edit fill
    fireEvent.blur(screen.getByLabelText('Cell fill RGB'), { target: { value: '00AA88' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].properties.fill).toEqual({
      color: { kind: 'srgb', value: '00AA88' },
    })

    // Edit top border
    fireEvent.blur(screen.getByLabelText('Cell top border RGB'), { target: { value: 'FF0000' } })
    fireEvent.change(screen.getByLabelText('Cell top border width (EMU)'), { target: { value: '12700' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].properties.borders.top).toEqual(
      expect.objectContaining({
        color: { kind: 'srgb', value: 'FF0000' },
        width: 12700,
      })
    )

    // Unaffected cell remains intact
    const lastCell = latest.slides[0].elements[0].tableDocument.rows.at(-1).cells.at(-1)
    expect(lastCell.properties.marginLeftEmu).not.toBe(45720)
  })

  it('supports column insertion and deletion through structure controls', async () => {
    const document = (await familyDocumentsFixture()).table
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'occurrence', type: 'table', pptxInstanceId: 'occurrence', data: [] }],
      }],
      pptxSemantic: document,
    })
    let latest = input

    function Harness() {
      const [presentation, setPresentation] = useState(input)
      const element = familyCompatibilityElement(
        presentation.pptxSemantic,
        presentation.slides[0].elements[0]
      )
      return <TableProperties element={element} onSemanticOperation={(operation) => {
        latest = applyPresentationProjectionOperation(presentation, operation)
        setPresentation(latest)
      }} />
    }

    render(<Harness />)
    // Unmerge initially merged cells so column can be inserted without intersecting merge
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    const initialCols = latest.slides[0].elements[0].tableDocument.columns.length

    // Insert column
    fireEvent.click(screen.getByRole('button', { name: 'Insert native table column after selected cell' }))
    expect(latest.slides[0].elements[0].tableDocument.columns).toHaveLength(initialCols + 1)
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells).toHaveLength(initialCols + 1)

    // Delete column
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected native table column' }))
    expect(latest.slides[0].elements[0].tableDocument.columns).toHaveLength(initialCols)
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells).toHaveLength(initialCols)
  })

  it('displays alert on invalid merge in UI without mutating presentation', async () => {
    const document = (await familyDocumentsFixture()).table
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'occurrence', type: 'table', pptxInstanceId: 'occurrence', data: [] }],
      }],
      pptxSemantic: document,
    })
    const before = JSON.stringify(input)
    let latest = input

    function Harness() {
      const [presentation, setPresentation] = useState(input)
      const element = familyCompatibilityElement(
        presentation.pptxSemantic,
        presentation.slides[0].elements[0]
      )
      return <TableProperties element={element} onSemanticOperation={(operation) => {
        latest = applyPresentationProjectionOperation(presentation, operation)
        setPresentation(latest)
      }} />
    }

    render(<Harness />)

    // Set out-of-bounds column span
    fireEvent.change(screen.getByLabelText('Merge column span'), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected rectangle' }))

    // Alert should appear
    expect(screen.getByRole('alert')).toBeDefined()
    // Presentation must remain unchanged
    expect(JSON.stringify(latest)).toBe(before)
  })

  it('rejects overlapping and out-of-bounds merges without mutating the table', () => {
    const source = tableDocument()
    const merged = applyTableOperation(source, merge)
    const before = JSON.stringify(merged)
    for (const command of [
      merge,
      { ...merge, startRow: 2, rowSpan: 2 },
      { type: 'mergeCells', startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 4 },
    ]) {
      expect(() => applyTableOperation(merged, command)).toThrow(TypeError)
      expect(JSON.stringify(merged)).toBe(before)
    }
  })

  it('authors rich cell typography, alignment, bullets, and structural runs via UI while preserving untouched cells', async () => {
    const document = (await familyDocumentsFixture()).table
    document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: ['occurrence', 'sibling'].map((id) => ({
          id, type: 'table', pptxInstanceId: id, data: [],
        })),
      }],
      pptxSemantic: document,
    })
    let latest = input

    function Harness() {
      const [presentation, setPresentation] = useState(input)
      const element = familyCompatibilityElement(
        presentation.pptxSemantic,
        presentation.slides[0].elements[0]
      )
      return <TableProperties element={element} onSemanticOperation={(operation) => {
        latest = applyPresentationProjectionOperation(presentation, operation)
        setPresentation(latest)
      }} />
    }

    render(<Harness />)

    // Alignment
    fireEvent.change(screen.getByLabelText('Cell 1,1 paragraph 1 alignment'), { target: { value: 'ctr' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].properties.alignment).toBe('ctr')

    // Bullet
    fireEvent.change(screen.getByLabelText('Cell 1,1 paragraph 1 bullet'), { target: { value: 'character' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].properties.bullet).toEqual({
      kind: 'character', character: '•',
    })

    // Run font size
    fireEvent.change(screen.getByLabelText('Cell 1,1 paragraph 1 run 1 size (pt)'), { target: { value: '18.5' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[0].properties.fontSizePt).toBe(18.5)

    // Bold & Underline
    fireEvent.click(screen.getByLabelText('Cell 1,1 paragraph 1 run 1 bold'))
    fireEvent.click(screen.getByLabelText('Cell 1,1 paragraph 1 run 1 underline'))
    const run1Props = latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[0].properties
    expect(run1Props.bold).toBe(true)
    expect(run1Props.underline).toBe('sng')

    // Text RGB
    fireEvent.blur(screen.getByLabelText('Cell 1,1 paragraph 1 run 1 color RGB'), { target: { value: '112233' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[0].properties.color).toEqual({
      kind: 'srgb', value: '112233',
    })

    // Add text run to paragraph 1
    fireEvent.click(screen.getByRole('button', { name: 'Add text run to Cell 1,1 paragraph 1' }))
    const runsAfterAdd = latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs
    expect(runsAfterAdd.length).toBeGreaterThan(1)
    const newRun = runsAfterAdd.at(-1)
    expect(newRun.kind).toBe('text')
    expect(newRun.componentId).toContain('~authored:text:')

    // Edit new run's text
    const newRunTextarea = screen.getByLabelText(`Cell 1,1 paragraph 1 run ${runsAfterAdd.length}`)
    fireEvent.change(newRunTextarea, { target: { value: 'appended run' } })
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs.at(-1).text).toBe('appended run')

    // Add line break
    fireEvent.click(screen.getByRole('button', { name: 'Add line break to Cell 1,1 paragraph 1' }))
    const runsWithBreak = latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs
    expect(runsWithBreak.at(-1).kind).toBe('break')

    // Add paragraph to Cell 1,1
    fireEvent.click(screen.getByRole('button', { name: 'Add paragraph to Cell 1,1' }))
    const parasAfterAdd = latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs
    expect(parasAfterAdd).toHaveLength(2)
    expect(parasAfterAdd[1].componentId).toContain('~authored:paragraph:')

    // Delete the break run
    fireEvent.click(screen.getByRole('button', { name: `Delete Cell 1,1 paragraph 1 run ${runsWithBreak.length}` }))
    const finalRuns = latest.slides[0].elements[0].tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs
    expect(finalRuns.every((r) => r.kind !== 'break')).toBe(true)

    // Unaffected cell and sibling verification
    const otherCell = latest.slides[0].elements[0].tableDocument.rows.at(-1).cells.at(-1)
    expect(otherCell.textDocument.paragraphs[0].properties?.alignment).not.toBe('ctr')
    expect(latest.pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(latest.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
  })

  it('preserves displaced cell text and styling across merge and unmerge (displaced-cell undo)', () => {
    const source = normalizeTableDocument(tableDocument())
    const original01 = structuredClone(source.rows[0].cells[1])
    const original10 = structuredClone(source.rows[1].cells[0])
    const original11 = structuredClone(source.rows[1].cells[1])

    // Merge 2x2 at (0,0)
    const merged = applyTableOperation(source, merge)
    expect(merged.rows[0].cells[0].merge).toEqual({ gridSpan: 2, rowSpan: 2 })
    expect(merged.rows[0].cells[1].anchorCellId).toBe('cell00')
    expect(merged.rows[1].cells[0].anchorCellId).toBe('cell00')
    expect(merged.rows[1].cells[1].anchorCellId).toBe('cell00')

    // Covered cells retain their own rich text documents and properties intact
    expect(merged.rows[0].cells[1].textDocument).toEqual(original01.textDocument)
    expect(merged.rows[1].cells[0].textDocument).toEqual(original10.textDocument)
    expect(merged.rows[1].cells[1].textDocument).toEqual(original11.textDocument)

    // Edit the anchor cell while merged
    const editedAnchor = applyTableOperation(merged, {
      type: 'replaceCellText',
      cellId: 'cell00',
      textDocument: {
        ...merged.rows[0].cells[0].textDocument,
        paragraphs: [{
          ...merged.rows[0].cells[0].textDocument.paragraphs[0],
          runs: [{ ...merged.rows[0].cells[0].textDocument.paragraphs[0].runs[0], text: 'anchor modified' }],
        }],
      },
    })

    // Covered cells are still untouched after anchor text edit
    expect(editedAnchor.rows[0].cells[1].textDocument).toEqual(original01.textDocument)
    expect(editedAnchor.rows[1].cells[0].textDocument).toEqual(original10.textDocument)
    expect(editedAnchor.rows[1].cells[1].textDocument).toEqual(original11.textDocument)

    // Unmerge restores covered cells without destructive loss
    const unmerged = applyTableOperation(editedAnchor, { type: 'unmergeCell', cellId: 'cell00' })
    expect(unmerged.rows[0].cells[1]).toEqual(original01)
    expect(unmerged.rows[1].cells[0]).toEqual(original10)
    expect(unmerged.rows[1].cells[1]).toEqual(original11)
    expect(unmerged.rows[0].cells[0].textDocument.paragraphs[0].runs[0].text).toBe('anchor modified')
  })

  it('rejects locked table edits atomically in UI and projection operations', async () => {
    const document = (await familyDocumentsFixture()).table
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'occurrence', type: 'table', pptxInstanceId: 'occurrence', data: [] }],
      }],
      pptxSemantic: document,
    })
    const before = JSON.stringify(input)
    let dispatchCalled = false

    // 1. UI rejects when element is locked
    const { unmount } = render(
      <TableProperties
        element={{ ...familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0]), locked: true }}
        onSemanticOperation={() => { dispatchCalled = true }}
      />
    )
    const fieldset = screen.getByRole('group', { name: 'Native table properties' })
    expect(fieldset.disabled).toBe(true)
    expect(dispatchCalled).toBe(false)
    unmount()

    // 2. UI rejects when slideLocked is true
    render(
      <TableProperties
        element={familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])}
        slideLocked={true}
        onSemanticOperation={() => { dispatchCalled = true }}
      />
    )
    const fieldsetSlideLocked = screen.getByRole('group', { name: 'Native table properties' })
    expect(fieldsetSlideLocked.disabled).toBe(true)
    expect(dispatchCalled).toBe(false)

    // 3. Central projection rejects locked slide atomically
    const lockedSlidePres = structuredClone(input)
    lockedSlidePres.slides[0].locked = true
    expect(() => applyPresentationProjectionOperation(lockedSlidePres, {
      type: 'table.edit',
      instanceId: 'occurrence',
      componentId: Object.values(document.definitions)[0].content.tableDocument.componentId,
      command: { type: 'setRowHeight', rowId: Object.values(document.definitions)[0].content.tableDocument.rows[0].componentId, heightEmu: 999999 },
    })).toThrow()
    expect(JSON.stringify(input)).toBe(before)

    // 4. Central projection rejects locked element atomically
    const lockedElementPres = structuredClone(input)
    lockedElementPres.slides[0].elements[0].locked = true
    expect(() => applyPresentationProjectionOperation(lockedElementPres, {
      type: 'table.edit',
      instanceId: 'occurrence',
      componentId: Object.values(document.definitions)[0].content.tableDocument.componentId,
      command: { type: 'setRowHeight', rowId: Object.values(document.definitions)[0].content.tableDocument.rows[0].componentId, heightEmu: 999999 },
    })).toThrow()
    expect(JSON.stringify(input)).toBe(before)

    // 5. Central projection rejects locked occurrence override atomically
    const lockedOccurrencePres = structuredClone(input)
    lockedOccurrencePres.pptxSemantic.instances.occurrence.overrides.locked = true
    expect(() => applyPresentationProjectionOperation(lockedOccurrencePres, {
      type: 'table.edit',
      instanceId: 'occurrence',
      componentId: Object.values(document.definitions)[0].content.tableDocument.componentId,
      command: { type: 'setRowHeight', rowId: Object.values(document.definitions)[0].content.tableDocument.rows[0].componentId, heightEmu: 999999 },
    })).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  it('enforces stable authored component IDs and ownership boundaries, rejecting forged or moved IDs', () => {
    const source = normalizeTableDocument(tableDocument())
    const ledger = new Map()
    assertTableOccurrenceIdentity(source, source, ledger)

    // Valid authored structure command
    const validRow = createTableRowInsertion(source, 'row0', 'token-123')
    const applied = applyTableOperation(source, validRow)
    expect(() => assertTableOccurrenceIdentity(source, applied, ledger)).not.toThrow()

    // Forged row ID with wrong owner prefix
    const badRow = structuredClone(applied)
    badRow.rows[1].componentId = 'foreign-table~authored:row:bad'
    expect(() => assertTableOccurrenceIdentity(source, badRow, ledger)).toThrow(TypeError)

    // Forged cell ID with wrong parent prefix
    const badCell = structuredClone(applied)
    badCell.rows[1].cells[0].componentId = `${applied.componentId}~authored:cell:wrong-parent`
    expect(() => assertTableOccurrenceIdentity(source, badCell, ledger)).toThrow(TypeError)

    // Forged run ID with invalid token characters
    const badRun = structuredClone(applied)
    badRun.rows[1].cells[0].textDocument.paragraphs[0].runs[0].componentId =
      `${badRun.rows[1].cells[0].textDocument.componentId}~authored:text:bad/slashes`
    expect(() => assertTableOccurrenceIdentity(source, badRun, ledger)).toThrow(TypeError)

    // Reparenting authored component to another row
    const movedCell = structuredClone(applied)
    const capturedCell = movedCell.rows[1].cells.pop()
    movedCell.rows[2].cells.push(capturedCell)
    expect(() => assertTableOccurrenceIdentity(source, movedCell, ledger)).toThrow(TypeError)
  })

  it('inherits adjacent source cell dimensions and style properties upon row and column insertion', () => {
    const raw = tableDocument()
    raw.rows[0].cells[1].properties = {
      marginLeftEmu: 12345,
      fill: { color: { kind: 'srgb', value: 'ABCDEF' } },
      borders: { top: { width: 9525, color: { kind: 'srgb', value: '654321' } } },
    }
    const source = normalizeTableDocument(raw)

    // Insert row after row 0
    const rowInsertion = createTableRowInsertion(source, 'row0', 'style-inherit-row')
    expect(rowInsertion.row.heightEmu).toBe(source.rows[0].heightEmu)
    // Each cell in the inserted row inherits from source.rows[0].cells[index]
    expect(rowInsertion.row.cells[1].properties).toEqual(source.rows[0].cells[1].properties)
    expect(rowInsertion.row.cells[1].textDocument.paragraphs[0].defaultRunProperties).toEqual(
      expect.objectContaining({ fontSizePt: 12.34, bold: true })
    )

    // Exercise actual table row insertion behavior through table operation reducer
    const withRow = applyTableOperation(source, rowInsertion)
    expect(withRow.rows).toHaveLength(source.rows.length + 1)
    expect(withRow.rows[1].heightEmu).toBe(source.rows[0].heightEmu)
    expect(withRow.rows[1].cells[1].properties).toEqual(source.rows[0].cells[1].properties)
    expect(withRow.rows[1].cells[1].textDocument.paragraphs[0].defaultRunProperties).toEqual(
      expect.objectContaining({ fontSizePt: 12.34, bold: true })
    )
    const rowLedger = new Map()
    expect(() => assertTableOccurrenceIdentity(source, withRow, rowLedger)).not.toThrow()

    // Insert column after column 1
    const colInsertion = createTableColumnInsertion(source, 'col1', 'style-inherit-col')
    expect(colInsertion.column.widthEmu).toBe(source.columns[1].widthEmu)
    // The cell in row 0 inherits from row 0, column 1
    expect(colInsertion.cells[0].properties).toEqual(source.rows[0].cells[1].properties)
    expect(colInsertion.cells[0].textDocument.paragraphs[0].defaultRunProperties).toEqual(
      expect.objectContaining({ fontSizePt: 12.34, bold: true })
    )

    // Exercise actual table column insertion behavior through table operation reducer
    const withCol = applyTableOperation(source, colInsertion)
    expect(withCol.columns).toHaveLength(source.columns.length + 1)
    expect(withCol.columns[2].widthEmu).toBe(source.columns[1].widthEmu)
    expect(withCol.rows[0].cells[2].properties).toEqual(source.rows[0].cells[1].properties)
    expect(withCol.rows[0].cells[2].textDocument.paragraphs[0].defaultRunProperties).toEqual(
      expect.objectContaining({ fontSizePt: 12.34, bold: true })
    )
    const colLedger = new Map()
    expect(() => assertTableOccurrenceIdentity(source, withCol, colLedger)).not.toThrow()
  })

  it('validates equation runs inside table cells and enforces ownership across equation subtrees', () => {
    const raw = tableDocument()
    const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
    const eqRootId = 'cell00:eqRoot'
    const eqRunId = 'cell00:eqRun'
    const eqTextId = 'cell00:eqText'
    const nativeEqRun = {
      componentId: 'cell00:r:eq',
      kind: 'equation',
      ommlDocument: {
        schemaVersion: 1,
        root: {
          componentId: eqRootId,
          namespaceUri: M,
          type: 'oMath',
          attributes: [],
          children: [{
            componentId: eqRunId,
            namespaceUri: M,
            type: 'r',
            attributes: [],
            children: [{
              componentId: eqTextId,
              namespaceUri: M,
              type: 't',
              attributes: [],
              children: [],
              text: 'E',
            }],
          }],
        },
      },
    }
    raw.rows[0].cells[0].textDocument.paragraphs[0].runs.push(nativeEqRun)
    const source = normalizeTableDocument(raw)

    const textWithEq = structuredClone(source.rows[0].cells[0].textDocument)
    const eqRun = textWithEq.paragraphs[0].runs.find((r) => r.kind === 'equation')
    const authoredRunId = `${eqRootId}~authored:eqRun2`
    const authoredTextId = `${eqRootId}~authored:eqText2`
    eqRun.ommlDocument.root.children.push({
      componentId: authoredRunId,
      namespaceUri: M,
      type: 'r',
      attributes: [],
      children: [{
        componentId: authoredTextId,
        namespaceUri: M,
        type: 't',
        attributes: [],
        children: [],
        text: '=mc^2',
      }],
    })

    const withEq = applyTableOperation(source, {
      type: 'replaceCellText',
      cellId: 'cell00',
      textDocument: textWithEq,
    })
    expect(normalizeTableDocument(withEq)).toEqual(withEq)
    const targetRun = withEq.rows[0].cells[0].textDocument.paragraphs[0].runs.find((r) => r.kind === 'equation')
    expect(targetRun.ommlDocument.root.children).toHaveLength(2)
    expect(targetRun.ommlDocument.root.children[1].children[0].text).toBe('=mc^2')
    expect(withEq.rows[0].cells[1]).toEqual(source.rows[0].cells[1])
    expect(withEq.rows[1].cells[0]).toEqual(source.rows[1].cells[0])

    // Assert identity tracking
    const ledger = new Map()
    expect(() => assertTableOccurrenceIdentity(source, withEq, ledger)).not.toThrow()

    // Reject forged equation child identity not starting with equation root prefix
    const badEqTable = structuredClone(withEq)
    badEqTable.rows[0].cells[0].textDocument.paragraphs[0].runs.find((r) => r.kind === 'equation')
      .ommlDocument.root.children[1].componentId = 'foreign-root~authored:bad-eq-node'
    expect(() => assertTableOccurrenceIdentity(source, badEqTable, ledger)).toThrow(TypeError)

    // Reject forged equation text identity not starting with equation root prefix
    const badEqTextTable = structuredClone(withEq)
    badEqTextTable.rows[0].cells[0].textDocument.paragraphs[0].runs.find((r) => r.kind === 'equation')
      .ommlDocument.root.children[1].children[0].componentId = 'foreign-root~authored:bad-eq-text'
    expect(() => assertTableOccurrenceIdentity(source, badEqTextTable, ledger)).toThrow(TypeError)

    // Reject equation node ID collision with another cell component
    const collidingEqTable = structuredClone(withEq)
    collidingEqTable.rows[0].cells[0].textDocument.paragraphs[0].runs.find((r) => r.kind === 'equation')
      .ommlDocument.root.children[1].componentId = 'cell01'
    expect(() => normalizeTableDocument(collidingEqTable)).toThrow()
  })
})
