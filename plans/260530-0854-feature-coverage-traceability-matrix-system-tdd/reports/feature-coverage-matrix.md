# Feature Coverage Matrix — editor-core

_Generated: local run_

Verified (PASS only): 44/100 (44%)  |  PASS: 44  |  DEEP-GAP: 1  |  GAP: 55

## canvas

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| canvas.align | high | smoke→deep | - | (none) | GAP |
| canvas.distribute | high | smoke→deep | - | (none) | GAP |
| canvas.group | high | smoke→deep | - | (none) | GAP |
| canvas.lock | low | smoke | - | (none) | GAP |
| canvas.move | low | smoke | - | (none) | GAP |
| canvas.resize | low | smoke | - | (none) | GAP |
| canvas.resize-aspect | high | smoke→deep | - | (none) | GAP |
| canvas.rotate-snap | high | smoke→deep | - | (none) | GAP |
| canvas.smart-guides | low | deep | unit | client/src/utils/smartGuides.test.js | PASS |
| canvas.zorder | high | smoke→deep | - | (none) | GAP |

## command

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| command.commandPalette | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| command.group | low | smoke | - | (none) | GAP |
| command.insertLink | low | smoke | - | (none) | GAP |
| command.insertSlide | low | smoke | - | (none) | GAP |
| command.resetZoom | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |
| command.startSlideshow | low | smoke | - | (none) | GAP |
| command.ungroup | low | smoke | - | (none) | GAP |
| command.zoomIn | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |
| command.zoomOut | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |

## control

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| control.file.menu | low | smoke | - | (none) | GAP |
| control.format.align | low | smoke | unit | client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx | PASS |
| control.format.bold | low | smoke | - | (none) | GAP |
| control.format.fontFamily | low | smoke | - | (none) | GAP |
| control.format.fontSize | low | smoke | - | (none) | GAP |
| control.format.fontWeight | low | smoke | - | (none) | GAP |
| control.format.italic | low | smoke | - | (none) | GAP |
| control.format.lineHeight | low | smoke | unit | client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx | PASS |
| control.format.position | low | smoke | - | (none) | GAP |
| control.format.underline | low | smoke | - | (none) | GAP |
| control.insert.shape | low | smoke | - | (none) | GAP |
| control.insert.text | low | smoke | - | (none) | GAP |
| control.view.selectionPane | low | smoke | - | (none) | GAP |
| control.view.smartGuides | low | smoke | - | (none) | GAP |

## element

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| element.audio | low | smoke | - | (none) | GAP |
| element.callout | low | smoke | - | (none) | GAP |
| element.chart | high | smoke→deep | - | (none) | GAP |
| element.code | low | smoke | - | (none) | GAP |
| element.drawing | low | smoke | - | (none) | GAP |
| element.html | low | smoke | - | (none) | GAP |
| element.icon | low | smoke | - | (none) | GAP |
| element.image | low | smoke | - | (none) | GAP |
| element.latex | low | smoke | - | (none) | GAP |
| element.line | low | smoke | - | (none) | GAP |
| element.markdown | low | smoke | - | (none) | GAP |
| element.qrcode | low | smoke | - | (none) | GAP |
| element.shape | low | smoke | - | (none) | GAP |
| element.svg | low | smoke | - | (none) | GAP |
| element.table | high | smoke→deep | - | (none) | GAP |
| element.text | low | smoke | - | (none) | GAP |
| element.timeline | high | smoke→deep | - | (none) | GAP |
| element.video | low | smoke | - | (none) | GAP |

## flow

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| flow.autosave | high | smoke→deep | - | (none) | GAP |
| flow.clipboard | high | deep | unit | client/src/hooks/use-clipboard.test.js | PASS |
| flow.find-replace | low | smoke | unit | client/src/components/find-replace-helpers.test.js | PASS |
| flow.multiselect | high | smoke→deep | unit | client/src/stores/editor-store.test.js | DEEP-GAP |
| flow.undo-redo | high | smoke→deep | - | (none) | GAP |

## shortcut

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| shortcut.blackScreen | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.bringForward | low | smoke | - | (none) | GAP |
| shortcut.commandPalette | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.copy | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.cut | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.delete | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.duplicate | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.endSlideshow | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.eraseAnnotations | low | smoke | - | (none) | GAP |
| shortcut.escape | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.gameHud | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameLeaderboard | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameNext | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gamePause | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameReveal | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameTimer | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.group | low | smoke | - | (none) | GAP |
| shortcut.highlighterTool | low | smoke | - | (none) | GAP |
| shortcut.insertSlide | low | smoke | - | (none) | GAP |
| shortcut.laserPointer | low | smoke | - | (none) | GAP |
| shortcut.paste | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.penTool | low | smoke | - | (none) | GAP |
| shortcut.redo | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.resetZoom | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |
| shortcut.selectAll | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.sendBackward | low | smoke | - | (none) | GAP |
| shortcut.slideFirst | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slideLast | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slideNext | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slidePrev | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.startSlideshow | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.startSlideshowCurrent | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.teamSelect1 | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect2 | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect3 | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect4 | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.timerAdd | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.timerSub | low | smoke | unit | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.toggleFindReplace | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.undo | low | smoke | unit | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.ungroup | low | smoke | - | (none) | GAP |
| shortcut.whiteScreen | low | smoke | unit | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.zoomIn | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |
| shortcut.zoomOut | low | smoke | unit | client/src/stores/editor-store.test.js | PASS |

