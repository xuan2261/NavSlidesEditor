import { useEffect, useCallback, useRef } from 'react'

/**
 * Syncs annotation state via Socket.IO events.
 * Filters incoming events by the current slide index so viewers only see
 * annotations relevant to the slide they are viewing.
 *
 * @param {object} params
 * @param {object|null} params.socket - Socket.IO socket instance
 * @param {number} params.slideIndex - Current slide index for filtering
 * @param {Function} params.onAnnotationAdd - Called with an Annotation and target slide index
 * @param {Function} params.onAnnotationRemove - Called with annotationId and target slide index
 * @param {Function} params.onAnnotationsClear - Called with the target slide index
 */
export function useAnnotationSync({
  socket,
  slideIndex,
  onAnnotationAdd,
  onAnnotationRemove,
  onAnnotationsClear,
}) {
  // Track seen annotation IDs to deduplicate against race-condition duplicates.
  // Race: annotation:add can arrive before annotations:sync, causing the same
  // annotation to be added twice (once from the event, once from sync).
  const seenIds = useRef(new Set())
  const activeSlideIndexRef = useRef(slideIndex)

  useEffect(() => {
    activeSlideIndexRef.current = slideIndex
  }, [slideIndex])

  const handleSlideState = useCallback(
    ({ slideIndex: nextSlideIndex }) => {
      if (Number.isInteger(nextSlideIndex)) activeSlideIndexRef.current = nextSlideIndex
    },
    [activeSlideIndexRef]
  )

  const handleAnnotationAdd = useCallback(
    ({ slideIndex: sIdx, annotation }) => {
      if (sIdx === activeSlideIndexRef.current && annotation?.id) {
        // Skip if already seen (deduplicate against annotations:sync arriving after add)
        if (seenIds.current.has(annotation.id)) return
        seenIds.current.add(annotation.id)
        onAnnotationAdd(annotation, sIdx)
      }
    },
    [activeSlideIndexRef, onAnnotationAdd]
  )

  const handleAnnotationRemove = useCallback(
    ({ slideIndex: sIdx, annotationId }) => {
      if (sIdx === activeSlideIndexRef.current) {
        seenIds.current.delete(annotationId)
        onAnnotationRemove(annotationId, sIdx)
      }
    },
    [activeSlideIndexRef, onAnnotationRemove]
  )

  const handleAnnotationClear = useCallback(
    ({ slideIndex: sIdx }) => {
      if (sIdx === activeSlideIndexRef.current) {
        // Clear seen IDs for this slide — next annotations:sync can re-add them
        seenIds.current = new Set()
        onAnnotationsClear(sIdx)
      }
    },
    [activeSlideIndexRef, onAnnotationsClear]
  )

  const handleAnnotationsSync = useCallback(
    (payload) => {
      // Two payload shapes are supported:
      //  - join/rejoin: { slideAnnotations: { [slideIndex]: Annotation[] } }
      //  - navigate (slide-scoped): { slideIndex, annotations: Annotation[] }
      let annotations
      const currentSlideIndex = activeSlideIndexRef.current
      if (payload?.slideAnnotations) {
        annotations = payload.slideAnnotations[currentSlideIndex]
      } else if (payload?.slideIndex === currentSlideIndex) {
        // Scoped sync for the slide we just navigated to: reset and replace so
        // the previous slide's strokes do not bleed onto this one.
        seenIds.current = new Set()
        onAnnotationsClear(currentSlideIndex)
        annotations = payload.annotations
      } else {
        return
      }
      if (annotations) {
        annotations.forEach((ann) => {
          if (ann?.id && !seenIds.current.has(ann.id)) {
            seenIds.current.add(ann.id)
            onAnnotationAdd(ann, currentSlideIndex)
          }
        })
      }
    },
    [activeSlideIndexRef, onAnnotationAdd, onAnnotationsClear]
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
}
