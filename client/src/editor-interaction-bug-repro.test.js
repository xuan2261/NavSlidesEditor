import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { applyResize } from './components/canvas/use-canvas-resize-rotate'
import useCanvasRubberBandSelection from './components/canvas/use-canvas-rubber-band-drag-selection'
import { useSlideOperations } from './hooks/use-slide-operations'
import {
  createCopyOperation,
  createPasteOperation,
  createDuplicateOperation,
  useClipboard,
} from './hooks/use-clipboard'
import { useEditorStore } from './stores/editor-store'

/**
 * Regression harness for EditorPage element/control interaction bugs found in
 * diagnostic audits. Tests assert the corrected behavior directly and should
 * stay green after fixes land.
 */

const byId = (els, id) => els.find((e) => e.id === id)

// ── resize math honors element rotation ─────────────────────────────────────
describe('resize honors element rotation', () => {
  it('grows a rotated element along its rotated axis while pinning the opposite edge in world space', () => {
    const start = { x: 100, y: 100, width: 200, height: 100, rotation: 45 }
    const dx = 50
    const dy = 0
    const rad = (45 * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    // Pointer delta projected onto the element's local x axis (the E handle axis).
    const ldx = dx * cos + dy * sin

    const out = applyResize('e', start, dx, dy)

    // (b) New width is the start width plus the delta projected onto the rotated axis.
    expect(out.width).toBeCloseTo(start.width + ldx, 6)
    expect(out.height).toBeCloseTo(start.height, 6)

    // (a) The fixed (west) edge midpoint stays put in WORLD space.
    const westMidWorld = (el) => {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      return { x: cx - (el.width / 2) * cos, y: cy - (el.width / 2) * sin }
    }
    const before = westMidWorld(start)
    const after = westMidWorld({ ...start, ...out })
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)

    // (c) Center moves by exactly half the projected delta along the rotated axis.
    const before_cx = start.x + start.width / 2
    const before_cy = start.y + start.height / 2
    const after_cx = out.x + out.width / 2
    const after_cy = out.y + out.height / 2
    expect(after_cx - before_cx).toBeCloseTo((ldx / 2) * cos, 6)
    expect(after_cy - before_cy).toBeCloseTo((ldx / 2) * sin, 6)
  })

  it('reduces to the legacy axis-aligned result when rotation is 0', () => {
    const start = { x: 100, y: 100, width: 200, height: 100, rotation: 0 }
    const out = applyResize('e', start, 50, 0)
    expect(out).toEqual({ x: 100, y: 100, width: 250, height: 100 })
  })
})

// ── clipboard ops must re-group copies under a fresh id, never reuse the source ─
describe('clipboard ops give copies a fresh group identity', () => {
  // Two independent groups on one slide: G1 = {a, b}, G2 = {c, d}.
  const grouped = [
    { id: 'a', groupId: 'G1', x: 0, y: 0, width: 50, height: 50 },
    { id: 'b', groupId: 'G1', x: 10, y: 10, width: 50, height: 50 },
    { id: 'c', groupId: 'G2', x: 20, y: 20, width: 50, height: 50 },
    { id: 'd', groupId: 'G2', x: 30, y: 30, width: 50, height: 50 },
  ]

  it('paste rebuilds each source group under its own new shared id without merging them', () => {
    const copied = createCopyOperation({
      slideElements: grouped,
      selectedElementIds: ['a', 'b', 'c', 'd'],
    })
    const { elements } = createPasteOperation({ clipboardElements: copied })
    expect(elements).toHaveLength(4)
    const [a, b, c, d] = elements
    // Members of one source group share ONE new id.
    expect(a.groupId).toBe(b.groupId)
    expect(c.groupId).toBe(d.groupId)
    // The two groups stay distinct — they must not collapse into one.
    expect(a.groupId).not.toBe(c.groupId)
    // None of the new ids reuse a source group id.
    for (const id of [a.groupId, c.groupId]) {
      expect(id).not.toBe('G1')
      expect(id).not.toBe('G2')
      expect(id).toBeTruthy()
    }
  })

  it('duplicate rebuilds a group under a new shared id, not the source id', () => {
    const { toAdd } = createDuplicateOperation({
      slideElements: grouped,
      selectedElementIds: ['a', 'b'],
    })
    expect(toAdd).toHaveLength(2)
    const [a, b] = toAdd
    expect(a.groupId).toBe(b.groupId)
    expect(a.groupId).not.toBe('G1')
    expect(a.groupId).toBeTruthy()
  })

  it('a lone survivor of a group pastes ungrouped (a 1-member group is meaningless)', () => {
    const copied = createCopyOperation({ slideElements: grouped, selectedElementIds: ['a'] })
    const { elements } = createPasteOperation({ clipboardElements: copied })
    expect(elements).toHaveLength(1)
    expect(elements[0].groupId).toBeUndefined()
  })
})

// ── repeated paste of one clipboard must cascade, not stack ──────────────────
describe('repeated paste cascades instead of overlapping', () => {
  it('a higher pasteIndex lands further from the origin', () => {
    const clip = [{ x: 100, y: 100, width: 50, height: 50 }]
    const first = createPasteOperation({ clipboardElements: clip, pasteIndex: 0 })
    const second = createPasteOperation({ clipboardElements: clip, pasteIndex: 1 })
    expect(first.elements[0].x).toBe(120) // 100 + 20*(0+1)
    expect(second.elements[0].x).toBe(140) // 100 + 20*(1+1)
    expect(second.elements[0].x).not.toBe(first.elements[0].x)
  })

  it('pasting twice through the hook cascades the second copy past the first', () => {
    useEditorStore.setState({ selectedElementIds: [], clipboard: null, pasteCount: 0 })
    let deck = { slides: [{ id: 's1', elements: [] }] }
    const setPresentation = (updater) => {
      deck = updater(deck)
    }
    const mapActiveSlide = (prev, fn) => ({
      ...prev,
      slides: prev.slides.map((s, i) => (i === 0 ? fn(s) : s)),
    })
    const clip = [{ x: 100, y: 100, width: 50, height: 50 }]
    const { result } = renderHook(() => useClipboard({ mapActiveSlide, setPresentation }))

    act(() => result.current.performPaste(clip))
    act(() => result.current.performPaste(clip))

    const xs = deck.slides[0].elements.map((el) => el.x)
    expect(xs).toEqual([120, 140])
  })
})

// ── rubber-band marquee must skip hidden / locked elements ──────────────────
describe('rubber-band marquee excludes hidden and locked elements', () => {
  function setupRubberBand(elements) {
    const ref = { current: null }
    const { result } = renderHook(() =>
      useCanvasRubberBandSelection({
        slide: { elements },
        onToggleSelectElement: () => {},
        rubberBandRef: ref,
      })
    )
    return result.current
  }

  function marqueeOverAll(rb) {
    let hits = []
    act(() => rb.startRubberBand(0, 0))
    act(() => rb.updateRubberBand(500, 500))
    act(() => {
      hits = rb.endRubberBand(() => {})
    })
    return hits
  }

  it('a hidden element inside the marquee is not selected, but a visible one is', () => {
    const rb = setupRubberBand([
      { id: 'vis', x: 10, y: 10, width: 100, height: 100 },
      { id: 'hid', hidden: true, x: 20, y: 20, width: 50, height: 50 },
    ])
    const hits = marqueeOverAll(rb)
    expect(hits).not.toContain('hid')
    expect(hits).toContain('vis')
  })

  it('a locked element inside the marquee is not selected, but a visible one is', () => {
    const rb = setupRubberBand([
      { id: 'vis', x: 10, y: 10, width: 100, height: 100 },
      { id: 'lock', locked: true, x: 30, y: 30, width: 50, height: 50 },
    ])
    const hits = marqueeOverAll(rb)
    expect(hits).not.toContain('lock')
    expect(hits).toContain('vis')
  })

  it('catches a rotated element by its visual footprint, not its unrotated box', () => {
    // A 100x100 square at (100,100) rotated 45deg has an AABB ~[79,79]..[221,221]
    // (corner reaches x≈79). A marquee touching only [60..85] misses the
    // unrotated box (x=100) but overlaps the rotated corner.
    const rb = setupRubberBand([
      { id: 'rot', x: 100, y: 100, width: 100, height: 100, rotation: 45 },
    ])
    let hits = []
    act(() => rb.startRubberBand(60, 140))
    act(() => rb.updateRubberBand(85, 160))
    act(() => {
      hits = rb.endRubberBand(() => {})
    })
    expect(hits).toContain('rot')
  })
})

// ── align/distribute must not move locked elements ──────────────────────────
describe('align leaves locked elements in place', () => {
  function setupOps(initialElements, selectedIds) {
    const state = { presentation: { slides: [{ id: 's1', elements: initialElements }] } }
    const selectedRef = { current: selectedIds }
    const idxRef = { current: 0 }
    const editingRef = { current: null }
    const setPresentation = (updater) => {
      state.presentation = typeof updater === 'function' ? updater(state.presentation) : updater
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

  it('align-left leaves a locked element in place while the free one snaps to min x', () => {
    // locked 'a' sits at x=400 (not the min); free 'b' at x=100 is the min.
    const { ops, els } = setupOps(
      [
        { id: 'a', locked: true, x: 400, y: 0, width: 100, height: 50 },
        { id: 'b', x: 100, y: 0, width: 100, height: 50 },
      ],
      ['a', 'b']
    )
    act(() => ops.alignElements('left'))
    // locked 'a' stays at 400; free 'b' aligns to the min x = 100.
    expect(byId(els(), 'a').x).toBe(400)
    expect(byId(els(), 'b').x).toBe(100)
  })

  it('one free + one locked selected is a no-op (count re-checked after locked filter)', () => {
    // After dropping locked 'a' only free 'b' remains — a lone survivor must
    // not self-align, so it keeps its original x.
    const { ops, els } = setupOps(
      [
        { id: 'a', locked: true, x: 400, y: 0, width: 100, height: 50 },
        { id: 'b', x: 100, y: 0, width: 100, height: 50 },
      ],
      ['a', 'b']
    )
    act(() => ops.alignElements('right'))
    expect(byId(els(), 'a').x).toBe(400)
    expect(byId(els(), 'b').x).toBe(100)
  })

  it('align-left uses the rotated visual edge of a rotated element', () => {
    // 'rot' is a 100x100 square rotated 45deg → its visual left edge sits
    // halfDiag-50 ≈ 20.7px LEFT of its x (visual left ≈ 79.29). That is the
    // min, so 'rot' stays and the flat element snaps so their VISUAL left
    // edges line up — proving align uses the rotated AABB, not the raw box.
    const { ops, els } = setupOps(
      [
        { id: 'rot', x: 100, y: 100, width: 100, height: 100, rotation: 45 },
        { id: 'flat', x: 300, y: 100, width: 100, height: 100 },
      ],
      ['rot', 'flat']
    )
    act(() => ops.alignElements('left'))
    const rot = byId(els(), 'rot')
    const flat = byId(els(), 'flat')
    const halfDiag = (100 * Math.SQRT2) / 2 // 70.71
    const rotVisualLeft = rot.x + 50 - halfDiag // center_x - half-AABB-width
    // rot was already the minimum visual left, so it does not move.
    expect(rot.x).toBeCloseTo(100, 4)
    // flat's left edge now matches rot's visual left (≈ 79.29), NOT x=100.
    expect(flat.x).toBeCloseTo(rotVisualLeft, 4)
    expect(flat.x).toBeLessThan(100)
  })
})
