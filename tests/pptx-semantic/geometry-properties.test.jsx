// @vitest-environment jsdom
import React, { useState, useRef, useLayoutEffect } from 'react'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller'
import { geometryProjectionFixture } from './geometry-projection-fixture'
afterEach(cleanup)
describe('canonical geometry property controls', () => {
  it.each([false, true])(
    'edits native control coordinates through actual dispatchers (collapsed %s)',
    (collapsed) => {
      const initial = geometryProjectionFixture()
      if (collapsed) {
        const geometry = initial.pptxSemantic.definitions.definition.content.geometry
        geometry.width = 0
        geometry.paths[0].width = 100
      }
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
      expect(screen.queryByLabelText('Shape kind')).toBeNull()
      fireEvent.change(screen.getByLabelText('Geometry point'), { target: { value: 'control' } })
      fireEvent.change(screen.getByLabelText('Geometry point X'), { target: { value: '58' } })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.paths[0]
          .commands[1].points[0]
      ).toMatchObject(
        collapsed ? { x: 'tip', y: 10, localOffset: { x: 58, y: 0 } } : { x: 58, y: 10 }
      )
      fireEvent.change(screen.getByLabelText('Geometry adjustment adj'), {
        target: { value: '40000' },
      })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.adjustments
      ).toEqual([{ name: 'adj', formula: 'val 40000' }])
      expect(current.slides[1]).toEqual(initial.slides[1])
      expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
      expect(current.pptxSemantic.instances.i1.localTransform).toEqual(
        initial.pptxSemantic.instances.i1.localTransform
      )
      fireEvent.change(screen.getByTestId('prop-shape-fill'), { target: { value: '#654321' } })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
      ).toEqual({ color: { kind: 'srgb', value: '654321' } })
      fireEvent.change(screen.getByLabelText('Native fill RGB'), { target: { value: 'ABCDEF' } })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
      ).toEqual({ color: { kind: 'srgb', value: 'ABCDEF' } })
      fireEvent.change(screen.getByTestId('prop-shape-stroke'), { target: { value: '#2468ac' } })
      fireEvent.change(screen.getByTestId('prop-shape-stroke-width'), { target: { value: '4' } })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style
          .stroke
      ).toMatchObject({ color: { kind: 'srgb', value: '2468ac' }, width: 38100 })
      expect(
        current.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
      ).toEqual({ color: { kind: 'srgb', value: 'ABCDEF' } })
      expect(current.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
      expect(current.slides[1]).toEqual(initial.slides[1])
    }
  )
  it('edits authored RGB without dropping native transforms and rejects incomplete drafts', () => {
    const deck = geometryProjectionFixture()
    const color = {
      kind: 'srgb',
      value: '2468AC',
      transforms: [
        { kind: 'tint', value: 50000 },
        { kind: 'alpha', value: 50000 },
      ],
    }
    deck.pptxSemantic.definitions.definition.content.geometry.style = { fill: { color } }
    const onUpdate = vi.fn()
    render(
      <PropertiesPanel
        slide={deck.slides[0]}
        presentation={deck}
        selectedElement={deck.slides[0].elements[0]}
        selectedElementIds={['i1']}
        onUpdateElement={onUpdate}
      />
    )
    const input = screen.getByLabelText('Native fill RGB')
    expect(input.value).toBe('2468AC')
    fireEvent.change(input, { target: { value: '12345' } })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '654321' } })
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onUpdate).toHaveBeenCalledWith({
      pptxProjectionOperation: {
        type: 'geometry.edit',
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'fill-paint', color: { ...color, value: '654321' } },
      },
    })
    expect(deck.pptxSemantic.instances.i1.overrides).toEqual({})
  })
  it.each(['slide', 'element', 'multi'])('keeps authored RGB readonly for %s guard', (guard) => {
    const deck = geometryProjectionFixture()
    deck.pptxSemantic.definitions.definition.content.geometry.style = {
      fill: { color: { kind: 'srgb', value: '2468AC' } },
    }
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
    expect(screen.getByLabelText('Native fill RGB').disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })
  it('does not issue geometry operations for a locked slide or multi-selection', () => {
    const deck = geometryProjectionFixture(),
      onUpdate = vi.fn()
    render(
      <PropertiesPanel
        slide={{ ...deck.slides[0], locked: true }}
        presentation={deck}
        selectedElement={deck.slides[0].elements[0]}
        selectedElementIds={['i1', 'i2']}
        onUpdateElement={onUpdate}
      />
    )
    expect(screen.getByLabelText('Geometry point X').disabled).toBe(true)
    expect(screen.getByLabelText('Geometry adjustment adj').disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
