import { useCallback } from 'react'
import { usePresentationStore } from '../stores/presentation-store'
import { useEditorStore } from '../stores/editor-store'

/**
 * Pure function: perform a copy operation.
 * Returns the clipboard data that should be set.
 *
 * @param {Object} opts
 * @param {Object[]} opts.slideElements - elements on the current slide
 * @param {string[]} opts.selectedElementIds
 * @returns {Object[]|null} elements to store in clipboard (IDs stripped), or null if nothing to copy
 */
export function createCopyOperation({ slideElements, selectedElementIds }) {
  if (!slideElements || selectedElementIds.length === 0) return null
  const elementsToCopy = (slideElements || []).filter((el) =>
    selectedElementIds.includes(el.id)
  )
  if (elementsToCopy.length === 0) return null
  // Strip IDs so pasted elements get fresh UUIDs
  return elementsToCopy.map((el) => {
    const { id: _id, ...rest } = el
    return { ...rest }
  })
}

/**
 * Pure function: compute elements to be pasted (fresh UUIDs + +20/+20 offset).
 * Does NOT mutate store — returns the elements to add.
 *
 * @param {Object} opts
 * @param {Object[]} opts.clipboardElements - elements from clipboard
 * @returns {{ elements: Object[], lastId: string|null }} elements to add, and the last new ID
 */
export function createPasteOperation({ clipboardElements }) {
  if (!clipboardElements || clipboardElements.length === 0) {
    return { elements: [], lastId: null }
  }
  const elements = []
  let lastId = null
  for (const el of clipboardElements) {
    const newId = crypto.randomUUID()
    lastId = newId
    elements.push({ ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
  }
  return { elements, lastId }
}

/**
 * Pure function: compute elements for a duplicate operation (sync, no setTimeout).
 * Returns { toAdd, clipboardData } — caller adds elements and sets clipboard.
 *
 * @param {Object} opts
 * @param {Object[]} opts.slideElements
 * @param {string[]} opts.selectedElementIds
 * @returns {{ toAdd: Object[], clipboardData: Object[]|null, lastId: string|null }}
 */
export function createDuplicateOperation({ slideElements, selectedElementIds }) {
  if (!slideElements || selectedElementIds.length === 0) {
    return { toAdd: [], clipboardData: null, lastId: null }
  }
  const elementsToDuplicate = (slideElements || []).filter((el) =>
    selectedElementIds.includes(el.id)
  )
  if (elementsToDuplicate.length === 0) {
    return { toAdd: [], clipboardData: null, lastId: null }
  }

  // Locked guard: skip entirely if any selected element is locked
  if (elementsToDuplicate.some((el) => el.locked)) {
    return { toAdd: [], clipboardData: null, lastId: null }
  }

  const clipboardData = elementsToDuplicate.map((el) => {
    const { id: _id, ...rest } = el
    return { ...rest }
  })

  const toAdd = []
  let lastId = null
  for (const el of elementsToDuplicate) {
    const newId = crypto.randomUUID()
    lastId = newId
    toAdd.push({ ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
  }

  return { toAdd, clipboardData, lastId }
}

/**
 * Pure function: perform a cut operation.
 * Returns { clipboardData, idsToDelete } — caller deletes originals and sets clipboard.
 *
 * @param {Object} opts
 * @param {Object[]} opts.slideElements
 * @param {string[]} opts.selectedElementIds
 * @returns {{ clipboardData: Object[]|null, idsToDelete: string[] }}
 */
export function createCutOperation({ slideElements, selectedElementIds }) {
  if (!slideElements || selectedElementIds.length === 0) {
    return { clipboardData: null, idsToDelete: [] }
  }
  const elementsToCut = (slideElements || []).filter((el) =>
    selectedElementIds.includes(el.id)
  )
  if (elementsToCut.length === 0) {
    return { clipboardData: null, idsToDelete: [] }
  }
  const clipboardData = elementsToCut.map((el) => {
    const { id: _id, ...rest } = el
    return { ...rest }
  })
  const idsToDelete = elementsToCut.map((el) => el.id)
  return { clipboardData, idsToDelete }
}

export function useClipboard() {
  const presentation = usePresentationStore((s) => s.presentation)
  const currentSlideIndex = usePresentationStore((s) => s.currentSlideIndex)
  const addElement = usePresentationStore((s) => s.addElement)
  const deleteElement = usePresentationStore((s) => s.deleteElement)

  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const clipboard = useEditorStore((s) => s.clipboard)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const selectElement = useEditorStore((s) => s.selectElement)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const performCopy = useCallback(() => {
    const slide = presentation?.slides?.[currentSlideIndex]
    const data = createCopyOperation({
      slideElements: slide?.elements,
      selectedElementIds,
    })
    if (data) setClipboard(data)
  }, [presentation, currentSlideIndex, selectedElementIds, setClipboard])

  const performPaste = useCallback(() => {
    const { elements, lastId } = createPasteOperation({ clipboardElements: clipboard })
    elements.forEach((el) => addElement(el))
    if (lastId) selectElement(lastId)
  }, [clipboard, addElement, selectElement])

  const performCut = useCallback(() => {
    const slide = presentation?.slides?.[currentSlideIndex]
    const { clipboardData, idsToDelete } = createCutOperation({
      slideElements: slide?.elements,
      selectedElementIds,
    })
    if (clipboardData) setClipboard(clipboardData)
    idsToDelete.forEach((id) => deleteElement(id))
    clearSelection()
  }, [
    presentation,
    currentSlideIndex,
    selectedElementIds,
    setClipboard,
    deleteElement,
    clearSelection,
  ])

  const performDuplicate = useCallback(() => {
    const slide = presentation?.slides?.[currentSlideIndex]
    const { toAdd, clipboardData, lastId } = createDuplicateOperation({
      slideElements: slide?.elements,
      selectedElementIds,
    })
    if (clipboardData) setClipboard(clipboardData)
    toAdd.forEach((el) => addElement(el))
    if (lastId) selectElement(lastId)
  }, [
    presentation,
    currentSlideIndex,
    selectedElementIds,
    setClipboard,
    addElement,
    selectElement,
  ])

  return { performCopy, performPaste, performCut, performDuplicate }
}
