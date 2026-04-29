import { useEffect, useMemo } from 'react'
import { normalizeKey } from '../utils/shortcut-normalizer'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'
import { loadOverrides } from '../utils/shortcut-local-storage-persistence'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Create keyboard event handler that dispatches from shortcut registry.
 */
export function createKeyboardHandler({
  shortcuts,
  isEditing = false,
  getActiveElement = () => document.activeElement,
  ...callbacks
}) {
  return (e) => {
    if (isEditing) return
    const tag = getActiveElement()?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const ctrl = e.ctrlKey || e.metaKey

    if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
      callbacks.onDelete?.()
      e.preventDefault()
      return
    }

    if (e.key === 'Escape') {
      callbacks.onEscape?.()
      return
    }

    if (ctrl) {
      const chord = normalizeKey(e)
      const shortcut = shortcuts.find((s) => s.activeKey === chord)
      if (shortcut) {
        const cbName = `on${capitalize(shortcut.id)}`
        callbacks[cbName]?.()
        e.preventDefault()
      }
    }
  }
}

/**
 * Custom hook for keyboard shortcuts in the editor.
 *
 * Reads overrides from localStorage and resolves active shortcuts from the registry.
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
  const shortcuts = getShortcuts(loadOverrides())

  const handleKeyDown = useMemo(
    () =>
      createKeyboardHandler({
        shortcuts,
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
      }),
    [
      shortcuts,
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
