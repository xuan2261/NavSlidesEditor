import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRequire } from 'node:module'
import { fixture } from '../../../../tests/pptx-semantic/smartart-layout-fixture.js'
const require = createRequire(import.meta.url)
const { applySmartArtOperation } = require('../../../../shared/src/pptx-smartart-operations')
const bounds = { x: 0, y: 0, width: 200, height: 100 }
afterEach(cleanup)

describe('production SmartArt semantic surface', () => {
  it('renders evaluated source positions and requires actual source paint/text rendering', async () => {
    const { NativeSmartArtRenderer } = await import('./native-smartart-renderer.jsx')
    const { document } = await fixture()
    const renderNode = vi.fn(({ point }) => <span>{point.componentId}</span>)
    const { container } = render(<NativeSmartArtRenderer document={document} bounds={bounds} renderNode={renderNode} />)
    const nodes = container.querySelectorAll('[data-smartart-point]')
    expect(nodes).toHaveLength(3)
    expect(nodes[1].style.left).toBe('25%')
    expect(nodes[1].style.width).toBe('20%')
    expect(renderNode).toHaveBeenCalledTimes(3)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
  it('emits typed occurrence commands and never writes document payloads', async () => {
    const { NativeSmartArtEditor } = await import('./native-smartart-editor.jsx')
    const { document } = await fixture()
    const onSemanticOperation = vi.fn()
    render(<NativeSmartArtEditor document={document} instanceId="occurrence" bounds={bounds} onSemanticOperation={onSemanticOperation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(onSemanticOperation).toHaveBeenCalledTimes(1)
    const operation = onSemanticOperation.mock.calls[0][0]
    expect(operation).toMatchObject({ type: 'smartart.edit', instanceId: 'occurrence',
      componentId: 'data', command: { type: 'add' } })
    expect(operation.command.point.componentId).toMatch(/^data~authored:/)
    expect(applySmartArtOperation(document, operation.command).points).toHaveLength(5)
    expect(document.points).toHaveLength(4)
  })
  it('edits each rich label run without dropping fields or styling', async () => {
    const { NativeSmartArtEditor } = await import('./native-smartart-editor.jsx')
    const { document } = await fixture()
    const d = JSON.parse(JSON.stringify(document))
    d.points[1].textDocument = { schemaVersion: 1, componentId: 'body', paragraphs: [
      { componentId: 'para', runs: [
        { componentId: 'run', kind: 'text', text: 'Before', properties: { bold: true } },
        { componentId: 'field', kind: 'field', text: '2', field: { id: 'f', type: 'slidenum' } },
      ] },
    ] }
    const onSemanticOperation = vi.fn()
    render(<NativeSmartArtEditor document={d} instanceId="i" bounds={bounds} onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Label run run' }), { target: { value: 'After' } })
    const command = onSemanticOperation.mock.calls[0][0].command
    expect(command.textDocument.paragraphs[0].runs).toEqual([
      { componentId: 'run', kind: 'text', text: 'After', properties: { bold: true } },
      { componentId: 'field', kind: 'field', text: '2', field: { id: 'f', type: 'slidenum' } },
    ])
  })
  it('disables locked edits and displays located unsupported programs instead of substitute geometry', async () => {
    const { NativeSmartArtEditor } = await import('./native-smartart-editor.jsx')
    const { NativeSmartArtRenderer } = await import('./native-smartart-renderer.jsx')
    const { document } = await fixture()
    const onSemanticOperation = vi.fn()
    const view = render(<NativeSmartArtEditor document={document} instanceId="i" bounds={bounds}
      disabled onSemanticOperation={onSemanticOperation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(onSemanticOperation).not.toHaveBeenCalled()
    view.unmount()
    const d = JSON.parse(JSON.stringify(document))
    d.layout.declarations.find((decl) => decl.type === 'alg').attributes.type = 'cycle'
    const { container } = render(<NativeSmartArtRenderer document={d} bounds={bounds} />)
    expect(screen.getByRole('alert').textContent).toContain('ppt/diagrams/layout.xml')
    expect(container.querySelectorAll('[data-smartart-point]')).toHaveLength(0)
  })
})
