import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../stores/editor-store'
import { authoringSeed, useAuthoringSafetyHarness } from './editor-authoring-safety-harness'

beforeEach(() => {
  vi.useFakeTimers()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useEditorStore.getState().clearSelection()
})
function openMaster(result) {
  act(() => result.current.openLayoutManager())
  act(() => result.current.layoutManagerProps.onEditMaster('master'))
  act(() => useEditorStore.getState().setSelectedElementIds(['m-a', 'm-b']))
}
const fixed = (result) => result.current.presentation.layoutMasters[0].fixedElements
const locks = (elements) =>
  elements.map((element) => (Object.hasOwn(element, 'locked') ? element.locked : 'absent'))

describe('master authoring stored locks, connectors and history', () => {
  it('aligns only the selected master without flattening stored lock metadata', () => {
    const seed = authoringSeed()
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    openMaster(result)
    act(() => result.current.alignElements('left'))
    expect(fixed(result).map((element) => element.x)).toEqual([100, 100, 250, 700])
    expect(locks(fixed(result))).toEqual([true, false, true, 'absent'])
    expect(result.current.presentation.slides).toEqual(seed.slides)
    expect(result.current.presentation.layoutMasters[1]).toEqual(seed.layoutMasters[1])
    act(() => result.current.handleUndo())
    expect(result.current.presentation).toEqual(seed)
    act(() => result.current.handleRedo())
    expect(fixed(result).map((element) => element.x)).toEqual([100, 100, 250, 700])
    expect(locks(fixed(result))).toEqual([true, false, true, 'absent'])
    act(() => result.current.exitMasterEdit())
    expect(result.current.masterEdit).toBeNull()
    expect(locks(fixed(result))).toEqual([true, false, true, 'absent'])
  })
  it('retains master-only selection across immediate undo/redo and routes the next numeric edit there', () => {
    const seed = authoringSeed()
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    openMaster(result)
    act(() => result.current.alignElements('left'))
    act(() => result.current.handleUndo())
    expect(result.current.selectedIds).toEqual(['m-a', 'm-b'])
    expect(result.current.masterEdit.id).toBe('master')
    act(() => result.current.handleRedo())
    expect(result.current.selectedIds).toEqual(['m-a', 'm-b'])
    act(() => result.current.updateSelectedElements({ x: 0 }))
    expect(fixed(result).map((element) => element.x)).toEqual([0, 0, 250, 700])
    expect(result.current.presentation.slides).toEqual(seed.slides)
  })
  it('persists explicit batch unlock and relock without altering unselected metadata', () => {
    const seed = authoringSeed()
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    openMaster(result)
    act(() => result.current.updateSelectedElements({ locked: false }))
    expect(locks(fixed(result))).toEqual([false, false, true, 'absent'])
    act(() => result.current.updateSelectedElements({ locked: true }))
    expect(locks(fixed(result))).toEqual([true, true, true, 'absent'])
    expect(
      result.current.masterEdit.fixedElements.slice(0, 2).map((element) => element.locked)
    ).toEqual([false, false])
  })
  it('persists attached connector fallback coordinates when one master element moves', () => {
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
      x2: 880,
      y2: 140,
      cx: 500,
      cy: 20,
      stroke: '#112233',
      connections: { start: { targetId: 'm-a', anchor: 'e' } },
      locked: true,
    }
    seed.layoutMasters[0].fixedElements.push(line)
    const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
    openMaster(result)
    act(() => useEditorStore.getState().setSelectedElementIds(['m-a']))
    act(() => result.current.updateSelectedElements({ x: 0 }))
    expect(fixed(result)[0]).toMatchObject({ x: 0, y: 50, locked: true })
    expect(fixed(result).find((element) => element.id === 'connector')).toEqual({
      ...line,
      x1: 180,
    })
    act(() => result.current.handleUndo())
    expect(fixed(result).find((element) => element.id === 'connector')).toEqual(line)
    act(() => result.current.handleRedo())
    expect(fixed(result).find((element) => element.id === 'connector')).toEqual({
      ...line,
      x1: 180,
    })
  })
})

it('preserves transformed master identities, order, deletion and new lock metadata', () => {
  const seed = authoringSeed()
  const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
  openMaster(result)
  act(() =>
    result.current.setPresentation((previous) =>
      result.current.mapAuthoringTarget(previous, (slide) => ({
        ...slide,
        elements: [
          slide.elements[3],
          slide.elements[2],
          { ...slide.elements[0], x: 12 },
          { id: 'new', type: 'shape', x: 60, y: 80, width: 40, height: 30, locked: true },
        ],
      }))
    )
  )
  expect(fixed(result).map((element) => element.id)).toEqual(['m-unset', 'm-c', 'm-a', 'new'])
  expect(locks(fixed(result))).toEqual(['absent', true, true, true])
  expect(fixed(result)[2]).toEqual({ ...seed.layoutMasters[0].fixedElements[0], x: 12 })
})
it('keeps an admitted duplicate-ID unlock intent through a later geometry partial', () => {
  const seed = authoringSeed()
  const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
  openMaster(result)
  act(() =>
    result.current.updateElements([
      { id: 'm-a', locked: false },
      { id: 'm-a', x: 60 },
    ])
  )
  expect(fixed(result)[0]).toEqual({
    ...seed.layoutMasters[0].fixedElements[0],
    x: 60,
    locked: false,
  })
  expect(locks(fixed(result).slice(1))).toEqual([false, true, 'absent'])
})
it('clears disappeared master selection without resurrecting it when redo restores the master', () => {
  const seed = authoringSeed()
  const master = seed.layoutMasters.shift()
  const { result } = renderHook(() => useAuthoringSafetyHarness(seed))
  act(() =>
    result.current.setPresentation((previous) => ({
      ...previous,
      layoutMasters: [master, ...previous.layoutMasters],
    }))
  )
  openMaster(result)
  act(() => useEditorStore.getState().setEditingElementId('m-a'))
  act(() => result.current.handleUndo())
  expect(result.current.masterEdit).toBeNull()
  expect(result.current.selectedIds).toEqual([])
  expect(result.current.editingId).toBeNull()
  act(() => result.current.handleRedo())
  expect(result.current.masterEdit.id).toBe('master')
  expect(result.current.selectedIds).toEqual([])
  expect(result.current.editingId).toBeNull()
})
