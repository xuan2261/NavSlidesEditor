import { useCallback } from 'react'
import {
  buildConnectorUpdateBatch,
  isLockedElementAllowedUpdate,
} from '../../utils/element-update-fanout'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'
import {
  applySemanticGeometry,
  semanticCompatibility,
  withoutSemanticGeometry,
} from '../../utils/pptx-semantic-geometry-bridge'
import { semanticDeletion } from '../../components/canvas/canvas-semantic-group-commands'
import projectionOperations from 'revealjs-shared/src/pptx-projection-operation.js'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import projectionCapabilities from 'revealjs-shared/src/pptx-projection-capabilities.js'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'
import { deleteSlideElements } from '../../utils/delete-slide-elements'

export function useEditorElementController(c) {
  const editingElementIdRef = c.editingElementIdRef
  const updateCurrentSlide = useCallback(
    (updates) =>
      c.setPresentation((prev) =>
        c.mapActive(prev, (slide) => {
          if (
            slide.locked &&
            !(Object.keys(updates || {}).length === 1 && updates.locked === false)
          )
            return slide
          return { ...slide, ...updates }
        })
      ),
    [c]
  )
  const updateElement = useCallback(
    (id, updates) => {
      const target = c.activeSlide?.elements?.find((element) => element.id === id)
      if (Object.hasOwn(updates, 'pptxProjectionOperation')) {
        const operation = updates.pptxProjectionOperation
        const selectedGroup =
          operation?.type === projectionCapabilities.GROUP_FILL_EDIT && operation.instanceId === id
            ? semanticInstance(c.presentation.pptxSemantic, id)
            : undefined
        const directGroup =
          selectedGroup?.slideId === c.activeSlide?.id &&
          semanticDefinition(c.presentation.pptxSemantic, selectedGroup.definitionId)?.kind === 'group'
        if (c.activeSlide?.locked || (!target && !directGroup) || target?.locked) return
        if (Object.keys(updates).length !== 1)
          throw new TypeError('Projection operations cannot be mixed with element patches')
        const matchesOwner = (presentation, element) =>
          operation?.type === projectionCapabilities.GROUP_FILL_EDIT &&
          element.pptxInstanceId &&
          geometryStyles.geometryFillFrame(presentation.pptxSemantic, element.pptxInstanceId)
            ?.ownerInstanceId === operation.instanceId
        if (
          !directGroup &&
          target.pptxInstanceId !== operation?.instanceId &&
          !matchesOwner(c.presentation, target)
        )
          throw new TypeError('Projection operation targets a different active occurrence')
        // Inspectors catch validation failures synchronously. Reuse this immutable
        // result unless React supplies a genuinely newer queued presentation.
        const projected = projectionOperations.applyPresentationProjectionOperation(
          c.presentation,
          updates.pptxProjectionOperation
        )
        c.setPresentation((prev) => {
          let currentTarget, currentSlide
          c.mapActive(prev, (slide) => {
            if (!slide.locked) currentSlide = slide
            if (!slide.locked) currentTarget = slide.elements?.find((element) => element.id === id)
            return slide
          })
          if (directGroup) {
            const group = semanticInstance(prev.pptxSemantic, id)
            if (
              !currentSlide ||
              group?.slideId !== currentSlide.id ||
              group.lineage?.tombstone ||
              group.lineage?.paintOnly ||
              group.overrides.locked
            )
              return prev
            return prev === c.presentation
              ? projected
              : projectionOperations.applyPresentationProjectionOperation(prev, operation)
          }
          if (!currentTarget || currentTarget.locked) return prev
          if (
            currentTarget.pptxInstanceId !== operation?.instanceId &&
            !matchesOwner(prev, currentTarget)
          )
            return prev
          return prev === c.presentation
            ? projected
            : projectionOperations.applyPresentationProjectionOperation(prev, operation)
        })
        return
      }
      const instance = semanticInstance(c.presentation?.pptxSemantic, target?.pptxInstanceId)
      const definition = semanticDefinition(c.presentation?.pptxSemantic, instance?.definitionId)
      if (
        definition?.content.chartProjection &&
        [
          'chartData',
          'chartType',
          'stacked',
          'areaFill',
          'showLegend',
          'showXAxis',
          'showYAxis',
          'showGridLines',
          'axisTitles',
        ].some((key) => Object.hasOwn(updates, key))
      )
        throw new TypeError('Use a source-bound projection operation for chart data and settings')
      return c.setPresentation((prev) => {
        let semantic = prev.pptxSemantic
        const result = c.mapActive(prev, (slide) => {
          if (slide.locked) return slide
          const source = (slide.elements || []).find((element) => element.id === id)
          const groupInst = semanticInstance(semantic, id)
          const group =
            groupInst?.slideId === slide.id &&
            !groupInst.lineage?.tombstone
              ? groupInst
              : null
          if ((!source && !group) || (source?.locked && !isLockedElementAllowedUpdate(updates)))
            return slide
          if (semantic) semantic = applySemanticGeometry(semantic, slide, [{ id, ...updates }])
          const batch = buildConnectorUpdateBatch(slide.elements || [], [
            { id, ...withoutSemanticGeometry(source || { pptxInstanceId: id }, updates) },
          ])
          const byId = new Map(batch.map(({ id: updateId, ...partial }) => [updateId, partial]))
          const updated = {
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
          return semantic ? semanticCompatibility(semantic, updated, prev.pptxSemantic) : updated
        })
        return semantic ? { ...result, pptxSemantic: semantic } : result
      })
    },
    [c]
  )
  const deleteElement = useCallback(
    (id) => {
      if (c.activeSlide?.locked) return
      const target = c.activeSlide?.elements?.find((element) => element.id === id)
      if (target?.locked) return
      const instance = semanticInstance(c.presentation?.pptxSemantic, id)
      if (
        c.presentation?.pptxSemantic &&
        !target &&
        (!instance || instance.slideId !== c.activeSlide.id || instance.lineage?.tombstone)
      )
        return
      const deletedIds = c.presentation?.pptxSemantic
        ? semanticDeletion(c.presentation.pptxSemantic, c.activeSlide, [id]).elementIds
        : [id]
      if (
        c.activeSlide?.elements?.some(
          (element) => deletedIds.includes(element.id) && element.locked
        )
      )
        return
      c.setPresentation((prev) => {
        let semantic = prev.pptxSemantic
        const result = c.mapActive(prev, (slide) => {
          if (slide.locked) return slide
          const deletion = semantic ? semanticDeletion(semantic, slide, [id]) : null
          const removed = deletion?.elementIds || [id]
          if (
            (slide.elements || []).some((element) => removed.includes(element.id) && element.locked)
          )
            return slide
          if (deletion) semantic = deletion.document
          return deleteSlideElements(slide, removed)
        })
        return semantic ? { ...result, pptxSemantic: semantic } : result
      })
      c.setSelectedElementIds((ids) => ids.filter((selectedId) => !deletedIds.includes(selectedId)))
      if (deletedIds.includes(c.editingElementId)) {
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
