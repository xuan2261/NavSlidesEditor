// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GeometryPointHandles from '../../client/src/components/canvas/element-renderers/geometry-point-handles'

afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-point-test-source]').forEach((node) => node.remove())
})

function fixture(matrix, bound = false) {
  const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  source.setAttribute('data-point-test-source', '')
  source.getScreenCTM = () => matrix
  document.body.appendChild(source)
  const geometry = {
    schemaVersion: 1,
    componentId: 'hitGeometry',
    kind: 'custom',
    width: 1000,
    height: 800,
    paths: [
      {
        componentId: 'hitPath',
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
          {
            kind: 'cubicBezTo',
            points: [
              { componentId: 'control1', x: 200, y: 20 },
              { componentId: 'control2', x: 300, y: 60 },
              { componentId: 'end', x: 1000, y: 800 },
            ],
          },
        ],
      },
    ],
  }
  if (bound)
    geometry.connector = {
      start: { shapeId: '2', index: 0, componentId: 'startBinding', targetDefinitionId: 'target' },
    }
  const before = structuredClone(geometry)
  const update = vi.fn()
  const preview = vi.fn()
  render(
    <GeometryPointHandles
      element={{
        id: 'shape',
        pptxInstanceId: 'shape',
        width: 125,
        height: 100,
        ...(bound ? { pptxConnectorBindings: { start: { targetInstanceId: 'target' } } } : {}),
      }}
      geometry={geometry}
      sourceSvg={source}
      onUpdateElement={update}
      onPreview={preview}
    />
  )
  const receiver = screen.getByLabelText('Move geometry point 3')
  receiver.setPointerCapture = vi.fn()
  receiver.hasPointerCapture = () => true
  receiver.releasePointerCapture = vi.fn()
  return { receiver, geometry, before, update, preview }
}

function pointer(target, type, x, y) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: 'touch' },
  })
  fireEvent(target, event)
}

it.each([
  ['scaled', { a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 200 }, 112.5, 201.25, 248, 84],
  ['rotated', { a: 0, b: 0.5, c: -0.5, d: 0, e: 100, f: 200 }, 98.75, 212.5, 264, -28],
  ['stretched', { a: 0.5, b: 0, c: 0, d: 2, e: 100, f: 200 }, 112.5, 205, 248, 36],
])(
  'drags and focuses the nearest painted point through an overlapping %s hit',
  (_, matrix, x, y, nextX, nextY) => {
    const { receiver, geometry, before, update, preview } = fixture(matrix)
    pointer(receiver, 'pointerdown', x, y)
    expect(document.activeElement).toBe(screen.getByLabelText('Move geometry point 2'))
    pointer(receiver, 'pointermove', x + 3, y + 4)
    expect(update).not.toHaveBeenCalled()
    pointer(receiver, 'pointerup', x + 3, y + 4)
    expect(update).toHaveBeenCalledExactlyOnceWith('shape', {
      pptxProjectionOperation: {
        type: 'geometry.edit',
        instanceId: 'shape',
        componentId: 'hitGeometry',
        command: { type: 'control-point', componentId: 'control1', x: nextX, y: nextY },
      },
    })
    expect(preview).toHaveBeenLastCalledWith(null)
    expect(geometry).toEqual(before)
  }
)

it('does not move a bound point through an overlapping editable hit', () => {
  const { receiver, geometry, before, update, preview } = fixture(
    { a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 200 },
    true
  )
  pointer(receiver, 'pointerdown', 100, 200)
  pointer(receiver, 'pointermove', 103, 204)
  pointer(receiver, 'pointerup', 103, 204)
  expect(update).not.toHaveBeenCalled()
  expect(preview).not.toHaveBeenCalled()
  expect(geometry).toEqual(before)
})

it('keeps keyboard editing on the explicitly focused point', () => {
  const { receiver, update } = fixture({ a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 200 })
  receiver.focus()
  fireEvent.keyDown(receiver, { key: 'ArrowRight' })
  expect(update).toHaveBeenCalledExactlyOnceWith('shape', {
    pptxProjectionOperation: {
      type: 'geometry.edit',
      instanceId: 'shape',
      componentId: 'hitGeometry',
      command: { type: 'control-point', componentId: 'control2', x: 308 },
    },
  })
})
