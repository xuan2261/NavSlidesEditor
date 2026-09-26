import { useCallback } from 'react'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'
import { computeMultiZOrderEdge, computeMultiZOrderStep } from '../../utils/z-order-step'
import {
  getSelectionIdsForActiveSlideElement,
  hasBlockedGroupMutation,
} from '../../utils/active-slide-selection'

export function useEditorSelectionController(c) {
  const {
    activeSlideRef,
    editingElementIdRef,
    getSelectionSlide: resolveSelectionSlide,
  } = c
  const getSelectionSlide = useCallback(
    () => resolveSelectionSlide?.() || activeSlideRef.current,
    [activeSlideRef, resolveSelectionSlide]
  )
  const reorderSelection = useCallback(
    (operation, direction) => {
      const ids = c.selectedElementIdsRef.current
      const slide = getSelectionSlide()
      if (!ids?.length || slide?.locked || hasBlockedGroupMutation(slide, ids)) return
      const allowedIds = ids.filter((id) =>
        slide?.elements?.find((element) => element.id === id && !element.locked)
      )
      if (!allowedIds.length) return
      const reordered = operation(slide.elements || [], allowedIds, direction)
      c.replaceElementZOrder(
        reordered.map((element) => ({ id: element.id, zIndex: element.zIndex }))
      )
    },
    [c, getSelectionSlide]
  )
  const stepSelectedZOrder = useCallback(
    (direction) => reorderSelection(computeMultiZOrderStep, direction),
    [reorderSelection]
  )
  const moveSelectedToStackEdge = useCallback(
    (edge) => reorderSelection(computeMultiZOrderEdge, edge),
    [reorderSelection]
  )
  const updateSelectedElements = useCallback(
    (updates) => {
      const ids = c.selectedElementIdsRef.current
      const slide = getSelectionSlide()
      if (!ids?.length || !slide) return
      const keys = Object.keys(updates || {})
      if (!(keys.length === 1 && keys[0] === 'locked') && hasBlockedGroupMutation(slide, ids)) {
        c.notifyBlockedAction('group-locked')
        return
      }
      const batch = buildSelectionUpdates(slide.elements || [], ids, ids.at(-1), updates)
      if (batch.length === 1 && ids.length === 1) {
        const [{ id, ...partial }] = batch
        c.updateElement(id, partial)
      } else if (batch.length > 0) c.updateElements(batch)
    },
    [c, getSelectionSlide]
  )
  const toggleElementSelection = useCallback(
    (id, multi = false) => {
      if (editingElementIdRef?.current && (id !== editingElementIdRef.current || multi)) {
        editingElementIdRef.current = null
        c.setEditingElementId(null)
        c.clearRichTextContent()
      }
      if (!id) return c.setSelectedElementIds([])
      if (multi) {
        c.setSelectedElementIds((ids) =>
          ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]
        )
      } else {
        c.setSelectedElementIds(
          getSelectionIdsForActiveSlideElement(
            getSelectionSlide(),
            c.presentation?.slides[c.currentSlideIndexRef.current],
            id
          )
        )
      }
    },
    [c, getSelectionSlide, editingElementIdRef]
  )
  return {
    moveSelectedToStackEdge,
    stepSelectedZOrder,
    toggleElementSelection,
    updateSelectedElements,
  }
}
