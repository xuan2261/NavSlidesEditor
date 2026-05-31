# Tag Retrofit Audit Ledger — editor-core

Records each retrofit decision: which existing test was tagged for which
capability, and why. Tags were added ONLY to tests that genuinely assert the
capability's behavior AND run green (verified against vitest `--reporter=json`).
No assertion logic was changed — title-string edits only.

## Convention

- Tag goes on the primary scenario `it()` title (vitest JSON reports leaf `it`
  titles, which the run-status join matches on — a `describe`-only tag would
  resolve to TAGGED, never PASS).
- Shared-id rule: a keyboard test asserting "key → callback" legitimately owns
  both the `shortcut.<id>` and the `command.*`/`canvas.*`/`flow.*` it triggers.
- `tier:deep` added only where the test asserts real behavior (exact values,
  fidelity), not just no-crash.

## Tagged (real coverage confirmed)

| Capability | Test file | Tier | Note |
|---|---|---|---|
| flow.clipboard | hooks/use-clipboard.test.js | deep | asserts copy/paste/cut/duplicate fidelity, +20/+20 offset, locked-guard |
| canvas.smart-guides | utils/smartGuides.test.js | deep | asserts exact snap geometry + threshold |
| flow.find-replace | components/find-replace-helpers.test.js | smoke | asserts replace + HTML-embed preservation |
| flow.multiselect | stores/editor-store.test.js | smoke | selection accumulation; high-risk → still DEEP-GAP (deep test = Phase 5) |
| shortcut.copy/cut/paste/duplicate/undo/redo/delete/selectAll/toggleFindReplace/escape | hooks/use-keyboard.test.js | smoke | one test asserts all 10 key→callback wirings |
| shortcut.commandPalette + command.commandPalette | hooks/use-keyboard.test.js | smoke | Ctrl+K → onCommandPalette |
| shortcut.{slideNext,slidePrev,slideFirst,slideLast,blackScreen,whiteScreen,endSlideshow,startSlideshow,startSlideshowCurrent} | hooks/slideshow-...-handler.test.js | smoke | per-key presentation wiring |
| shortcut.{gameHud,gameTimer,gameNext,gameReveal,gameLeaderboard,gamePause,timerAdd,timerSub,teamSelect1-4} | hooks/game-presenter-...-handler.test.js | smoke | per-key game wiring |
| shortcut.{zoomIn,zoomOut,resetZoom} + command.{zoomIn,zoomOut,resetZoom} | stores/editor-store.test.js | smoke | zoom action math (shared id) |
| control.format.align | ribbon/controls/paragraph-...-controls.test.jsx | smoke | menu command dispatch |
| control.format.lineHeight | ribbon/controls/paragraph-...-controls.test.jsx | smoke | line-height command dispatch |

## Left GAP (feeds Phase 4 smoke / Phase 5 deep)

- **Elements** (chart, code, shape, image, text, markdown, html, latex, qrcode,
  icon, callout, line, drawing, svg, table, timeline, audio, video): covered by
  `tests/e2e/elements/*` but NOT yet PASS in the unit-only matrix run. The e2e
  specs ARE scanned; tagging them is a follow-up sweep. Until an e2e run JSON is
  joined, they stay GAP. → Phase 4 decision: tag existing e2e specs OR add unit
  smoke; do not duplicate e2e-covered elements.
- **canvas.{move,resize,resize-aspect,rotate-snap,zorder,group,align,distribute,lock}**:
  no unit test asserts these store ops yet. → Phase 4 smoke + Phase 5 deep.
- **flow.{undo-redo,autosave}**: undo/redo wiring asserted in keyboard tests but
  the 50-step bound + history behavior is not. → Phase 5 deep.
- **control.{insert.*,view.*,file.menu,format.bold/italic/underline/fontSize/fontFamily/fontWeight/position}**:
  no asserting unit test. → Phase 4 smoke.
- **command.{insertSlide,insertLink,group,ungroup,startSlideshow}**: → Phase 4
  smoke. NOTE: `command.startSlideshow` action is a `console.log` stub
  (EditorPage.jsx:912) — a real finding to record, not paper over.
- **shortcut.{insertSlide,group,ungroup,bringForward,sendBackward,penTool,laserPointer,highlighterTool,eraseAnnotations}**:
  no asserting wiring test yet. → Phase 4 smoke or dated allowlist.

## Before/After

| Metric | Baseline (Phase 2) | After retrofit (Phase 3) |
|---|---|---|
| Verified (PASS) | 0/100 | 44/100 |
| GAP | 100 | 55 |
| DEEP-GAP | 0 | 1 (flow.multiselect) |
| Orphan tags | 0 | 0 (after camelCase extractor fix) |

## Bug surfaced during retrofit

The first retrofit matrix showed 17 orphan tags — all camelCase ids truncated
at the first uppercase letter (`shortcut.blackScreen` → `shortcut.black`). Root
cause: the Phase 2 `[cap:*]` extractor regex allowed only `[a-z0-9.\-]`. Fixed
to `[A-Za-z0-9.\-]` with a regression test. This is the matrix doing its job:
it made an invisible extractor defect visible immediately.
