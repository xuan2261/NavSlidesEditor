import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { pushHistory } from '../../utils/history-stack'
import { reconcileSelectionAfterHistory } from '../../utils/history-selection-reconciler'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function useEditorHistoryController({
  presentation,
  setPresentation,
  setCurrentSlideIndex,
  setVerticalEdit,
  resolveHistorySlide,
  selectedElementIdsRef,
  editingElementIdRef,
  setSelectedElementIds,
  setEditingElementId,
  editor,
  settingContent: settingContentRef,
}) {
  const historyRef = useRef([])
  const redoStackRef = useRef([])
  const pendingSnapshotRef = useRef(null)
  const applyingUndoRef = useRef(false)
  const seededRef = useRef(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false })

  const publishHistoryState = useCallback(() => {
    if (window.__E2E__) window.__NAVSLIDES_E2E_HISTORY_LENGTH = historyRef.current.length
    setAvailability({
      canUndo: historyRef.current.length > 1 || pendingSnapshotRef.current !== null,
      canRedo: redoStackRef.current.length > 0,
    })
  }, [])

  const commitPendingSnapshot = useCallback(() => {
    if (pendingSnapshotRef.current === null) return
    historyRef.current = pushHistory(historyRef.current, pendingSnapshotRef.current)
    pendingSnapshotRef.current = null
  }, [])

  const commitHistoryTransaction = useCallback(() => {
    commitPendingSnapshot()
    publishHistoryState()
  }, [commitPendingSnapshot, publishHistoryState])

  const seedHistory = useCallback(
    (snapshot) => {
      historyRef.current = [clone(snapshot)]
      redoStackRef.current = []
      pendingSnapshotRef.current = null
      seededRef.current = true
      setHasChanges(false)
      publishHistoryState()
    },
    [publishHistoryState]
  )

  useLayoutEffect(() => {
    if (!presentation) return
    if (seededRef.current) {
      seededRef.current = false
      return
    }
    if (applyingUndoRef.current) {
      applyingUndoRef.current = false
      return
    }
    pendingSnapshotRef.current = clone(presentation)
    redoStackRef.current = []
    setHasChanges(true)
    publishHistoryState()
    const timer = setTimeout(() => {
      commitPendingSnapshot()
      publishHistoryState()
    }, 500)
    return () => clearTimeout(timer)
  }, [commitPendingSnapshot, presentation, publishHistoryState])

  const reconcile = useCallback(
    (state) => {
      setVerticalEdit((active) => {
        if (!active || active.child == null) return active
        const parent = state?.slides?.find((slide) => slide.id === active.parentId)
        return !parent?.children || active.child >= parent.children.length ? null : active
      })
      const slide = resolveHistorySlide(state)
      const result = reconcileSelectionAfterHistory(
        slide,
        selectedElementIdsRef.current,
        editingElementIdRef.current
      )
      setSelectedElementIds(result.selectedIds)
      if (!result.editingCleared) return
      setEditingElementId(result.editingId)
      editingElementIdRef.current = result.editingId
      if (!editor || editor.isDestroyed) return
      settingContentRef.current = true
      editor.commands.setContent('', false)
      settingContentRef.current = false
    },
    [
      editingElementIdRef,
      editor,
      selectedElementIdsRef,
      resolveHistorySlide,
      setEditingElementId,
      setSelectedElementIds,
      setVerticalEdit,
      settingContentRef,
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
    commitPendingSnapshot()
    if (historyRef.current.length < 2) return
    applyingUndoRef.current = true
    redoStackRef.current = pushHistory(
      redoStackRef.current,
      historyRef.current[historyRef.current.length - 1]
    )
    historyRef.current = historyRef.current.slice(0, -1)
    setHasChanges(historyRef.current.length > 1)
    publishHistoryState()
    restore(historyRef.current[historyRef.current.length - 1])
  }, [commitPendingSnapshot, publishHistoryState, restore])

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return
    applyingUndoRef.current = true
    const state = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    historyRef.current = pushHistory(historyRef.current, state)
    setHasChanges(historyRef.current.length > 1)
    publishHistoryState()
    restore(state)
  }, [publishHistoryState, restore])

  return {
    ...availability,
    commitHistoryTransaction,
    handleRedo,
    handleUndo,
    hasChanges,
    seedHistory,
  }
}
