// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useClipboard } from './use-clipboard'
import { usePresentationState } from './use-presentation-state'
import { useEditorStore } from '../stores/editor-store'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import { geometryGroupFillFixture } from '../../../tests/pptx-semantic/geometry-group-fill-fixture.js'

afterEach(() => { cleanup(); useEditorStore.getState().clearSelection() })
function mount(strict = false) {
  const initial = semantic.normalizeSemanticPresentation({ ...geometryGroupFillFixture(), id: 'queued-cut' })
  initial.slides[0].elements.push({ id: 'survivor', type: 'text', content: '<p>Original</p>' })
  const initialClipboard = [{ type: 'text', content: '<p>Prior clipboard</p>' }]
  useEditorStore.setState({ selectedElementIds: ['i1'], clipboard: initialClipboard, pasteCount: 4 })
  const view = renderHook(() => {
    const [deck, setPresentation, commitPresentationTransaction] = usePresentationState(initial)
    const clipboard = useClipboard({ getPresentation: () => deck, getActiveSlide: () => deck.slides[0],
      setPresentation, commitPresentationTransaction, mapActiveSlide: (previous, update) => ({ ...previous,
        slides: [update(previous.slides[0]), ...previous.slides.slice(1)] }) })
    return { deck, setPresentation, clipboard }
  }, { wrapper: strict ? StrictMode : undefined })
  return { ...view, initial, initialClipboard }
}

describe('semantic cut rebases onto live React state', () => {
  it('retains queued title and surviving-element edits without mutating the source snapshot', () => {
    const { result, initial } = mount()
    const before = structuredClone(initial)
    const stale = result.current
    act(() => {
      stale.setPresentation((previous) => ({ ...previous, title: 'Queued title', slides: [
        { ...previous.slides[0], elements: previous.slides[0].elements.map((element) => element.id === 'survivor'
          ? { ...element, content: '<p>Queued content</p>' } : element) }, previous.slides[1],
      ] }))
      stale.clipboard.performCut(stale.deck.slides[0].elements, ['i1'])
    })
    expect(result.current.deck.title).toBe('Queued title')
    expect(result.current.deck.slides[0].elements).toEqual([
      expect.objectContaining({ id: 'survivor', content: '<p>Queued content</p>' }),
    ])
    expect(result.current.deck.pptxSemantic.instances.i1.lineage.tombstone).toBe(true)
    expect(result.current.deck.slides[1]).toEqual(before.slides[1])
    expect(result.current.deck.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(initial).toEqual(before)
  })

  it('cuts the queued selected content into the clipboard rather than deleting a live edit with a stale copy', () => {
    const { result } = mount()
    const stale = result.current
    act(() => {
      stale.setPresentation((previous) => ({ ...previous, slides: [
        { ...previous.slides[0], elements: previous.slides[0].elements.map((element) => element.id === 'i1'
          ? { ...element, text: 'Queued selected content' } : element) }, previous.slides[1],
      ] }))
      stale.clipboard.performCut(stale.deck.slides[0].elements, ['i1'])
    })
    expect(result.current.deck.slides[0].elements.some((element) => element.id === 'i1')).toBe(false)
    expect(useEditorStore.getState().clipboard.elements.find((element) => element.id === 'i1').text).toBe('Queued selected content')
    expect(useEditorStore.getState().selectedElementIds).toEqual([])
    expect(useEditorStore.getState().pasteCount).toBe(0)
  })

  it('publishes the committed clipboard even when a later queued edit spreads the cut presentation', () => {
    const { result } = mount()
    const stale = result.current
    act(() => {
      stale.setPresentation((previous) => ({ ...previous, slides: [
        { ...previous.slides[0], elements: previous.slides[0].elements.map((element) => element.id === 'i1'
          ? { ...element, text: 'Committed source content' } : element) }, previous.slides[1],
      ] }))
      stale.clipboard.performCut(stale.deck.slides[0].elements, ['i1'])
      stale.setPresentation((previous) => ({ ...previous, title: 'After cut', slides: [
        { ...previous.slides[0], elements: previous.slides[0].elements.map((element) => element.id === 'survivor'
          ? { ...element, content: '<p>After cut edit</p>' } : element) }, previous.slides[1],
      ] }))
    })
    expect(result.current.deck.title).toBe('After cut')
    expect(result.current.deck.slides[0].elements).toEqual([
      expect.objectContaining({ id: 'survivor', content: '<p>After cut edit</p>' }),
    ])
    expect(useEditorStore.getState().clipboard.elements.find((element) => element.id === 'i1').text).toBe('Committed source content')
    expect(useEditorStore.getState().selectedElementIds).toEqual([])
  })

  it('publishes one committed clipboard update under StrictMode after queued edits', () => {
    const { result } = mount(true)
    const publications = []
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.clipboard !== previous.clipboard) publications.push(state.clipboard)
    })
    try {
      const stale = result.current
      act(() => {
        stale.setPresentation((previous) => ({ ...previous, title: 'Strict queued title' }))
        stale.clipboard.performCut(stale.deck.slides[0].elements, ['i1'])
        stale.setPresentation((previous) => ({ ...previous, title: 'Strict committed title' }))
      })
      expect(result.current.deck.title).toBe('Strict committed title')
      expect(result.current.deck.slides[0].elements.map((element) => element.id)).toEqual(['survivor'])
      expect(publications).toHaveLength(1)
      expect(publications[0].rootInstanceIds).toEqual(['i1'])
      expect(result.current.deck).not.toHaveProperty('pendingEffects')
      expect(result.current.deck).not.toHaveProperty('receipt')
    } finally {
      unsubscribe()
    }
  })

  it.each(['slide', 'element', 'semantic-owner'])('does not erase or bypass a queued %s lock', (lock) => {
    const { result, initial, initialClipboard } = mount()
    const stale = result.current
    let locked
    act(() => {
      stale.setPresentation((previous) => {
        locked = structuredClone(previous)
        if (lock === 'slide') locked.slides[0].locked = true
        else if (lock === 'element') locked.slides[0].elements[0].locked = true
        else locked.pptxSemantic.instances.g1.overrides.locked = true
        return locked
      })
      stale.clipboard.performCut(stale.deck.slides[0].elements, ['i1'])
    })
    expect(result.current.deck).toBe(locked)
    expect(result.current.deck.slides[0].elements.map((element) => element.id)).toEqual(['i1', 'survivor'])
    expect(result.current.deck.pptxSemantic.instances.i1.lineage?.tombstone).not.toBe(true)
    expect(initial.slides[0].locked).not.toBe(true)
    expect(useEditorStore.getState().clipboard).toBe(initialClipboard)
    expect(useEditorStore.getState().selectedElementIds).toEqual(['i1'])
    expect(useEditorStore.getState().pasteCount).toBe(4)
  })
})
