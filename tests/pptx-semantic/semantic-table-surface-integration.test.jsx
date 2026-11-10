// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TableProperties from '../../client/src/components/properties/table-properties'
import { familyDocumentsFixture } from './family-documents-fixture'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation'

afterEach(cleanup)
describe('native table controls with actual presentation reducer', () => {
  it('derives rich table updates from typed journals while preserving source and sibling occurrences', async () => {
    const document = (await familyDocumentsFixture()).table
    document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
    const input = normalizeSemanticPresentation({
      slides: [
        {
          id: 's1',
          elements: ['occurrence', 'sibling'].map((id) => ({
            id,
            type: 'table',
            pptxInstanceId: id,
            data: [],
          })),
        },
      ],
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
      return (
        <TableProperties
          element={element}
          onSemanticOperation={(operation) => {
            latest = applyPresentationProjectionOperation(presentation, operation)
            setPresentation(latest)
          }}
        />
      )
    }
    render(<Harness />)
    const sourceCell = Object.values(document.definitions)[0].content.tableDocument.rows[0].cells[0]
    fireEvent.change(screen.getByLabelText('Cell 1,1 paragraph 1 run 1'), {
      target: { value: 'rich source-preserving edit' },
    })
    expect(screen.queryByRole('alert')?.textContent).toBeUndefined()
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').value).toBe(
      'rich source-preserving edit'
    )
    fireEvent.change(screen.getByLabelText('Row 1 height (EMU)'), { target: { value: '190500' } })
    expect(screen.getByLabelText('Row 1 height (EMU)').value).toBe('190500')
    expect(latest.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(latest.pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(latest.slides[0].elements[1]).toEqual(input.slides[0].elements[1])
    const effective = latest.slides[0].elements[0].tableDocument
    expect(effective.rows[0].cells[0].textDocument.paragraphs[0].runs[0]).toEqual({
      ...sourceCell.textDocument.paragraphs[0].runs[0],
      text: 'rich source-preserving edit',
    })
    expect(JSON.stringify(input)).toBe(before)
    expect(
      latest.pptxSemantic.instances.occurrence.overrides.components[effective.componentId]
        .familyOperations.commands
    ).toHaveLength(2)
  })
})
