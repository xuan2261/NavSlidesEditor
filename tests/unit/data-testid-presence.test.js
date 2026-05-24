import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const REQUIRED_TESTIDS = [
  { file: 'client/src/components/MediaLibraryModal.jsx', testid: 'media-library-item' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-overlay' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-dialog' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-close-btn' },
  { file: 'client/src/pages/HomePage.jsx', testid: 'home-new-presentation-btn' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-panel-container' },
  { file: 'client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx', testid: 'ribbon-tab-${tab.id}' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-${id}-content' },
  { file: 'client/src/components/ribbon/ribbon-file-dropdown-menu.jsx', testid: 'ribbon-file-menu-trigger' },
  { file: 'client/src/components/ribbon/ribbon-file-dropdown-menu.jsx', testid: 'ribbon-file-export-pptx' },
  { file: 'client/src/components/ribbon/ribbon-file-dropdown-menu.jsx', testid: 'ribbon-file-export-html' },
  { file: 'client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx', testid: 'ribbon-insert-text' },
  { file: 'client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx', testid: 'ribbon-insert-shape' },
  { file: 'client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx', testid: 'ribbon-insert-game' },
  { file: 'client/src/components/SlideCanvas.jsx', testid: 'canvas-area' },
  { file: 'client/src/components/SlideCanvas.jsx', testid: 'smart-guide-${guide.axis}' },
  { file: 'client/src/components/ribbon/controls/canvas-controls.jsx', testid: 'canvas-controls-toggle-smart-guides' },
  { file: 'client/src/components/ribbon/ribbon-view-mode-controls-content.jsx', testid: 'view-toggle-selection-pane' },
  { file: 'client/src/components/SelectionPane.jsx', testid: 'selection-pane-toggle-visibility-${el.id}' },
  { file: 'client/src/components/SlidePanel.jsx', testid: 'slide-panel-item' },
  { file: 'client/src/pages/HomePage.jsx', testid: 'home-import-markdown-btn' },
  { file: 'client/src/pages/HomePage.jsx', testid: 'home-import-markdown-input' },
  { file: 'client/src/pages/SettingsPage.jsx', testid: 'settings-open-sync' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-modal-dialog' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-provider-proton-drive' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-configure-confirm' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-status-configured' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-push-btn' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-pull-btn' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-push-result' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-pull-result' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-error-toast' },
  { file: 'client/src/components/game-hud-overlay.jsx', testid: 'game-hud' },
  { file: 'client/src/components/game-leaderboard-overlay.jsx', testid: 'game-leaderboard' },
  { file: 'client/src/pages/EditorPage.jsx', testid: 'game-active-indicator' },
  { file: 'client/src/components/canvas/element-renderers/game-element-renderer.jsx', testid: 'game-question' },
  { file: 'client/src/components/canvas/element-renderers/game-element-renderer.jsx', testid: 'game-score' },
]

function testIdPattern(testid) {
  const escaped = testid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:data-testid|triggerTestId)(?:=["']|=\\{\\\`|=\\{)[\\s\\S]{0,240}${escaped}`)
}

describe('data-testid catalog enforcement', () => {
  for (const { file, testid } of REQUIRED_TESTIDS) {
    it(`${file} contains data-testid="${testid}"`, () => {
      const source = readFileSync(file, 'utf8')
      expect(source).toMatch(testIdPattern(testid))
    })
  }
})
