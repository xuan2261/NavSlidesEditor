import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSlideOperations } from './use-slide-operations'

// Drive the real hook with injected deps so we exercise the actual align/group
// geometry, not a reimplementation. A mutable holder stands in for React state.
function setupOps(initialElements, selectedIds) {
  const state = { presentation: { slides: [{ id: 's1', elements: initialElements }] } }
  const selectedRef = { current: selectedIds }
  const idxRef = { current: 0 }
  const editingRef = { current: null }
  const setPresentation = (updater) => {
    state.presentation =
      typeof updater === 'function' ? updater(state.presentation) : updater
  }
  const { result } = renderHook(() =>
    useSlideOperations({
      presentation: state.presentation,
      setPresentation,
      currentSlideIndex: 0,
      setCurrentSlideIndex: () => {},
      currentSlideIndexRef: idxRef,
      selectedElementIdsRef: selectedRef,
      editingElementIdRef: editingRef,
      mapActiveSlide: (prev, fn) =>
        prev ? { ...prev, slides: prev.slides.map((s, i) => (i === 0 ? fn(s) : s)) } : prev,
      getActiveSlide: () => state.presentation.slides[0],
    })
  )
  return { ops: result.current, els: () => state.presentation.slides[0].elements }
}

const byId = (els, id) => els.find((e) => e.id === id)

const THREE = [
  { id: 'a', x: 100, y: 50, width: 200, height: 100 },
  { id: 'b', x: 400, y: 300, width: 100, height: 60 },
  { id: 'c', x: 250, y: 150, width: 80, height: 40 },
]

describe('[cap:canvas.align tier:deep] alignment geometry', () => {
  it('left-aligns every selected element to the minimum x', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b', 'c'])
    act(() => ops.alignElements('left'))
    expect(els().map((e) => e.x)).toEqual([100, 100, 100])
  })

  it('right-aligns so each right edge meets the maximum right edge (500)', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b', 'c'])
    act(() => ops.alignElements('right'))
    expect(byId(els(), 'a').x).toBe(300) // 500 - 200
    expect(byId(els(), 'b').x).toBe(400) // 500 - 100
    expect(byId(els(), 'c').x).toBe(420) // 500 - 80
  })

  it('center-h aligns each element center to the group horizontal center (300)', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b', 'c'])
    act(() => ops.alignElements('center-h'))
    expect(byId(els(), 'a').x).toBe(200) // 300 - 200/2
    expect(byId(els(), 'b').x).toBe(250) // 300 - 100/2
    expect(byId(els(), 'c').x).toBe(260) // 300 - 80/2
  })

  it('top-aligns to the minimum y (50)', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b', 'c'])
    act(() => ops.alignElements('top'))
    expect(els().map((e) => e.y)).toEqual([50, 50, 50])
  })

  it('does nothing with fewer than 2 selected', () => {
    const { ops, els } = setupOps(THREE, ['a'])
    act(() => ops.alignElements('left'))
    expect(byId(els(), 'a').x).toBe(100) // unchanged
  })
})

describe('[cap:canvas.distribute tier:deep] even distribution among ≥3', () => {
  it('distribute-h spaces elements with an equal gap, endpoints fixed', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b', 'c'])
    act(() => ops.alignElements('distribute-h'))
    // sorted by x: a(100,w200) c(250,w80) b(400,w100); gap = (500-100-380)/2 = 10
    expect(byId(els(), 'a').x).toBe(100) // left endpoint fixed
    expect(byId(els(), 'c').x).toBe(310) // 100 + 200 + 10
    expect(byId(els(), 'b').x).toBe(400) // 310 + 80 + 10, right endpoint fixed
  })

  it('distribute-v spaces by equal vertical gap', () => {
    const tall = [
      { id: 'a', x: 0, y: 0, width: 50, height: 100 },
      { id: 'b', x: 0, y: 400, width: 50, height: 100 },
      { id: 'c', x: 0, y: 120, width: 50, height: 60 },
    ]
    const { ops, els } = setupOps(tall, ['a', 'b', 'c'])
    act(() => ops.alignElements('distribute-v'))
    // sorted by y: a(0,h100) c(120,h60) b(400,h100); gap=(500-0-260)/2=120
    expect(byId(els(), 'a').y).toBe(0)
    expect(byId(els(), 'c').y).toBe(220) // 0 + 100 + 120
    expect(byId(els(), 'b').y).toBe(400) // 220 + 60 + 120
  })
})

describe('[cap:canvas.group tier:deep] group / ungroup', () => {
  it('assigns one shared groupId to all selected, then clears it on ungroup', () => {
    const { ops, els } = setupOps(THREE, ['a', 'b'])
    act(() => ops.groupElements())
    const ga = byId(els(), 'a').groupId
    const gb = byId(els(), 'b').groupId
    expect(ga).toBeTruthy()
    expect(ga).toBe(gb) // same group
    expect(byId(els(), 'c').groupId).toBeUndefined() // untouched

    act(() => ops.ungroupElements())
    expect(byId(els(), 'a').groupId).toBeUndefined()
    expect(byId(els(), 'b').groupId).toBeUndefined()
  })

  it('does not group a single element (needs ≥2)', () => {
    const { ops, els } = setupOps(THREE, ['a'])
    act(() => ops.groupElements())
    expect(byId(els(), 'a').groupId).toBeUndefined()
  })
})
