import { useCallback } from 'react'
import {
  applyConnectorDependentPatches,
  buildConnectorUpdateBatch,
  isLockedElementAllowedUpdate,
} from '../../utils/element-update-fanout'
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
        c.mapActive(prev, (slide) => {
          if (slide.locked) return slide
          const source = (slide.elements || []).find((element) => element.id === id)
          if (!source || (source.locked && !isLockedElementAllowedUpdate(updates))) return slide
          const batch = buildConnectorUpdateBatch(slide.elements || [], [{ id, ...updates }])
          const byId = new Map(batch.map(({ id: updateId, ...partial }) => [updateId, partial]))
          return {
            ...slide,
            elements: (slide.elements || []).map((element) =>
              byId.has(element.id)
                ? {
                    ...element,
                    ...invalidatePptxFitMetaForUpdates(element, byId.get(element.id)),
                  }
                : element
            ),
          }
        })
      ),
    [c]
  )
  const deleteElement = useCallback(
    (id) => {
      if (c.activeSlide?.locked) return
      const target = c.activeSlide?.elements?.find((element) => element.id === id)
      if (target?.locked) return
      c.setPresentation((prev) =>
        c.mapActive(prev, (slide) => {
          const elements = (slide.elements || []).filter((element) => element.id !== id)
          return { ...slide, elements: applyConnectorDependentPatches(elements, [id]) }
        })
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
