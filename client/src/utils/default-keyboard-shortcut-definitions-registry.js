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
  { id: 'undo',       label: 'Undo',       category: 'navigation', defaultKey: 'Ctrl+Z', scopes: ['canvas', 'editor', 'presentation'] },
  { id: 'redo',       label: 'Redo',       category: 'navigation', defaultKey: 'Ctrl+Y', scopes: ['canvas', 'editor', 'presentation'] },
  { id: 'selectAll',  label: 'Select All', category: 'navigation', defaultKey: 'Ctrl+A', scopes: ['canvas'] },
  { id: 'escape',     label: 'Deselect',   category: 'navigation', defaultKey: 'Escape', scopes: ['canvas', 'editor'] },
  // View
  { id: 'toggleFindReplace', label: 'Find/Replace', category: 'view', defaultKey: 'Ctrl+F', scopes: ['canvas'] },
  // Slideshow
  { id: 'startSlideshow',       label: 'Start Slideshow',           category: 'slideshow', defaultKey: 'F5',         scopes: ['editor'] },
  { id: 'startSlideshowCurrent',label: 'Start from Current Slide',  category: 'slideshow', defaultKey: 'Shift+F5',  scopes: ['editor'] },
  { id: 'slideNext',            label: 'Next Slide',                category: 'slideshow', defaultKey: 'ArrowRight', scopes: ['presentation'] },
  { id: 'slidePrev',            label: 'Previous Slide',            category: 'slideshow', defaultKey: 'ArrowLeft',  scopes: ['presentation'] },
  { id: 'slideFirst',           label: 'First Slide',               category: 'slideshow', defaultKey: 'Home',        scopes: ['presentation'] },
  { id: 'slideLast',            label: 'Last Slide',                category: 'slideshow', defaultKey: 'End',        scopes: ['presentation'] },
  { id: 'blackScreen',          label: 'Black Screen',              category: 'slideshow', defaultKey: 'B',         scopes: ['presentation'] },
  { id: 'whiteScreen',          label: 'White Screen',              category: 'slideshow', defaultKey: 'W',         scopes: ['presentation'] },
  { id: 'endSlideshow',         label: 'End Slideshow',             category: 'slideshow', defaultKey: 'Escape',    scopes: ['presentation'] },
  // Game Presenter (present + game mode)
  { id: 'gameHud',        label: 'Toggle Game HUD',    category: 'game', defaultKey: 'G',      scopes: ['presentation-game'] },
  { id: 'gameTimer',      label: 'Start/Stop Timer',   category: 'game', defaultKey: ' ',     scopes: ['presentation-game'] },
  { id: 'gameNext',       label: 'Next Phase',         category: 'game', defaultKey: 'Enter',  scopes: ['presentation-game'] },
  { id: 'gameReveal',     label: 'Reveal Answer',     category: 'game', defaultKey: 'R',       scopes: ['presentation-game'] },
  { id: 'gameLeaderboard',label: 'Toggle Leaderboard',category: 'game', defaultKey: 'L',      scopes: ['presentation-game'] },
  { id: 'gamePause',      label: 'Pause/Resume Game',  category: 'game', defaultKey: 'P',      scopes: ['presentation-game'] },
  { id: 'timerAdd',       label: 'Add 10s',            category: 'game', defaultKey: '+',      scopes: ['presentation-game'] },
  { id: 'timerSub',       label: 'Subtract 10s',       category: 'game', defaultKey: '-',      scopes: ['presentation-game'] },
  // Editor Enhancements
  { id: 'insertSlide',          label: 'Insert Slide',                category: 'editing', defaultKey: 'Ctrl+M',        scopes: ['editor'] },
  { id: 'group',                label: 'Group Elements',              category: 'editing', defaultKey: 'Ctrl+G',         scopes: ['editor'] },
  { id: 'ungroup',              label: 'Ungroup Elements',            category: 'editing', defaultKey: 'Ctrl+Shift+G',  scopes: ['editor'] },
  { id: 'bringForward',          label: 'Bring Forward',               category: 'editing', defaultKey: 'Ctrl+]',        scopes: ['editor'] },
  { id: 'sendBackward',         label: 'Send Backward',               category: 'editing', defaultKey: 'Ctrl+[',        scopes: ['editor'] },
  { id: 'save',                 label: 'Save',                        category: 'editing', defaultKey: 'Ctrl+S',        scopes: ['editor'] },
  { id: 'resetZoom',            label: 'Reset Zoom',                  category: 'view',    defaultKey: 'Ctrl+0',        scopes: ['editor'] },
  { id: 'zoomIn',               label: 'Zoom In',                     category: 'view',    defaultKey: 'Ctrl+=',        scopes: ['editor'] },
  { id: 'zoomOut',              label: 'Zoom Out',                    category: 'view',    defaultKey: 'Ctrl+-',        scopes: ['editor'] },
  { id: 'commandPalette',        label: 'Command Palette',             category: 'view',    defaultKey: 'Ctrl+K',        scopes: ['editor']
    // NOTE: Scope is editor-only. CommandPalette renders in EditorPage only.
    // LiveViewPage does not render CommandPalette. If presentation-mode palette is needed,
    // add 'presentation' scope and filter commands (YAGNI for now).
  },
  // Annotations (present mode)
  { id: 'penTool',         label: 'Pen Tool',       category: 'annotation', defaultKey: 'Ctrl+Shift+O', scopes: ['presentation'] },
  { id: 'laserPointer',    label: 'Laser Pointer',  category: 'annotation', defaultKey: 'Ctrl+I',  scopes: ['presentation'] },
  { id: 'highlighterTool', label: 'Highlighter',    category: 'annotation', defaultKey: 'Y',        scopes: ['presentation'] },
  { id: 'eraseAnnotations',label: 'Erase All',     category: 'annotation', defaultKey: 'E',        scopes: ['presentation'] },
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
