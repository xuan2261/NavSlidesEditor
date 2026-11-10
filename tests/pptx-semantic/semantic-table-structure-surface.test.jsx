// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TableProperties from '../../client/src/components/properties/table-properties'
import { familyDocumentsFixture } from './family-documents-fixture'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations'
import { applyPresentationProjectionOperation as apply } from '../../shared/src/pptx-projection-operation'
import { normalizeSemanticPresentation as reopen } from '../../shared/src/pptx-semantic-presentation'

afterEach(cleanup)
async function harness({ locked = false } = {}) {
  const document = (await familyDocumentsFixture()).table
  document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
  const input = reopen({ pptxSemantic: document, slides: [{ id: 's1', elements:
    ['occurrence', 'sibling'].map((id) => ({ id, type: 'table', pptxInstanceId: id })) }] })
  let latest = input
  function Harness() {
    const [presentation, setPresentation] = useState(input)
    const element = familyCompatibilityElement(presentation.pptxSemantic, presentation.slides[0].elements[0])
    return <TableProperties element={{ ...element, locked }} onSemanticOperation={(operation) => {
      latest = reopen(JSON.parse(JSON.stringify(apply(presentation, operation))))
      setPresentation(latest)
    }} />
  }
  render(<Harness />)
  return { input, current: () => latest }
}

describe('reachable native table structure controls', () => {
  it('inserts and deletes selected rows/columns through real commands and reopened state', async () => {
    const { input, current } = await harness()
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert native table row after selected cell' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(current().slides[0].elements[0].tableDocument.rows).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Insert native table column after selected cell' }))
    expect(screen.queryByRole('alert')).toBeNull()
    const table = current().slides[0].elements[0].tableDocument
    expect(table.columns).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Selected native table cell'), {
      target: { value: table.rows[1].cells[1].componentId },
    })
    fireEvent.change(screen.getByLabelText('Cell 2,2 paragraph 1 run 1'), {
      target: { value: 'Structure survives reopening' },
    })
    expect(current().slides[0].elements[0].data[1][1]).toBe('Structure survives reopening')
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected native table row' }))
    fireEvent.change(screen.getByLabelText('Selected native table cell'), {
      target: { value: current().slides[0].elements[0].tableDocument.rows[0].cells[1].componentId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected native table column' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(current().slides[0].elements[0].tableDocument.rows).toHaveLength(2)
    expect(current().slides[0].elements[0].tableDocument.columns).toHaveLength(2)
    expect(current().pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(current().pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(current().slides[0].elements[1]).toEqual(input.slides[0].elements[1])
  })

  it('reports merge boundary errors and disables locked structural operations', async () => {
    const { input, current } = await harness()
    fireEvent.click(screen.getByRole('button', { name: 'Insert native table column after selected cell' }))
    expect(screen.getByRole('alert').textContent).toContain('merge')
    expect(current()).toEqual(input)
    cleanup()
    await harness({ locked: true })
    for (const name of ['Insert native table row after selected cell',
      'Insert native table column after selected cell', 'Delete selected native table row',
      'Delete selected native table column']) {
      expect(screen.getByRole('button', { name }).matches(':disabled')).toBe(true)
    }
  })
})
