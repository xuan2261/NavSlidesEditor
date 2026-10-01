import { describe, expect, it } from 'vitest'
import { applySorterSlideOperation, getSorterCurrentDestination } from './slide-sorter-operations'

const makeSlides = () => ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  elements: [{ id: `${id}-text`, type: 'text', content: id }],
}))

describe('sorter identity and queued mutations', () => {
  it('retains the current slide and vertical address when moved or when a predecessor is deleted', () => {
    const slides = makeSlides()
    slides[1].children = [{ id: 'child-b', elements: [] }]
    const vertical = { parentId: 'b', child: 0 }
    const moved = applySorterSlideOperation(slides, 'move', 'b', 3)
    expect(moved.map((slide) => slide.id)).toEqual(['a', 'c', 'd', 'b'])
    expect(getSorterCurrentDestination(slides, 1, moved, vertical)).toEqual({ index: 3, child: 0, identityChanged: false })
    const deleted = applySorterSlideOperation(slides, 'delete', 'a')
    expect(getSorterCurrentDestination(slides, 1, deleted, vertical)).toEqual({ index: 0, child: 0, identityChanged: false })
  })

  it('clears the vertical address and signals selection cleanup when the current slide is removed at the same index', () => {
    const slides = makeSlides()
    const next = applySorterSlideOperation(slides, 'delete', 'b')
    expect(getSorterCurrentDestination(slides, 1, next, { parentId: 'b', child: 0 })).toEqual({ index: 1, child: null, identityChanged: true })
    expect(next[1].id).toBe('c')
  })

  it('applies all queued deletions by original identity without deleting shifted neighbors', () => {
    const slides = makeSlides()
    const next = ['b', 'c'].reduce((current, id) => applySorterSlideOperation(current, 'delete', id), slides)
    expect(next.map((slide) => slide.id)).toEqual(['a', 'd'])
    expect(slides.map((slide) => slide.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(applySorterSlideOperation([slides[0]], 'delete', 'a')).toEqual([slides[0]])
  })

  it('duplicates every queued original rather than the shifted clone and regenerates nested IDs', () => {
    const slides = makeSlides()
    slides[1].children = [{ id: 'child-b', elements: [{ id: 'nested-b', type: 'text', content: 'child-b' }] }]
    const next = ['b', 'c'].reduce((current, id) => applySorterSlideOperation(current, 'duplicate', id), slides)
    expect(next.map((slide) => slide.elements[0].content)).toEqual(['a', 'b', 'b', 'c', 'c', 'd'])
    expect(next.filter((slide) => slide.id === 'b')).toEqual([slides[1]])
    expect(next.filter((slide) => slide.id === 'c')).toEqual([slides[2]])
    expect(next[2].elements[0].id).not.toBe('b-text')
    expect(next[2].children[0].id).not.toBe('child-b')
    expect(next[2].children[0].elements[0].id).not.toBe('nested-b')
    expect(getSorterCurrentDestination(slides, 2, next)).toEqual({ index: 3, child: null, identityChanged: false })
  })

  it('does not mutate the deck for a stale missing slide or out-of-range move', () => {
    const slides = makeSlides()
    expect(applySorterSlideOperation(slides, 'delete', 'gone')).toBe(slides)
    expect(applySorterSlideOperation(slides, 'move', 'b', -1)).toBe(slides)
    expect(applySorterSlideOperation(slides, 'move', 'b', slides.length)).toBe(slides)
  })
})
