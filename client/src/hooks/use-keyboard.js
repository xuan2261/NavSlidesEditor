import { useEffect, useRef } from 'react'
import { normalizeKey } from '../utils/shortcut-normalizer'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'
import { loadOverrides } from '../utils/shortcut-local-storage-persistence'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Bare arrow keys are not registry shortcuts: in the editor they either nudge
// the selected element or navigate slides, decided by the caller at press time.
const ARROW_DIRECTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

// Discrete one-shot commands: holding the key must NOT re-fire on OS auto-repeat
// (a held Ctrl+K would otherwise strobe the palette, Ctrl+G spam grouping).
// Continuous actions (arrow nudge, slide walking, timer +/-) are intentionally
// excluded so holding an arrow keeps moving the selection.
const REPEAT_SUPPRESSED_IDS = new Set(['commandPalette', 'group', 'insertSlide'])

// Bare game keys that hijack canvas typing/selection while authoring. These stay
// inert in the editor (only live when actually presenting a game). HUD/reveal/
// leaderboard remain reachable in-editor and are deliberately NOT listed here.
const EDITOR_SUPPRESSED_GAME_IDS = new Set([
  'gameTimer',
  'teamSelect1',
  'teamSelect2',
  'teamSelect3',
  'teamSelect4',
])

/**
 * Create keyboard event handler that dispatches from shortcut registry.
 * Supports scope filtering via isPresenting flag and activeGameType.
 *
 * Scope resolution:
 *   - isPresenting && activeGameType  → 'presentation-game'
 *   - isPresenting && !activeGameType → 'presentation'
 *   - !isPresenting                  → 'editor' plus active game shortcuts when activeGameType exists
 */
export function createKeyboardHandler({
  shortcuts,
  isEditing = false,
  isPresenting = false,
  activeGameType = null,
  getActiveElement = () => document.activeElement,
  ...callbacks
}) {
  return (e) => {
    if (e.defaultPrevented) return
    if (isEditing) return
    const active = getActiveElement()
    const tag = active?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    // A focused rich-text surface (TipTap root, table cell) owns typing and
    // clipboard keys even if the editing-state flag has not propagated yet, so
    // the canvas-level shortcuts must stand down whenever the caret lives in any
    // contenteditable region.
    if (active?.isContentEditable) return

    const ctrl = e.ctrlKey || e.metaKey

    // Resolve active scope
    const activeScope =
      isPresenting && activeGameType ? 'presentation-game' : isPresenting ? 'presentation' : 'editor'

    // Determine which shortcuts are active in the current scope.
    // In editor mode, include canvas shortcuts too (editor IS the canvas).
    const scopeShortcuts = shortcuts.filter(
      (s) =>
        s.scopes.includes(activeScope) ||
        (!isPresenting && s.scopes.includes('canvas')) ||
        (activeGameType && s.scopes.includes('presentation-game'))
    )

    // Standalone keys (no Ctrl) — F5, arrows, B, W, Home, End, Escape in presentation
    if (!ctrl) {
      const normalized = normalizeKey(e)
      const match = scopeShortcuts.find((s) => s.activeKey === normalized)
      if (match) {
        // Bare game keys that collide with canvas typing/selection are inert
        // while authoring; they only fire when actually presenting the game.
        if (!isPresenting && EDITOR_SUPPRESSED_GAME_IDS.has(match.id)) return
        // Explicit map for camelCase shortcut IDs (teamSelect1 → onTeamSelect1, not onTeamselect1)
        const explicitMap = {
          teamSelect1: callbacks.onTeamSelect1,
          teamSelect2: callbacks.onTeamSelect2,
          teamSelect3: callbacks.onTeamSelect3,
          teamSelect4: callbacks.onTeamSelect4,
        }
        const cb = explicitMap[match.id] ?? callbacks[`on${capitalize(match.id)}`]
        cb?.()
        e.preventDefault()
        return
      }
    }

    // Ctrl chords
    if (ctrl) {
      const chord = normalizeKey(e)
      const shortcut = scopeShortcuts.find((s) => s.activeKey === chord)
      if (shortcut) {
        // One-shot chords must not re-fire while the key is held down.
        if (e.repeat && REPEAT_SUPPRESSED_IDS.has(shortcut.id)) {
          e.preventDefault()
          return
        }
        const cbName = `on${capitalize(shortcut.id)}`
        callbacks[cbName]?.()
        e.preventDefault()
        return
      }
    }

    // Bare arrow keys (editor only) — caller decides nudge-element vs change-slide.
    // Presentation scope keeps its own ArrowLeft/Right registry shortcuts.
    if (!ctrl && !isPresenting && ARROW_DIRECTION[e.key]) {
      callbacks.onArrow?.(ARROW_DIRECTION[e.key], e)
      return
    }

    // Delete/Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
      callbacks.onDelete?.()
      e.preventDefault()
      return
    }

    // Escape — only in canvas/editor scope (presentation uses endSlideshow shortcut)
    if (e.key === 'Escape' && !isPresenting) {
      callbacks.onEscape?.()
    }
  }
}

/**
 * Custom hook for keyboard shortcuts in the editor.
 *
 * Reads overrides from localStorage and resolves active shortcuts from the registry.
 */
/**
 * Custom hook for keyboard shortcuts in the editor.
 *
 * Reads overrides from localStorage and resolves active shortcuts from the
 * registry. The document listener subscribes ONCE and reads the latest options
 * (callbacks + scope flags) from a ref each event, so re-renders with fresh
 * inline callbacks never churn the subscription or strand a stale closure.
 */
export function useKeyboard(options) {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      const opts = optionsRef.current
      const shortcuts = getShortcuts(loadOverrides())
      createKeyboardHandler({ ...opts, shortcuts })(e)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
