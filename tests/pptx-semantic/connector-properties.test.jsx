// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GeometryProperties from '../../client/src/components/properties/geometry-properties'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import operations from '../../shared/src/pptx-projection-operation'

afterEach(cleanup)
it('requires explicit detach before coordinate edits and reattaches an occurrence through target/site controls', () => {
  const initial = geometryProjectionFixture()
  const line = initial.pptxSemantic.definitions.definition
  const target = structuredClone(line)
  target.id = 'target'
  target.source.nativeId = '3'
  target.content.geometry.connections = [
    { componentId: 'site', angle: 0, position: { x: 'w', y: 'h' } },
  ]
  initial.pptxSemantic.definitions.target = target
  line.content.geometry.paths[0].commands = [
    { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
    { kind: 'lnTo', points: [{ componentId: 'end', x: 'w', y: 'h' }] },
  ]
  line.content.geometry.connector = {
    start: {
      shapeId: '3',
      index: 0,
      targetDefinitionId: 'target',
      componentId: 'binding',
    },
  }
  line.components.push({
    id: 'binding',
    kind: 'connection',
    locator: { path: [0, 0, 5], preconditionHash: 'a'.repeat(64) },
  })
  for (const [offset, id] of ['i1', 'i2'].entries()) {
    const instance = initial.pptxSemantic.instances[id]
    const targetId = `target${offset}`
    initial.pptxSemantic.instances[targetId] = {
      ...structuredClone(instance),
      id: targetId,
      definitionId: 'target',
      localTransform: [1, 0, 0, 1, 0, 0],
    }
    instance.connectorBindings = { start: { targetInstanceId: targetId, index: 0 }, end: null }
    initial.slides[offset].elements.push({
      ...structuredClone(initial.slides[offset].elements[0]),
      id: targetId,
      pptxInstanceId: targetId,
    })
  }
  let current
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return (
      <GeometryProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={['i1']}
        onUpdate={(patch) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, patch.pptxProjectionOperation)
          )
        }
      />
    )
  }
  render(<Harness />)
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Detach connector start' }))
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(false)
  expect(current.pptxSemantic.instances.i1.connectorBindings.start).toBeNull()
  const originalSecond = structuredClone(initial.pptxSemantic.instances.i2)
  fireEvent.change(screen.getByLabelText('Connector start target'), {
    target: { value: 'target0' },
  })
  expect(current.pptxSemantic.instances.i1.connectorBindings.start).toEqual({
    targetInstanceId: 'target0',
    index: 0,
  })
  expect(screen.getByLabelText('Geometry point X').disabled).toBe(true)
  expect(current.pptxSemantic.instances.i2).toEqual(originalSecond)
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
})
