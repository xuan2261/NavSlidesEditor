import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSlideOperations } from './use-slide-operations'
import {
  createInteractionSlideState,
  executeInteractionAction,
  resolveEffectiveSlide,
} from 'revealjs-shared'

function makeHarness(initial) {
  let presentation = initial
  const setPresentation = vi.fn((updater) => {
    presentation = typeof updater === 'function' ? updater(presentation) : updater
  })
  const currentSlideIndexRef = { current: 0 }
  const deps = {
    presentation,
    setPresentation,
    currentSlideIndex: 0,
    setCurrentSlideIndex: vi.fn(),
    currentSlideIndexRef,
    selectedElementIdsRef: { current: [] },
    editingElementIdRef: { current: null },
  }
  return { get: () => presentation, deps }
}

beforeEach(() => {
  if (!globalThis.crypto) globalThis.crypto = {}
  if (!globalThis.crypto.randomUUID) {
    let n = 0
    globalThis.crypto.randomUUID = () => `uuid-${++n}`
  }
})

describe('useSlideOperations — vertical child CRUD', () => {
  it('addChildSlide appends a child inheriting the parent background', () => {
    const { get, deps } = makeHarness({
      slides: [{ id: 'p0', elements: [], background: { type: 'color', color: '#abc' } }],
    })
    const { result } = renderHook(() => useSlideOperations(deps))
    act(() => result.current.addChildSlide(0))
    const children = get().slides[0].children
    expect(children).toHaveLength(1)
    expect(children[0].elements).toEqual([])
    expect(children[0].background).toEqual({ type: 'color', color: '#abc' })
  })

  it('duplicateChildSlide deep-clones with fresh ids', () => {
    const { get, deps } = makeHarness({
      slides: [
        {
          id: 'p0',
          elements: [],
          children: [{ id: 'c0', elements: [{ id: 'e0', type: 'text', content: 'x' }] }],
        },
      ],
    })
    const { result } = renderHook(() => useSlideOperations(deps))
    act(() => result.current.duplicateChildSlide(0, 0))
    const children = get().slides[0].children
    expect(children).toHaveLength(2)
    // dup inserted right after the original
    expect(children[1].id).not.toBe('c0')
    expect(children[1].elements[0].id).not.toBe('e0')
    expect(children[1].elements[0].content).toBe('x')
  })

  it('duplicates a child using fresh local targets and placeholder bindings while preserving fixed scope', () => {
    const fixed = 'layout-fixed:l:answer'
    const { get, deps } = makeHarness({
      layoutMasters: [
        {
          id: 'l',
          name: 'Layout',
          placeholders: [
            { id: 'title', type: 'text', role: 'title', x: 20, y: 20, width: 200, height: 40 },
          ],
          fixedElements: [{ id: 'answer', type: 'text', x: 20, y: 80, width: 200, height: 40 }],
        },
      ],
      slides: [
        {
          id: 'parent',
          elements: [],
          children: [
            {
              id: 'child',
              layoutId: 'l',
              transition: 'fade',
              transitionDuration: 700,
              layoutOverrides: { placeholderBindings: { title: 'target' } },
              elements: [
                {
                  id: 'source',
                  type: 'shape',
                  action: { kind: 'show', targetElementId: 'target' },
                },
                { id: 'target', type: 'text', initialVisibility: 'hidden', content: 'Child title' },
                {
                  id: 'fixed-source',
                  type: 'shape',
                  action: { kind: 'hide', targetElementId: fixed },
                },
              ],
            },
          ],
        },
      ],
    })
    const { result } = renderHook(() => useSlideOperations(deps))
    act(() => result.current.duplicateChildSlide(0, 0))
    const copy = get().slides[0].children[1]
    expect(copy.elements[0].action.targetElementId).toBe(copy.elements[1].id)
    expect(copy.layoutOverrides.placeholderBindings.title).toBe(copy.elements[1].id)
    expect(copy.elements[2].action.targetElementId).toBe(fixed)
    expect(copy.elements[2].action.referenceError).toBeUndefined()
    for (const oldId of ['source', 'target', 'fixed-source'])
      expect(copy.elements.map((element) => element.id)).not.toContain(oldId)
    expect(copy).toMatchObject({ transition: 'fade', transitionDuration: 700 })
    const effective = resolveEffectiveSlide(copy, get().layoutMasters).slide
    const shown = executeInteractionAction(
      createInteractionSlideState(effective),
      copy.elements[0].action
    )
    expect(shown.state.visibility[copy.elements[1].id]).toBe(true)
    const hidden = executeInteractionAction(shown.state, copy.elements[2].action)
    expect(hidden.state.visibility[fixed]).toBe(false)
    expect(get().slides[0].children[0]).toEqual(deps.presentation.slides[0].children[0])
    expect(get().slides[0].elements).toEqual([])
  })

  it('deleteChildSlide removes the child at the index', () => {
    const { get, deps } = makeHarness({
      slides: [
        {
          id: 'p0',
          elements: [],
          children: [
            { id: 'c0', elements: [] },
            { id: 'c1', elements: [] },
          ],
        },
      ],
    })
    const { result } = renderHook(() => useSlideOperations(deps))
    act(() => result.current.deleteChildSlide(0, 0))
    const children = get().slides[0].children
    expect(children).toHaveLength(1)
    expect(children[0].id).toBe('c1')
  })

  it('addChildSlide on a missing parent is a no-op', () => {
    const { get, deps } = makeHarness({ slides: [{ id: 'p0', elements: [] }] })
    const { result } = renderHook(() => useSlideOperations(deps))
    act(() => result.current.addChildSlide(5))
    expect(get().slides[0].children).toBeUndefined()
  })
})
