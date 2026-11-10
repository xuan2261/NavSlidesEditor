import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRequire } from 'node:module'
import { fixture } from '../../../../tests/pptx-semantic/smartart-layout-fixture.js'
import { NativeSmartArtEditor } from './native-smartart-editor.jsx'
const require = createRequire(import.meta.url)
const { applySmartArtOperation } = require('../../../../shared/src/pptx-smartart-operations')
const { evaluateSmartArtLayout } = require('../../../../shared/src/pptx-smartart-layout')
const bounds = { x: 0, y: 0, width: 200, height: 100 }
afterEach(cleanup)

describe('authored SmartArt layout controls', () => {
  it('publishes exact typed occurrence edits and displays refreshed evaluator values', async () => {
    const { document } = await fixture()
    const onSemanticOperation = vi.fn()
    function Editor() {
      const [effective, setEffective] = useState(document)
      return <NativeSmartArtEditor document={effective} instanceId="occurrence" bounds={bounds}
        onSemanticOperation={(operation) => {
          onSemanticOperation(operation)
          setEffective(applySmartArtOperation(effective, operation.command))
        }} />
    }
    render(<Editor />)
    const direction = document.layout.declarations.find((d) => d.type === 'param')
    fireEvent.change(screen.getByRole('combobox', { name: 'SmartArt layout value' }), { target: { value: 'fromR' } })
    expect(onSemanticOperation).toHaveBeenLastCalledWith({ type: 'smartart.edit', instanceId: 'occurrence',
      componentId: 'data', command: { type: 'layout', declarationId: direction.componentId, attribute: 'val', value: 'fromR' } })
    expect(screen.getByRole('combobox', { name: 'SmartArt layout value' }).value).toBe('fromR')
    const width = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'w')
    fireEvent.change(screen.getByRole('combobox', { name: 'SmartArt layout declaration' }), { target: { value: width.componentId } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'SmartArt layout factor' }), { target: { value: '0.25' } })
    const command = onSemanticOperation.mock.calls.at(-1)[0].command
    expect(command).toEqual({ type: 'layout', declarationId: width.componentId, attribute: 'fact', value: 0.25 })
    expect(evaluateSmartArtLayout(applySmartArtOperation(document, command), bounds).placements[0].width).toBe(50)
    expect(document.layout.declarations.find((d) => d.componentId === width.componentId).attributes.fact).toBe(0.2)
  })

  it('rejects an unevaluable direction atomically with the actual source diagnostic', async () => {
    const { document } = await fixture()
    const onSemanticOperation = vi.fn()
    render(<NativeSmartArtEditor document={document} instanceId="occurrence" bounds={bounds} onSemanticOperation={onSemanticOperation} />)
    // This authored horizontal algorithm has vertAlign, not the required horzAlign.
    fireEvent.change(screen.getByRole('combobox', { name: 'SmartArt layout value' }), { target: { value: 'fromT' } })
    expect(onSemanticOperation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('ppt/diagrams/layout.xml')
    expect(screen.getByRole('combobox', { name: 'SmartArt layout value' }).value).toBe('fromL')
  })

  it('rejects blank numeric values and disables locked layout controls', async () => {
    const { document } = await fixture()
    const onSemanticOperation = vi.fn()
    const view = render(<NativeSmartArtEditor document={document} instanceId="occurrence" bounds={bounds} onSemanticOperation={onSemanticOperation} />)
    const spacing = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'sp')
    fireEvent.change(screen.getByRole('combobox', { name: 'SmartArt layout declaration' }), { target: { value: spacing.componentId } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'SmartArt layout value' }), { target: { value: '' } })
    expect(onSemanticOperation).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('finite number')
    view.rerender(<NativeSmartArtEditor document={document} instanceId="occurrence" bounds={bounds} disabled onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'SmartArt layout value' }), { target: { value: '5' } })
    expect(onSemanticOperation).not.toHaveBeenCalled()
  })
})
