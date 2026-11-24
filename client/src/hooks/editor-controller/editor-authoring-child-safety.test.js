import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../stores/editor-store'
import { authoringSeed, shapes, useAuthoringSafetyHarness } from './editor-authoring-safety-harness'

beforeEach(() => {
  vi.useFakeTimers()
  useEditorStore.getState().clearSelection()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useEditorStore.getState().clearSelection()
})
function selectChild(result, ids = ['a', 'b', 'c']) {
  act(() => result.current.setVerticalEdit({ parentId: 'parent', child: 0 }))
  act(() => useEditorStore.getState().setSelectedElementIds(ids))
}
const child = (result) => result.current.presentation.slides[0].children[0]
function expectSentinels(result, seed) {
  expect(result.current.presentation.slides[0].elements).toEqual(seed.slides[0].elements)
  expect(result.current.presentation.slides[0].children[1]).toEqual(seed.slides[0].children[1])
  expect(result.current.presentation.layoutMasters).toEqual(seed.layoutMasters)
}

describe('real child selection operations and history', () => {
  it.each([
    ['left', [100, 100, 100]],
    ['center-h', [200, 250, 260]],
    ['right', [300, 400, 420]],
  ])(
    'keeps %s alignment, immediate undo and redo on the effective child',
    (direction, positions) => {
      const seed = authoringSeed()
      const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
      selectChild(result)
      act(() => result.current.alignElements(direction))
      expect(child(result).elements).toEqual(
        shapes.map((element, index) => ({ ...element, x: positions[index] }))
      )
      expectSentinels(result, seed)
      act(() => result.current.handleUndo())
      expect(result.current.presentation).toEqual(seed)
      expect(result.current.selectedIds).toEqual(['a', 'b', 'c'])
      act(() => result.current.handleRedo())
      expect(child(result).elements.map((element) => element.x)).toEqual(positions)
      expect(result.current.verticalEdit).toEqual({ parentId: 'parent', child: 0 })
      expectSentinels(result, seed)
    }
  )
  it('keeps numeric deltas and the next changed selection on the child', () => {
    const seed = authoringSeed()
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    selectChild(result)
    act(() => result.current.updateSelectedElements({ x: 0 }))
    expect(child(result).elements.map((element) => element.x)).toEqual([-150, 150, 0])
    act(() => result.current.handleUndo())
    expect(result.current.presentation).toEqual(seed)
    act(() => result.current.handleRedo())
    act(() => useEditorStore.getState().setSelectedElementIds(['b']))
    act(() => result.current.updateSelectedElements({ y: 0 }))
    expect(child(result).elements).toEqual([
      { ...shapes[0], x: -150 },
      { ...shapes[1], x: 150, y: 0 },
      { ...shapes[2], x: 0 },
    ])
    expectSentinels(result, seed)
  })
  it.each(['slide', 'all', 'one-free'])(
    'does not mutate a protected %s child selection',
    (protection) => {
      const seed = authoringSeed()
      const target = seed.slides[0].children[0]
      if (protection === 'slide') target.locked = true
      else
        target.elements = target.elements.map((element, index) => ({
          ...element,
          locked: protection === 'all' || index > 0,
        }))
      const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
      selectChild(result)
      act(() => result.current.alignElements('left'))
      expect(result.current.presentation).toEqual(seed)
    }
  )
  it('moves two free members but preserves a locked member in the real operation', () => {
    const seed = authoringSeed()
    seed.slides[0].children[0].elements[2].locked = true
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    selectChild(result)
    act(() => result.current.alignElements('left'))
    expect(child(result).elements).toEqual([
      shapes[0],
      { ...shapes[1], x: 100 },
      { ...shapes[2], locked: true },
    ])
    expectSentinels(result, seed)
  })
  it('restores attached endpoints and metadata in the same child undo unit', () => {
    const seed = authoringSeed()
    const line = {
      id: 'connector',
      type: 'line',
      x: 20,
      y: 10,
      width: 900,
      height: 300,
      x1: 280,
      y1: 90,
      x2: 380,
      y2: 140,
      cx: 500,
      cy: 20,
      locked: true,
      connections: { start: { targetId: 'a', anchor: 'e' }, end: { targetId: 'b', anchor: 'w' } },
    }
    seed.slides[0].children[0].elements.push(line)
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    selectChild(result, ['a', 'b'])
    act(() => result.current.alignElements('left'))
    expect(child(result).elements.at(-1)).toEqual({ ...line, x2: 80 })
    act(() => result.current.handleUndo())
    expect(child(result).elements.at(-1)).toEqual(line)
    act(() => result.current.handleRedo())
    expect(child(result).elements.at(-1)).toEqual({ ...line, x2: 80 })
    expectSentinels(result, seed)
  })
})

describe('history reconciles selection against the final ordinary address', () => {
  it('clears child selection when restored slide count clamps the displayed index', () => {
    const seed = authoringSeed()
    seed.slides.push({ id: 'final-parent', elements: [{ ...shapes[1], id: 'final-guard' }] })
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    act(() =>
      result.current.setPresentation((previous) => ({
        ...previous,
        slides: [...previous.slides, { id: 'temporary-parent', elements: [] }],
      }))
    )
    act(() => result.current.setCurrentSlideIndex(2))
    selectChild(result, ['a'])
    act(() => useEditorStore.getState().setEditingElementId('a'))
    act(() => result.current.handleUndo())
    expect(result.current.presentation).toEqual(seed)
    expect(result.current.verticalEdit).toBeNull()
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.editingId).toBeNull()
  })
  it('does not retain selection from a different parent after the child address disappears', () => {
    const seed = authoringSeed()
    seed.slides[0].elements = [{ ...shapes[0] }]
    seed.slides[0].children = []
    seed.slides.push({
      id: 'displayed-parent',
      elements: [{ ...shapes[1], id: 'displayed-guard' }],
    })
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    act(() => result.current.setCurrentSlideIndex(1))
    act(() =>
      result.current.setPresentation((previous) => ({
        ...previous,
        slides: previous.slides.map((slide, index) =>
          index === 0
            ? {
                ...slide,
                elements: [],
                children: [{ id: 'moved-child', elements: [{ ...shapes[0] }] }],
              }
            : slide
        ),
      }))
    )
    selectChild(result, ['a'])
    act(() => useEditorStore.getState().setEditingElementId('a'))
    act(() => result.current.handleUndo())
    expect(result.current.presentation).toEqual(seed)
    expect(result.current.verticalEdit).toBeNull()
    expect(result.current.selectedIds).toEqual([])
    expect(result.current.editingId).toBeNull()
  })
})
