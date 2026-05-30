import { describe, it, expect } from 'vitest'
import { resolveActiveSlide, mapActiveSlide, toFlatVerticalIndex } from './active-slide-mapper'

function deck() {
  return {
    slides: [
      {
        id: 'p0',
        elements: [{ id: 'a' }],
        children: [
          { id: 'c0', elements: [{ id: 'ca' }] },
          { id: 'c1', elements: [{ id: 'cb' }] },
        ],
      },
      { id: 'p1', elements: [{ id: 'b' }] },
    ],
  }
}

describe('active-slide-mapper', () => {
  describe('resolveActiveSlide', () => {
    it('returns the parent slide at currentSlideIndex when no vertical edit', () => {
      const s = resolveActiveSlide(deck().slides, 0, null)
      expect(s.id).toBe('p0')
    })

    it('returns the active child when a vertical edit is set (by parent id)', () => {
      const s = resolveActiveSlide(deck().slides, 0, { parentId: 'p0', child: 1 })
      expect(s.id).toBe('c1')
    })

    it('falls back to the parent when the tracked child index is out of range', () => {
      const s = resolveActiveSlide(deck().slides, 0, { parentId: 'p0', child: 9 })
      expect(s.id).toBe('p0')
    })

    it('falls back to the parent at currentSlideIndex when the parent id is gone', () => {
      const s = resolveActiveSlide(deck().slides, 1, { parentId: 'missing', child: 0 })
      expect(s.id).toBe('p1')
    })
  })

  describe('mapActiveSlide', () => {
    it('maps the parent slide when no vertical edit', () => {
      const next = mapActiveSlide(deck(), 0, null, (s) => ({ ...s, elements: [...s.elements, { id: 'new' }] }))
      expect(next.slides[0].elements.map((e) => e.id)).toEqual(['a', 'new'])
      // untouched
      expect(next.slides[1].elements.map((e) => e.id)).toEqual(['b'])
    })

    it('maps the active CHILD, not the parent, when a vertical edit is set', () => {
      const next = mapActiveSlide(deck(), 0, { parentId: 'p0', child: 0 }, (s) => ({
        ...s,
        elements: [...s.elements, { id: 'x' }],
      }))
      // parent unchanged
      expect(next.slides[0].elements.map((e) => e.id)).toEqual(['a'])
      // child 0 changed
      expect(next.slides[0].children[0].elements.map((e) => e.id)).toEqual(['ca', 'x'])
      // child 1 unchanged
      expect(next.slides[0].children[1].elements.map((e) => e.id)).toEqual(['cb'])
    })

    it('returns prev unchanged when the active child cannot be resolved', () => {
      const d = deck()
      const next = mapActiveSlide(d, 0, { parentId: 'p0', child: 9 }, (s) => ({ ...s, elements: [] }))
      // out-of-range child -> no-op on children, parent untouched
      expect(next.slides[0].elements.map((e) => e.id)).toEqual(['a'])
      expect(next.slides[0].children[0].elements.map((e) => e.id)).toEqual(['ca'])
    })
  })

  describe('toFlatVerticalIndex', () => {
    it('maps child=null to flat 0 (the parent)', () => {
      expect(toFlatVerticalIndex({ child: null })).toBe(0)
      expect(toFlatVerticalIndex(null)).toBe(0)
    })
    it('maps child N to flat N+1', () => {
      expect(toFlatVerticalIndex({ child: 0 })).toBe(1)
      expect(toFlatVerticalIndex({ child: 2 })).toBe(3)
    })
  })
})
