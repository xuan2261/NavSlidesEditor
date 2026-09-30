import { useCallback, useMemo, useState } from 'react'
import { applyLayout, changeLayout, detachLayout } from 'revealjs-shared'
import { getSystemLayoutMasters } from '../../data/slide-template-layout-adapter'

function mergeLayouts(stored = []) {
  const storedIds = new Set(stored.map((layout) => layout.id))
  return [
    ...getSystemLayoutMasters().filter((layout) => !storedIds.has(layout.id)),
    ...stored,
  ]
}

export function useEditorLayoutController({
  presentation,
  setPresentation,
  mapActive,
  setSelectedElementIds,
}) {
  const [showLayoutManager, setShowLayoutManager] = useState(false)
  const [masterTarget, setMasterTarget] = useState(null)
  const masterEditId = masterTarget?.presentationId === presentation?.id &&
    presentation?.layoutMasters?.some((layout) => layout.id === masterTarget?.layoutId)
    ? masterTarget.layoutId
    : null
  const availableLayouts = useMemo(
    () => mergeLayouts(presentation?.layoutMasters),
    [presentation?.layoutMasters]
  )

  const updateActiveLayout = useCallback(
    (layoutId, mode = 'change') => {
      setPresentation((previous) => {
        const layouts = mergeLayouts(previous.layoutMasters)
        const layout = layouts.find((candidate) => candidate.id === layoutId)
        const withMaster =
          layout && !(previous.layoutMasters || []).some((candidate) => candidate.id === layoutId)
            ? { ...previous, layoutMasters: [...(previous.layoutMasters || []), layout] }
            : previous
        const command = mode === 'apply' ? applyLayout : changeLayout
        return mapActive(withMaster, (slide) =>
          command(slide, withMaster.layoutMasters, layoutId).slide
        )
      })
    },
    [mapActive, setPresentation]
  )

  const detachActiveLayout = useCallback(() => {
    setPresentation((previous) =>
      mapActive(previous, (slide) =>
        detachLayout(slide, mergeLayouts(previous.layoutMasters)).slide
      )
    )
  }, [mapActive, setPresentation])

  const masterEdit = useMemo(() => {
    if (!masterEditId) return null
    const layout = presentation?.layoutMasters?.find((candidate) => candidate.id === masterEditId)
    if (!layout) return null
    return {
      ...layout,
      fixedElements: (layout.fixedElements || []).map((element) =>
        element.locked ? { ...element, locked: false } : element
      ),
    }
  }, [masterEditId, presentation?.layoutMasters])

  const updateMasterElement = useCallback(
    (id, updates) => {
      setPresentation((previous) => ({
        ...previous,
        layoutMasters: (previous.layoutMasters || []).map((layout) =>
          layout.id === masterEditId
            ? {
                ...layout,
                fixedElements: layout.fixedElements.map((element) =>
                  element.id === id ? { ...element, ...updates } : element
                ),
              }
            : layout
        ),
      }))
    },
    [masterEditId, setPresentation]
  )

  const deleteMasterElement = useCallback(
    (id) => {
      setPresentation((previous) => ({
        ...previous,
        layoutMasters: (previous.layoutMasters || []).map((layout) =>
          layout.id === masterEditId
            ? {
                ...layout,
                fixedElements: layout.fixedElements.filter((element) => element.id !== id),
              }
            : layout
        ),
      }))
      setSelectedElementIds((ids) => ids.filter((selectedId) => selectedId !== id))
    },
    [masterEditId, setPresentation, setSelectedElementIds]
  )

  const mapAuthoringTarget = useCallback(
    (previous, transform) => {
      if (!masterEditId) return mapActive(previous, transform)
      return {
        ...previous,
        layoutMasters: (previous.layoutMasters || []).map((layout) =>
          layout.id === masterEditId
            ? {
                ...layout,
                fixedElements: transform({
                  elements: layout.fixedElements.map((element) => ({
                    ...element,
                    locked: false,
                  })),
                }).elements,
              }
            : layout
        ),
      }
    },
    [mapActive, masterEditId]
  )

  return {
    availableLayouts,
    updateActiveLayout,
    detachActiveLayout,
    masterEdit,
    updateMasterElement,
    deleteMasterElement,
    mapAuthoringTarget,
    openLayoutManager: () => setShowLayoutManager(true),
    exitMasterEdit: () => setMasterTarget(null),
    layoutManagerProps: showLayoutManager
      ? {
          presentation,
          onChange: setPresentation,
          onEditMaster: (layoutId) => {
            setMasterTarget({ presentationId: presentation?.id, layoutId })
            setShowLayoutManager(false)
          },
          onClose: () => setShowLayoutManager(false),
        }
      : null,
  }
}
