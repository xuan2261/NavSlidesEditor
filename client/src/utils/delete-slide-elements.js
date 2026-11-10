import { applyConnectorDependentPatches } from './element-update-fanout'

const VISIBILITY_ACTIONS = new Set(['show', 'hide', 'toggle'])
const TARGET_REMOVED = 'Target was deleted from this slide. Choose an existing target.'
const TIMING_INVALIDATED =
  'Source animation timing may reference deleted elements. Original timing is preserved; review the remaining animations before presenting.'

// Imported timing records are source inventory, not target-bound executable steps.
// Never guess a target from mapped/preset/filter or rewrite the immutable source.
export function deleteSlideElements(slide, ids) {
  const removed = new Set(ids)
  if (!(slide.elements || []).some((element) => removed.has(element.id))) return slide
  const elements = (slide.elements || [])
    .filter((element) => !removed.has(element.id))
    .map((element) => {
      if (!VISIBILITY_ACTIONS.has(element.action?.kind) || !removed.has(element.action.targetElementId))
        return element
      return {
        ...element,
        action: { ...element.action, referenceError: element.action.referenceError || TARGET_REMOVED },
      }
    })
  const timing = slide._pptxAnimations
  const sourceTiming = slide.hasSourceTiming === true || timing?.mapped?.length || timing?.unsupported?.length || timing?.fragmentHints?.length
  return {
    ...slide,
    elements: applyConnectorDependentPatches(elements, ids),
    // This public diagnostic survives canonical save, which strips _pptx inventory.
    ...(sourceTiming ? { animationReferenceError: slide.animationReferenceError || TIMING_INVALIDATED } : {}),
  }
}
