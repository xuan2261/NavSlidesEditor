import { useCallback, useMemo, useState } from 'react'
import { applyLayout, changeLayout, detachLayout } from 'revealjs-shared'
import { getSystemLayoutMasters } from '../../data/slide-template-layout-adapter'
import { buildConnectorUpdateBatch } from '../../utils/element-update-fanout'
import { showNotice } from '../../utils/app-feedback'

function mergeLayouts(stored = []) {
  const storedIds = new Set(stored.map((layout) => layout.id))
  return [...getSystemLayoutMasters().filter((layout) => !storedIds.has(layout.id)), ...stored]
}

function restoreMasterLocks(originals, transformed, lockIntents) {
  const originalsById = new Map(originals.map((element) => [element.id, element]))
  const explicitLocks = new Map()
  for (const update of lockIntents || []) {
    if (Object.hasOwn(update, 'locked')) explicitLocks.set(update.id, update.locked)
  }
  return transformed.map((element) => {
    const original = originalsById.get(element.id)
    if (!original) return element
    if (explicitLocks.has(element.id)) return { ...element, locked: explicitLocks.get(element.id) }
    if (Object.hasOwn(original, 'locked')) {
      return element.locked === original.locked ? element : { ...element, locked: original.locked }
    }
    if (!Object.hasOwn(element, 'locked')) return element
    const restored = { ...element }
    delete restored.locked
    return restored
  })
}

export function useEditorLayoutController({
  presentation,
  setPresentation,
  mapActive,
  setSelectedElementIds,
}) {
  const [showLayoutManager, setShowLayoutManager] = useState(false)
  const [masterTarget, setMasterTarget] = useState(null)
  const masterEditId =
    masterTarget?.presentationId === presentation?.id &&
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
        return mapActive(
          withMaster,
          (slide) => command(slide, withMaster.layoutMasters, layoutId).slide
        )
      })
    },
    [mapActive, setPresentation]
  )

  const detachActiveLayout = useCallback(() => {
    if (!presentation) return
    const warnings = []
    const next = mapActive(presentation, (slide) => {
      const result = detachLayout(slide, mergeLayouts(presentation.layoutMasters))
      warnings.push(...result.warnings)
      return result.slide
    })
    setPresentation(next)
    if (warnings.length)
      showNotice(warnings.join('\n'), {
        title: 'Repair interaction targets',
        testId: 'interaction-reference-notice',
      })
  }, [mapActive, presentation, setPresentation])

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
        layoutMasters: (previous.layoutMasters || []).map((layout) => {
          if (
            layout.id !== masterEditId ||
            !layout.fixedElements.some((element) => element.id === id)
          )
            return layout
          const batch = buildConnectorUpdateBatch(layout.fixedElements, [{ id, ...updates }])
          const byId = new Map(batch.map(({ id, ...partial }) => [id, partial]))
          return {
            ...layout,
            fixedElements: layout.fixedElements.map((element) =>
              byId.has(element.id) ? { ...element, ...byId.get(element.id) } : element
            ),
          }
        }),
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
    (previous, transform, lockIntents) => {
      if (!masterEditId) return mapActive(previous, transform)
      return {
        ...previous,
        layoutMasters: (previous.layoutMasters || []).map((layout) =>
          layout.id === masterEditId
            ? {
                ...layout,
                fixedElements: restoreMasterLocks(
                  layout.fixedElements,
                  transform({
                    elements: layout.fixedElements.map((element) =>
                      element.locked ? { ...element, locked: false } : element
                    ),
                  }).elements,
                  lockIntents
                ),
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
