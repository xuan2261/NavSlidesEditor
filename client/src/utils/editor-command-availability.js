import { hasBlockedGroupMutation } from './active-slide-selection'

// A null reason enables the command; a string explains why it cannot run.
export function getEditorCommandAvailability({
  slide,
  selectedElementIds = [],
  clipboard,
  canUndo,
  canRedo,
  editingText,
  masterEditing,
}) {
  const selected = (slide?.elements || []).filter((element) =>
    selectedElementIds.includes(element.id)
  )
  const missingSlide = slide ? null : 'Select a slide first'
  const missingSelection = missingSlide || (selected.length ? null : 'Select an element first')
  const slideMutation = missingSlide || (slide.locked ? 'Slide is locked' : null)
  const selectionMutation = slideMutation || missingSelection ||
    (selected.some((element) => element.locked) ? 'Selection is locked' : null) ||
    (hasBlockedGroupMutation(slide, selectedElementIds) ? 'Group contains locked or hidden elements' : null)

  return {
    copy: missingSelection,
    cut: selectionMutation,
    paste: slideMutation || (clipboard?.length ? null : 'Clipboard is empty'),
    duplicate: selectionMutation,
    deleteSelection: selectionMutation,
    arrange: selectionMutation,
    group: selectionMutation || (selected.length >= 2 ? null : 'Select at least two elements'),
    ungroup: selectionMutation || (selected.some((element) => element.groupId) ? null : 'Select a grouped element'),
    undo: canUndo ? null : 'Nothing to undo',
    redo: canRedo ? null : 'Nothing to redo',
    insertText: slideMutation,
    insertLink: selectionMutation || (editingText ? null : 'Edit text to insert a link'),
    speakerNotes: missingSlide || (masterEditing ? 'Speaker notes are unavailable while editing a master' : null),
  }
}
