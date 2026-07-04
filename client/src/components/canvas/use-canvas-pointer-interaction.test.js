/**
 * Unit tests for use-canvas-pointer-interaction.js
 *
 * Test strategy:
 * - applyCropHandle is a pure function — test it directly
 * - startElementDrag side-effects only (sets pendingDragRef) — test via ref inspection
 * - No @testing-library/react needed (not installed in client)
 */
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import useCanvasPointerInteraction, {
  applyCropHandle,
  applyMoveBatch,
  computeClampedBatchDelta,
} from './use-canvas-pointer-interaction'

// Re-exported pure helpers from the hook module for direct testing
// applyCropHandle and startElementDrag are exported for testing purposes
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('applyCropHandle (pure math)', () => {
  const cases = [
    {
      handle: 'nw',
      dx: -0.05,
      dy: -0.05,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: true,
      expectY: true,
    },
    {
      handle: 'se',
      dx: 0.05,
      dy: 0.05,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: false,
      expectY: false,
    },
    {
      handle: 'e',
      dx: 0.1,
      dy: 0,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: false,
      expectY: false,
    },
    {
      handle: 'n',
      dx: 0,
      dy: -0.1,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: false,
      expectY: true,
    },
    {
      handle: 'w',
      dx: -0.1,
      dy: 0,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: true,
      expectY: false,
    },
    {
      handle: 's',
      dx: 0,
      dy: 0.1,
      crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      expectX: false,
      expectY: false,
    },
  ]

  cases.forEach(({ handle, dx, dy, crop, expectX, expectY }) => {
    it(`handle ${handle}: x ${expectX ? 'changes' : 'unchanged'}, y ${expectY ? 'changes' : 'unchanged'}`, () => {
      const result = applyCropHandle(handle, { ...crop }, dx, dy, 200, 100)
      if (expectX) expect(result.x).not.toBe(crop.x)
      if (!expectX) expect(result.x).toBe(crop.x)
      if (expectY) expect(result.y).not.toBe(crop.y)
      if (!expectY) expect(result.y).toBe(crop.y)
    })
  })

  it('SE handle: increases w and h, preserves x and y', () => {
    const crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    const result = applyCropHandle('se', crop, 0.05, 0.05, 200, 100)
    expect(result.w).toBeGreaterThan(crop.w)
    expect(result.h).toBeGreaterThan(crop.h)
    expect(result.x).toBe(crop.x)
    expect(result.y).toBe(crop.y)
  })

  it('enforces minimum crop of 0.05', () => {
    const crop = { x: 0.01, y: 0.01, w: 0.99, h: 0.99 }
    const result = applyCropHandle('nw', crop, -0.5, -0.5, 200, 100)
    expect(result.w).toBeGreaterThanOrEqual(0.05)
    expect(result.h).toBeGreaterThanOrEqual(0.05)
  })

  it('clamps x/y to not go below 0', () => {
    const crop = { x: 0.05, y: 0.05, w: 0.8, h: 0.8 }
    const result = applyCropHandle('nw', crop, -0.5, -0.5, 200, 100)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('clamps w/h so they do not exceed slide bounds', () => {
    const crop = { x: 0.9, y: 0.9, w: 0.05, h: 0.05 }
    const result = applyCropHandle('se', crop, 0.5, 0.5, 200, 100)
    expect(result.w).toBeLessThanOrEqual(1 - result.x)
    expect(result.h).toBeLessThanOrEqual(1 - result.y)
  })

  it('NE: w and h both increase (top-right outward drag)', () => {
    // NE outward: dx>0 → drag rightward (width increases), dy<0 → drag upward (h increases)
    const crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    const result = applyCropHandle('ne', crop, 20, -10, 200, 100)
    expect(result.w).toBeGreaterThan(crop.w)
    expect(result.h).toBeGreaterThan(crop.h) // top moves up → visible region expands → h increases
    expect(result.x).toBe(crop.x)
    expect(result.y).toBeLessThan(crop.y)
  })

  it('SW: w and h both increase (bottom-left outward drag)', () => {
    // SW outward: dx<0 → drag leftward (width increases), dy>0 → drag downward (h increases)
    const crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    const result = applyCropHandle('sw', crop, -20, 10, 200, 100)
    expect(result.h).toBeGreaterThan(crop.h)
    expect(result.w).toBeGreaterThan(crop.w) // left moves left → visible region expands → w increases
    expect(result.y).toBe(crop.y)
    expect(result.x).toBeLessThan(crop.x)
  })
})

describe('exports', () => {
  it('applyCropHandle is exported from the module', () => {
    expect(typeof applyCropHandle).toBe('function')
  })
})

describe('batch move bounds', () => {
  it('computes one shared clamped delta near the right edge', () => {
    expect(
      computeClampedBatchDelta(
        [
          { id: 'a', x: 850, y: 10, width: 100, height: 80 },
          { id: 'b', x: 100, y: 20, width: 100, height: 80 },
        ],
        50,
        0,
        960,
        540
      )
    ).toEqual({ dx: 10, dy: 0 })
  })

  it('applies the shared clamped delta to every selected element', () => {
    expect(
      applyMoveBatch(
        [
          { id: 'a', x: 850, y: 10, width: 100, height: 80 },
          { id: 'b', x: 100, y: 20, width: 100, height: 80 },
        ],
        50,
        0,
        960,
        540
      )
    ).toEqual([
      { id: 'a', x: 860, y: 10 },
      { id: 'b', x: 110, y: 20 },
    ])
  })

  it('clamps top and left movement as a shared delta', () => {
    expect(
      computeClampedBatchDelta(
        [
          { id: 'a', x: 5, y: 4, width: 100, height: 80 },
          { id: 'b', x: 100, y: 30, width: 100, height: 80 },
        ],
        -20,
        -10,
        960,
        540
      )
    ).toEqual({ dx: -5, dy: -4 })
  })
})

function renderPointerInteraction() {
  const pendingDragRef = { current: null }
  const slide = {
    elements: [
      { id: 'free', x: 10, y: 20, width: 100, height: 80 },
      { id: 'locked', locked: true, x: 200, y: 220, width: 120, height: 90 },
    ],
  }

  const canvas = document.createElement('div')
  canvas.className = 'slide-canvas'
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 })
  document.body.appendChild(canvas)

  const hook = renderHook(() =>
    useCanvasPointerInteraction({
      scaleRef: { current: 1 },
      showGridRef: { current: false },
      gridSizeRef: { current: 10 },
      smartGuidesRef: { current: false },
      slideRef: { current: slide },
      selectedElementIdsRef: { current: ['free', 'locked'] },
      draggingRef: { current: null },
      pendingDragRef,
      cropDragRef: { current: null },
      rubberBandRef: { current: null },
      suppressCanvasClickRef: { current: false },
      onUpdateElement: vi.fn(),
      onUpdateElements: vi.fn(),
      snapToGrid: (value) => value,
      snapWithRef: (x, y) => ({ x, y }),
      getRotationAngle: vi.fn(),
      applyResize: vi.fn(),
      applyResizeAspectRatio: vi.fn(),
      clampToSlide: vi.fn(),
      startRubberBand: vi.fn(),
      updateRubberBand: vi.fn(),
      endRubberBand: vi.fn(() => []),
      applyRubberBandSelection: vi.fn(),
      setRubberBand: vi.fn(),
      setActiveGuides: vi.fn(),
      forceUpdate: vi.fn(),
      setSuppressCanvasClick: vi.fn(),
      setCropMode: vi.fn(),
      slideW: 960,
      slideH: 540,
    })
  )

  return { hook, pendingDragRef, slide }
}

describe('startElementDrag lock handling', () => {
  it('[cap:canvas.lock] does not create a pending drag for a locked element', () => {
    const { hook, pendingDragRef, slide } = renderPointerInteraction()

    hook.result.current.startElementDrag(
      { clientX: 210, clientY: 230 },
      'locked',
      'move',
      null,
      slide,
      1,
      ['free', 'locked']
    )

    expect(pendingDragRef.current).toBeNull()
  })

  it('[cap:canvas.lock] excludes locked selected elements from a mixed move drag', () => {
    const { hook, pendingDragRef, slide } = renderPointerInteraction()

    hook.result.current.startElementDrag(
      { clientX: 20, clientY: 30 },
      'free',
      'move',
      null,
      slide,
      1,
      ['free', 'locked']
    )

    expect(pendingDragRef.current.startEls).toEqual([
      { id: 'free', x: 10, y: 20, width: 100, height: 80 },
    ])
  })
})
