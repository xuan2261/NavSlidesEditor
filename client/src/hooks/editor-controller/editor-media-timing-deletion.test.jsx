// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, renderHook, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorElementController } from './use-editor-element-controller'
import { useSlideOperations } from '../use-slide-operations'
import { useClipboard } from '../use-clipboard'
import { usePresentationState } from '../use-presentation-state'
import { useEditorStore } from '../../stores/editor-store'
import AnimationTimeline from '../../components/AnimationTimeline'
import { executeInteractionAction, createInteractionSlideState } from 'revealjs-shared/src/education/interaction-actions.js'
import { canonicalEditableSnapshot } from '../../../../server/services/pptx-import/canonical-snapshot.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import { geometryGroupFillFixture } from '../../../../tests/pptx-semantic/geometry-group-fill-fixture.js'
import { parseSlideAnimations } from '../../../../server/services/pptx-import/ooxml-animation.js'

// Real importer inventory shape: mapped animation records have no target IDs.
const timing = parseSlideAnimations('<p:timing><p:animEffect filter="fade"><p:cBhvr><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:animEffect></p:timing>')
const sourceTiming = { mapped: timing.animations, unsupported: timing.unsupported, fragmentHints: timing.fragmentHints }
const mapActive = (previous, update) => ({ ...previous, slides: [update(previous.slides[0]), ...previous.slides.slice(1)] })
afterEach(() => { cleanup(); useEditorStore.getState().clearSelection() })

function fixture(typed) {
  const deck = typed ? semantic.normalizeSemanticPresentation(geometryGroupFillFixture()) : {
    slides: [{ id: 's1', elements: [{ id: 'i1', type: 'shape' }] }, { id: 's2', elements: [] }],
  }
  deck.id = 'media-deletion-regression'
  deck.slides[0]._pptxAnimations = structuredClone(sourceTiming)
  deck.slides[0].elements[0].fragment = true
  deck.slides[0].elements[0].fragmentIndex = 1
  deck.slides[0].elements.push({ id: 'button', type: 'shape', action: { kind: 'show', targetElementId: 'i1' } })
  return deck
}
function mount(seed) {
  useEditorStore.getState().setSelectedElementIds(['i1'])
  return renderHook(() => {
    const [deck, setPresentation, commitPresentationTransaction] = usePresentationState(seed)
    const context = { presentation: deck, activeSlide: deck.slides[0], setPresentation,
      editingElementIdRef: { current: null }, setEditingElementId: vi.fn(),
      setSelectedElementIds: useEditorStore.getState().setSelectedElementIds, mapActive }
    const element = useEditorElementController(context)
    const selected = useSlideOperations({ presentation: deck, setPresentation,
      currentSlideIndexRef: { current: 0 }, selectedElementIdsRef: { current: ['i1'] },
      editingElementIdRef: { current: null }, mapActiveSlide: mapActive })
    const clipboard = useClipboard({ setPresentation, commitPresentationTransaction, mapActiveSlide: mapActive,
      getPresentation: () => deck, getActiveSlide: () => deck.slides[0] })
    return { deck, element, selected, clipboard }
  })
}

describe('deleted animation and action targets at real editor boundaries', () => {
  it.each(['single', 'selection', 'cut'].flatMap((command) => [false, true].map((typed) => [command, typed])))(
    'discloses %s deletion (semantic=%s) without rewriting source timing or sibling slides', (command, typed) => {
      const original = fixture(typed)
      const before = structuredClone(original)
      const { result } = mount(original)
      act(() => {
        const current = result.current
        if (command === 'single') current.element.deleteElement('i1')
        else if (command === 'selection') current.selected.deleteSelectedElements()
        else current.clipboard.performCut(current.deck.slides[0].elements, ['i1'])
      })
      const slide = result.current.deck.slides[0]
      expect(slide.elements.some((element) => element.id === 'i1')).toBe(false)
      expect(slide._pptxAnimations).toEqual(sourceTiming)
      expect(slide.animationReferenceError).toMatch(/deleted|removed/i)
      const button = slide.elements.find((element) => element.id === 'button')
      expect(button.action).toMatchObject({ kind: 'show', targetElementId: 'i1', referenceError: expect.stringMatching(/deleted|removed/i) })
      const state = createInteractionSlideState(slide)
      expect(executeInteractionAction(state, button.action)).toMatchObject({ state, error: button.action.referenceError })
      const reopened = canonicalEditableSnapshot(JSON.parse(JSON.stringify(result.current.deck)))
      expect(reopened.slides[0].animationReferenceError).toBe(slide.animationReferenceError)
      expect(reopened.slides[0].elements.find((element) => element.id === 'button').action).toEqual(button.action)
      expect(result.current.deck.slides[1]).toEqual(before.slides[1])
      if (typed) expect(result.current.deck.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(original).toEqual(before)
      render(<AnimationTimeline slide={slide} onUpdateElement={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByRole('alert').textContent).toBe(slide.animationReferenceError)
    }
  )

  it('does not invent timing debt when there is no source timing and does not alter unrelated actions', () => {
    const initial = fixture(false)
    delete initial.slides[0]._pptxAnimations
    initial.slides[0].elements.push({ id: 'other', type: 'shape', action: { kind: 'hide', targetElementId: 'button' } })
    const { result } = mount(initial)
    act(() => result.current.element.deleteElement('i1'))
    expect(result.current.deck.slides[0].animationReferenceError).toBeUndefined()
    expect(result.current.deck.slides[0].elements.find((element) => element.id === 'other').action).toEqual({ kind: 'hide', targetElementId: 'button' })
  })
})
