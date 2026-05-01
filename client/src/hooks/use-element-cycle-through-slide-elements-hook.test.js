import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useElementCycle } from './use-element-cycle-through-slide-elements-hook'

const makeSlide = (ids) => ids.map((id) => ({ id }))
const makeSlides = (elements) => [{ elements }]

describe('useElementCycle', () => {
  it('cycleNext returns first element when nothing selected', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result } = renderHook(() => useElementCycle([], slides, 0))
    expect(result.current.cycleNext()).toBe('a')
  })

  it('cycleNext cycles through elements', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result, rerender } = renderHook(
      ({ sel }) => useElementCycle(sel, slides, 0),
      { initialProps: { sel: ['a'] } }
    )
    expect(result.current.cycleNext()).toBe('b')
    rerender({ sel: [result.current.cycleNext()] })
    expect(result.current.cycleNext()).toBe('c')
    rerender({ sel: [result.current.cycleNext()] })
    expect(result.current.cycleNext()).toBe('a')
  })

  it('cyclePrev cycles backward', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result } = renderHook(() => useElementCycle(['b'], slides, 0))
    expect(result.current.cyclePrev()).toBe('a')
  })

  it('cycleNext returns null when no elements', () => {
    const slides = makeSlides(makeSlide([]))
    const { result } = renderHook(() => useElementCycle(['a'], slides, 0))
    expect(result.current.cycleNext()).toBeNull()
  })

  it('cyclePrev returns last element when multi-selected', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result } = renderHook(() => useElementCycle(['a', 'b'], slides, 0))
    expect(result.current.cyclePrev()).toBe('c')
  })

  it('wraps around at end of element list', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result } = renderHook(() => useElementCycle(['c'], slides, 0))
    expect(result.current.cycleNext()).toBe('a')
  })

  it('wraps around at beginning', () => {
    const slides = makeSlides(makeSlide(['a', 'b', 'c']))
    const { result } = renderHook(() => useElementCycle(['a'], slides, 0))
    expect(result.current.cyclePrev()).toBe('c')
  })
})
