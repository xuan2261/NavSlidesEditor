import { resolveEffectiveSlide } from 'revealjs-shared/src/slide-layouts.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import timing from 'revealjs-shared/src/pptx-timing-document.js'
import timingOperations from 'revealjs-shared/src/pptx-timing-operations.js'
import { semanticDeletion } from '../components/canvas/canvas-semantic-group-commands'
import { semanticCompatibility } from './pptx-semantic-geometry-bridge'
import { createSemanticClipboard } from './pptx-semantic-clipboard'
import { hasBlockedGroupMutation, semanticClipboardMutationBlocked } from './active-slide-selection'
import { deleteSlideElements } from './delete-slide-elements'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

// Pure preparation: React may replay it. Clipboard publication belongs to the
// state owner's commit phase, alongside the deletion that actually committed.
export function prepareSemanticCut(presentation, slideId, ids, mapActiveSlide, clipboard) {
  if (!presentation?.pptxSemantic) return null
  let receipt, document
  const next = mapActiveSlide(presentation, (slide) => {
    if (
      slide.id !== slideId || slide.locked ||
      hasBlockedGroupMutation(slide, ids) ||
      semanticClipboardMutationBlocked(presentation.pptxSemantic, slide, ids) ||
      ids.some((id) => !slide.elements?.some((element) => element.id === id) &&
        semanticInstance(presentation.pptxSemantic, id)?.slideId !== slide.id)
    ) return slide
    const removed = semanticDeletion(presentation.pptxSemantic, slide, ids)
    if (slide.elements?.some((element) => removed.elementIds.includes(element.id) && (element.locked || element.hidden)))
      return slide
    const data = clipboard || createSemanticClipboard({
      presentation, slide, selectedElementIds: ids,
      effectiveElements: resolveEffectiveSlide(slide, presentation.layoutMasters).slide.elements,
    })
    if (!data) return slide
    receipt = data
    document = removed.document
    // Preserve the exact pre-cut binding: a later paste must not silently
    // redirect an existing native animation onto the replacement occurrence.
    const bound = timing.resolveSlideTiming(presentation.pptxSemantic, slide).nodes.reduce((current, node) =>
      node.targetInstanceId && timing.activeTarget(presentation.pptxSemantic, slide, node.targetInstanceId,
        semanticDefinition(presentation.pptxSemantic, node.definitionId)?.source?.partUri) &&
        semanticInstance(removed.document, node.targetInstanceId)?.lineage?.tombstone
        ? timingOperations.editSourceTiming(presentation.pptxSemantic, current, {
            type: 'timing.edit', slideId: slide.id, definitionId: node.definitionId,
            nodeLocator: node.nodeLocator,
            command: { type: 'set-target', targetInstanceId: node.targetInstanceId },
          })
        : current, slide)
    return semanticCompatibility(document, deleteSlideElements(bound, removed.elementIds), presentation.pptxSemantic)
  })
  return receipt
    ? { presentation: semantic.normalizeSemanticPresentation({ ...next, pptxSemantic: document }), receipt }
    : null
}
