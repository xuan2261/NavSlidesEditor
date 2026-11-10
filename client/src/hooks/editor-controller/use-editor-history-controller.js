import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { pushHistory } from '../../utils/history-stack'
import { reconcileSelectionAfterHistory } from '../../utils/history-selection-reconciler'
import { resolveHistoryAuthoringSlide } from '../../utils/history-authoring-slide'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import { semanticInstances, semanticInstance, semanticDefinition, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function useEditorHistoryController({
  presentation,
  authoringTarget,
  setPresentation,
  setCurrentSlideIndex,
  setVerticalEdit,
  resolveHistorySlide,
  currentSlideIndexRef,
  verticalEditRef,
  selectedElementIdsRef,
  editingElementIdRef,
  setSelectedElementIds,
  setEditingElementId,
  resetContent,
}) {
  const masterTargetId = authoringTarget?.kind === 'master' ? authoringTarget.id : null
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
    historyRef.current = pushHistory(historyRef.current, clone(pendingSnapshotRef.current))
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
    pendingSnapshotRef.current = presentation
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
      const slide = resolveHistorySlide
        ? resolveHistorySlide(state)
        : resolveHistoryAuthoringSlide(state, {
            presentationId: presentation?.id,
            masterId: masterTargetId,
            currentSlideIndex: currentSlideIndexRef.current,
            verticalEdit: verticalEditRef.current,
          })
      const result = reconcileSelectionAfterHistory(
        slide,
        selectedElementIdsRef.current,
        editingElementIdRef.current
      )
      setSelectedElementIds(result.selectedIds)
      if (result.editingCleared) {
        setEditingElementId(result.editingId)
        editingElementIdRef.current = result.editingId
        resetContent('')
      } else if (result.editingId) {
        const restoredElement = slide.elements.find((element) => element.id === result.editingId)
        resetContent(restoredElement.content || '')
      }
    },
    [
      editingElementIdRef,
      masterTargetId,
      selectedElementIdsRef,
      resolveHistorySlide,
      setEditingElementId,
      setSelectedElementIds,
      setVerticalEdit,
      resetContent,
      currentSlideIndexRef,
      verticalEditRef,
      presentation?.id,
    ]
  )

  const prepareRestore = useCallback(
    (state) => {
      let restored = state
      if (state.pptxSemantic && presentation?.pptxSemantic) {
        let patchInstances = null
        let patchDefinitions = null
        // A saved source occurrence cannot disappear from the baseline.
        // Undo removes its authored presence, not its retained identity.
        for (const [id, instance] of semanticInstances(presentation.pptxSemantic)) {
          if (semanticInstance(state.pptxSemantic, id)) continue
          patchDefinitions ??= {}
          if (!semanticDefinition(state.pptxSemantic, instance.definitionId) && !patchDefinitions[instance.definitionId]) {
            patchDefinitions[instance.definitionId] = semanticDefinition(presentation.pptxSemantic, instance.definitionId)
          }
          patchInstances ??= {}
          patchInstances[id] = {
            ...instance,
            lineage: {
              ...instance.lineage,
              tombstone: true,
              deleted: true,
              ...(instance.lineage?.paintOnly ? { paintOnly: false } : {}),
            },
          }
        }
        if (patchInstances || patchDefinitions) {
          restored = {
            ...state,
            pptxSemantic: replaceSemanticRecords(state.pptxSemantic, {
              definitions: patchDefinitions || undefined,
              instances: patchInstances || undefined,
            }),
          }
        }
      }
      return semantic.normalizeSemanticPresentation(restored)
    },
    [presentation]
  )

  const restore = useCallback(
    (canonical) => {
      reconcile(canonical)
      setPresentation(canonical)
      setCurrentSlideIndex((index) => Math.min(index, canonical.slides.length - 1))
    },
    [reconcile, setCurrentSlideIndex, setPresentation]
  )

  const handleUndo = useCallback(() => {
    commitPendingSnapshot()
    if (historyRef.current.length < 2) return
    const canonical = prepareRestore(historyRef.current[historyRef.current.length - 2])
    applyingUndoRef.current = true
    redoStackRef.current = pushHistory(
      redoStackRef.current,
      historyRef.current[historyRef.current.length - 1]
    )
    historyRef.current = historyRef.current.slice(0, -1)
    setHasChanges(historyRef.current.length > 1)
    publishHistoryState()
    restore(canonical)
  }, [commitPendingSnapshot, prepareRestore, publishHistoryState, restore])

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return
    const canonical = prepareRestore(redoStackRef.current[redoStackRef.current.length - 1])
    applyingUndoRef.current = true
    const state = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    historyRef.current = pushHistory(historyRef.current, state)
    setHasChanges(historyRef.current.length > 1)
    publishHistoryState()
    restore(canonical)
  }, [prepareRestore, publishHistoryState, restore])

  return {
    ...availability,
    commitHistoryTransaction,
    handleRedo,
    handleUndo,
    hasChanges,
    seedHistory,
  }
}
