// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PropertiesPanel from '../../client/src/components/PropertiesPanel.jsx'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller.js'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller.js'
import { arcProjectionFixture } from './geometry-arc-fixture.js'
import { inheritedGeometryStyleFixture } from './geometry-style-fixture.js'
import geometryStyles from '../../shared/src/pptx-geometry-style-resolution.js'

afterEach(cleanup)

describe('occurrence-local native arc controls', () => {
  it.each([1, 2])('edits an authored arc through the real schema%s dispatchers', (schema) => {
    const initial = arcProjectionFixture()
    if (schema === 2) {
      const geometry = initial.pptxSemantic.definitions.definition.content.geometry
      const components = initial.pptxSemantic.definitions.definition.components
      initial.pptxSemantic = inheritedGeometryStyleFixture()
      initial.pptxSemantic.definitions.definition.content.geometry = geometry
      initial.pptxSemantic.definitions.definition.components = components
      geometry.schemaVersion = 2
      delete geometry.width
      delete geometry.height
      initial.pptxSemantic.instances.i1.overrides = {
        components: { geometry: { geometryStyle: { stroke: { cap: 'flat' } } } },
      }
    }
    const before = structuredClone(initial)
    let current
    function Harness() {
      const [deck, setDeck] = useState(initial)
      const editingElementIdRef = useRef(null)
      const commands = useEditorElementController({
        presentation: deck,
        setPresentation: setDeck,
        activeSlide: deck.slides[0],
        editingElementIdRef,
        setEditingElementId: vi.fn(),
        setSelectedElementIds: vi.fn(),
        mapActive: (prev, fn) => ({
          ...prev,
          slides: prev.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
        }),
      })
      const selection = useEditorSelectionController({
        activeSlideRef: useRef(deck.slides[0]),
        getSelectionSlide: () => deck.slides[0],
        selectedElementIdsRef: useRef(['i1']),
        editingElementIdRef,
        ...commands,
        notifyBlockedAction: vi.fn(),
      })
      useLayoutEffect(() => {
        current = deck
      }, [deck])
      return (
        <PropertiesPanel
          slide={deck.slides[0]}
          presentation={deck}
          selectedElement={deck.slides[0].elements[0]}
          selectedElementIds={['i1']}
          onUpdateElement={selection.updateSelectedElements}
        />
      )
    }
    render(<Harness />)
    expect(screen.getByLabelText('Native arc width radius').value).toBe('50')
    fireEvent.change(screen.getByLabelText('Native arc width radius'), {
      target: { value: '30.25' },
    })
    const changed = current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
    expect(changed.paths[0].commands[1].wR).toBe(30.25)
    expect(changed.paths[0].commands[2].wR).toBe('rx')
    if (schema === 2) {
      expect(changed).not.toHaveProperty('style')
      expect(current.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle).toEqual(
        { stroke: { cap: 'flat' } }
      )
    }
    expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(current.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(current.pptxSemantic.instances.i1.localTransform).toEqual(
      before.pptxSemantic.instances.i1.localTransform
    )

    fireEvent.change(screen.getByLabelText('Native arc'), {
      target: { value: 'geometry:path:1:1' },
    })
    expect(screen.getByLabelText('Native arc width radius').value).toBe('50')
    expect(screen.getByLabelText('Native arc sweep angle').value).toBe('-5400000')
    fireEvent.change(screen.getByLabelText('Native arc height radius'), {
      target: { value: '20.5' },
    })
    const reloaded = JSON.parse(JSON.stringify(current))
    const effective = geometryStyles.materializeGeometry(reloaded.pptxSemantic, 'i1')
    expect(effective.paths[0].commands[1].wR).toBe(30.25)
    expect(effective.paths[1].commands[1].hR).toBe(20.5)
    expect(current.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(current.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    const accepted = structuredClone(current)
    fireEvent.change(screen.getByLabelText('Native arc height radius'), {
      target: { value: '-1' },
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(current).toEqual(accepted)
    fireEvent.change(screen.getByLabelText('Native arc height radius'), {
      target: { value: '25.25' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.paths[1]
        .commands[1].hR
    ).toBe(25.25)
  })

  it.each(['slide', 'element', 'multi'])(
    'keeps native arc fields readonly for %s guard',
    (guard) => {
      const deck = arcProjectionFixture()
      const onUpdate = vi.fn()
      render(
        <PropertiesPanel
          slide={{ ...deck.slides[0], locked: guard === 'slide' }}
          presentation={deck}
          selectedElement={{ ...deck.slides[0].elements[0], locked: guard === 'element' }}
          selectedElementIds={guard === 'multi' ? ['i1', 'i2'] : ['i1']}
          onUpdateElement={onUpdate}
        />
      )
      for (const label of [
        'Native arc',
        'Native arc width radius',
        'Native arc height radius',
        'Native arc start angle',
        'Native arc sweep angle',
      ])
        expect(screen.getByLabelText(label).disabled).toBe(true)
      expect(onUpdate).not.toHaveBeenCalled()
    }
  )
})
