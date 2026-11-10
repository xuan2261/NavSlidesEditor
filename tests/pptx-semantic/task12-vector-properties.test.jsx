// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Task12VectorProperties from '../../client/src/components/properties/task12-vector-properties'
import primitiveCore from '../../shared/src/pptx-vector-primitives'
import svgOperations from '../../shared/src/pptx-svg-operations'

afterEach(cleanup)
const primitive = { kind: 'rect', parameters: { x: 1, y: 2, width: 20, height: 10 } }
function document() {
  const geometry = primitiveCore.primitiveGeometry({ schemaVersion: 1, kind: 'custom',
    componentId: 'geometry', width: 100, height: 50,
    paths: [{ componentId: 'draw-path', commands: [] }] }, primitive)
  return { schemaVersion: 1, componentId: 'root',
    source: { partUri: 'ppt/media/vector.svg', preconditionHash: 'a'.repeat(64), byteLength: 200, path: [0] },
    viewBox: { x: 0, y: 0, width: 100, height: 50 },
    paths: [{ componentId: 'rect', source: { partUri: 'ppt/media/vector.svg',
      preconditionHash: 'a'.repeat(64), path: [0, 0], ordinal: 0, element: 'rect' }, primitive, geometry }] }
}

describe('task12 typed SVG inspector', () => {
  it('dispatches source-bound primitive edits, explicit conversion, and canonical point edits', async () => {
    let current = document()
    const onSemanticOperation = vi.fn((operation) => {
      expect(operation).toMatchObject({ type: 'svg.edit', instanceId: 'instance', componentId: 'root' })
      current = svgOperations.applySvgOperation(current, operation.command)
    })
    const view = render(<Task12VectorProperties document={current} instanceId="instance" onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Vector width'), { target: { value: '42' } })
    fireEvent.blur(screen.getByLabelText('Vector width'))
    await waitFor(() => expect(current.paths[0].primitive.parameters.width).toBe(42))
    view.rerender(<Task12VectorProperties document={current} instanceId="instance" onSemanticOperation={onSemanticOperation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Convert primitive to editable path' }))
    await waitFor(() => expect(current.paths[0]).not.toHaveProperty('primitive'))
    view.rerender(<Task12VectorProperties document={current} instanceId="instance" onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Path command 1 point 1 x'), { target: { value: '7' } })
    fireEvent.blur(screen.getByLabelText('Path command 1 point 1 x'))
    await waitFor(() => expect(current.paths[0].geometry.paths[0].commands[0].points[0].x).toBe(7))
  })
  it('disables editing on locked targets and reports rejected operations', async () => {
    const onSemanticOperation = vi.fn().mockRejectedValue(new TypeError('Rejected width'))
    const view = render(<Task12VectorProperties document={document()} instanceId="instance" disabled onSemanticOperation={onSemanticOperation} />)
    expect(screen.getByLabelText('Vector width').disabled).toBe(true)
    expect(screen.getByRole('button').disabled).toBe(true)
    view.rerender(<Task12VectorProperties document={document()} instanceId="instance" onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Vector width'), { target: { value: '-5' } })
    fireEvent.blur(screen.getByLabelText('Vector width'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Rejected width'))
  })
  it('never carries an unfinished shared-component draft into a sibling occurrence', () => {
    const source = document()
    const onSemanticOperation = vi.fn()
    const view = render(<Task12VectorProperties document={source} instanceId="first" onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Vector width'), { target: { value: '42' } })
    view.rerender(<Task12VectorProperties document={source} instanceId="second" onSemanticOperation={onSemanticOperation} />)
    expect(screen.getByLabelText('Vector width').value).toBe('20')
    fireEvent.blur(screen.getByLabelText('Vector width'))
    expect(onSemanticOperation).not.toHaveBeenCalled()
  })
  it('clears occurrence-specific rejection when selecting a sibling', async () => {
    const source = document()
    const onSemanticOperation = vi.fn().mockRejectedValue(new TypeError('First occurrence is locked'))
    const view = render(<Task12VectorProperties document={source} instanceId="first" onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Vector width'), { target: { value: '42' } })
    fireEvent.blur(screen.getByLabelText('Vector width'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('First occurrence is locked'))
    view.rerender(<Task12VectorProperties document={source} instanceId="second" onSemanticOperation={onSemanticOperation} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Vector width').value).toBe('20')
  })
})
