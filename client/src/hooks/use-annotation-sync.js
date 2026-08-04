import { useEffect, useCallback, useRef } from 'react'

/**
 * Syncs annotation state via Socket.IO events.
 * Filters incoming events by the current slide index so viewers only see
 * annotations relevant to the slide they are viewing.
 *
 * @param {object} params
 * @param {object|null} params.socket - Socket.IO socket instance
 * @param {number} params.slideIndex - Current horizontal slide index for filtering
 * @param {number} params.verticalIndex - Current vertical slide index for filtering
 * @param {boolean} params.includeVerticalIndex - Pass the target vertical index for root callbacks too
 * @param {Function} params.onAnnotationAdd - Called with an Annotation and target indices
 * @param {Function} params.onAnnotationRemove - Called with annotationId and target indices
 * @param {Function} params.onAnnotationsClear - Called with the target indices
 */
export function useAnnotationSync({
  socket,
  slideIndex,
  verticalIndex = 0,
  includeVerticalIndex = false,
  onAnnotationAdd,
  onAnnotationRemove,
  onAnnotationsClear,
}) {
  // Track seen annotation IDs to deduplicate against race-condition duplicates.
  // Race: annotation:add can arrive before annotations:sync, causing the same
  // annotation to be added twice (once from the event, once from sync).
  const seenIds = useRef(new Set())
  const activeSlideRef = useRef({ slideIndex, verticalIndex: verticalIndex || 0 })
  const registerAnnotationId = useCallback((annotationId) => {
    if (annotationId) seenIds.current.add(annotationId)
  }, [])

  useEffect(() => {
    activeSlideRef.current = { slideIndex, verticalIndex: verticalIndex || 0 }
  }, [slideIndex, verticalIndex])

  const handleSlideState = useCallback(
    ({ slideIndex: nextSlideIndex, verticalIndex: nextVerticalIndex = 0 }) => {
      if (Number.isInteger(nextSlideIndex)) {
        activeSlideRef.current = {
          slideIndex: nextSlideIndex,
          verticalIndex: Number.isInteger(nextVerticalIndex) ? nextVerticalIndex : 0,
        }
      }
    },
    []
  )

  const isCurrentSlide = useCallback((nextSlideIndex, nextVerticalIndex = 0) => (
    nextSlideIndex === activeSlideRef.current.slideIndex &&
    (nextVerticalIndex || 0) === activeSlideRef.current.verticalIndex
  ), [])

  const callWithTarget = useCallback((callback, args, targetSlideIndex, targetVerticalIndex = 0) => {
    if (includeVerticalIndex || (targetVerticalIndex || 0) !== 0) {
      callback(...args, targetSlideIndex, targetVerticalIndex || 0)
    } else {
      callback(...args, targetSlideIndex)
    }
  }, [includeVerticalIndex])

  const handleAnnotationAdd = useCallback(
    ({ slideIndex: sIdx, verticalIndex: vIdx = 0, annotation }) => {
      if (isCurrentSlide(sIdx, vIdx) && annotation?.id) {
        // Skip if already seen (deduplicate against annotations:sync arriving after add)
        if (seenIds.current.has(annotation.id)) return
        seenIds.current.add(annotation.id)
        callWithTarget(onAnnotationAdd, [annotation], sIdx, vIdx)
      }
    },
    [callWithTarget, isCurrentSlide, onAnnotationAdd]
  )

  const handleAnnotationRemove = useCallback(
    ({ slideIndex: sIdx, verticalIndex: vIdx = 0, annotationId }) => {
      if (isCurrentSlide(sIdx, vIdx)) {
        seenIds.current.delete(annotationId)
        callWithTarget(onAnnotationRemove, [annotationId], sIdx, vIdx)
      }
    },
    [callWithTarget, isCurrentSlide, onAnnotationRemove]
  )

  const handleAnnotationClear = useCallback(
    (payload = {}) => {
      const isGlobalClear = payload?.global === true || payload?.slideIndex == null
      const currentTarget = activeSlideRef.current
      const targetSlideIndex = isGlobalClear ? currentTarget.slideIndex : payload.slideIndex
      const targetVerticalIndex = isGlobalClear
        ? currentTarget.verticalIndex
        : payload.verticalIndex || 0
      if (isGlobalClear || isCurrentSlide(targetSlideIndex, targetVerticalIndex)) {
        // Clear seen IDs for this slide — next annotations:sync can re-add them
        seenIds.current = new Set()
        callWithTarget(onAnnotationsClear, [], targetSlideIndex, targetVerticalIndex)
      }
    },
    [callWithTarget, isCurrentSlide, onAnnotationsClear]
  )

  const handleAnnotationsSync = useCallback(
    (payload) => {
      // Two payload shapes are supported:
      //  - join/rejoin: { slideAnnotations: { [slideIndex]: Annotation[] } }
      //  - navigate (slide-scoped): { slideIndex, verticalIndex, annotations: Annotation[] }
      let annotations
      const isFullSync = Boolean(payload?.slideAnnotations)
      const { slideIndex: currentSlideIndex, verticalIndex: currentVerticalIndex } = activeSlideRef.current
      const annotationKey = currentVerticalIndex
        ? `${currentSlideIndex}:${currentVerticalIndex}`
        : String(currentSlideIndex)
      if (isFullSync) {
        annotations = Array.isArray(payload.slideAnnotations[annotationKey])
          ? payload.slideAnnotations[annotationKey]
          : []
        const snapshotIds = new Set(annotations.map((ann) => ann?.id).filter(Boolean))
        const seenIdsMatch = snapshotIds.size === seenIds.current.size &&
          [...snapshotIds].every((id) => seenIds.current.has(id))
        if (!seenIdsMatch) {
          // A join/rejoin snapshot is authoritative for the current slide. Replace
          // local strokes when the server snapshot differs from the live event set.
          seenIds.current = new Set()
          callWithTarget(onAnnotationsClear, [], currentSlideIndex, currentVerticalIndex)
        }
      } else if (
        payload?.slideIndex === currentSlideIndex &&
        (payload?.verticalIndex || 0) === currentVerticalIndex
      ) {
        // Scoped sync for the slide we just navigated to: reset and replace so
        // the previous slide's strokes do not bleed onto this one.
        seenIds.current = new Set()
        callWithTarget(onAnnotationsClear, [], currentSlideIndex, currentVerticalIndex)
        annotations = payload.annotations
      } else {
        return
      }
      if (annotations) {
        annotations.forEach((ann) => {
          if (ann?.id && !seenIds.current.has(ann.id)) {
            seenIds.current.add(ann.id)
            callWithTarget(onAnnotationAdd, [ann], currentSlideIndex, currentVerticalIndex)
          }
        })
      }
    },
    [activeSlideRef, callWithTarget, onAnnotationAdd, onAnnotationsClear]
  )

  useEffect(() => {
    if (!socket) return

    socket.on('annotation:add', handleAnnotationAdd)
    socket.on('annotation:removed', handleAnnotationRemove)
    socket.on('annotation:cleared', handleAnnotationClear)
    socket.on('annotations:sync', handleAnnotationsSync)
    socket.on('navigate', handleSlideState)
    socket.on('sync-state', handleSlideState)

    return () => {
      socket.off('annotation:add', handleAnnotationAdd)
      socket.off('annotation:removed', handleAnnotationRemove)
      socket.off('annotation:cleared', handleAnnotationClear)
      socket.off('annotations:sync', handleAnnotationsSync)
      socket.off('navigate', handleSlideState)
      socket.off('sync-state', handleSlideState)
      seenIds.current = new Set()
    }
  }, [
    socket,
    handleAnnotationAdd,
    handleAnnotationRemove,
    handleAnnotationClear,
    handleAnnotationsSync,
    handleSlideState,
  ])

  return { registerAnnotationId }
}
