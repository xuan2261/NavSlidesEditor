import { useCallback } from 'react'
import { isLockedElementAllowedUpdate } from '../../utils/element-update-fanout'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'

export function useEditorElementController(c) {
  const editingElementIdRef = c.editingElementIdRef
  const updateCurrentSlide = useCallback(
    (updates) => c.setPresentation((prev) => c.mapActive(prev, (slide) => ({ ...slide, ...updates }))),
    [c]
  )
  const updateElement = useCallback(
    (id, updates) =>
      c.setPresentation((prev) =>
        c.mapActive(prev, (slide) => ({
          ...slide,
          elements: (slide.elements || []).map((element) =>
            element.id === id &&
            !slide.locked &&
            (!element.locked || isLockedElementAllowedUpdate(updates))
              ? { ...element, ...invalidatePptxFitMetaForUpdates(element, updates) }
              : element
          ),
        }))
      ),
    [c]
  )
  const deleteElement = useCallback(
    (id) => {
      if (c.activeSlide?.locked) return
      const target = c.activeSlide?.elements?.find((element) => element.id === id)
      if (target?.locked) return
      c.setPresentation((prev) =>
        c.mapActive(prev, (slide) => ({
          ...slide,
          elements: (slide.elements || []).filter((element) => element.id !== id),
        }))
      )
      c.setSelectedElementIds((ids) => ids.filter((selectedId) => selectedId !== id))
      if (c.editingElementId === id) {
        c.setEditingElementId(null)
        editingElementIdRef.current = null
      }
    },
    [c, editingElementIdRef]
  )
  return {
    deleteElement,
    updateCurrentSlide,
    updateElement,
  }
}
