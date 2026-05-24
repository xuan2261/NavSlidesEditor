import { useEffect, useMemo } from 'react'
import { normalizeKey } from '../utils/shortcut-normalizer'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'
import { loadOverrides } from '../utils/shortcut-local-storage-persistence'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

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
    if (isEditing) return
    const tag = getActiveElement()?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

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
        const cbName = `on${capitalize(shortcut.id)}`
        callbacks[cbName]?.()
        e.preventDefault()
        return
      }
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
  onToggleRibbon,
  onEscape,
  onStartSlideshow,
  onStartSlideshowCurrent,
  onSlideNext,
  onSlidePrev,
  onSlideFirst,
  onSlideLast,
  onBlackScreen,
  onWhiteScreen,
  onEndSlideshow,
  // Game callbacks
  onGameHud,
  onGameTimer,
  onGameNext,
  onGameReveal,
  onGameLeaderboard,
  onGamePause,
  onTimerAdd,
  onTimerSub,
  onTeamSelect1,
  onTeamSelect2,
  onTeamSelect3,
  onTeamSelect4,
  onCommandPalette,
  // Editor shortcuts wired in 260523-1230 cleanup plan
  onInsertSlide,
  onGroup,
  onUngroup,
  onBringForward,
  onSendBackward,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  isEditing = false,
  isPresenting = false,
  activeGameType = null,
}) {
  const shortcuts = getShortcuts(loadOverrides())

  const handleKeyDown = useMemo(
    () =>
      createKeyboardHandler({
        shortcuts,
        isEditing,
        isPresenting,
        activeGameType,
        onCopy,
        onCut,
        onPaste,
        onDuplicate,
        onUndo,
        onRedo,
        onDelete,
        onSelectAll,
        onToggleFindReplace,
        onToggleRibbon,
        onEscape,
        onStartSlideshow,
        onStartSlideshowCurrent,
        onSlideNext,
        onSlidePrev,
        onSlideFirst,
        onSlideLast,
        onBlackScreen,
        onWhiteScreen,
        onEndSlideshow,
        onGameHud,
        onGameTimer,
        onGameNext,
        onGameReveal,
        onGameLeaderboard,
        onGamePause,
        onTimerAdd,
        onTimerSub,
        onTeamSelect1,
        onTeamSelect2,
        onTeamSelect3,
        onTeamSelect4,
        onCommandPalette,
        onInsertSlide,
        onGroup,
        onUngroup,
        onBringForward,
        onSendBackward,
        onResetZoom,
        onZoomIn,
        onZoomOut,
      }),
    [
      shortcuts,
      isEditing,
      isPresenting,
      activeGameType,
      onCopy,
      onCut,
      onPaste,
      onDuplicate,
      onUndo,
      onRedo,
      onDelete,
      onSelectAll,
      onToggleFindReplace,
      onToggleRibbon,
      onEscape,
      onStartSlideshow,
      onStartSlideshowCurrent,
      onSlideNext,
      onSlidePrev,
      onSlideFirst,
      onSlideLast,
      onBlackScreen,
      onWhiteScreen,
      onEndSlideshow,
      onGameHud,
      onGameTimer,
      onGameNext,
      onGameReveal,
      onGameLeaderboard,
      onGamePause,
      onTimerAdd,
      onTimerSub,
      onTeamSelect1,
      onTeamSelect2,
      onTeamSelect3,
      onTeamSelect4,
      onCommandPalette,
      onInsertSlide,
      onGroup,
      onUngroup,
      onBringForward,
      onSendBackward,
      onResetZoom,
      onZoomIn,
      onZoomOut,
    ]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
