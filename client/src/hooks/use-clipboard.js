import { useCallback } from 'react'
import { clonePresetElements } from 'revealjs-shared/src/education/presets/clone.js'
import { useEditorStore } from '../stores/editor-store'
import {
  hasBlockedGroupMutation,
  semanticClipboardMutationBlocked,
} from '../utils/active-slide-selection'
import { createSemanticClipboard, pasteSemanticClipboard } from '../utils/pptx-semantic-clipboard'
import { deleteSlideElements } from '../utils/delete-slide-elements'
import { prepareSemanticCut } from '../utils/pptx-semantic-cut'

function effectiveActions(elements, effective = elements) {
  const byId = new Map((effective || []).map((element) => [element.id, element]))
  return elements.map((element) =>
    byId.get(element.id)?.action ? { ...element, action: byId.get(element.id).action } : element
  )
}

function copyElements(elements, sourceScopeId) {
  const copied = elements.map((element) => {
    const { id, ...copy } = structuredClone(element)
    Object.defineProperty(copy, '__connectorSourceId', { value: id })
    return copy
  })
  Object.defineProperty(copied, '__interactionSourceScopeId', { value: sourceScopeId })
  return copied
}

export function createCopyOperation({
  slideElements,
  selectedElementIds,
  sourceScopeId,
  effectiveElements = slideElements,
}) {
  if (!slideElements || !selectedElementIds.length) return null
  const selected = slideElements.filter((element) => selectedElementIds.includes(element.id))
  return selected.length
    ? copyElements(effectiveActions(selected, effectiveElements), sourceScopeId)
    : null
}

/** Paste uses the canonical clone engine; a destination ID alone cannot prove source ownership. */
export function createPasteOperation({
  clipboardElements,
  pasteIndex = 0,
  destinationElements = [],
  destinationScopeId,
}) {
  if (!clipboardElements?.length) return { elements: [], allIds: [], lastId: null }
  const source = clipboardElements.map((element, index) => ({
    ...element,
    id: element.__connectorSourceId || element.id || `clipboard-source:${index}`,
  }))
  const counts = new Map()
  for (const element of source)
    if (element.groupId) counts.set(element.groupId, (counts.get(element.groupId) || 0) + 1)
  const grouped = source.map((element) => ({
    ...element,
    groupId: counts.get(element.groupId) >= 2 ? element.groupId : undefined,
  }))
  const sameScope =
    destinationScopeId != null &&
    clipboardElements.__interactionSourceScopeId === destinationScopeId
  const cloned = clonePresetElements(
    { elements: grouped },
    { destinationElements, preserveExternalTargets: sameScope }
  )
  const offset = 20 * (pasteIndex + 1)
  const elements = cloned.elements.map((element) => ({
    ...element,
    x: (element.x || 0) + offset,
    y: (element.y || 0) + offset,
  }))
  const allIds = elements.map((element) => element.id)
  return { elements, allIds, lastId: allIds.at(-1), warnings: cloned.warnings }
}

export function createDuplicateOperation({
  slideElements,
  selectedElementIds,
  destinationElements = slideElements,
}) {
  const selected = effectiveActions(
    (slideElements || []).filter(
      (element) => selectedElementIds.includes(element.id) && !element.locked
    ),
    destinationElements
  )
  if (!selected.length) return { toAdd: [], clipboardData: null, lastId: null }
  const counts = new Map()
  for (const element of selected)
    if (element.groupId) counts.set(element.groupId, (counts.get(element.groupId) || 0) + 1)
  const grouped = selected.map((element) => ({
    ...element,
    groupId: counts.get(element.groupId) >= 2 ? element.groupId : undefined,
  }))
  const cloned = clonePresetElements(
    { elements: grouped },
    { destinationElements: destinationElements || [], preserveExternalTargets: true }
  )
  const toAdd = cloned.elements.map((element) => ({
    ...element,
    x: (element.x || 0) + 20,
    y: (element.y || 0) + 20,
  }))
  return {
    toAdd,
    clipboardData: copyElements(selected),
    lastId: toAdd.at(-1).id,
    warnings: cloned.warnings,
  }
}

export function createCutOperation({
  slideElements,
  selectedElementIds,
  sourceScopeId,
  effectiveElements = slideElements,
}) {
  if (
    !slideElements ||
    !selectedElementIds.length ||
    hasBlockedGroupMutation({ elements: slideElements }, selectedElementIds)
  )
    return { clipboardData: null, idsToDelete: [] }
  const selected = slideElements.filter(
    (element) => selectedElementIds.includes(element.id) && !element.locked
  )
  return selected.length
    ? {
        clipboardData: copyElements(effectiveActions(selected, effectiveElements), sourceScopeId),
        idsToDelete: selected.map((element) => element.id),
      }
    : { clipboardData: null, idsToDelete: [] }
}

export function useClipboard({
  mapActiveSlide,
  setPresentation,
  getActiveSlide,
  getDestinationElements,
  getScopeId,
  onInteractionWarnings,
  getPresentation,
  commitPresentationTransaction,
}) {
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const incrementPasteCount = useEditorStore((s) => s.incrementPasteCount)
  const resetPasteCount = useEditorStore((s) => s.resetPasteCount)

  const performCopy = useCallback(
    (slideElements) => {
      const presentation = getPresentation?.()
      const active = getActiveSlide?.()
      if (presentation?.pptxSemantic) {
        const data = createSemanticClipboard({
          presentation,
          slide: active,
          selectedElementIds: useEditorStore.getState().selectedElementIds,
          effectiveElements: getDestinationElements?.() || slideElements,
        })
        if (data) {
          setClipboard(data)
          resetPasteCount()
          return data
        }
      }
      const data = createCopyOperation({
        slideElements,
        selectedElementIds: useEditorStore.getState().selectedElementIds,
        sourceScopeId: getScopeId?.() || getActiveSlide?.()?.id,
        effectiveElements: getDestinationElements?.() || slideElements,
      })
      if (data) {
        setClipboard(data)
        resetPasteCount()
      }
    },
    [
      getPresentation,
      getScopeId,
      getActiveSlide,
      getDestinationElements,
      setClipboard,
      resetPasteCount,
    ]
  )

  const performPaste = useCallback(
    (clipboardElements) => {
      if (clipboardElements?.kind === 'pptx-semantic-selection') {
        const active = getActiveSlide()
        if (active.locked) throw new TypeError('Slide is locked')
        const pasted = pasteSemanticClipboard({
          presentation: getPresentation(),
          slideId: active.id,
          clipboard: clipboardElements,
          pasteIndex: useEditorStore.getState().pasteCount,
        })
        setPresentation(pasted.presentation)
        incrementPasteCount()
        setSelectedElementIds(pasted.selectedIds)
        if (pasted.warnings.length) onInteractionWarnings?.(pasted.warnings)
        return pasted
      }
      if (!clipboardElements?.length) return
      const active = getActiveSlide?.()
      const pasted = createPasteOperation({
        clipboardElements,
        pasteIndex: useEditorStore.getState().pasteCount,
        destinationElements: getDestinationElements?.() || active?.elements || [],
        destinationScopeId: getScopeId?.() || active?.id,
      })
      setPresentation((prev) =>
        mapActiveSlide(prev, (slide) => ({
          ...slide,
          elements: [...(slide.elements || []), ...pasted.elements],
        }))
      )
      incrementPasteCount()
      setSelectedElementIds(pasted.allIds)
      if (pasted.warnings.length) onInteractionWarnings?.(pasted.warnings)
      return pasted
    },
    [
      mapActiveSlide,
      setPresentation,
      getScopeId,
      getActiveSlide,
      getPresentation,
      getDestinationElements,
      incrementPasteCount,
      setSelectedElementIds,
      onInteractionWarnings,
    ]
  )

  const performCut = useCallback(
    (slideElements, selectedElementIds = []) => {
      const presentation = getPresentation?.()
      const active = getActiveSlide?.()
      if (presentation?.pptxSemantic) {
        const data = createSemanticClipboard({
          presentation,
          slide: active,
          selectedElementIds,
          effectiveElements: getDestinationElements?.() || slideElements,
        })
        if (data) {
          if (typeof commitPresentationTransaction !== 'function')
            throw new TypeError('Semantic cut requires a presentation transaction owner')
          const prepared = prepareSemanticCut(presentation, active.id, selectedElementIds, mapActiveSlide, data)
          if (!prepared) throw new TypeError('Selection contains locked or hidden objects')
          commitPresentationTransaction(
            (previous) => previous?.id !== presentation.id
              ? null
              : previous === presentation
                ? prepared
                : prepareSemanticCut(previous, active.id, selectedElementIds, mapActiveSlide),
            (clipboard) => {
              setClipboard(clipboard)
              resetPasteCount()
              clearSelection()
            }
          )
          return data
        }
      }
      const { clipboardData, idsToDelete } = createCutOperation({
        slideElements,
        selectedElementIds,
        sourceScopeId: getScopeId?.() || getActiveSlide?.()?.id,
        effectiveElements: getDestinationElements?.() || slideElements,
      })
      if (clipboardData) {
        setClipboard(clipboardData)
        resetPasteCount()
      }
      if (!idsToDelete.length) return
      setPresentation((prev) =>
        mapActiveSlide(prev, (slide) => deleteSlideElements(slide, idsToDelete))
      )
      const survivors = selectedElementIds.filter((id) => !idsToDelete.includes(id))
      if (survivors.length) setSelectedElementIds(survivors)
      else clearSelection()
    },
    [
      getScopeId,
      getPresentation,
      getActiveSlide,
      getDestinationElements,
      mapActiveSlide,
      setPresentation,
      commitPresentationTransaction,
      setClipboard,
      resetPasteCount,
      setSelectedElementIds,
      clearSelection,
    ]
  )

  const performDuplicate = useCallback(() => {
    const presentation = getPresentation?.()
    if (!presentation?.pptxSemantic) return null
    const active = getActiveSlide()
    const selectedElementIds = useEditorStore.getState().selectedElementIds
    const data = createSemanticClipboard({
      presentation,
      slide: active,
      selectedElementIds,
      effectiveElements: getDestinationElements?.() || active.elements,
    })
    if (!data) return null
    if (
      active.locked ||
      hasBlockedGroupMutation(active, selectedElementIds) ||
      semanticClipboardMutationBlocked(presentation.pptxSemantic, active, selectedElementIds)
    )
      throw new TypeError('Selection contains locked or hidden objects')
    const duplicated = pasteSemanticClipboard({
      presentation,
      slideId: active.id,
      clipboard: data,
      pasteIndex: 0,
    })
    setPresentation(duplicated.presentation)
    setSelectedElementIds(duplicated.selectedIds)
    if (duplicated.warnings.length) onInteractionWarnings?.(duplicated.warnings)
    return duplicated
  }, [
    getPresentation,
    getActiveSlide,
    getDestinationElements,
    setPresentation,
    setSelectedElementIds,
    onInteractionWarnings,
  ])

  return { performCopy, performPaste, performCut, performDuplicate }
}
