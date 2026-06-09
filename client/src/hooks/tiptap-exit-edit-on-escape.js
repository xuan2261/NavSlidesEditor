/**
 * Builds the TipTap `editorProps.handleKeyDown` that exits text editing on
 * Escape and hands control back to the canvas — the exit-edit behavior users
 * expect from mainstream slide editors. The global keyboard handler cannot do
 * this because it deliberately ignores keys while editing, so the editor
 * surface owns its own exit.
 *
 * Returns true (key consumed) only when Escape is pressed while an element is
 * being edited; every other key falls through to TipTap's own handling.
 *
 * @param {object} opts
 * @param {{current: string|null}} opts.editingElementIdRef - live editing-target ref
 * @param {(id: string|null) => void} opts.setEditingElementId - editing-state setter
 * @param {() => void} [opts.blurEditor] - blurs the editor DOM selection
 */
export function createExitEditOnEscape({ editingElementIdRef, setEditingElementId, blurEditor }) {
  return (_view, event) => {
    if (event.key !== 'Escape') return false
    if (!editingElementIdRef.current) return false
    setEditingElementId(null)
    editingElementIdRef.current = null
    blurEditor?.()
    return true
  }
}
