// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TableProperties from '../../client/src/components/properties/table-properties'
import { TableRenderer } from '../../client/src/components/canvas/element-renderers/table-element-renderer'
import { PptxSourceFontContext } from '../../client/src/contexts/pptx-source-font-context'
import { options } from './semantic-table-renderer-fixtures'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation'
import { importTableFixture, tableFrame } from './table-import-fixture'

afterEach(cleanup)
const fill = { color: { kind: 'srgb', value: 'ABCDEF' } }
const border = { color: { kind: 'srgb', value: '123456' }, width: 19050 }
async function fixture() {
  const graphic = tableFrame().replace('<a:tcPr/>',
    '<a:tcPr marL="91440" marT="45720"><a:lnB w="9525"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:lnB><a:solidFill><a:srgbClr val="A1B2C3"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:tcPr>')
    .replace('</a:p>', '<a:br/><a:fld id="{12345678-1234-5678-9ABC-123456789ABC}" type="slidenum"><a:t>7</a:t></a:fld></a:p>')
  const imported = await importTableFixture({ graphic })
  const presentation = JSON.parse(JSON.stringify(imported.presentation))
  const element = presentation.slides[0].elements[0]
  const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
  presentation.pptxSemantic.instances.sibling = { ...instance, id: 'sibling' }
  presentation.slides[0].elements.push({ ...element, id: 'sibling', pptxInstanceId: 'sibling' })
  return normalizeSemanticPresentation(presentation)
}

describe('source-bound table cell property authoring', () => {
  it('production renderer consumes the shared provider and respects an explicit runtime override', async () => {
    const input = await fixture()
    const element = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])
    const shared = options(), explicit = options()
    const dispose = vi.fn()
    shared.dispose = dispose
    const { rerender, unmount } = render(<PptxSourceFontContext.Provider value={{
      status: 'ready', fontRuntime: shared, issues: [], sourceIdentity: 'source',
    }}><TableRenderer element={element} /></PptxSourceFontContext.Provider>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Merged &', { exact: false })).toBeTruthy()
    rerender(<PptxSourceFontContext.Provider value={{
      status: 'unavailable', fontRuntime: null, issues: [],
    }}><TableRenderer element={element} tableRuntime={explicit} /></PptxSourceFontContext.Provider>)
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()
    expect(dispose).not.toHaveBeenCalled()
  })
  it('patches only selected declarations through the actual presentation journal and reopens', async () => {
    const input = await fixture(), before = JSON.stringify(input)
    const element = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])
    const source = element.tableDocument, cell = source.rows[0].cells[0]
    const edited = applyPresentationProjectionOperation(input, {
      type: 'table.edit', instanceId: element.pptxInstanceId, componentId: source.componentId,
      command: { type: 'setCellProperties', cellId: cell.componentId,
        properties: { fill, marginLeftEmu: 19050, borders: { top: border } } },
    })
    const effective = edited.slides[0].elements[0].tableDocument
    expect(effective.rows[0].cells[0].properties).toEqual({
      ...cell.properties, fill, marginLeftEmu: 19050,
      borders: { ...cell.properties.borders, top: border },
    })
    expect(effective.rows[0].cells[0].textDocument).toEqual(cell.textDocument)
    expect(cell.textDocument.paragraphs[0].runs.map((run) => run.kind))
      .toEqual(['text', 'text', 'break', 'field'])
    expect(effective.rows[0].cells[1]).toEqual(source.rows[0].cells[1])
    expect(effective.columns).toEqual(source.columns)
    expect(effective.rows.map((row) => row.heightEmu)).toEqual(source.rows.map((row) => row.heightEmu))
    expect(edited.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(edited.pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(edited.slides[0].elements[1]).toEqual(input.slides[0].elements[1])
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(edited)))).toEqual(edited)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('focus and blur preserve original alpha transforms and never dispatch for unchanged RGB', async () => {
    const input = await fixture(), onSemanticOperation = vi.fn()
    const element = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])
    render(<TableProperties element={element} onSemanticOperation={onSemanticOperation} />)
    fireEvent.focus(screen.getByLabelText('Cell fill RGB'))
    fireEvent.blur(screen.getByLabelText('Cell fill RGB'))
    fireEvent.focus(screen.getByLabelText('Cell top border RGB'))
    fireEvent.blur(screen.getByLabelText('Cell top border RGB'))
    expect(onSemanticOperation).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(element.tableDocument.rows[0].cells[0].properties.fill.color.transforms)
      .toEqual([{ kind: 'alpha', value: 50000 }])
  })
  it('production properties dispatch cell fill, border and inset edits without flattening rich cells', async () => {
    const input = await fixture()
    let latest = input
    function Harness() {
      const [presentation, setPresentation] = useState(input)
      return <TableProperties element={familyCompatibilityElement(
        presentation.pptxSemantic, presentation.slides[0].elements[0])}
        onSemanticOperation={(operation) => {
          latest = applyPresentationProjectionOperation(presentation, operation)
          setPresentation(latest)
        }} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Cell left inset (EMU)'), { target: { value: '19050' } })
    fireEvent.change(screen.getByLabelText('Cell fill RGB'), { target: { value: 'ABCDEF' } })
    fireEvent.blur(screen.getByLabelText('Cell fill RGB'))
    fireEvent.change(screen.getByLabelText('Cell top border RGB'), { target: { value: '123456' } })
    fireEvent.blur(screen.getByLabelText('Cell top border RGB'))
    fireEvent.change(screen.getByLabelText('Cell top border width (EMU)'), { target: { value: '19050' } })
    expect(screen.queryByRole('alert')).toBeNull()
    const cell = latest.slides[0].elements[0].tableDocument.rows[0].cells[0]
    expect(cell.properties).toMatchObject({ fill, marginLeftEmu: 19050, borders: { top: border } })
    expect(cell.textDocument).toEqual(Object.values(input.pptxSemantic.definitions)[0]
      .content.tableDocument.rows[0].cells[0].textDocument)
    fireEvent.click(screen.getByRole('button', { name: 'Remove cell fill' }))
    expect(latest.slides[0].elements[0].tableDocument.rows[0].cells[0].properties.fill)
      .toEqual({ color: { kind: 'none' } })
  })
  it('rejects covered targets, invalid declarations and foreign properties atomically', async () => {
    const input = await fixture()
    const source = Object.values(input.pptxSemantic.definitions)[0].content.tableDocument
    const before = JSON.stringify(source)
    for (const command of [
      { cellId: source.rows[0].cells[1].componentId, properties: { fill } },
      { cellId: source.rows[0].cells[0].componentId, properties: { marginLeftEmu: -1 } },
      { cellId: source.rows[0].cells[0].componentId, properties: { fill: { color: { kind: 'srgb', value: 'oops' } } } },
      { cellId: source.rows[0].cells[0].componentId, properties: { textDocument: {} } },
    ]) expect(() => applyTableOperation(source, { type: 'setCellProperties', ...command })).toThrow()
    expect(JSON.stringify(source)).toBe(before)
  })
})
