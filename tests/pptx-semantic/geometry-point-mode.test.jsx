// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CanvasElement from '../../client/src/components/canvas/canvas-element-wrapper'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { useEditorStore } from '../../client/src/stores/editor-store'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { linkedCurveConnectorFixture } from './geometry-style-connector-fixture'
import tree from '../../shared/src/pptx-semantic-render-tree'

const originalMatrix = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'getScreenCTM')
beforeEach(() => {
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })
})
afterEach(() => {
  cleanup()
  useEditorStore.setState({ selectedElementIds: [], geometryPointEditingElementId: null })
  if (originalMatrix) Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', originalMatrix)
  else delete SVGSVGElement.prototype.getScreenCTM
})

it('gives endpoint hits to explicit point mode and restores resize ownership when leaving it', () => {
  const deck = geometryProjectionFixture()
  const element = tree.semanticRenderTree(deck.pptxSemantic, deck.slides[0])[0].element
  const update = vi.fn()
  const before = JSON.stringify(deck)
  useEditorStore.getState().setSelectedElementIds([element.id])
  render(
    <>
      <GeometryProperties
        element={element}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={[element.id]}
        onUpdate={update}
      />
      <CanvasElement
        element={element}
        isSelected
        selectedElementCount={1}
        onUpdateElement={update}
        onPointerDown={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        iconPaths={{}}
      />
    </>
  )
  expect(screen.queryByLabelText('Move geometry point 1')).toBeNull()
  expect(screen.getByTestId('resize-handle-nw')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Edit geometry points' }))
  const point = screen.getByLabelText('Move geometry point 1')
  expect(point).toBeTruthy()
  expect(point.closest('[data-element-id]')).toBeNull()
  expect(point.closest('svg[data-geometry-overlay]')).not.toBeNull()
  expect(screen.queryByTestId('resize-handle-nw')).toBeNull()
  expect(screen.queryByTestId('rotation-handle')).toBeNull()
  expect(update).not.toHaveBeenCalled()
  expect(JSON.stringify(deck)).toBe(before)
  act(() => useEditorStore.getState().clearSelection())
  expect(screen.queryByLabelText('Move geometry point 1')).toBeNull()
  expect(screen.getByTestId('resize-handle-nw')).toBeTruthy()
})

it('keeps curve controls editable while inspector and keyboard block only bound endpoints', () => {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = linkedCurveConnectorFixture()
  deck.slides[0].elements.push({
    id: 'connector',
    pptxInstanceId: 'connector',
    type: 'shape',
    shape: 'rect',
  })
  const element = tree
    .semanticRenderTree(deck.pptxSemantic, deck.slides[0])
    .find((entry) => entry.instanceId === 'connector').element
  const update = vi.fn()
  const before = structuredClone(deck)
  useEditorStore.getState().setSelectedElementIds([element.id])
  render(
    <>
      <GeometryProperties
        element={element}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={[element.id]}
        onUpdate={update}
      />
      <CanvasElement
        element={element}
        isSelected
        selectedElementCount={1}
        onUpdateElement={update}
        onPointerDown={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        iconPaths={{}}
      />
    </>
  )
  fireEvent.change(screen.getByLabelText('Geometry point'), {
    target: { value: 'curveControl1' },
  })
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(false)
  fireEvent.change(screen.getByLabelText('Geometry point'), {
    target: { value: 'connectorEnd' },
  })
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Edit geometry points' }))
  const control = screen.getByLabelText('Move geometry point 2')
  expect(control.getAttribute('aria-disabled')).toBe('false')
  fireEvent.keyDown(control, { key: 'ArrowRight' })
  expect(update).toHaveBeenCalledWith(element.id, {
    pptxProjectionOperation: {
      type: 'geometry.edit',
      instanceId: 'connector',
      componentId: 'connectorGeometry',
      command: { type: 'control-point', componentId: 'curveControl1', x: expect.any(Number) },
    },
  })
  update.mockClear()
  const end = screen.getByLabelText('Attached geometry point 4')
  expect(end.getAttribute('aria-disabled')).toBe('true')
  fireEvent.keyDown(end, { key: 'ArrowRight' })
  expect(update).not.toHaveBeenCalled()
  expect(deck).toEqual(before)
})

it('disables attachment on an unsupported detached route without disabling its point editor', () => {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = linkedCurveConnectorFixture()
  deck.pptxSemantic.definitions.connectorSource.content.geometry.paths[0].commands.push({
    kind: 'close',
  })
  deck.pptxSemantic.instances.connector.connectorBindings = { start: null, end: null }
  deck.slides[0].elements.push({
    id: 'connector',
    pptxInstanceId: 'connector',
    type: 'shape',
    shape: 'rect',
  })
  const element = tree
    .semanticRenderTree(deck.pptxSemantic, deck.slides[0])
    .find((entry) => entry.instanceId === 'connector').element
  const update = vi.fn()
  render(
    <GeometryProperties
      element={element}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={[element.id]}
      onUpdate={update}
    />
  )
  expect(screen.getByLabelText('Connector start target').disabled).toBe(true)
  expect(screen.getByLabelText('Connector end target').disabled).toBe(true)
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(false)
  expect(screen.getByRole('button', { name: 'Edit geometry points' }).disabled).toBe(false)
  expect(update).not.toHaveBeenCalled()
})
