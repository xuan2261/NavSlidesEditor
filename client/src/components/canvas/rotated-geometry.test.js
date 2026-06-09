import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  rotatePoint,
  getRotatedAABB,
  applyResize,
  applyResizeAspectRatio,
  clampToSlide,
  MIN_SIZE,
} from './use-canvas-resize-rotate'
import useCanvasPointerInteraction, { applyCropHandle } from './use-canvas-pointer-interaction'

describe('rotatePoint', () => {
  it('returns the input bit-for-bit at 0 degrees', () => {
    const p = rotatePoint(13, 27, 100, 50, 0)
    expect(p).toEqual({ x: 13, y: 27 })
  })

  it('rotates 90 degrees clockwise about a center', () => {
    // Point to the right of center maps to directly below it.
    const p = rotatePoint(10, 0, 0, 0, 90)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(10, 6)
  })
})

describe('getRotatedAABB', () => {
  it('equals the element box when unrotated', () => {
    const box = getRotatedAABB({ x: 10, y: 20, width: 200, height: 100 })
    expect(box).toMatchObject({ x: 10, y: 20, width: 200, height: 100, left: 10, top: 20, right: 210, bottom: 120 })
  })

  it('expands to the rotated extent for a rotated element, centered on the element center', () => {
    const el = { x: 0, y: 0, width: 200, height: 100, rotation: 90 }
    const box = getRotatedAABB(el)
    // 90deg swaps the visual footprint to 100 x 200, still centered at (100,50).
    expect(box.width).toBeCloseTo(100, 6)
    expect(box.height).toBeCloseTo(200, 6)
    expect((box.left + box.right) / 2).toBeCloseTo(100, 6)
    expect((box.top + box.bottom) / 2).toBeCloseTo(50, 6)
  })

  it('a 45deg square grows its AABB by sqrt(2)', () => {
    const box = getRotatedAABB({ x: 0, y: 0, width: 100, height: 100, rotation: 45 })
    expect(box.width).toBeCloseTo(100 * Math.SQRT2, 6)
    expect(box.height).toBeCloseTo(100 * Math.SQRT2, 6)
  })
})

describe('clampToSlide rotation-awareness', () => {
  it('preserves the world anchor of a rotated resize near a slide edge', () => {
    // Rotated element resized so its axis-aligned box would spill past x=0.
    const start = { x: 20, y: 200, width: 200, height: 100, rotation: 45 }
    const out = applyResize('w', start, -300, 0) // drag west edge far left
    const before = { ...out }
    clampToSlide(out, start, null, 960, 540)
    // The axis-aligned clamp is skipped for rotated elements: x/y/w/h untouched
    // (beyond the MIN_SIZE floor already applied), so the anchor is preserved.
    expect(out.x).toBe(before.x)
    expect(out.y).toBe(before.y)
    expect(out.width).toBe(before.width)
    expect(out.height).toBe(before.height)
    expect(out.width).toBeGreaterThanOrEqual(MIN_SIZE)
  })

  it('still clamps an unrotated element to the slide box', () => {
    const start = { x: 10, y: 10, width: 200, height: 100, rotation: 0 }
    const out = { x: -50, y: -30, width: 200, height: 100 }
    clampToSlide(out, start, null, 960, 540)
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })
})

describe('startElementDrag threads rotation into startEl', () => {
  it('populates startEl.rotation from the element', () => {
    // jsdom needs a .slide-canvas element for getBoundingClientRect lookup.
    const canvas = document.createElement('div')
    canvas.className = 'slide-canvas'
    document.body.appendChild(canvas)
    const pendingDragRef = { current: null }
    const noop = () => {}
    const noopRef = { current: null }
    const { result } = renderHook(() =>
      useCanvasPointerInteraction({
        scaleRef: { current: 1 },
        showGridRef: { current: false },
        gridSizeRef: { current: 10 },
        smartGuidesRef: { current: false },
        slideRef: { current: null },
        selectedElementIdsRef: noopRef,
        draggingRef: noopRef,
        pendingDragRef,
        cropDragRef: noopRef,
        rubberBandRef: noopRef,
        suppressCanvasClickRef: noopRef,
        onUpdateElement: noop,
        onUpdateElements: noop,
        snapToGrid: (v) => v,
        snapWithRef: () => ({ x: 0, y: 0 }),
        getRotationAngle: () => 0,
        applyResize,
        applyResizeAspectRatio,
        clampToSlide,
        startRubberBand: noop,
        updateRubberBand: noop,
        endRubberBand: () => [],
        applyRubberBandSelection: noop,
        setRubberBand: noop,
        setActiveGuides: noop,
        forceUpdate: noop,
        setSuppressCanvasClick: noop,
        setCropMode: noop,
        slideW: 960,
        slideH: 540,
      })
    )
    const slide = {
      elements: [{ id: 'el1', x: 100, y: 100, width: 200, height: 100, rotation: 30 }],
    }
    result.current.startElementDrag(
      { clientX: 150, clientY: 150 },
      'el1',
      'resize',
      'e',
      slide,
      1,
      ['el1']
    )
    expect(pendingDragRef.current.startEl.rotation).toBe(30)
    document.body.removeChild(canvas)
  })
})

describe('crop handles never invert', () => {
  const startCrop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
  const MIN_CROP = 0.05
  const subtractive = ['nw', 'n', 'ne', 'sw', 'w']

  for (const handle of subtractive) {
    it(`${handle} floors w/h at MIN_CROP when dragged far past the opposite edge`, () => {
      // Huge positive delta drives every subtractive edge past its opposite edge.
      const out = applyCropHandle(handle, startCrop, 100000, 100000, 400, 300)
      expect(out.w).toBeGreaterThanOrEqual(MIN_CROP)
      expect(out.h).toBeGreaterThanOrEqual(MIN_CROP)
      expect(Number.isFinite(out.w)).toBe(true)
      expect(Number.isFinite(out.h)).toBe(true)
      expect(out.x).toBeGreaterThanOrEqual(0)
      expect(out.y).toBeGreaterThanOrEqual(0)
    })
  }

  it('nw dragged past the SE corner keeps a MIN_CROP rectangle anchored to the fixed edge', () => {
    const out = applyCropHandle('nw', startCrop, 100000, 100000, 400, 300)
    const right = startCrop.x + startCrop.w
    const bottom = startCrop.y + startCrop.h
    expect(out.x + out.w).toBeCloseTo(right, 6)
    expect(out.y + out.h).toBeCloseTo(bottom, 6)
  })
})

describe('aspect-ratio resize guards a zero-dimension element', () => {
  it('does not produce NaN/Infinity when width and height are both 0', () => {
    const start = { x: 0, y: 0, width: 0, height: 0 }
    const updates = applyResize('se', start, 100, 100)
    applyResizeAspectRatio('se', start, updates)
    expect(Number.isFinite(updates.width)).toBe(true)
    expect(Number.isFinite(updates.height)).toBe(true)
    expect(updates.width).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(updates.height).toBeGreaterThanOrEqual(MIN_SIZE)
  })
})
