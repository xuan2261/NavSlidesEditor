import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useCanvasPointerInteraction from './use-canvas-pointer-interaction'

const START_ELEMENT = { id: 'free', x: 10, y: 20, width: 100, height: 80, rotation: 0 }
const START_CROP = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }

function touchPointer(type, x, y, pointerId = 7) {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
    pointerId,
    pointerType: 'touch',
  })
}

function renderTouchInteraction({ deferredCropUpdates = false } = {}) {
  const pendingDragRef = { current: null }
  const draggingRef = { current: null }
  const cropDragRef = { current: null }
  const onUpdateElement = vi.fn()
  const setElementPreview = vi.fn()
  const setPointerCapture = vi.fn()
  const queuedCropUpdates = []
  let cropState = { elementId: 'free', ...START_CROP }
  const setCropMode = vi.fn((update) => {
    if (deferredCropUpdates) {
      queuedCropUpdates.push(update)
      return
    }
    cropState = typeof update === 'function' ? update(cropState) : update
  })
  const slide = { id: 'slide-1', elements: [START_ELEMENT] }
  const slideRef = { current: slide }
  const canvas = document.createElement('div')
  canvas.className = 'slide-canvas'
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 })
  document.body.appendChild(canvas)

  const hook = renderHook(
    ({ activeSlide }) => {
      slideRef.current = activeSlide
      return useCanvasPointerInteraction({
      scaleRef: { current: 1 },
      showGridRef: { current: false },
      gridSizeRef: { current: 10 },
      smartGuidesRef: { current: false },
      slideRef: { current: slide },
      selectedElementIdsRef: { current: ['free'] },
      draggingRef,
      pendingDragRef,
      cropDragRef,
      rubberBandRef: { current: null },
      suppressCanvasClickRef: { current: false },
      onUpdateElement,
      onUpdateElements: vi.fn(),
      snapToGrid: (value) => value,
      snapWithRef: (x, y) => ({ x, y }),
      getRotationAngle: vi.fn(() => 45),
      applyResize: vi.fn(() => ({ x: 10, y: 20, width: 120, height: 90 })),
      applyResizeAspectRatio: vi.fn(),
      clampToSlide: vi.fn(),
      startRubberBand: vi.fn(),
      updateRubberBand: vi.fn(),
      endRubberBand: vi.fn(() => []),
      applyRubberBandSelection: vi.fn(),
      setRubberBand: vi.fn(),
      setActiveGuides: vi.fn(),
      setElementPreview,
      clearElementPreview: vi.fn(),
      forceUpdate: vi.fn(),
      setSuppressCanvasClick: vi.fn(),
        setCropMode,
        slideW: 960,
        slideH: 540,
        activeSlideIdentity: JSON.stringify([
          activeSlide.id,
          activeSlide.parentId ?? null,
          activeSlide.verticalIndex ?? activeSlide.childIndex ?? null,
          activeSlide.childId ?? null,
        ]),
      })
    },
    { initialProps: { activeSlide: slide } }
  )

  return {
    hook,
    rerenderSlide: (activeSlide) => hook.rerender({ activeSlide }),
    refs: { pendingDragRef, draggingRef, cropDragRef },
    onUpdateElement,
    setElementPreview,
    setPointerCapture,
    setCropMode,
    queuedCropUpdates,
    getCropState: () => cropState,
    slide,
  }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('touch Pointer Event session ownership', () => {
  it('removes the duplicate Touch Event fallback API', () => {
    const { hook } = renderTouchInteraction()

    expect(hook.result.current).toHaveProperty('startElementDrag')
    expect(hook.result.current).toHaveProperty('setCropDrag')
    expect(hook.result.current).not.toHaveProperty('startTouchElementDrag')
    expect(hook.result.current).not.toHaveProperty('setTouchCropDrag')
  })

  it.each(['move', 'resize', 'rotate'])(
    'uses the touch Pointer Event owner for %s cancellation',
    (type) => {
      const { hook, refs, onUpdateElement, setElementPreview, setPointerCapture, slide } = renderTouchInteraction()
      const admitted = hook.result.current.startElementDrag(
        {
          button: 0,
          clientX: 20,
          clientY: 30,
          pointerId: 7,
          pointerType: 'touch',
          currentTarget: { setPointerCapture },
        },
        'free',
        type,
        type === 'resize' ? 'se' : null,
        slide,
        1,
        ['free']
      )

      expect(admitted).toBe(true)
      expect(setPointerCapture).toHaveBeenCalledWith(7)
      act(() => document.dispatchEvent(touchPointer('pointermove', 30, 40)))
      expect(refs.draggingRef.current?.type).toBe(type)
      expect(setElementPreview).toHaveBeenCalled()
      expect(onUpdateElement).not.toHaveBeenCalled()

      act(() => document.dispatchEvent(touchPointer('pointercancel', 30, 40)))

      expect(onUpdateElement).not.toHaveBeenCalled()
      expect(refs.pendingDragRef.current).toBeNull()
      expect(refs.draggingRef.current).toBeNull()
      expect(refs.cropDragRef.current).toBeNull()
    }
  )

  it('does not allow another pointer to replace the active session', () => {
    const { hook, refs, slide } = renderTouchInteraction()
    expect(
      hook.result.current.startElementDrag(
        { button: 0, clientX: 20, clientY: 30, pointerId: 7 },
        'free',
        'move',
        null,
        slide,
        1,
        ['free']
      )
    ).toBe(true)
    const session = refs.pendingDragRef.current

    expect(
      hook.result.current.startElementDrag(
        { button: 0, clientX: 40, clientY: 50, pointerId: 8 },
        'free',
        'rotate',
        null,
        slide,
        1,
        ['free']
      )
    ).toBe(false)
    expect(refs.pendingDragRef.current).toBe(session)
  })

  it('cancels only the owner when pointer capture is lost', () => {
    const { hook, refs, slide } = renderTouchInteraction()
    hook.result.current.startElementDrag(
      { button: 0, clientX: 20, clientY: 30, pointerId: 7 },
      'free',
      'move',
      null,
      slide,
      1,
      ['free']
    )

    act(() => document.dispatchEvent(touchPointer('lostpointercapture', 20, 30, 8)))
    expect(refs.pendingDragRef.current).not.toBeNull()
    act(() => document.dispatchEvent(touchPointer('lostpointercapture', 20, 30, 7)))
    expect(refs.pendingDragRef.current).toBeNull()
  })

  it('captures crop start state before a deferred cancellation updater runs', () => {
    const { hook, refs, queuedCropUpdates, getCropState } = renderTouchInteraction({
      deferredCropUpdates: true,
    })
    hook.result.current.setCropDrag('se', 20, 30, START_CROP, 100, 80, 0, 7)

    act(() => {
      document.dispatchEvent(touchPointer('pointermove', 30, 40))
      document.dispatchEvent(touchPointer('pointercancel', 30, 40))
    })
    expect(refs.cropDragRef.current).toBeNull()

    queuedCropUpdates.forEach((update) => {
      if (typeof update === 'function') {
        const next = update(getCropState())
        Object.assign(getCropState(), next)
      }
    })
    expect(getCropState()).toMatchObject(START_CROP)
  })

  it.each(['move', 'resize'])(
    'keeps an active %s session alive when geometry replaces the current slide object',
    (type) => {
      const { hook, rerenderSlide, onUpdateElement, setElementPreview, slide } = renderTouchInteraction()
      hook.result.current.startElementDrag(
        { button: 0, clientX: 20, clientY: 30, pointerId: 7 },
        'free',
        type,
        type === 'resize' ? 'se' : null,
        slide,
        1,
        ['free']
      )
      act(() => document.dispatchEvent(touchPointer('pointermove', 30, 40)))
      onUpdateElement.mockClear()

      rerenderSlide({ ...slide, elements: slide.elements.map((element) => ({ ...element })) })
      act(() => document.dispatchEvent(touchPointer('pointermove', 40, 50)))

      expect(setElementPreview).toHaveBeenCalled()
      expect(onUpdateElement).not.toHaveBeenCalled()
    }
  )

  it('discards an active session on true slide identity change', () => {
    const { hook, rerenderSlide, refs, onUpdateElement, slide } = renderTouchInteraction()
    hook.result.current.startElementDrag(
      { button: 0, clientX: 20, clientY: 30, pointerId: 7 },
      'free',
      'move',
      null,
      slide,
      1,
      ['free']
    )
    act(() => document.dispatchEvent(touchPointer('pointermove', 30, 40)))
    onUpdateElement.mockClear()

    rerenderSlide({ id: 'slide-2', elements: [{ ...START_ELEMENT }] })
    expect(refs.pendingDragRef.current).toBeNull()
    expect(refs.draggingRef.current).toBeNull()
    act(() => document.dispatchEvent(touchPointer('pointermove', 40, 50)))

    expect(onUpdateElement).not.toHaveBeenCalled()
  })
})
