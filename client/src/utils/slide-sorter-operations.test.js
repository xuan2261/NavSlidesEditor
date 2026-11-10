import { describe, expect, it } from 'vitest'
import { applySorterSlideOperation, getSorterCurrentDestination } from './slide-sorter-operations'

const makePresentation = () => ({
  slides: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    elements: [{ id: `${id}-text`, type: 'text', content: id }],
  })),
})

describe('sorter identity and queued mutations', () => {
  it('retains the current slide and vertical address when moved or when a predecessor is deleted', () => {
    const pres = makePresentation()
    pres.slides[1].children = [{ id: 'child-b', elements: [] }]
    const vertical = { parentId: 'b', child: 0 }
    const moved = applySorterSlideOperation(pres, 'move', 'b', 3)
    expect(moved.slides.map((slide) => slide.id)).toEqual(['a', 'c', 'd', 'b'])
    expect(getSorterCurrentDestination(pres.slides, 1, moved.slides, vertical)).toEqual({ index: 3, child: 0, identityChanged: false })
    const deleted = applySorterSlideOperation(pres, 'delete', 'a')
    expect(getSorterCurrentDestination(pres.slides, 1, deleted.slides, vertical)).toEqual({ index: 0, child: 0, identityChanged: false })
  })

  it('clears the vertical address and signals selection cleanup when the current slide is removed at the same index', () => {
    const pres = makePresentation()
    const next = applySorterSlideOperation(pres, 'delete', 'b')
    expect(getSorterCurrentDestination(pres.slides, 1, next.slides, { parentId: 'b', child: 0 })).toEqual({ index: 1, child: null, identityChanged: true })
    expect(next.slides[1].id).toBe('c')
  })

  it('applies all queued deletions by original identity without deleting shifted neighbors', () => {
    const pres = makePresentation()
    const next = ['b', 'c'].reduce((current, id) => applySorterSlideOperation(current, 'delete', id), pres)
    expect(next.slides.map((slide) => slide.id)).toEqual(['a', 'd'])
    expect(pres.slides.map((slide) => slide.id)).toEqual(['a', 'b', 'c', 'd'])
    const single = { slides: [pres.slides[0]] }
    expect(applySorterSlideOperation(single, 'delete', 'a')).toBe(single)
  })

  it('duplicates every queued original rather than the shifted clone and regenerates nested IDs', () => {
    const pres = makePresentation()
    pres.slides[1].children = [{ id: 'child-b', elements: [{ id: 'nested-b', type: 'text', content: 'child-b' }] }]
    const next = ['b', 'c'].reduce((current, id) => applySorterSlideOperation(current, 'duplicate', id), pres)
    expect(next.slides.map((slide) => slide.elements[0].content)).toEqual(['a', 'b', 'b', 'c', 'c', 'd'])
    expect(next.slides.filter((slide) => slide.id === 'b')).toEqual([pres.slides[1]])
    expect(next.slides.filter((slide) => slide.id === 'c')).toEqual([pres.slides[2]])
    expect(next.slides[2].elements[0].id).not.toBe('b-text')
    expect(next.slides[2].children[0].id).not.toBe('child-b')
    expect(next.slides[2].children[0].elements[0].id).not.toBe('nested-b')
    expect(getSorterCurrentDestination(pres.slides, 2, next.slides)).toEqual({ index: 3, child: null, identityChanged: false })
  })

  it('does not mutate the deck for a stale missing slide or out-of-range move', () => {
    const pres = makePresentation()
    expect(applySorterSlideOperation(pres, 'delete', 'gone')).toBe(pres)
    expect(applySorterSlideOperation(pres, 'move', 'b', -1)).toBe(pres)
    expect(applySorterSlideOperation(pres, 'move', 'b', pres.slides.length)).toBe(pres)
  })
})
