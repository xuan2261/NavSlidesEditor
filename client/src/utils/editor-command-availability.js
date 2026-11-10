import { hasBlockedGroupMutation, semanticClipboardMutationBlocked } from './active-slide-selection'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

// A null reason enables the command; a string explains why it cannot run.
export function getEditorCommandAvailability({
  slide,
  selectedElementIds = [],
  clipboard,
  canUndo,
  canRedo,
  editingText,
  masterEditing,
  pptxSemantic,
  presentationId,
}) {
  const selected = (slide?.elements || []).filter((element) =>
    selectedElementIds.includes(element.id)
  )
  const missingSlide = slide ? null : 'Select a slide first'
  const semanticSelected = selectedElementIds
    .map(
      (id) =>
        semanticInstance(
          pptxSemantic,
          slide?.elements?.find((element) => element.id === id)?.pptxInstanceId || id
        )
    )
    .filter(
      (instance) =>
        instance &&
        instance.slideId === slide?.id &&
        !instance.lineage?.tombstone &&
        !instance.lineage?.paintOnly
    )
  const count = new Set([
    ...selected.map((element) => element.pptxInstanceId || element.id),
    ...semanticSelected.map((instance) => instance.id),
  ]).size
  const missingSelection = missingSlide || (count ? null : 'Select an element first')
  const slideMutation = missingSlide || (slide.locked ? 'Slide is locked' : null)
  const selectionMutation =
    slideMutation ||
    missingSelection ||
    (selected.some((element) => element.locked) ? 'Selection is locked' : null) ||
    (hasBlockedGroupMutation(slide, selectedElementIds) ||
    semanticClipboardMutationBlocked(pptxSemantic, slide, selectedElementIds)
      ? 'Group contains locked or hidden elements'
      : null)
  const semanticClipboard =
    clipboard?.kind === 'pptx-semantic-selection' &&
    clipboard.version === 1 &&
    clipboard.rootInstanceIds?.length > 0
  const pasteReason = semanticClipboard
    ? clipboard.source?.presentationId === presentationId && pptxSemantic
      ? null
      : 'Source objects can only be pasted into their owning presentation'
    : clipboard?.length
      ? null
      : 'Clipboard is empty'

  return {
    copy: missingSelection,
    cut: selectionMutation,
    paste: slideMutation || pasteReason,
    duplicate: selectionMutation,
    deleteSelection: selectionMutation,
    arrange: selectionMutation || (selected.length ? null : 'Select an element first'),
    group: selectionMutation || (count >= 2 ? null : 'Select at least two elements'),
    ungroup:
      selectionMutation ||
      (selected.some((element) => element.groupId) ||
      semanticSelected.some(
        (instance) => semanticDefinition(pptxSemantic, instance.definitionId)?.kind === 'group'
      )
        ? null
        : 'Select a grouped element'),
    undo: canUndo ? null : 'Nothing to undo',
    redo: canRedo ? null : 'Nothing to redo',
    insertText: slideMutation,
    insertLink: selectionMutation || (editingText ? null : 'Edit text to insert a link'),
    speakerNotes:
      missingSlide ||
      (masterEditing ? 'Speaker notes are unavailable while editing a master' : null),
  }
}
