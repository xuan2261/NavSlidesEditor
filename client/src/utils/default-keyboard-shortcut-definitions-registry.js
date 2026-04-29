/**
 * Default keyboard shortcut definitions.
 * Single source of truth for all editor shortcuts.
 */

export const DEFAULT_SHORTCUTS = [
  // Clipboard
  { id: 'copy',       label: 'Copy',       category: 'clipboard', defaultKey: 'Ctrl+C', scopes: ['canvas'] },
  { id: 'cut',        label: 'Cut',        category: 'clipboard', defaultKey: 'Ctrl+X', scopes: ['canvas'] },
  { id: 'paste',      label: 'Paste',      category: 'clipboard', defaultKey: 'Ctrl+V', scopes: ['canvas'] },
  { id: 'duplicate',  label: 'Duplicate',  category: 'clipboard', defaultKey: 'Ctrl+D', scopes: ['canvas'] },
  { id: 'delete',     label: 'Delete',     category: 'clipboard', defaultKey: 'Delete', scopes: ['canvas'] },
  // Navigation
  { id: 'undo',       label: 'Undo',       category: 'navigation', defaultKey: 'Ctrl+Z', scopes: ['canvas', 'editor'] },
  { id: 'redo',       label: 'Redo',       category: 'navigation', defaultKey: 'Ctrl+Y', scopes: ['canvas', 'editor'] },
  { id: 'selectAll',  label: 'Select All', category: 'navigation', defaultKey: 'Ctrl+A', scopes: ['canvas'] },
  { id: 'escape',     label: 'Deselect',   category: 'navigation', defaultKey: 'Escape', scopes: ['canvas', 'editor'] },
  // View
  { id: 'toggleFindReplace', label: 'Find/Replace', category: 'view', defaultKey: 'Ctrl+F', scopes: ['canvas'] },
]

/**
 * Merge defaults with user overrides.
 * @param {Object} overrides - { shortcutId: 'Ctrl+Shift+D', ... }
 * @returns {Array} shortcuts with activeKey resolved
 */
export function getShortcuts(overrides = {}) {
  return DEFAULT_SHORTCUTS.map((s) => ({
    ...s,
    activeKey: overrides[s.id] ?? s.defaultKey,
  }))
}

/**
 * Look up a shortcut by id from the full shortcuts list.
 * @param {string} id
 * @returns {Object|null}
 */
export function getShortcutById(id) {
  return DEFAULT_SHORTCUTS.find((s) => s.id === id) || null
}

/**
 * Look up a shortcut by its active key chord.
 * @param {string} chord
 * @param {Array} [shortcuts] - resolved shortcuts with activeKey (from getShortcuts)
 * @returns {Object|null}
 */
export function getShortcutByKey(chord, shortcuts) {
  const list = shortcuts || getShortcuts()
  return list.find((s) => s.activeKey === chord) || null
}
