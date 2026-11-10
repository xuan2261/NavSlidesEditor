// @vitest-environment jsdom
import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorElementController } from './use-editor-element-controller'
import { geometryGroupFillFixture } from '../../../../tests/pptx-semantic/geometry-group-fill-fixture.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import operations from 'revealjs-shared/src/pptx-projection-operation.js'
import styles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'

import NativeGroupFillProperties from '../../components/properties/native-group-fill-properties'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const patch = (color = 'ABCDEF') => ({ pptxProjectionOperation: { type: 'group.fill.edit',
  instanceId: 'g1', componentId: 'group:group-properties',
  command: { type: 'fill-paint', color: { kind: 'srgb', value: color } } } })
function mount() {
  const initial = semantic.normalizeSemanticPresentation(geometryGroupFillFixture())
  const view = renderHook(() => {
    const [deck, setPresentation] = useState(initial)
    const element = useEditorElementController({ presentation: deck, setPresentation,
      activeSlide: deck.slides[0], editingElementIdRef: { current: null },
      mapActive: (previous, update) => ({ ...previous, slides: [update(previous.slides[0]), ...previous.slides.slice(1)] }) })
    return { deck, element, setPresentation }
  })
  return { ...view, initial }
}
const fill = (deck) => styles.materializeGeometry(deck.pptxSemantic, 'i1').style.fill.color.value

describe('projection commit with synchronous inspector error disclosure', () => {
  it('publishes the synchronously computed immutable result without recomputing it', () => {
    const { result, initial } = mount()
    const apply = vi.spyOn(operations, 'applyPresentationProjectionOperation')
    const before = structuredClone(initial)
    act(() => result.current.element.updateElement('i1', patch()))
    expect(fill(result.current.deck)).toBe('ABCDEF')
    expect(apply).toHaveBeenCalledTimes(1)
    expect(result.current.deck).toBe(apply.mock.results[0].value)
    expect(initial).toEqual(before)
    expect(result.current.deck.slides[1]).toEqual(initial.slides[1])
  })

  it('still throws malformed commands synchronously before React schedules its updater', () => {
    const { result, initial } = mount()
    const invalid = patch('not-a-color')
    expect(() => result.current.element.updateElement('i1', invalid)).toThrow()
    expect(result.current.deck).toBe(initial)
  })

  it('renders actual canonical rejection in the existing inspector alert boundary', () => {
    function Inspector() {
      const [deck, setPresentation] = useState(semantic.normalizeSemanticPresentation(geometryGroupFillFixture()))
      const controller = useEditorElementController({ presentation: deck, setPresentation,
        activeSlide: deck.slides[0], editingElementIdRef: { current: null },
        mapActive: (previous, update) => ({ ...previous, slides: [update(previous.slides[0]), ...previous.slides.slice(1)] }) })
      const frame = { ...styles.geometryFillFrame(deck.pptxSemantic, 'i1'), componentId: 'stale-source-component' }
      return <NativeGroupFillProperties document={deck.pptxSemantic} frame={frame}
        onUpdate={(updates) => controller.updateElement('i1', updates)} />
    }
    render(<Inspector />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit owner group' }))
    fireEvent.click(screen.getByRole('button', { name: 'No group fill' }))
    expect(screen.getByRole('alert').textContent).toMatch(/different source paint component/i)
  })
  it('rebases onto a queued live edit instead of overwriting it with the inspected snapshot', () => {
    const { result, initial } = mount()
    const command = result.current.element
    act(() => {
      result.current.setPresentation((previous) => ({ ...previous, title: 'Queued title' }))
      command.updateElement('i1', patch())
    })
    expect(result.current.deck.title).toBe('Queued title')
    expect(fill(result.current.deck)).toBe('ABCDEF')
    expect(initial.title).not.toBe('Queued title')
  })

  it('does not publish the precomputed owner edit after the live target was detached', () => {
    const { result } = mount()
    const command = result.current.element
    act(() => {
      result.current.setPresentation((previous) => {
        const detached = structuredClone(previous)
        detached.pptxSemantic.instances.i1.parentInstanceId = null
        detached.pptxSemantic.instances.i1.overrides = { components: {
          geometry: { geometryStyle: { fill: { color: { kind: 'srgb', value: '112233' } } } },
        } }
        return semantic.normalizeSemanticPresentation(detached)
      })
      command.updateElement('i1', patch())
    })
    expect(result.current.deck.pptxSemantic.instances.g1.overrides).toEqual({})
    expect(fill(result.current.deck)).toBe('112233')
  })
})
