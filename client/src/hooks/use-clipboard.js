import { useCallback } from 'react'
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
    return { elements: [], allIds: [], lastId: null }
  }
  const elements = []
  const allIds = []
  let lastId = null
  for (const el of clipboardElements) {
    const newId = crypto.randomUUID()
    lastId = newId
    allIds.push(newId)
    elements.push({ ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
  }
  return { elements, allIds, lastId }
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

/**
 * @param {Object} opts
 * @param {() => number} opts.getCurrentSlideIndex - getter for current slide index
 * @param {(presentation: Object) => void} opts.setPresentation - presentation store setter
 */
export function useClipboard({ getCurrentSlideIndex, setPresentation }) {
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const selectElement = useEditorStore((s) => s.selectElement)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const performCopy = useCallback(
    (slideElements) => {
      const data = createCopyOperation({
        slideElements: slideElements || [],
        selectedElementIds,
      })
      if (data) setClipboard(data)
    },
    [selectedElementIds, setClipboard]
  )

  const performPaste = useCallback(
    (clipboardElements) => {
      const { elements, allIds } = createPasteOperation({ clipboardElements })
      if (!elements.length) return
      const idx = getCurrentSlideIndex()
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === idx ? { ...s, elements: [...(s.elements || []), ...elements] } : s
          ),
        }
      })
      if (allIds.length) selectElement(allIds)
    },
    [getCurrentSlideIndex, setPresentation, selectElement]
  )

  const performCut = useCallback(
    (slideElements, idsToDelete) => {
      const { clipboardData } = createCutOperation({ slideElements: slideElements || [], selectedElementIds: idsToDelete || [] })
      if (clipboardData) setClipboard(clipboardData)
      if (!idsToDelete?.length) return
      const idx = getCurrentSlideIndex()
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === idx
              ? { ...s, elements: (s.elements || []).filter((el) => !idsToDelete.includes(el.id)) }
              : s
          ),
        }
      })
      clearSelection()
    },
    [getCurrentSlideIndex, setPresentation, setClipboard, clearSelection]
  )

  const performDuplicate = useCallback(
    (clipboardElements) => {
      const toAdd = (clipboardElements || []).filter((el) => !el.locked)
      if (!toAdd.length) return
      const idx = getCurrentSlideIndex()
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === idx ? { ...s, elements: [...(s.elements || []), ...toAdd] } : s
          ),
        }
      })
    },
    [getCurrentSlideIndex, setPresentation]
  )

  return { performCopy, performPaste, performCut, performDuplicate }
}
