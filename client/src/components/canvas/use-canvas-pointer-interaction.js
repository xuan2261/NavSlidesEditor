import { useCallback, useEffect } from 'react'
import { calculateGuides } from '../../utils/smartGuides'
import {
  clampAspectResizeToSlide,
  getRotatedAABB,
} from './use-canvas-resize-rotate'

export function rotateDeltaToLocal(dx, dy, rotation = 0) {
  if (!rotation) return { dx, dy }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    dx: dx * cos + dy * sin,
    dy: -dx * sin + dy * cos,
  }
}

export function getVisualGuideElement(element, overrides = {}) {
  return {
    ...getRotatedAABB({ ...element, ...overrides }),
    id: element.id,
  }
}

/**
 * Pure crop math — extracted to module level for testability.
 * Converts pixel delta to fractional crop coordinates, enforces min/max bounds.
 */
export function applyCropHandle(handle, startCrop, dx, dy, elW, elH) {
  const fdx = dx / elW
  const fdy = dy / elH
  let { x, y, w, h } = startCrop
  const MIN_CROP = 0.05
  // Subtractive handles move a leading edge toward the FIXED opposite edge.
  // Capping the moving edge at (opposite - MIN_CROP) floors the resulting
  // width/height at MIN_CROP, so the crop rectangle can never collapse or
  // invert past the opposite edge.
  switch (handle) {
    case 'nw': {
      const right = x + w
      const bottom = y + h
      const nx = Math.min(Math.max(x + fdx, 0), right - MIN_CROP)
      const ny = Math.min(Math.max(y + fdy, 0), bottom - MIN_CROP)
      x = nx
      y = ny
      w = right - nx
      h = bottom - ny
      break
    }
    case 'n': {
      const bottom = y + h
      const ny = Math.min(Math.max(y + fdy, 0), bottom - MIN_CROP)
      y = ny
      h = bottom - ny
      break
    }
    case 'ne': {
      const bottom = y + h
      const ny = Math.min(Math.max(y + fdy, 0), bottom - MIN_CROP)
      y = ny
      h = bottom - ny
      w = Math.max(MIN_CROP, w + fdx)
      break
    }
    case 'e':
      w = Math.max(MIN_CROP, w + fdx)
      break
    case 'se':
      w = Math.max(MIN_CROP, w + fdx)
      h = Math.max(MIN_CROP, h + fdy)
      break
    case 's':
      h = Math.max(MIN_CROP, h + fdy)
      break
    case 'sw': {
      const right = x + w
      const nx = Math.min(Math.max(x + fdx, 0), right - MIN_CROP)
      x = nx
      w = right - nx
      h = Math.max(MIN_CROP, h + fdy)
      break
    }
    case 'w': {
      const right = x + w
      const nx = Math.min(Math.max(x + fdx, 0), right - MIN_CROP)
      x = nx
      w = right - nx
      break
    }
  }
  x = Math.max(0, x)
  y = Math.max(0, y)
  w = Math.min(w, 1 - x)
  h = Math.min(h, 1 - y)
  return { x, y, w, h }
}

export function applyMove(startEl, dx, dy, slideW, slideH) {
  const delta = computeClampedBatchDelta([startEl], dx, dy, slideW, slideH)
  return {
    x: startEl.x + delta.dx,
    y: startEl.y + delta.dy,
  }
}

export function computeClampedBatchDelta(startEls, dx, dy, slideW, slideH) {
  if (!Array.isArray(startEls) || !startEls.length) return { dx: 0, dy: 0 }
  const boxes = startEls.map((el) =>
    getRotatedAABB({
      ...el,
      x: el.x || 0,
      y: el.y || 0,
      width: el.width || 0,
      height: el.height || 0,
    })
  )
  const minDx = Math.max(...boxes.map((box) => -box.left))
  const maxDx = Math.min(...boxes.map((box) => slideW - box.right))
  const minDy = Math.max(...boxes.map((box) => -box.top))
  const maxDy = Math.min(...boxes.map((box) => slideH - box.bottom))
  return {
    dx: Math.max(minDx, Math.min(maxDx, dx)),
    dy: Math.max(minDy, Math.min(maxDy, dy)),
  }
}

export function applyMoveBatch(startEls, dx, dy, slideW, slideH) {
  const delta = computeClampedBatchDelta(startEls, dx, dy, slideW, slideH)
  return startEls.map((sel) => ({
    id: sel.id,
    x: (sel.x || 0) + delta.dx,
    y: (sel.y || 0) + delta.dy,
  }))
}

/**
 * use-canvas-pointer-interaction — pointer event routing for element drag/resize/rotate.
 * Manages pending drag, active drag, and crop drag state via refs.
 * Installs document-level mousemove/mouseup listeners.
 *
 * Props:
 *   scaleRef         — ref to current scale
 *   showGridRef      — ref to showGrid bool
 *   gridSizeRef      — ref to gridSize number
 *   smartGuidesRef   — ref to smartGuidesEnabled bool
 *   slideRef         — ref to current slide
 *   selectedElementIdsRef — ref to selected element ids
 *   draggingRef      — ref to active drag state
 *   pendingDragRef   — ref to pending drag state
 *   cropDragRef      — ref to crop drag state
 *   rubberBandRef    — ref to rubber-band state
 *   suppressCanvasClickRef — ref to suppress-click flag
 *   onUpdateElement  — (id, changes) => void
 *   onUpdateElements — (updates[]) => void
 *   snapToGrid       — (v) => number
 *   snapWithRef     — (rawX, rawY, w, h, ref, snapFn) => { x, y }
 *   getRotationAngle — (startEl, mouseX, mouseY, snap) => number
 *   applyResize      — (handle, startEl, dx, dy) => { x, y, w, h }
 *   applyResizeAspectRatio — (handle, startEl, updates) => void
 *   clampToSlide     — (updates, startEl, snapFn, slideW, slideH) => void
 *   startRubberBand  — (startX, startY) => void
 *   updateRubberBand — (currentX, currentY) => void
 *   endRubberBand    — (setRubberBand) => string[]
 *   applyRubberBandSelection — (hitIds) => void
 *   rubberBandRef    — ref (passed separately for read access)
 *   setRubberBand    — React state setter
 *   setActiveGuides  — (guides) => void
 *   setCropMode      — React state setter (for crop updates)
 *   setCropDragRef   — function to update cropDragRef
 *   forceUpdate      — React forceUpdate
 *   setSuppressCanvasClick — (bool) => void
 *   slideW           — slide width
 *   slideH           — slide height
 */
export default function useCanvasPointerInteraction({
  scaleRef,
  showGridRef,
  gridSizeRef,
  smartGuidesRef,
  slideRef,
  selectedElementIdsRef: _selectedElementIdsRef,
  draggingRef,
  pendingDragRef,
  cropDragRef,
  rubberBandRef,
  suppressCanvasClickRef: _suppressCanvasClickRef,
  onUpdateElement,
  onUpdateElements,
  snapToGrid,
  snapWithRef: snapWithRef_,
  getRotationAngle,
  applyResize,
  applyResizeAspectRatio,
  clampToSlide,
  startRubberBand: _startRubberBand,
  updateRubberBand,
  endRubberBand,
  applyRubberBandSelection,
  setRubberBand,
  setActiveGuides,
  forceUpdate,
  setSuppressCanvasClick,
  setCropMode,
  slideW,
  slideH,
  onBlockedAction,
}) {
  // Crop drag state ref accessor (needed by cropDragRef.current setter below)
  const setCropDrag = useCallback(
    (handle, startX, startY, startCrop, elW, elH, rotation = 0) => {
      cropDragRef.current = { handle, startX, startY, startCrop, elW, elH, rotation }
    },
    [cropDragRef]
  )

  // Install document-level global mouse move/up listeners
  useEffect(() => {
    const snap = (v) => snapToGrid(v, showGridRef.current, gridSizeRef.current)

    const onMouseMove = (e) => {
      // Crop drag
      if (cropDragRef.current) {
        const cd = cropDragRef.current
        const screenDx = (e.clientX - cd.startX) / scaleRef.current
        const screenDy = (e.clientY - cd.startY) / scaleRef.current
        const { dx, dy } = rotateDeltaToLocal(screenDx, screenDy, cd.rotation)
        const newCrop = applyCropHandle(cd.handle, cd.startCrop, dx, dy, cd.elW, cd.elH)
        setCropMode((prev) => (prev ? { ...prev, ...newCrop } : prev))
        return
      }

      // Rubber-band selection drag
      if (rubberBandRef.current) {
        const canvasEl = document.querySelector('.slide-canvas')
        if (!canvasEl) return
        const rect = canvasEl.getBoundingClientRect()
        const mx = (e.clientX - rect.left) / scaleRef.current
        const my = (e.clientY - rect.top) / scaleRef.current
        updateRubberBand(mx, my)
        setRubberBand({ ...rubberBandRef.current })
        return
      }

      // Promote pending → active drag after 4px movement
      if (pendingDragRef.current && !draggingRef.current) {
        const px = pendingDragRef.current
        if (Math.abs(e.clientX - px.startClientX) + Math.abs(e.clientY - px.startClientY) > 4) {
          draggingRef.current = {
            type: px.type,
            handle: px.handle,
            elementId: px.elementId,
            startMouseX: px.startMouseX,
            startMouseY: px.startMouseY,
            startEl: px.startEl,
            startEls: px.startEls,
          }
          forceUpdate((n) => n + 1)
        }
      }

      const drag = draggingRef.current
      if (!drag) return

      const canvasEl = document.querySelector('.slide-canvas')
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) / scaleRef.current
      const mouseY = (e.clientY - rect.top) / scaleRef.current
      const dx = mouseX - drag.startMouseX
      const dy = mouseY - drag.startMouseY

      if (drag.type === 'move') {
        if (drag.startEls && drag.startEls.length > 1) {
          let nextDx = dx
          let nextDy = dy
          const primary = drag.startEls.find((el) => el.id === drag.elementId) || drag.startEls[0]
          if (showGridRef.current && primary) {
            const rawPrimary = applyMove(primary, dx, dy, slideW, slideH)
            const { x: snappedX, y: snappedY } = snapWithRef_(
              rawPrimary.x,
              rawPrimary.y,
              primary.width,
              primary.height,
              primary.snapRef || 'ul',
              snap
            )
            nextDx = snappedX - primary.x
            nextDy = snappedY - primary.y
            setActiveGuides([])
          } else if (smartGuidesRef.current && primary) {
            const allEls = slideRef.current?.elements || []
            const rawPrimary = applyMove(primary, dx, dy, slideW, slideH)
            const draggedEl = getVisualGuideElement(primary, rawPrimary)
            const guideElements = allEls.map((element) => getVisualGuideElement(element))
            const { guides, snappedX, snappedY } = calculateGuides(
              draggedEl,
              guideElements,
              slideW,
              slideH
            )
            nextDx = rawPrimary.x + snappedX - draggedEl.x - primary.x
            nextDy = rawPrimary.y + snappedY - draggedEl.y - primary.y
            setActiveGuides(guides)
          } else {
            setActiveGuides([])
          }
          onUpdateElements(applyMoveBatch(drag.startEls, nextDx, nextDy, slideW, slideH))
        } else {
          const { x: rawX, y: rawY } = applyMove(drag.startEl, dx, dy, slideW, slideH)
          let newX, newY
          if (showGridRef.current) {
            const { x: snappedX, y: snappedY } = snapWithRef_(
              rawX,
              rawY,
              drag.startEl.width,
              drag.startEl.height,
              drag.startEl.snapRef || 'ul',
              snap
            )
            const clamped = applyMove(
              drag.startEl,
              snappedX - drag.startEl.x,
              snappedY - drag.startEl.y,
              slideW,
              slideH
            )
            newX = clamped.x
            newY = clamped.y
            setActiveGuides([])
          } else if (smartGuidesRef.current) {
            const allEls = slideRef.current?.elements || []
            const draggedEl = getVisualGuideElement(
              { ...drag.startEl, id: drag.elementId },
              { x: rawX, y: rawY }
            )
            const guideElements = allEls.map((element) => getVisualGuideElement(element))
            const { guides, snappedX, snappedY } = calculateGuides(
              draggedEl,
              guideElements,
              slideW,
              slideH
            )
            const clamped = applyMove(
              drag.startEl,
              rawX + snappedX - draggedEl.x - drag.startEl.x,
              rawY + snappedY - draggedEl.y - drag.startEl.y,
              slideW,
              slideH
            )
            newX = clamped.x
            newY = clamped.y
            setActiveGuides(guides)
          } else {
            newX = rawX
            newY = rawY
            setActiveGuides([])
          }
          onUpdateElement(drag.elementId, { x: newX, y: newY })
        }
      } else if (drag.type === 'resize') {
        let updates = applyResize(drag.handle, drag.startEl, dx, dy)
        let aspectClamped = false
        if (e.shiftKey) {
          applyResizeAspectRatio(drag.handle, drag.startEl, updates)
          aspectClamped = clampAspectResizeToSlide(
            drag.handle,
            updates,
            drag.startEl,
            slideW,
            slideH
          )
        }
        if (!aspectClamped) clampToSlide(updates, drag.startEl, snap, slideW, slideH)
        onUpdateElement(drag.elementId, updates)
      } else if (drag.type === 'rotate') {
        const rotation = getRotationAngle(drag.startEl, mouseX, mouseY, e.shiftKey)
        onUpdateElement(drag.elementId, { rotation })
      }
    }

    const onMouseUp = () => {
      if (rubberBandRef.current) {
        const hitIds = endRubberBand(setRubberBand)
        applyRubberBandSelection(hitIds)
      }

      const hadInteraction = cropDragRef.current || pendingDragRef.current || draggingRef.current
      cropDragRef.current = null
      pendingDragRef.current = null
      draggingRef.current = null
      if (hadInteraction) {
        setSuppressCanvasClick(true)
        setTimeout(() => setSuppressCanvasClick(false), 0)
        setActiveGuides([])
        forceUpdate((n) => n + 1)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [
    snapToGrid,
    showGridRef,
    gridSizeRef,
    smartGuidesRef,
    slideRef,
    onUpdateElement,
    onUpdateElements,
    snapWithRef_,
    getRotationAngle,
    applyResize,
    applyResizeAspectRatio,
    clampToSlide,
    slideW,
    slideH,
    setActiveGuides,
    setRubberBand,
    endRubberBand,
    applyRubberBandSelection,
    updateRubberBand,
    forceUpdate,
    setSuppressCanvasClick,
    setCropMode,
    cropDragRef,
    draggingRef,
    pendingDragRef,
    rubberBandRef,
    scaleRef,
  ])

  // startElementDrag — called by CanvasElement on pointer down
  const startElementDrag = useCallback(
    (e, elementId, type, handle, slide, scale, selectedIds) => {
      if (slide?.locked) {
        onBlockedAction?.('slide-locked')
        return
      }
      const canvasEl = document.querySelector('.slide-canvas')
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      const element = slide?.elements?.find((el) => el.id === elementId)
      if (!element) return
      if (element.locked) {
        onBlockedAction?.('element-locked')
        return
      }
      const hasBlockedGroup = (slide?.elements || []).some((el) => {
        if (!selectedIds.includes(el.id) || !el.groupId) return false
        return (slide.elements || []).some(
          (member) => member.groupId === el.groupId && (member.locked || member.hidden)
        )
      })
      if (hasBlockedGroup) {
        onBlockedAction?.('group-locked')
        return
      }
      const allSelected = (slide?.elements || []).filter(
        (el) => selectedIds.includes(el.id) && !el.locked
      )
      pendingDragRef.current = {
        type,
        handle,
        elementId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startMouseX: (e.clientX - rect.left) / scale,
        startMouseY: (e.clientY - rect.top) / scale,
        startEl: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotation: element.rotation || 0,
          snapRef: element.snapRef,
        },
        startEls: allSelected.map((el) => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          snapRef: el.snapRef,
        })),
      }
    },
    [pendingDragRef, onBlockedAction]
  )

  return {
    startElementDrag,
    setCropDrag,
    applyCropHandle,
  }
}
