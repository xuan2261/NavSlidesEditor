/**
 * LocalStorage persistence for user-defined keyboard shortcut overrides.
 */

const STORAGE_KEY = 'navslides-shortcuts'

/**
 * Load all overrides from localStorage.
 * @returns {Object} - { shortcutId: 'Ctrl+Shift+D', ... }
 */
export function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

/**
 * Save a single shortcut override.
 * @param {string} id - shortcut id
 * @param {string} key - key chord
 */
export function saveOverride(id, key) {
  const overrides = loadOverrides()
  overrides[id] = key
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

/**
 * Remove a specific shortcut override (restores default).
 * @param {string} id - shortcut id
 */
export function resetOverride(id) {
  const overrides = loadOverrides()
  delete overrides[id]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

/**
 * Clear all overrides.
 */
export function resetAll() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Detect if a key chord conflicts with another shortcut.
 * @param {string} id - the shortcut being set
 * @param {string} key - the key chord
 * @param {Array} shortcuts - all active shortcuts
 * @returns {boolean} true if conflict exists
 */
export function detectConflict(id, key, shortcuts) {
  return shortcuts.some(
    (s) => s.id !== id && s.activeKey === key
  )
}
