import { useEffect, useCallback } from 'react'

/**
 * Custom hook for keyboard shortcuts in the editor.
 *
 * @param {Object} opts
 * @param {Function} opts.onCopy - copy selected element
 * @param {Function} opts.onCut - cut selected element
 * @param {Function} opts.onPaste - paste from clipboard
 * @param {Function} opts.onDuplicate - duplicate selected element
 * @param {Function} opts.onUndo - undo last action
 * @param {Function} opts.onRedo - redo last undone action
 * @param {Function} opts.onDelete - delete selected elements
 * @param {Function} opts.onSelectAll - select all elements
 * @param {Function} opts.onToggleFindReplace - toggle find/replace bar
 * @param {Function} opts.onEscape - deselect / close modals
 * @param {boolean}  opts.isEditing - whether a text element is being edited (skip shortcuts)
 */
export function useKeyboard({
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onUndo,
  onRedo,
  onDelete,
  onSelectAll,
  onToggleFindReplace,
  onEscape,
  isEditing = false,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      // Skip when editing text or in input fields
      if (isEditing) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ctrl = e.ctrlKey || e.metaKey

      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
        onDelete?.()
        e.preventDefault()
        return
      }

      // Escape
      if (e.key === 'Escape') {
        onEscape?.()
        e.preventDefault()
        return
      }

      if (!ctrl) return

      switch (e.key.toLowerCase()) {
        case 'c':
          onCopy?.()
          e.preventDefault()
          break
        case 'x':
          onCut?.()
          e.preventDefault()
          break
        case 'v':
          onPaste?.()
          e.preventDefault()
          break
        case 'd':
          onDuplicate?.()
          e.preventDefault()
          break
        case 'z':
          if (e.shiftKey) {
            onRedo?.()
          } else {
            onUndo?.()
          }
          e.preventDefault()
          break
        case 'y':
          onRedo?.()
          e.preventDefault()
          break
        case 'a':
          onSelectAll?.()
          e.preventDefault()
          break
        case 'f':
          onToggleFindReplace?.()
          e.preventDefault()
          break
        default:
          break
      }
    },
    [
      isEditing,
      onCopy,
      onCut,
      onPaste,
      onDuplicate,
      onUndo,
      onRedo,
      onDelete,
      onSelectAll,
      onToggleFindReplace,
      onEscape,
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
