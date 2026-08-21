import { useKeyboard } from '../use-keyboard'
import { getKeyboardNudgeStep } from '../../utils/keyboard-nudge'
import { hasBlockedGroupMutation } from '../../utils/active-slide-selection'
import { computeClampedBatchDelta } from '../../components/canvas/use-canvas-pointer-interaction'
import { GAME_SHORTCUT_CONFIG } from '../../utils/game-shortcut-config'

export function useEditorKeyboardController(c) {
  useKeyboard({
    disabled: c.disabled,
    onSave: c.handleManualSave,
    onCopy: c.handleCopy,
    onCut: c.handleCut,
    onPaste: c.handlePaste,
    onDuplicate: c.handleDuplicate,
    onUndo: c.handleUndo,
    onRedo: c.handleRedo,
    onDelete: c.deleteSelectedElements,
    onSelectAll: c.handleSelectAll,
    onToggleFindReplace: () => c.setShowFindReplace((v) => !v),
    onEscape: () => {
      if (c.showCommandPalette) return c.setShowCommandPalette(false)
      if (c.showGameHud) return c.setShowGameHud(false)
      if (c.showGameLeaderboard) return c.setShowGameLeaderboard(false)
      c.setSelectedElementIds([])
      c.setEditingElementId(null)
    },
    onArrow: (direction, e) => {
      const ids = c.selectedElementIdsRef.current
      if (ids.length > 0) {
        const slide = c.activeSlideRef.current
        if (slide?.locked) return
        const step = getKeyboardNudgeStep(e.shiftKey)
        const dx = direction === 'left' ? -step : direction === 'right' ? step : 0
        const dy = direction === 'up' ? -step : direction === 'down' ? step : 0
        if (dx === 0 && dy === 0) return
        e.preventDefault()
        if (hasBlockedGroupMutation(slide, ids)) return c.notifyBlockedAction('group-locked')
        const moving = (slide?.elements || [])
          .filter((el) => ids.includes(el.id) && !el.locked)
          .map((el) => ({
            id: el.id,
            x: el.x || 0,
            y: el.y || 0,
            width: el.width || 0,
            height: el.height || 0,
            rotation: el.rotation || 0,
          }))
        const delta = computeClampedBatchDelta(
          moving,
          dx,
          dy,
          c.presentation?.resolution?.width || 960,
          c.presentation?.resolution?.height || 540
        )
        const batch = moving.map((el) => ({
          id: el.id,
          x: el.x + delta.dx,
          y: el.y + delta.dy,
        }))
        if (batch.length) c.updateElements(batch)
        return
      }
      if (direction === 'up' || direction === 'down') {
        const total = c.presentation?.slides?.length ?? 0
        if (!total) return
        e.preventDefault()
        c.setCurrentSlideIndex((index) =>
          direction === 'up' ? Math.max(0, index - 1) : Math.min(total - 1, index + 1)
        )
      }
    },
    isEditing: Boolean(c.editingElementId),
    activeGameType: c.currentGameType,
    isGamePresenterActive: c.isPresenterPopupActive,
    onStartSlideshow: c.startSlideshow,
    onStartSlideshowCurrent: c.startSlideshow,
    onGameHud: () => c.setShowGameHud((v) => !v),
    onGameTimer: () => {
      const shortcut = getGameShortcut(c, 'timer')
      const el = c.activeGameElement
      if (!shortcut || !el) return
      const payload = shortcut.action === 'startTimer'
        ? { duration: shortcut.duration ?? el.timerDuration ?? 30 }
        : {}
      c.emitGameShortcutAction(shortcut.action, payload)
    },
    onGameNext: () => emitConfiguredGameShortcut(c, 'nextPhase'),
    onGameReveal: () => {
      if (!getGameShortcut(c, 'reveal')) return
      c.setShowGameHud(true)
      emitConfiguredGameShortcut(c, 'reveal')
    },
    onGameLeaderboard: () => {
      if (getGameShortcut(c, 'leaderboard')) c.setShowGameLeaderboard((v) => !v)
    },
    onGamePause: () => emitConfiguredGameShortcut(c, 'pause'),
    onTimerAdd: () => adjustTimer(c, 'timerAdd', 10),
    onTimerSub: () => adjustTimer(c, 'timerSub', -10),
    onCommandPalette: () => c.setShowCommandPalette((v) => !v),
    onInsertSlide: () => c.setShowTemplateModal(true),
    onGroup: c.groupElements,
    onUngroup: c.ungroupElements,
    onBringForward: () => c.selectedElementIds.length && c.stepSelectedZOrder('forward'),
    onSendBackward: () => c.selectedElementIds.length && c.stepSelectedZOrder('backward'),
    onResetZoom: c.fitZoom,
    onZoomIn: c.zoomIn,
    onZoomOut: c.zoomOut,
  })
}

function getGameShortcut(c, configKey) {
  return GAME_SHORTCUT_CONFIG[c.currentGameType]?.[configKey] || null
}

function emitConfiguredGameShortcut(c, configKey, payload = {}) {
  const shortcut = getGameShortcut(c, configKey)
  if (!shortcut) return
  c.emitGameShortcutAction(shortcut.action, payload)
}

function adjustTimer(c, configKey, fallback) {
  const shortcut = getGameShortcut(c, configKey)
  if (!shortcut || !c.activeGameElement) return
  c.emitGameShortcutAction(shortcut.action, { delta: shortcut.delta ?? fallback })
}
