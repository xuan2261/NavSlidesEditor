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
 * Pure function: compute elements to be pasted (fresh UUIDs + cascading offset).
 * Does NOT mutate store — returns the elements to add.
 *
 * Group handling: a source group is rebuilt under a NEW shared groupId only when
 * ≥2 pasted elements carry that source groupId. A lone survivor of a group is
 * dropped to ungrouped (a 1-member group is meaningless). Pasting two distinct
 * source groups yields two distinct new groupIds — they never collapse together.
 *
 * @param {Object} opts
 * @param {Object[]} opts.clipboardElements - elements from clipboard
 * @param {number} [opts.pasteIndex=0] - how many times this clipboard has already
 *   been pasted; drives the cascade offset so repeated pastes fan out.
 * @returns {{ elements: Object[], allIds: string[], lastId: string|null }}
 */
export function createPasteOperation({ clipboardElements, pasteIndex = 0 }) {
  if (!clipboardElements || clipboardElements.length === 0) {
    return { elements: [], allIds: [], lastId: null }
  }
  const counts = new Map()
  for (const el of clipboardElements) {
    if (el.groupId) counts.set(el.groupId, (counts.get(el.groupId) || 0) + 1)
  }
  const groupRemap = new Map()
  const off = 20 * (pasteIndex + 1)
  const elements = []
  const allIds = []
  let lastId = null
  for (const el of clipboardElements) {
    const newId = crypto.randomUUID()
    lastId = newId
    allIds.push(newId)
    let groupId
    if (el.groupId && counts.get(el.groupId) >= 2) {
      if (!groupRemap.has(el.groupId)) groupRemap.set(el.groupId, crypto.randomUUID())
      groupId = groupRemap.get(el.groupId)
    }
    elements.push({ ...el, id: newId, groupId, x: (el.x || 0) + off, y: (el.y || 0) + off })
  }
  return { elements, allIds, lastId }
}

/**
 * Pure function: compute elements for a duplicate operation (sync, no setTimeout).
 * Returns { toAdd, clipboardData } — caller adds elements and sets clipboard.
 *
 * Locked members are skipped (the rest are still duplicated), matching delete
 * behavior. Group handling mirrors createPasteOperation: duplicates of a group
 * land under a NEW shared groupId (≥2 members), a lone survivor is ungrouped.
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
  const selected = (slideElements || []).filter((el) =>
    selectedElementIds.includes(el.id)
  )
  if (selected.length === 0) {
    return { toAdd: [], clipboardData: null, lastId: null }
  }

  // Skip locked members, duplicate the rest (consistent with delete).
  const elementsToDuplicate = selected.filter((el) => !el.locked)
  if (elementsToDuplicate.length === 0) {
    return { toAdd: [], clipboardData: null, lastId: null }
  }

  const clipboardData = elementsToDuplicate.map((el) => {
    const { id: _id, ...rest } = el
    return { ...rest }
  })

  const counts = new Map()
  for (const el of elementsToDuplicate) {
    if (el.groupId) counts.set(el.groupId, (counts.get(el.groupId) || 0) + 1)
  }
  const groupRemap = new Map()
  const toAdd = []
  let lastId = null
  for (const el of elementsToDuplicate) {
    const newId = crypto.randomUUID()
    lastId = newId
    let groupId
    if (el.groupId && counts.get(el.groupId) >= 2) {
      if (!groupRemap.has(el.groupId)) groupRemap.set(el.groupId, crypto.randomUUID())
      groupId = groupRemap.get(el.groupId)
    }
    toAdd.push({ ...el, id: newId, groupId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
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
  // Skip locked members (parity with delete + duplicate). Mixed selection cuts free only.
  const elementsToCut = (slideElements || []).filter(
    (el) => selectedElementIds.includes(el.id) && !el.locked
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
 * @param {(prev:Object, fn:(slide:Object)=>Object)=>Object} opts.mapActiveSlide
 *   routes a slide transform to the active slide (parent OR active vertical
 *   child), so paste/cut/duplicate never write to the parent while a child is
 *   being edited.
 * @param {(presentation: Object) => void} opts.setPresentation - presentation store setter
 */
export function useClipboard({ mapActiveSlide, setPresentation }) {
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const incrementPasteCount = useEditorStore((s) => s.incrementPasteCount)
  const resetPasteCount = useEditorStore((s) => s.resetPasteCount)

  const performCopy = useCallback(
    (slideElements) => {
      const data = createCopyOperation({
        slideElements: slideElements || [],
        selectedElementIds,
      })
      if (data) {
        setClipboard(data)
        resetPasteCount()
      }
    },
    [selectedElementIds, setClipboard, resetPasteCount]
  )

  const performPaste = useCallback(
    (clipboardElements) => {
      const pasteIndex = useEditorStore.getState().pasteCount
      const { elements, allIds } = createPasteOperation({ clipboardElements, pasteIndex })
      if (!elements.length) return
      setPresentation((prev) =>
        mapActiveSlide(prev, (s) => ({ ...s, elements: [...(s.elements || []), ...elements] }))
      )
      incrementPasteCount()
      if (allIds.length) setSelectedElementIds(allIds)
    },
    [mapActiveSlide, setPresentation, setSelectedElementIds, incrementPasteCount]
  )

  const performCut = useCallback(
    (slideElements, selectedIds) => {
      const selectedElementIds = selectedIds || []
      const { clipboardData, idsToDelete } = createCutOperation({
        slideElements: slideElements || [],
        selectedElementIds,
      })
      if (clipboardData) {
        setClipboard(clipboardData)
        resetPasteCount()
      }
      // Only delete free ids returned by the pure op — never raw selection (locked stay).
      if (!idsToDelete?.length) return
      setPresentation((prev) =>
        mapActiveSlide(prev, (s) => ({
          ...s,
          elements: (s.elements || []).filter((el) => !idsToDelete.includes(el.id)),
        }))
      )
      // Mirror deleteSelectedElements: keep selection on remaining locked members.
      const lockedSurvivors = selectedElementIds.filter((id) => !idsToDelete.includes(id))
      if (lockedSurvivors.length) {
        setSelectedElementIds(lockedSurvivors)
      } else {
        clearSelection()
      }
    },
    [
      mapActiveSlide,
      setPresentation,
      setClipboard,
      clearSelection,
      resetPasteCount,
      setSelectedElementIds,
    ]
  )

  const performDuplicate = useCallback(
    (clipboardElements) => {
      const toAdd = (clipboardElements || []).filter((el) => !el.locked)
      if (!toAdd.length) return
      setPresentation((prev) =>
        mapActiveSlide(prev, (s) => ({ ...s, elements: [...(s.elements || []), ...toAdd] }))
      )
    },
    [mapActiveSlide, setPresentation]
  )

  return { performCopy, performPaste, performCut, performDuplicate }
}
