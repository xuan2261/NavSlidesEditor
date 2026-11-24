// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConnectorProperties from '../../client/src/components/properties/connector-properties.jsx'
import operations from '../../shared/src/pptx-projection-operation.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import { linkedConnectorFixture } from './geometry-style-connector-fixture.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

afterEach(cleanup)
it('exposes the visible inherited provider target and site through actual detach and reattach commands', () => {
  const initial = geometryProjectionFixture()
  initial.pptxSemantic = linkedConnectorFixture()
  initial.slides[0].elements.push({
    id: 'connector',
    pptxInstanceId: 'connector',
    type: 'shape',
    shape: 'rect',
  })
  let current
  function Harness() {
    const [deck, setDeck] = useState(initial)
    useLayoutEffect(() => {
      current = deck
    }, [deck])
    return (
      <ConnectorProperties
        instance={deck.pptxSemantic.instances.connector}
        definition={deck.pptxSemantic.definitions.connectorSource}
        document={deck.pptxSemantic}
        editable
        submit={(command) =>
          setDeck((previous) =>
            operations.applyPresentationProjectionOperation(previous, {
              type: 'geometry.edit',
              instanceId: 'connector',
              componentId: 'connectorGeometry',
              command,
            })
          )
        }
      />
    )
  }
  render(<Harness />)
  expect(
    Array.from(screen.getByLabelText('Connector start target').options).map(
      (option) => option.value
    )
  ).toContain('i1')
  expect(screen.getByLabelText('Connector start site').options).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Detach connector start' }))
  expect(current.pptxSemantic.instances.connector.connectorBindings.start).toBeNull()
  fireEvent.change(screen.getByLabelText('Connector start target'), { target: { value: 'i1' } })
  expect(current.pptxSemantic.instances.connector.connectorBindings.start).toEqual({
    targetInstanceId: 'i1',
    index: 0,
  })
  expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
})
it('omits a target from another protected original host even on the same project slide', () => {
  const input = linkedConnectorFixture()
  input.instances.i2.slideId = 's1'
  const document = semantic.normalizePptxSemanticDocument(input)
  render(
    <ConnectorProperties
      instance={document.instances.connector}
      definition={document.definitions.connectorSource}
      document={document}
      editable={false}
      submit={() => {
        throw new Error('Readonly target edit')
      }}
    />
  )
  const target = screen.getByLabelText('Connector start target')
  expect(target.disabled).toBe(true)
  expect(Array.from(target.options).map((option) => option.value)).not.toContain('i2')
  expect(screen.getByLabelText('Connector start site').disabled).toBe(true)
})
