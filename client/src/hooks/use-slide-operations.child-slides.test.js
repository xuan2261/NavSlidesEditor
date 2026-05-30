import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSlideOperations } from './use-slide-operations'

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
