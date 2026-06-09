import { describe, expect, it } from 'vitest'
import { resolvePointerDownSelection } from './active-slide-selection'

const slide = (elements) => ({ id: 's1', elements })

const ungrouped = slide([
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
])

const grouped = slide([
  { id: 'g1', groupId: 'G' },
  { id: 'g2', groupId: 'G' },
  { id: 'lone' },
])

describe('resolvePointerDownSelection', () => {
  it('replaces selection with an unselected element grabbed without shift on move', () => {
    const next = resolvePointerDownSelection({
      activeSlide: ungrouped,
      elementId: 'c',
      currentSelectionIds: ['a', 'b'],
      shiftKey: false,
      type: 'move',
    })
    expect(next).toEqual(['c'])
  })

  it('expands to the whole group when grabbing an unselected grouped element', () => {
    const next = resolvePointerDownSelection({
      activeSlide: grouped,
      elementId: 'g1',
      currentSelectionIds: ['lone'],
      shiftKey: false,
      type: 'move',
    })
    expect(next.sort()).toEqual(['g1', 'g2'])
  })

  it('keeps the current multi-selection when grabbing an already-selected element', () => {
    const next = resolvePointerDownSelection({
      activeSlide: ungrouped,
      elementId: 'a',
      currentSelectionIds: ['a', 'b', 'c'],
      shiftKey: false,
      type: 'move',
    })
    expect(next).toEqual(['a', 'b', 'c'])
  })

  it('preserves the current selection when shift is held (additive intent)', () => {
    const next = resolvePointerDownSelection({
      activeSlide: ungrouped,
      elementId: 'c',
      currentSelectionIds: ['a', 'b'],
      shiftKey: true,
      type: 'move',
    })
    expect(next).toEqual(['a', 'b'])
  })

  it('preserves the current selection for resize/rotate handles (non-move)', () => {
    const next = resolvePointerDownSelection({
      activeSlide: ungrouped,
      elementId: 'c',
      currentSelectionIds: ['a', 'b'],
      shiftKey: false,
      type: 'resize',
    })
    expect(next).toEqual(['a', 'b'])
  })
})
