// @vitest-environment jsdom
import React, { useLayoutEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GeometryProperties from '../../client/src/components/properties/geometry-properties.jsx'
import operations from '../../shared/src/pptx-projection-operation.js'
import { extentProjectionFixture } from './geometry-extent-fixture.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

afterEach(cleanup)

describe('source-bound native extent inspector', () => {
  it('edits a collapsed native axis through the structural operation, without affine scaling', () => {
    const initial = extentProjectionFixture()
    const before = structuredClone(initial)
    let current = initial
    const dispatched = []
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
          onUpdate={(patch) => {
            dispatched.push(patch)
            const next = operations.applyPresentationProjectionOperation(
              current,
              patch.pptxProjectionOperation
            )
            setDeck(next)
          }}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByLabelText('Native width (EMU)').value).toBe('0')
    expect(screen.getByLabelText('Native height (EMU)').value).toBe('762000')
    fireEvent.change(screen.getByLabelText('Native width (EMU)'), {
      target: { value: '952500' },
    })
    expect(dispatched).toEqual([
      {
        pptxProjectionOperation: {
          type: 'geometry.edit',
          instanceId: 'i1',
          componentId: 'geometry',
          command: { type: 'extent', width: 952500 },
        },
      },
    ])
    expect(current.slides[0].elements[0]).toMatchObject({ width: 100, height: 80 })
    expect(current.pptxSemantic.instances.i1.localTransform).toEqual(
      before.pptxSemantic.instances.i1.localTransform
    )
    expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(current.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    const valid = structuredClone(current)
    fireEvent.change(screen.getByLabelText('Native height (EMU)'), {
      target: { value: '-1' },
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(current).toEqual(valid)
    fireEvent.change(screen.getByLabelText('Native height (EMU)'), {
      target: { value: '381000' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(current.slides[0].elements[0]).toMatchObject({ width: 100, height: 40 })
  })

  it.each(['element', 'slide', 'multiple'])(
    'keeps native dimensions readonly for %s guards',
    (guard) => {
      const deck = extentProjectionFixture()
      const element = { ...deck.slides[0].elements[0], locked: guard === 'element' }
      render(
        <GeometryProperties
          element={element}
          pptxSemantic={deck.pptxSemantic}
          slideLocked={guard === 'slide'}
          selectedElementIds={guard === 'multiple' ? ['i1', 'i2'] : ['i1']}
          onUpdate={() => {
            throw new Error('Readonly native extent updated')
          }}
        />
      )
      expect(screen.getByLabelText('Native width (EMU)').disabled).toBe(true)
      expect(screen.getByLabelText('Native height (EMU)').disabled).toBe(true)
    }
  )

  it('does not expose ambiguous legacy schema1 dimensions as native EMU', () => {
    const deck = geometryProjectionFixture()
    render(
      <GeometryProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={['i1']}
        onUpdate={() => {
          throw new Error('Legacy native extent updated')
        }}
      />
    )
    expect(screen.queryByLabelText('Native width (EMU)')).toBeNull()
    expect(screen.queryByLabelText('Native height (EMU)')).toBeNull()
    expect(screen.getByLabelText('Geometry point X')).toBeTruthy()
  })

  it('exposes native EMU extent inputs for schemaVersion 3 graph documents', () => {
    const deck = extentProjectionFixture()
    deck.pptxSemantic.schemaVersion = 3
    render(
      <GeometryProperties
        element={deck.slides[0].elements[0]}
        pptxSemantic={deck.pptxSemantic}
        selectedElementIds={['i1']}
        onUpdate={() => {}}
      />
    )
    expect(screen.getByLabelText('Native width (EMU)')).toBeTruthy()
    expect(screen.getByLabelText('Native height (EMU)')).toBeTruthy()
  })
})
