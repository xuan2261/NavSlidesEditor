import { useCallback, useEffect, useRef } from 'react'
import { calculateGuides } from '../../utils/smartGuides'
import { clampAspectResizeToSlide, getRotatedAABB } from './use-canvas-resize-rotate'

export function rotateDeltaToLocal(dx, dy, rotation = 0) {
  if (!rotation) return { dx, dy }
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos }
}

export function getVisualGuideElement(element, overrides = {}) {
  return { ...getRotatedAABB({ ...element, ...overrides }), id: element.id }
}

export function applyCropHandle(handle, startCrop, dx, dy, elW, elH) {
  const fdx = dx / elW
  const fdy = dy / elH
  let { x, y, w, h } = startCrop
  const MIN_CROP = 0.05
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
    default:
      break
  }
  x = Math.max(0, x)
  y = Math.max(0, y)
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }
}

export function computeClampedBatchDelta(startEls, dx, dy, slideW, slideH) {
  if (!Array.isArray(startEls) || !startEls.length) return { dx: 0, dy: 0 }
  const boxes = startEls.map((el) =>
    getRotatedAABB({ ...el, x: el.x || 0, y: el.y || 0, width: el.width || 0, height: el.height || 0 })
  )
  return {
    dx: Math.max(Math.max(...boxes.map((box) => -box.left)), Math.min(Math.min(...boxes.map((box) => slideW - box.right)), dx)),
    dy: Math.max(Math.max(...boxes.map((box) => -box.top)), Math.min(Math.min(...boxes.map((box) => slideH - box.bottom)), dy)),
  }
}

export function applyMove(startEl, dx, dy, slideW, slideH) {
  const delta = computeClampedBatchDelta([startEl], dx, dy, slideW, slideH)
  return { x: startEl.x + delta.dx, y: startEl.y + delta.dy }
}

export function applyMoveBatch(startEls, dx, dy, slideW, slideH) {
  const delta = computeClampedBatchDelta(startEls, dx, dy, slideW, slideH)
  return startEls.map((el) => ({ id: el.id, x: (el.x || 0) + delta.dx, y: (el.y || 0) + delta.dy }))
}

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
  startRubberBand,
  updateRubberBand,
  endRubberBand,
  applyRubberBandSelection,
  setRubberBand,
  setActiveGuides,
  setElementPreview,
  clearElementPreview,
  forceUpdate,
  setSuppressCanvasClick,
  setCropMode,
  slideW,
  slideH,
  onBlockedAction,
  pinchActiveRef,
  activeSlideIdentity,
}) {
  const activeSessionRef = useRef(null)
  const cancelRef = useRef(null)

  const ownsPointer = (session, event) => session?.pointerId === event.pointerId
  const clearSession = useCallback(
    (session, suppressClick) => {
      if (session?.captureTarget?.hasPointerCapture?.(session.pointerId)) {
        session.captureTarget.releasePointerCapture(session.pointerId)
      }
      cropDragRef.current = null
      pendingDragRef.current = null
      draggingRef.current = null
      rubberBandRef.current = null
      activeSessionRef.current = null
      if (session?.kind === 'element') clearElementPreview?.()
      setRubberBand(null)
      setActiveGuides([])
      if (suppressClick) {
        setSuppressCanvasClick(true)
        setTimeout(() => setSuppressCanvasClick(false), 0)
      }
      forceUpdate((count) => count + 1)
    },
    [clearElementPreview, cropDragRef, draggingRef, forceUpdate, pendingDragRef, rubberBandRef, setActiveGuides, setRubberBand, setSuppressCanvasClick]
  )

  const cancelActiveInteraction = useCallback(
    (pointerId, { rollback = true } = {}) => {
      const session = activeSessionRef.current
      if (!session || (pointerId != null && session.pointerId !== pointerId)) return false

      if (rollback && session.kind === 'crop') {
        const startCrop = cropDragRef.current?.startCrop
        if (startCrop) setCropMode((previous) => (previous ? { ...previous, ...startCrop } : previous))
      }
      clearSession(session, true)
      return true
    },
    [clearSession, cropDragRef, setCropMode]
  )

  useEffect(() => {
    cancelRef.current = cancelActiveInteraction
  }, [cancelActiveInteraction])

  useEffect(() => {
    return () => cancelRef.current?.(undefined, { rollback: false })
  }, [activeSlideIdentity])

  const setCropDrag = useCallback(
    (handle, startX, startY, startCrop, elW, elH, rotation = 0, pointerId, captureTarget) => {
      if (activeSessionRef.current || pinchActiveRef?.current) return false
      cropDragRef.current = { handle, startX, startY, startCrop, elW, elH, rotation, pointerId }
      activeSessionRef.current = {
        kind: 'crop',
        pointerId,
        captureTarget,
        slideId: slideRef.current?.id,
        navigationIdentity: activeSlideIdentity,
      }
      return true
    },
    [activeSlideIdentity, cropDragRef, pinchActiveRef, slideRef]
  )

  const startRubberBandDrag = useCallback(
    (event, startX, startY) => {
      if (activeSessionRef.current || pinchActiveRef?.current) return false
      startRubberBand(startX, startY)
      rubberBandRef.current = { ...rubberBandRef.current, pointerId: event.pointerId }
      activeSessionRef.current = {
        kind: 'marquee',
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        slideId: slideRef.current?.id,
        navigationIdentity: activeSlideIdentity,
        startX,
        startY,
        moved: false,
      }
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      return true
    },
    [activeSlideIdentity, pinchActiveRef, rubberBandRef, slideRef, startRubberBand]
  )

  const startElementDrag = useCallback(
    (event, elementId, type, handle, slide, scale, selectedIds) => {
      if (event.button != null && event.button !== 0) return false
      if (activeSessionRef.current || pinchActiveRef?.current) return false
      if (slide?.locked) {
        onBlockedAction?.('slide-locked')
        return false
      }
      const canvas = document.querySelector('.slide-canvas')
      const element = slide?.elements?.find((item) => item.id === elementId)
      if (!canvas || !element) return false
      if (element.locked) {
        onBlockedAction?.('element-locked')
        return false
      }
      const hasBlockedGroup = (slide.elements || []).some((item) => {
        if (!selectedIds.includes(item.id) || !item.groupId) return false
        return slide.elements.some((member) => member.groupId === item.groupId && (member.locked || member.hidden))
      })
      if (hasBlockedGroup) {
        onBlockedAction?.('group-locked')
        return false
      }
      const rect = canvas.getBoundingClientRect()
      const startEls = slide.elements.filter((item) => selectedIds.includes(item.id) && !item.locked)
      pendingDragRef.current = {
        pointerId: event.pointerId,
        type,
        handle,
        elementId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startMouseX: (event.clientX - rect.left) / scale,
        startMouseY: (event.clientY - rect.top) / scale,
        startEl: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          rotation: element.rotation || 0,
          snapRef: element.snapRef,
        },
        startEls: startEls.map((item) => ({
          id: item.id,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          rotation: item.rotation || 0,
          snapRef: item.snapRef,
        })),
      }
      activeSessionRef.current = {
        kind: 'element',
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        slideId: slide.id,
        navigationIdentity: activeSlideIdentity,
        elementId,
      }
      event.currentTarget?.setPointerCapture?.(event.pointerId)
      return true
    },
    [activeSlideIdentity, onBlockedAction, pendingDragRef, pinchActiveRef]
  )

  useEffect(() => {
    const snap = (value) => snapToGrid(value, showGridRef.current, gridSizeRef.current)
    const isStaleSession = (session) =>
      Boolean(
        session.navigationIdentity && session.navigationIdentity !== activeSlideIdentity
      ) ||
      Boolean(session.slideId && slideRef.current?.id !== session.slideId) ||
      (session.elementId && !slideRef.current?.elements?.some((element) => element.id === session.elementId))
    const updateElementPreview = (drag, updates) => {
      drag.previewUpdates = updates
      setElementPreview?.(
        Array.isArray(updates)
          ? Object.fromEntries(updates.map(({ id, ...changes }) => [id, changes]))
          : { [drag.elementId]: updates }
      )
    }

    const onPointerMove = (event) => {
      const session = activeSessionRef.current
      if (!session || !ownsPointer(session, event)) return
      if (isStaleSession(session)) {
        cancelActiveInteraction(event.pointerId, { rollback: false })
        return
      }
      if (session.kind === 'crop') {
        const crop = cropDragRef.current
        if (!crop) return
        const screenDx = (event.clientX - crop.startX) / scaleRef.current
        const screenDy = (event.clientY - crop.startY) / scaleRef.current
        const { dx, dy } = rotateDeltaToLocal(screenDx, screenDy, crop.rotation)
        const nextCrop = applyCropHandle(crop.handle, crop.startCrop, dx, dy, crop.elW, crop.elH)
        setCropMode((previous) => (previous ? { ...previous, ...nextCrop } : previous))
        return
      }
      if (session.kind === 'marquee') {
        const canvas = document.querySelector('.slide-canvas')
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const x = (event.clientX - rect.left) / scaleRef.current
        const y = (event.clientY - rect.top) / scaleRef.current
        session.moved = Math.abs(x - session.startX) > 4 || Math.abs(y - session.startY) > 4
        updateRubberBand(x, y)
        setRubberBand({ ...rubberBandRef.current })
        return
      }

      const pending = pendingDragRef.current
      if (pending && !draggingRef.current) {
        if (Math.abs(event.clientX - pending.startClientX) + Math.abs(event.clientY - pending.startClientY) > 4) {
          draggingRef.current = { ...pending }
          forceUpdate((count) => count + 1)
        }
      }
      const drag = draggingRef.current
      if (!drag) return
      const canvas = document.querySelector('.slide-canvas')
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mouseX = (event.clientX - rect.left) / scaleRef.current
      const mouseY = (event.clientY - rect.top) / scaleRef.current
      const dx = mouseX - drag.startMouseX
      const dy = mouseY - drag.startMouseY

      if (drag.type === 'move') {
        if (drag.startEls.length > 1) {
          let nextDx = dx
          let nextDy = dy
          const primary = drag.startEls.find((item) => item.id === drag.elementId) || drag.startEls[0]
          if (showGridRef.current && primary) {
            const raw = applyMove(primary, dx, dy, slideW, slideH)
            const snapped = snapWithRef_(raw.x, raw.y, primary.width, primary.height, primary.snapRef || 'ul', snap)
            nextDx = snapped.x - primary.x
            nextDy = snapped.y - primary.y
            setActiveGuides([])
          } else if (smartGuidesRef.current && primary) {
            const raw = applyMove(primary, dx, dy, slideW, slideH)
            const dragged = getVisualGuideElement(primary, raw)
            const { guides, snappedX, snappedY } = calculateGuides(
              dragged,
              (slideRef.current?.elements || []).map((item) => getVisualGuideElement(item)),
              slideW,
              slideH
            )
            nextDx = raw.x + snappedX - dragged.x - primary.x
            nextDy = raw.y + snappedY - dragged.y - primary.y
            setActiveGuides(guides)
          } else {
            setActiveGuides([])
          }
          updateElementPreview(drag, applyMoveBatch(drag.startEls, nextDx, nextDy, slideW, slideH))
          return
        }
        const raw = applyMove(drag.startEl, dx, dy, slideW, slideH)
        let x = raw.x
        let y = raw.y
        if (showGridRef.current) {
          const snapped = snapWithRef_(raw.x, raw.y, drag.startEl.width, drag.startEl.height, drag.startEl.snapRef || 'ul', snap)
          const clamped = applyMove(drag.startEl, snapped.x - drag.startEl.x, snapped.y - drag.startEl.y, slideW, slideH)
          x = clamped.x
          y = clamped.y
          setActiveGuides([])
        } else if (smartGuidesRef.current) {
          const dragged = getVisualGuideElement({ ...drag.startEl, id: drag.elementId }, raw)
          const { guides, snappedX, snappedY } = calculateGuides(
            dragged,
            (slideRef.current?.elements || []).map((item) => getVisualGuideElement(item)),
            slideW,
            slideH
          )
          const clamped = applyMove(drag.startEl, raw.x + snappedX - dragged.x - drag.startEl.x, raw.y + snappedY - dragged.y - drag.startEl.y, slideW, slideH)
          x = clamped.x
          y = clamped.y
          setActiveGuides(guides)
        } else {
          setActiveGuides([])
        }
        updateElementPreview(drag, { x, y })
        return
      }
      if (drag.type === 'resize') {
        const updates = applyResize(drag.handle, drag.startEl, dx, dy)
        let aspectClamped = false
        if (event.shiftKey) {
          applyResizeAspectRatio(drag.handle, drag.startEl, updates)
          aspectClamped = clampAspectResizeToSlide(drag.handle, updates, drag.startEl, slideW, slideH)
        }
        if (!aspectClamped) clampToSlide(updates, drag.startEl, snap, slideW, slideH)
        updateElementPreview(drag, updates)
        return
      }
      if (drag.type === 'rotate') {
        updateElementPreview(drag, {
          rotation: getRotationAngle(drag.startEl, mouseX, mouseY, event.shiftKey),
        })
      }
    }

    const finishPointer = (event, cancelled) => {
      const session = activeSessionRef.current
      if (!session || !ownsPointer(session, event)) return
      if (isStaleSession(session)) {
        cancelActiveInteraction(event.pointerId, { rollback: false })
        return
      }
      if (cancelled) {
        cancelActiveInteraction(event.pointerId)
        return
      }
      if (session.kind === 'marquee') {
        if (session.moved) applyRubberBandSelection(endRubberBand(setRubberBand))
        clearSession(session, session.moved)
        return
      }
      if (session.kind === 'element' && draggingRef.current?.previewUpdates) {
        const { elementId, previewUpdates } = draggingRef.current
        if (Array.isArray(previewUpdates)) onUpdateElements(previewUpdates)
        else onUpdateElement(elementId, previewUpdates)
      }
      const suppressClick = session.kind === 'crop' || Boolean(draggingRef.current) || pendingDragRef.current?.type !== 'move'
      clearSession(session, suppressClick)
    }

    const onPointerUp = (event) => finishPointer(event, false)
    const onPointerCancel = (event) => finishPointer(event, true)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('lostpointercapture', onPointerCancel)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('lostpointercapture', onPointerCancel)
    }
  }, [activeSlideIdentity, applyResize, applyResizeAspectRatio, applyRubberBandSelection, cancelActiveInteraction, clampToSlide, clearSession, cropDragRef, draggingRef, endRubberBand, forceUpdate, getRotationAngle, gridSizeRef, onUpdateElement, onUpdateElements, pendingDragRef, rubberBandRef, scaleRef, setActiveGuides, setCropMode, setElementPreview, setRubberBand, showGridRef, slideH, slideRef, slideW, smartGuidesRef, snapToGrid, snapWithRef_, updateRubberBand])

  return { startElementDrag, setCropDrag, startRubberBand: startRubberBandDrag, cancelActiveInteraction, applyCropHandle }
}
