import { useEffect, useCallback, useRef } from 'react'

/**
 * Syncs annotation state via Socket.IO events.
 * Filters incoming events by the current slide index so viewers only see
 * annotations relevant to the slide they are viewing.
 *
 * @param {object} params
 * @param {object|null} params.socket - Socket.IO socket instance
 * @param {number} params.slideIndex - Current slide index for filtering
 * @param {Function} params.onAnnotationAdd - Called with an Annotation when one is added
 * @param {Function} params.onAnnotationRemove - Called with annotationId when one is removed
 * @param {Function} params.onAnnotationsClear - Called when all annotations for a slide are cleared
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

  const handleAnnotationAdd = useCallback(
    ({ slideIndex: sIdx, annotation }) => {
      if (sIdx === slideIndex && annotation?.id) {
        // Skip if already seen (deduplicate against annotations:sync arriving after add)
        if (seenIds.current.has(annotation.id)) return
        seenIds.current.add(annotation.id)
        onAnnotationAdd(annotation)
      }
    },
    [slideIndex, onAnnotationAdd]
  )

  const handleAnnotationRemove = useCallback(
    ({ slideIndex: sIdx, annotationId }) => {
      if (sIdx === slideIndex) {
        seenIds.current.delete(annotationId)
        onAnnotationRemove(annotationId)
      }
    },
    [slideIndex, onAnnotationRemove]
  )

  const handleAnnotationClear = useCallback(
    ({ slideIndex: sIdx }) => {
      if (sIdx === slideIndex) {
        // Clear seen IDs for this slide — next annotations:sync can re-add them
        seenIds.current = new Set()
        onAnnotationsClear()
      }
    },
    [slideIndex, onAnnotationsClear]
  )

  const handleAnnotationsSync = useCallback(
    (payload) => {
      // Two payload shapes are supported:
      //  - join/rejoin: { slideAnnotations: { [slideIndex]: Annotation[] } }
      //  - navigate (slide-scoped): { slideIndex, annotations: Annotation[] }
      let annotations
      if (payload?.slideAnnotations) {
        annotations = payload.slideAnnotations[slideIndex]
      } else if (payload?.slideIndex === slideIndex) {
        // Scoped sync for the slide we just navigated to: reset and replace so
        // the previous slide's strokes do not bleed onto this one.
        seenIds.current = new Set()
        onAnnotationsClear()
        annotations = payload.annotations
      } else {
        return
      }
      if (annotations) {
        annotations.forEach((ann) => {
          if (ann?.id && !seenIds.current.has(ann.id)) {
            seenIds.current.add(ann.id)
            onAnnotationAdd(ann)
          }
        })
      }
    },
    [slideIndex, onAnnotationAdd, onAnnotationsClear]
  )

  useEffect(() => {
    if (!socket) return

    socket.on('annotation:add', handleAnnotationAdd)
    socket.on('annotation:removed', handleAnnotationRemove)
    socket.on('annotation:cleared', handleAnnotationClear)
    socket.on('annotations:sync', handleAnnotationsSync)

    return () => {
      socket.off('annotation:add', handleAnnotationAdd)
      socket.off('annotation:removed', handleAnnotationRemove)
      socket.off('annotation:cleared', handleAnnotationClear)
      socket.off('annotations:sync', handleAnnotationsSync)
      seenIds.current = new Set()
    }
  }, [socket, handleAnnotationAdd, handleAnnotationRemove, handleAnnotationClear, handleAnnotationsSync])
}
