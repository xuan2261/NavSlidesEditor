/**
 * Key chord normalization for keyboard shortcuts.
 * Converts browser keyboard events to consistent string format.
 */

// Reserved chords that browsers intercept and should be rejected
const RESERVED_CHORDS = new Set([
  'Ctrl+W',   // close tab
  'Ctrl+T',   // new tab
  'Ctrl+N',   // new window
  'Ctrl+P',   // print
  'Ctrl+Shift+T',  // reopen closed tab
  'Ctrl+Shift+N',  // incognito window
  'Ctrl+Shift+P',  // private window
  'Ctrl+Shift+Delete', // clear browsing data
  'Alt+F4',   // close window (Windows)
  'Cmd+Alt+Q', // quit (macOS)
])

/**
 * Normalize a keyboard event to a chord string.
 * e.g. Ctrl+C -> 'Ctrl+C', ctrl+c -> 'Ctrl+C'
 * @param {KeyboardEvent} e
 * @returns {string}
 */
export function normalizeKey(e) {
  const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])
  let key = e.key

  // Standalone modifier: only modifier flag set, no actual key pressed
  if (MODIFIER_KEYS.has(key)) {
    const mods = []
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl')
    if (e.shiftKey) mods.push('Shift')
    if (e.altKey) mods.push('Alt')
    return mods.length > 0 ? mods.join('+') : key
  }

  const mods = []
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl')
  if (e.shiftKey) mods.push('Shift')
  if (e.altKey) mods.push('Alt')

  // Uppercase single-letter keys for consistency
  if (key.length === 1) {
    key = key.toUpperCase()
  }

  if (mods.length === 0) return key

  return [...mods, key].join('+')
}

/**
 * Check if a chord is reserved by the browser.
 * @param {string} chord - e.g. 'Ctrl+W'
 * @returns {boolean}
 */
export function isReservedChord(chord) {
  return RESERVED_CHORDS.has(chord)
}

/**
 * Check if the event is a standalone modifier key press (no actual key pressed).
 * e.g. pressing just Ctrl, Shift, or Alt without any other key.
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
export function isModifierKey(e) {
  const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])
  // Standalone: modifier flag set AND key is the modifier name itself
  const pressedKey = e.key
  if (MODIFIER_KEYS.has(pressedKey)) return true
  // Also standalone if only modifiers set and key is something like "Unidentified"
  const hasMod = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey
  if (!hasMod) return false
  // Key is non-modifier letter/number/symbol — not a standalone modifier
  if (pressedKey.length === 1 && /^[a-zA-Z0-9]$/.test(pressedKey)) return false
  if (MODIFIER_KEYS.has(pressedKey)) return true
  return false
}
