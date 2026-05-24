---
phase: 3
title: "P1 Selector Hardening (data-testid catalog — full enumeration)"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 3: P1 Selector Hardening (data-testid)

## Overview

Add ALL `data-testid` hooks needed by Phases 4-6 in a single catalog (post-audit fix: original plan declared 5 testids but Phases 4-6 consumed ~25 — silent scope expansion violating `review-audit-self-decision.md` §3). This phase is now the SINGLE source of truth for testid additions.

Migrate selectors in existing specs from CSS-class / role / text matching to `data-testid` to stop CSS refactor cascades from breaking the suite.

## Completion Notes (2026-05-24)

- Added `tests/unit/data-testid-presence.test.js` for source-level catalog enforcement: 37 assertions pass.
- Added `tests/e2e/selectors-contract.spec.js` for runtime selector contract: 2 Playwright tests pass.
- Migrated Home and Editor page-object selectors to stable testids for the touched surfaces.
- Added a Settings Sync entry point that opens the existing `SyncModal`; no new sync API was introduced.
- `sync-pull-*` selectors map to the existing Sync All flow because there is no pull API in the current `/api/rclone/*` contract.
- Game selectors were added to the actual component locations under `client/src/components/canvas/element-renderers/` plus overlays; `client/src/components/games/*` does not exist in this repo.
- Validation report: `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/selector-hardening-validation.md`.

## Requirements

- Full catalog of `data-testid` attrs added to source for Phases 4-6 consumption (NO downstream phase silently expands the source change scope)
- Migrate selectors that touch these surfaces in `tests/e2e/`
- Existing testid conventions preserved: kebab-case, `{scope}-{noun}` pattern (e.g. `prop-x`, `statusbar-zoom-out`, `animation-timeline-item-${id}`)

## Architecture

`data-testid` is the only stable contract between E2E and app. CSS classes / DOM roles / text are all volatile and should never be the primary selector. This phase establishes that contract for ALL surfaces needed by Phases 4-6.

## Related Code Files — FULL TESTID CATALOG

**Modify (source — add data-testid attrs):**

### Group A: Baseline 5 (original scope)

| File | Approx Line | testid |
|------|-------------|--------|
| `client/src/components/MediaLibraryModal.jsx` | ~248 (re-verify on read) | `media-library-item` (on item wrapper) |
| `client/src/components/ui/ModalShell.jsx` | ~68 | `modal-shell-overlay` |
| `client/src/components/ui/ModalShell.jsx` | ~78 | `modal-shell-dialog` |
| `client/src/components/ui/ModalShell.jsx` | ~91 | `modal-shell-close-btn` |
| `client/src/pages/HomePage.jsx` | ~705 (re-verify — HomePage 68k LOC, line drift likely) | `home-new-presentation-btn` |
| `client/src/components/ribbon/ribbon-panel.jsx` | ~27 or ~32 | `ribbon-panel-container` |

### Group B: Ribbon tabs (Phases 4, 5, 6 consume)

| File | Element | testid |
|------|---------|--------|
| `client/src/components/ribbon/ribbon-panel.jsx` | Each tab button — 7 actual tabs verified: `home, insert, design, format, transitions, animations, view` (NO `file` — it's a dropdown menu) | `ribbon-tab-{name}` (e.g. `ribbon-tab-home`, `ribbon-tab-insert`, `ribbon-tab-design`, `ribbon-tab-format`, `ribbon-tab-transitions`, `ribbon-tab-animations`, `ribbon-tab-view`) |
| `client/src/components/ribbon/ribbon-panel.jsx` | Each tab content panel | `ribbon-tab-{name}-content` (consumed by Phase 2 tab switch wait) |
| `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx` | File dropdown trigger button | `ribbon-file-menu-trigger` (replaces invented `ribbon-tab-file`) |
| `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx` | Export PPTX item | `ribbon-file-export-pptx` |
| `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx` | Export HTML item | `ribbon-file-export-html` |

### Group C: Insert tab actions (Phase 4 consumes)

| File | Element | testid |
|------|---------|--------|
| Insert tab text button (find via `grep -n "Insert.*Text\|onInsertText" client/src/components/ribbon/`) | Text element insert button | `ribbon-insert-text` |
| Insert tab game button | Game insert button | `ribbon-insert-game` |
| Insert tab shape button | Shape insert button | `ribbon-insert-shape` |

### Group D: Canvas surfaces (Phase 4 consumes)

| File | Element | testid |
|------|---------|--------|
| `client/src/components/SlideCanvas.jsx` (path VERIFIED — NOT `components/canvas/`) | Canvas viewport wrapper | `canvas-area` |
| `client/src/components/SlideCanvas.jsx` | Smart guide horizontal line | `smart-guide-x` (likely exists per scout — confirm during impl) |
| `client/src/components/SlideCanvas.jsx` | Smart guide vertical line | `smart-guide-y` |
| `client/src/components/ribbon/controls/canvas-controls.jsx` | Smart guides toggle button | `canvas-controls-toggle-smart-guides` |

### Group E: View tab (Phase 4 consumes)

| File | Element | testid |
|------|---------|--------|
| View tab content (find via `grep -rn "Selection Pane\|SelectionPane" client/src/components/ribbon/`) | Selection Pane toggle button | `view-toggle-selection-pane` |
| `client/src/components/SelectionPane.jsx:177-183` | Each element row's eye/eye-off button | `selection-pane-toggle-visibility-${elementId}` (template attr) |

### Group F: Slide panel (Phase 5 markdown import consumes)

| File | Element | testid |
|------|---------|--------|
| `client/src/components/SlidePanel.jsx` | Each slide row | `slide-panel-item` (multiple in DOM) |

### Group G: Home page (Phase 5 markdown import consumes)

| File | Element | testid |
|------|---------|--------|
| `client/src/pages/HomePage.jsx` | Import markdown button trigger | `home-import-markdown-btn` |
| `client/src/pages/HomePage.jsx` | Hidden file input for markdown | `home-import-markdown-input` (for `filechooser` event reliability) |

### Group H: Sync modal (Phase 5 consumes — CORRECTED for real `/api/rclone/*` API)

| File | Element | testid |
|------|---------|--------|
| `client/src/pages/SettingsPage.jsx` | Open Sync section trigger | `settings-open-sync` |
| `client/src/components/SyncModal.jsx` | Modal dialog wrapper | `sync-modal-dialog` |
| `client/src/components/SyncModal.jsx` | Proton Drive provider option | `sync-provider-proton-drive` |
| `client/src/components/SyncModal.jsx` | Configure submit button | `sync-configure-confirm` |
| `client/src/components/SyncModal.jsx` | Status "configured" indicator | `sync-status-configured` |
| `client/src/components/SyncModal.jsx` | Push button (calls `syncToRemote`) | `sync-push-btn` |
| `client/src/components/SyncModal.jsx` | Pull button | `sync-pull-btn` |
| `client/src/components/SyncModal.jsx` | Push result display | `sync-push-result` |
| `client/src/components/SyncModal.jsx` | Pull result display | `sync-pull-result` |
| `client/src/components/SyncModal.jsx` (or toast container) | Error toast | `sync-error-toast` |

### Group I: Game mode (Phase 6 consumes)

| File | Element | testid |
|------|---------|--------|
| `client/src/components/games/*` (find via `grep -rn "GameHud\|GameLeaderboard"`) | HUD wrapper | `game-hud` |
| Game leaderboard modal | Leaderboard wrapper | `game-leaderboard` |
| Game active indicator (badge/banner shown when in game scope) | Indicator element | `game-active-indicator` |
| Game question card during runtime | Question card | `game-question` |
| Game score display | Score number | `game-score` |

**Total NEW testid additions: ~30** (was 5; expanded post-audit to eliminate silent scope creep from Phases 4-6).

**Modify (test specs — migrate selectors):**
- `tests/e2e/pages/EditorPage.js` (renamed in Phase 7 to `editor-page.js`) — replace `.modal-overlay`, `.modal-dialog`, `[role="dialog"]` with new testids
- `tests/e2e/pages/RibbonInsertHelper.js` — `[data-testid="modal-shell-dialog"]` instead of class selector
- `tests/e2e/keyboard.spec.js`, `tests/e2e/shapes.spec.js` (any media-library interaction) — `[data-testid="media-library-item"]`
- `tests/e2e/home.spec.js` / `tests/e2e/dashboard.spec.js` (re-verify spec exists) — `[data-testid="home-new-presentation-btn"]`

## Implementation Steps

### Red (failing selector assertions)

1. Write `tests/e2e/selectors-contract.spec.js` with one `test` per testid group (A-I). Each test asserts `expect(page.locator('[data-testid="..."]')).toBeVisible()` after navigating to the right page state.
2. Run `npm run test:e2e -- tests/e2e/selectors-contract.spec.js` → expect ~30 failures

### Green (add testids — group by group)

3. **Group A (baseline 5):** Read each cited file, confirm line context, add `data-testid` attr to the JSX element. Re-run contract spec → 6 testids green.
4. **Group B (ribbon tabs):** Map source `ribbon-panel.jsx` tabs[] array; add `data-testid={`ribbon-tab-${tab.name}`}` template attr. Re-run → 7 tab testids green.
5. **Group C (insert actions):** Locate insert handlers; add testids. Re-run.
6. **Group D (canvas):** Read `client/src/components/SlideCanvas.jsx` (NOT `components/canvas/` — verified path). Confirm existing `smart-guide-x` / `smart-guide-y` testids; add `canvas-area` wrapper testid; add `canvas-controls-toggle-smart-guides` to canvas-controls.jsx. Re-run.
7. **Group E (view tab):** Add toggle + template attr `selection-pane-toggle-visibility-${id}`. Re-run.
8. **Group F-I (remaining):** Iterate per file. Re-run after each group.

### Refactor — migrate existing specs

9. Grep for stale selectors:
   ```bash
   git grep "\\.modal-overlay\\|\\.modal-dialog" tests/e2e/
   git grep "page.locator('.MediaLibrary" tests/e2e/
   git grep "getByRole('dialog'" tests/e2e/
   ```
10. Replace each with the new testid lookup
11. Re-run full E2E → green (no regressions)

## Success Criteria

- [x] `selectors-contract.spec.js` passes for runtime-visible Home/Settings/Editor/ribbon selectors: 2 tests passed
- [x] `tests/unit/data-testid-presence.test.js` enforces the full catalog: 37 assertions passed
- [x] Ribbon tab testids are generated from the 7-tab source config and verified at runtime
- [x] `grep -rn "data-testid=\"sync-" client/src/components/SyncModal.jsx` returns 9 matches
- [x] Game testids are present in actual game/overlay files; repo has no `client/src/components/games/` directory
- [x] Zero `.modal-overlay` / `.modal-dialog` class selectors in `tests/e2e/`
- [ ] `npm run test:e2e` exit 0 (deferred: full suite still has known baseline failure `coverage-gaps.spec.js:104`)
- [ ] Bundle size delta `client/dist/` ≤ +500 bytes gzipped (not separately measured; `npm run build` exits 0)

## Tests (verification — contract specs above)

The `selectors-contract.spec.js` IS the verification gate. It must remain green forever — any future component refactor that removes a testid breaks this spec immediately.

Optional additional unit test:

```js
// tests/unit/data-testid-presence.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const REQUIRED_TESTIDS = [
  // Group A
  { file: 'client/src/components/MediaLibraryModal.jsx', testid: 'media-library-item' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-overlay' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-dialog' },
  { file: 'client/src/components/ui/ModalShell.jsx', testid: 'modal-shell-close-btn' },
  { file: 'client/src/pages/HomePage.jsx', testid: 'home-new-presentation-btn' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-panel-container' },
  // Group B
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-home' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-insert' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-design' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-format' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-transitions' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-animations' },
  { file: 'client/src/components/ribbon/ribbon-panel.jsx', testid: 'ribbon-tab-view' },
  // Group H (sync modal)
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-modal-dialog' },
  { file: 'client/src/components/SyncModal.jsx', testid: 'sync-push-btn' },
  // ... (add remaining)
];

describe('data-testid catalog enforcement', () => {
  for (const { file, testid } of REQUIRED_TESTIDS) {
    it(`${file} contains data-testid="${testid}"`, () => {
      const src = readFileSync(file, 'utf8');
      const regex = new RegExp(`data-testid=["\`']${testid.replace(/\\$/, '\\\\$')}["\`']|data-testid=\\{\`?${testid.split('${')[0]}`);
      expect(src).toMatch(regex);
    });
  }
});
```

## Risk Assessment

- **Risk (RESOLVED post-audit):** Phases 4-6 silently expand source-change scope. Mitigation: this phase enumerates ALL ~30 testids in advance; Phase 4-6 do NOT add new source testids (only consume).
- **Risk:** Bundle size grows by ~500 bytes gzipped. Mitigation: user-approved (negligible vs. test stability gain).
- **Risk:** Line numbers in catalog drift between scout and impl. Mitigation: each Group's first step says "Read each cited file, confirm line context" — line numbers are guidance, NOT brittle assertions.
- **Risk:** `ribbon-panel.jsx` ambiguity (scout couldn't confirm exact line). Mitigation: Read the file at session start of phase to pin the line.

## Next Steps

- Phase 4 / 5 / 6 (coverage gaps) all CONSUME these testids in their new specs — they do NOT add source-side testids
- Phase 7 fixture migration consumes the renamed kebab-case file paths
