// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { arg, doc, node, options } from './omml-rendering-fixtures.js'

afterEach(cleanup)
const editorPath = '../../client/src/components/properties/native-omml-editor.jsx'
const operationsPath = '../../shared/src/pptx-omml-operations.js'
it('dispatches typed run and fraction insertion commands through the real reducer', async () => {
  const { default: Editor } = await import(/* @vite-ignore */ editorPath)
  const { default: operations } = await import(/* @vite-ignore */ operationsPath)
  const initial = doc(node('f', [arg('num', 'x'), arg('den', 'y')]))
  let current = initial
  const dispatch = vi.fn()
  function Harness() {
    const [document, setDocument] = useState(initial)
    return <Editor document={document} instanceId="occurrence" runtime={options}
      onSemanticOperation={(wrapper) => {
        dispatch(wrapper)
        current = operations.applyOmmlOperation(current, wrapper.command)
        setDocument(current)
      }} />
  }
  const { container } = render(<Harness />)
  const target = initial.root.children[0].children[0].children[0].children[0]
  fireEvent.click(screen.getByRole('button', { name: `Select t ${target.componentId}` }))
  fireEvent.change(screen.getByLabelText('Math run text'), { target: { value: 'alpha' } })
  expect(dispatch).toHaveBeenLastCalledWith({
    type: 'omml.edit', instanceId: 'occurrence', componentId: initial.root.componentId,
    command: { type: 'setText', componentId: target.componentId, text: 'alpha' },
  })
  expect(container.querySelector('svg').textContent).toContain('alpha')
  fireEvent.click(screen.getByRole('button', { name: `Select num ${initial.root.children[0].children[0].componentId}` }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert fraction' }))
  expect(current.root.children[0].children[0].children[1].type).toBe('f')
  expect(JSON.parse(JSON.stringify(current))).toEqual(current)
  expect(initial.root.children[0].children[0].children[0].children[0].text).toBe('x')
})

it('keeps unsupported rendering explicit and guards locked dispatch', async () => {
  const { default: Editor } = await import(/* @vite-ignore */ editorPath)
  const onSemanticOperation = vi.fn()
  const input = doc(node('f', [arg('num', 'x'), arg('den', 'y')]))
  render(<Editor document={input} instanceId="locked" locked onSemanticOperation={onSemanticOperation} />)
  expect(screen.getByRole('alert').textContent).toMatch(/font|runtime/i)
  fireEvent.click(screen.getByRole('button', { name: 'Insert fraction' }))
  expect(onSemanticOperation).not.toHaveBeenCalled()
})

it('shows reopened or undone source text instead of a stale successful input draft', async () => {
  const { default: Editor } = await import(/* @vite-ignore */ editorPath)
  const { default: operations } = await import(/* @vite-ignore */ operationsPath)
  const input = doc(node('f', [arg('num', 'x'), arg('den', 'y')]))
  const target = input.root.children[0].children[0].children[0].children[0]
  const onSemanticOperation = vi.fn()
  const props = { instanceId: 'occurrence', runtime: options, onSemanticOperation }
  const view = render(<Editor {...props} document={input} />)
  fireEvent.click(screen.getByRole('button', { name: `Select t ${target.componentId}` }))
  fireEvent.change(screen.getByLabelText('Math run text'), { target: { value: 'edited' } })
  const changed = operations.applyOmmlOperation(input, onSemanticOperation.mock.calls[0][0].command)
  view.rerender(<Editor {...props} document={changed} />)
  expect(screen.getByLabelText('Math run text').value).toBe('edited')
  view.rerender(<Editor {...props} document={input} />)
  expect(screen.getByLabelText('Math run text').value).toBe('x')
})

it('edits fraction presentation and matrix structure via typed UI controls', async () => {
  const { default: Editor } = await import(/* @vite-ignore */ editorPath)
  const { default: operations } = await import(/* @vite-ignore */ operationsPath)
  const initial = doc(
    node('f', [arg('num', 'a'), arg('den', 'b')]),
    node('m', [
      node('mr', [arg('e', '1'), arg('e', '2')]),
      node('mr', [arg('e', '3'), arg('e', '4')]),
    ])
  )
  let current = initial
  const dispatch = vi.fn()
  function Harness() {
    const [document, setDocument] = useState(initial)
    return <Editor document={document} instanceId="occurrence" runtime={options}
      onSemanticOperation={(wrapper) => {
        dispatch(wrapper)
        current = operations.applyOmmlOperation(current, wrapper.command)
        setDocument(current)
      }} />
  }
  render(<Harness />)
  const fraction = initial.root.children[0]
  fireEvent.click(screen.getByRole('button', { name: `Select f ${fraction.componentId}` }))
  const fractionSelect = screen.getByLabelText('Fraction presentation')
  fireEvent.change(fractionSelect, { target: { value: 'skw' } })
  expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
    type: 'omml.edit', instanceId: 'occurrence', componentId: initial.root.componentId,
    command: expect.objectContaining({ type: 'replace', componentId: fraction.componentId }),
  }))
  const matrix = initial.root.children[1]
  fireEvent.click(screen.getByRole('button', { name: `Select m ${matrix.componentId}` }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert matrix row after' }))
  expect(current.root.children[1].children.filter((c) => c.type === 'mr')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: 'Insert matrix column after' }))
  expect(current.root.children[1].children.filter((c) => c.type === 'mr')[0].children).toHaveLength(3)
})
