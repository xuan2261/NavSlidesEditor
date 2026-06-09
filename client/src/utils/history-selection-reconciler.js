// Reconcile editor selection/editing state against a restored history snapshot.
//
// Undo/redo can remove the very elements the editor was selecting or editing.
// Leaving those ids around produces a phantom selection and a properties panel
// that acts on elements that no longer exist, so we intersect the selection
// with what survived and flag whether the active edit target is gone.

/**
 * @param {Object|undefined} restoredSlide - the active slide after restore
 *        (parent or active vertical child)
 * @param {string[]} selectedIds - selection before reconciliation
 * @param {string|null} editingId - element currently open for inline editing
 * @returns {{selectedIds:string[], editingId:string|null, editingCleared:boolean}}
 */
export function reconcileSelectionAfterHistory(restoredSlide, selectedIds, editingId) {
  const liveIds = new Set((restoredSlide?.elements || []).map((el) => el.id))
  const nextSelected = (selectedIds || []).filter((id) => liveIds.has(id))
  const editingSurvives = editingId != null && liveIds.has(editingId)
  return {
    selectedIds: nextSelected,
    editingId: editingSurvives ? editingId : null,
    editingCleared: editingId != null && !editingSurvives,
  }
}
