import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveActiveSlide } from '../../utils/active-slide-mapper'
import { pushHistory } from '../../utils/history-stack'
import { reconcileSelectionAfterHistory } from '../../utils/history-selection-reconciler'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function useEditorHistoryController({
  presentation,
  setPresentation,
  setCurrentSlideIndex,
  setVerticalEdit,
  currentSlideIndexRef,
  verticalEditRef,
  selectedElementIdsRef,
  editingElementIdRef,
  setSelectedElementIds,
  setEditingElementId,
  editor,
  settingContent: settingContentRef,
}) {
  const historyRef = useRef([])
  const redoStackRef = useRef([])
  const applyingUndoRef = useRef(false)
  const seededRef = useRef(false)
  const [hasChanges, setHasChanges] = useState(false)

  const publishLength = useCallback(() => {
    if (window.__E2E__) window.__NAVSLIDES_E2E_HISTORY_LENGTH = historyRef.current.length
  }, [])

  const seedHistory = useCallback(
    (snapshot) => {
      historyRef.current = [clone(snapshot)]
      redoStackRef.current = []
      seededRef.current = true
      setHasChanges(false)
      publishLength()
    },
    [publishLength]
  )

  useEffect(() => {
    if (!presentation) return
    if (seededRef.current) {
      seededRef.current = false
      return
    }
    if (applyingUndoRef.current) {
      applyingUndoRef.current = false
      return
    }
    const timer = setTimeout(() => {
      historyRef.current = pushHistory(historyRef.current, clone(presentation))
      redoStackRef.current = []
      setHasChanges(historyRef.current.length > 1)
      publishLength()
    }, 500)
    return () => clearTimeout(timer)
  }, [presentation, publishLength])

  const reconcile = useCallback(
    (state) => {
      setVerticalEdit((active) => {
        if (!active || active.child == null) return active
        const parent = state?.slides?.find((slide) => slide.id === active.parentId)
        return !parent?.children || active.child >= parent.children.length ? null : active
      })
      const index = Math.min(currentSlideIndexRef.current, (state?.slides?.length ?? 1) - 1)
      const slide = resolveActiveSlide(state?.slides, index, verticalEditRef.current)
      const result = reconcileSelectionAfterHistory(
        slide,
        selectedElementIdsRef.current,
        editingElementIdRef.current
      )
      setSelectedElementIds(result.selectedIds)
      if (!result.editingCleared) return
      setEditingElementId(result.editingId)
      editingElementIdRef.current = result.editingId
      if (!editor) return
      settingContentRef.current = true
      editor.commands.setContent('', false)
      settingContentRef.current = false
    },
    [
      currentSlideIndexRef,
      editingElementIdRef,
      editor,
      selectedElementIdsRef,
      setEditingElementId,
      setSelectedElementIds,
      setVerticalEdit,
      settingContentRef,
      verticalEditRef,
    ]
  )

  const restore = useCallback(
    (state) => {
      setPresentation(state)
      setCurrentSlideIndex((index) => Math.min(index, state.slides.length - 1))
      reconcile(state)
    },
    [reconcile, setCurrentSlideIndex, setPresentation]
  )

  const handleUndo = useCallback(() => {
    if (historyRef.current.length < 2) return
    applyingUndoRef.current = true
    redoStackRef.current = pushHistory(
      redoStackRef.current,
      historyRef.current[historyRef.current.length - 1]
    )
    historyRef.current = historyRef.current.slice(0, -1)
    setHasChanges(historyRef.current.length > 1)
    restore(historyRef.current[historyRef.current.length - 1])
  }, [restore])

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return
    applyingUndoRef.current = true
    const state = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    if (presentation) historyRef.current = pushHistory(historyRef.current, clone(presentation))
    setHasChanges(historyRef.current.length > 1)
    restore(state)
  }, [presentation, restore])

  return { handleRedo, handleUndo, hasChanges, seedHistory }
}
