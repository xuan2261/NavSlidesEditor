# Feature Coverage Matrix — editor-core

_Generated: local run_

Verified (PASS only): 100/100 (100%)  |  PASS: 100

## canvas

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| canvas.align | high | deep | unit | trace | client/src/hooks/use-slide-operations-align-group-distribute.deep.test.js | PASS |
| canvas.distribute | high | deep | unit | trace | client/src/hooks/use-slide-operations-align-group-distribute.deep.test.js | PASS |
| canvas.group | high | deep | unit | trace | client/src/hooks/use-slide-operations-align-group-distribute.deep.test.js | PASS |
| canvas.lock | low | smoke | unit | trace | client/src/components/canvas/canvas-geometry-ops.smoke.test.js<br>client/src/components/canvas/use-canvas-pointer-interaction.test.js | PASS |
| canvas.move | low | smoke | unit | trace | client/src/components/canvas/canvas-geometry-ops.smoke.test.js | PASS |
| canvas.resize | low | smoke | unit | trace | client/src/components/canvas/canvas-geometry-ops.smoke.test.js | PASS |
| canvas.resize-aspect | high | deep | unit | trace | client/src/components/canvas/use-canvas-resize-rotate.deep.test.js | PASS |
| canvas.rotate-snap | high | deep | unit | trace | client/src/components/canvas/use-canvas-resize-rotate.deep.test.js | PASS |
| canvas.smart-guides | low | deep | unit | trace | client/src/utils/smartGuides.test.js | PASS |
| canvas.zorder | high | deep | unit | trace | client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx | PASS |

## command

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| command.commandPalette | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| command.group | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx | PASS |
| command.insertLink | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx | PASS |
| command.insertSlide | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx | PASS |
| command.resetZoom | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |
| command.startSlideshow | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx | PASS |
| command.ungroup | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx | PASS |
| command.zoomIn | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |
| command.zoomOut | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |

## control

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| control.file.menu | low | smoke | unit,e2e | trace, a11y | client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx<br>tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js | PASS |
| control.format.align | low | smoke | unit | trace | client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx | PASS |
| control.format.bold | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.format.fontFamily | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.format.fontSize | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.format.fontWeight | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.format.italic | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.format.lineHeight | low | smoke | unit | trace | client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx | PASS |
| control.format.position | low | smoke | unit,e2e | trace, behavior, persistence | client/src/components/properties/apply-to-selection.test.jsx<br>client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx<br>tests/e2e/coverage-depth/editor-control-persistence.spec.js | PASS |
| control.format.underline | low | smoke | unit | trace | client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | PASS |
| control.insert.shape | low | smoke | unit | trace | client/src/components/ribbon/big-button-clipboard-and-insert-integration.test.jsx | PASS |
| control.insert.text | low | smoke | unit | trace | client/src/components/ribbon/big-button-clipboard-and-insert-integration.test.jsx | PASS |
| control.view.selectionPane | low | smoke | unit | trace | client/src/components/ribbon/ribbon-view-tab-mode-controls-and-window-panel-toggles.test.jsx | PASS |
| control.view.smartGuides | low | smoke | unit | trace | client/src/components/ribbon/ribbon-view-tab-mode-controls-and-window-panel-toggles.test.jsx | PASS |

## element

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| element.audio | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.callout | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.chart | high | deep | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/missing-controls.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.code | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.drawing | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.html | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.icon | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.image | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.latex | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.line | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.markdown | low | smoke | unit | trace, behavior | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/markdown-controls.test.jsx | PASS |
| element.qrcode | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.shape | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/indeterminate-multi-select.test.jsx<br>client/src/components/properties/shape-line-misc-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.svg | low | smoke | unit | trace, behavior | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/missing-controls.test.jsx | PASS |
| element.table | high | deep | unit | trace, behavior, export | client/src/components/canvas/element-renderers/table-element-merge.deep.test.jsx<br>client/src/components/properties/missing-controls.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.text | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.timeline | high | deep | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/missing-controls.test.jsx<br>shared/tests/element-renderers.test.js | PASS |
| element.video | low | smoke | unit | trace, behavior, export | client/src/components/canvas/element-renderers/element-factory.smoke.test.js<br>client/src/components/properties/media-code-image-latex-html-properties-depth.test.jsx<br>shared/tests/element-renderers.test.js | PASS |

## flow

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| flow.autosave | high | deep | unit | trace | client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx | PASS |
| flow.clipboard | high | deep | unit | trace | client/src/hooks/use-clipboard.test.js | PASS |
| flow.find-replace | low | smoke | unit | trace | client/src/components/find-replace-helpers.test.js | PASS |
| flow.multiselect | high | deep | unit | trace, behavior | client/src/components/properties/indeterminate-multi-select.test.jsx<br>client/src/stores/editor-store-multiselect.deep.test.js<br>client/src/stores/editor-store.test.js | PASS |
| flow.undo-redo | high | deep | unit | trace | client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx | PASS |

## shortcut

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| shortcut.blackScreen | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.bringForward | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx | PASS |
| shortcut.commandPalette | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.copy | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.cut | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.delete | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.duplicate | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.endSlideshow | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.eraseAnnotations | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.escape | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.gameHud | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameLeaderboard | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameNext | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gamePause | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameReveal | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.gameTimer | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.group | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx | PASS |
| shortcut.highlighterTool | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.insertSlide | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.laserPointer | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.paste | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.penTool | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.redo | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.resetZoom | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |
| shortcut.selectAll | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.sendBackward | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx | PASS |
| shortcut.slideFirst | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slideLast | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slideNext | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.slidePrev | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.startSlideshow | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.startSlideshowCurrent | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.teamSelect1 | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect2 | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect3 | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.teamSelect4 | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.timerAdd | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.timerSub | low | smoke | unit | trace | client/src/hooks/game-presenter-keyboard-shortcut-handler.test.js | PASS |
| shortcut.toggleFindReplace | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.undo | low | smoke | unit | trace | client/src/hooks/use-keyboard.test.js | PASS |
| shortcut.ungroup | low | smoke | unit | trace | client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx | PASS |
| shortcut.whiteScreen | low | smoke | unit | trace | client/src/hooks/slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js | PASS |
| shortcut.zoomIn | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |
| shortcut.zoomOut | low | smoke | unit | trace | client/src/stores/editor-store.test.js | PASS |

