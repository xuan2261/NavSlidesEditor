# Refactoring Plan Audit: deep-feature-synthesis-hardening-roadmap

**Audit date:** 2026-04-27
**Plan location:** `plans/260427-0531-deep-feature-synthesis-hardening-roadmap/`
**Commits audited:** HEAD~5 (30ba1da..HEAD)

---

## Executive Summary

Of 10 planned phases, **zero were fully executed** per plan specifications. The actual work in HEAD~5 commits is:

1. **PPTX export hardening** (Phase 6 tangential) — 12 new/modified files, 1781+ lines of PPTX export work
2. **Command layer partial improvement** — keyboard hook refactored with `createKeyboardHandler`, clipboard `performDuplicate` rewritten, SlideCanvas keyboard handler updated with locked-element guards and paste-on-empty-selection
3. **UI/UX Tailwind remediation** — 31 component files modified, mostly class-name hardening
4. **Animation preview modal** — new feature, not in plan
5. **Live presentation hardening** — `presenterToken` support added
6. **Minor store guard fixes** — null guards added to presentation-store actions

**Critical gaps:** Phase 3 (canvas decomposition), Phase 4 (chrome extraction), Phase 5 (shortcut registry) were planned but not started. Phase 7-10 (P2 features) were gated and also not executed. `use-history.js` was deleted per git status but the file existed in the commit referenced — meaning it's a working-copy untracked deletion, not a committed deletion.

---

## Phase-by-Phase Audit

### Phase 1: Baseline Scope And Gates

**Planned:** Create verified baseline — capture LOC, run test commands, freeze scope.

**Status:** NOT EXECUTED

- No Phase 1 baseline capture was performed as a discrete step
- No `plans/reports/` entries documenting baseline test failures or scope confirmation
- The plan itself was created (all phases marked `pending`) but no execution evidence

---

### Phase 2: Command Layer Unification

**Planned:** One canonical command layer; `SlideCanvas.jsx` loses inline clipboard/keyboard code; context menu and keyboard share same command callbacks; `EditorPage.jsx` owns command wiring.

**Status:** PARTIALLY EXECUTED — significant work done but plan contract NOT met

#### What was done:

**`use-keyboard.js`:**
- Refactored from `useCallback` to `createKeyboardHandler` + `useMemo` pattern (better memoization)
- Logic unchanged (same shortcuts, same `e.key.toLowerCase()` switch)
- No new shortcut customization — matches plan's non-functional requirement "no shortcut customization UI in this phase"

**`use-clipboard.js`:**
- `performDuplicate` rewritten: previously `performCopy() + setTimeout(performPaste, 50)`, now inline with `crypto.randomUUID()` for IDs
- Null guard added: `(slide.elements || [])` instead of `slide.elements.filter`
- Behavior: creates fresh IDs (`crypto.randomUUID()`) and offsets `+20/+20`

**`SlideCanvas.jsx` (keyboard handler changes):**
- `slideRef` created so keyboard handler uses `slideRef.current` instead of stale `slide` prop (fixes the "paste after slide change" bug from plan's Phase 2 requirements)
- `clipboardRef` created to avoid stale closure in paste handler
- Locked-element guards added: `hasLockedSelection` check blocks cut/duplicate of locked elements
- Paste on empty selection added: allows paste when `selectedElementIds.length === 0` (exactly what Phase 2 required)
- `commitCropRef` added to fix stale closure on crop commit (Phase 2 notes crop mode as handled by keyboard)

#### What was NOT done:

| Plan requirement | Status |
|---|---|
| `SlideCanvas.jsx` removes inline keyboard listener | NOT DONE — SlideCanvas still has its own `document.addEventListener('keydown', onKeyDown)` (~line 618+). Keyboard listener is still in canvas. |
| `SlideCanvas.jsx` removes inline clipboard command bodies | PARTIALLY DONE — copy/cut/paste/duplicate logic still inline in SlideCanvas keyboard handler. Only paste-on-empty was added. Cut/duplicate logic is still in SlideCanvas. |
| Single command wiring point in `EditorPage.jsx` | NOT DONE — no unified command layer in EditorPage. Undo/redo were extracted to `handleUndo`/`handleRedo` callbacks (good) but clipboard commands remain in SlideCanvas. |
| `use-clipboard.test.js` | NOT CREATED |
| `tests/e2e/keyboard-shortcuts.spec.js` updates | MINIMAL — only 4 lines changed |
| Paste offset decision | NOT MADE — code uses `+20/+20` offset (matches default but not explicitly decided) |

**Evidence:** SlideCanvas still has ~80+ lines of inline keyboard/clipboard code (keyboard handler starting around line 508). Context menu (around line 250-260 `contextMenu` state) was not checked for command callback unification.

---

### Phase 3: SlideCanvas Render Decomposition

**Planned:** Extract element renderer components to `client/src/components/canvas/element-renderers/`; create `registry.js`; reduce SlideCanvas from ~2759 LOC to <=1200 LOC.

**Status:** NOT EXECUTED

- No `canvas/` directory created
- No `CanvasElement.jsx` created
- No element renderer components created
- No `registry.js` created
- SlideCanvas LOC: **still 2759 LOC** (no reduction)
- The `client/src/components/canvas/` glob returned zero files

---

### Phase 4: Canvas Chrome And Interaction Extraction

**Planned:** Extract chrome components (`CanvasRulers`, `CanvasGridOverlay`, `CanvasContextMenu`, `CanvasFooterOverlay`, `CanvasZoomControls`, `CropOverlay`) and interaction hooks (`use-canvas-selection.js`, `use-canvas-pointer-interaction.js`, `use-canvas-resize-rotate.js`). Target `<=1200 LOC`.

**Status:** NOT EXECUTED

- No `canvas/` directory or chrome components created
- No interaction hooks created
- `SlideCanvas.jsx` still 2759 LOC
- `CropOverlay` not extracted — crop mode logic remains inline

---

### Phase 5: Custom Shortcut Registry And Settings

**Planned:** Create `shortcut-registry.js`, `shortcut-storage.js`, `shortcut-normalizer.js`; update `useKeyboard()` to resolve from registry; add Settings UI.

**Status:** NOT EXECUTED

- No `shortcut-registry.js`, `shortcut-storage.js`, or `shortcut-normalizer.js` created (glob returned zero matches)
- `useKeyboard()` still uses hardcoded switch — no registry dispatch
- SettingsPage unchanged for shortcut management
- `use-keyboard.test.js` unchanged (minor, only 4 lines diff)
- No `shortcut-registry.test.js` or `shortcut-storage.test.js` created

---

### Phase 6: PPTX Fidelity Corpus And Metadata Hardening

**Planned:** Add chart-heavy corpus, per-type real corpus gates, chart metadata tests, OLE/equation fallback warnings, update docs.

**Status:** PARTIALLY EXECUTED — significant PPTX work done but not Phase 6 spec

**What was done:**
- 12 new/modified PPTX export files (1781+ lines):
  - `export-pptx-core.js` + `.test.js`
  - `export-pptx-basic-renderers.js` (270 lines)
  - `export-pptx-color-utils.js`
  - `export-pptx-fallback-renderer.js`
  - `export-pptx-html-parser.js` (175 lines)
  - `export-pptx-raster-capture.js`
  - `export-pptx-raster.js` (374 lines) + `.test.js`
  - `export-pptx-renderers.js`
  - `export-pptx-text-runs.js`
  - `exportPptx.test.js` (257 lines)
- This is PPTX **export** hardening, not PPTX **import** fidelity (Phase 6 was about import)

**What was NOT done:**
- No chart-heavy corpus files added
- No per-type corpus gates
- No chart metadata tests
- No OLE/equation fallback warnings
- `docs/pptx-import-fidelity-report.md` unchanged
- Phase 6 was import-side, but the work was export-side

---

### Phase 7: Slide Master Validation And Hybrid Design

**Status:** NOT EXECUTED — P2 gated

- No demand validation
- No hybrid data model documented
- No `slideMasters`/`layouts`/`overrides` schema
- No `resolveSlideContent()` prototype

---

### Phase 8: Editable PDF Import Spike

**Status:** NOT EXECUTED — P2 gated

- No `pdf-extractor.js` or Python bridge
- `pdf-import.js` had minor diff (13 lines) — likely safety guard or null check only
- No Python packaging decision

---

### Phase 9: Privacy Bounded Presentation Analytics

**Status:** NOT EXECUTED — P2 gated

- `AnalyticsModal.jsx` modified (46 lines) — likely UI hardening but not Phase 9 analytics persistence
- No `analytics-service.js` created
- No `sessions` array or bounded storage added to analytics
- No live session persistence

---

### Phase 10: Roadmap Docs And Release Gates

**Status:** NOT EXECUTED

- No plan phase statuses updated
- No changelog entries for the changes that were made
- No `docs/project-roadmap.md` update
- No architecture doc update for command layer changes

---

## Special Findings

### `use-history.js` Deletion

Git status shows `D client/src/hooks/use-history.js`. However:
- The file existed in commit `6515d44b` (the last commit that had it)
- The file exists in `30ba1da` (current HEAD)
- This is a **working-copy deletion only**, not a committed deletion
- The plan did NOT call for deleting `use-history.js` — Phase 2 said "Delete: none unless a dead helper is fully unused after refactor"
- History logic was moved inline into `EditorPage.jsx` (`handleUndo`/`handleRedo` callbacks) — so the hook became unused and was deleted from working copy, but the deletion was not committed

### `SlideCanvas.jsx` LOC

Still **2759 LOC** — no meaningful reduction despite Phase 3 being a P0 dependency for all later phases.

### `EditorPage.jsx` LOC

Still **1662 LOC** — no reduction despite Phase 2 calling for "single command wiring point in EditorPage".

### Tailwind Hardening (a38a8c5)

The commit `fix(ui): complete ui/ux tailwind hard mode remediation (19 fixes)` is a separate effort not part of this plan. It modified 31 component files with UI/UX improvements. This is good hygiene but unrelated to the roadmap phases.

### Animation Preview Modal (30ba1da)

New feature added: `AnimationPreviewModal.jsx` + `animation-preview-helpers.js` + tests. Not in any plan phase. Outside scope of this roadmap.

### Live Presentation Hardening (195b37d)

`presenterToken` support added to `use-live-presentation.js`. This fixes live export/packaging but is tangential to any plan phase.

### Store Null Guards

`presentation-store.js` received null guards (`!state.presentation`) in `updateSlide`, `updateElement`, `addElement`, `deleteElement`. These are defensive fixes, not Phase 2 work.

---

## Test Coverage Assessment

| Plan required test | Created? |
|---|---|
| `use-clipboard.test.js` | NO |
| `shortcut-registry.test.js` | NO |
| `shortcut-storage.test.js` | NO |
| Phase 2 keyboard E2E updates | MINIMAL (4 lines) |
| PPTX import fidelity E2E | NO |
| Canvas interaction E2E | NO |

What WAS added (not plan-required):
- `export-pptx-core.test.js` (160 lines)
- `export-pptx-raster.test.js` (113 lines)
- `exportPptx.test.js` (257 lines)
- `AnimationPreviewModal.test.jsx` + `animation-preview-helpers.test.js`
- `export-project.test.js`, `undo-redo.spec.js` (54 lines)
- `animation-preview.spec.js` E2E

---

## Summary Table

| Phase | Plan status | Actual status | Completion |
|---|---|---|---|
| 1: Baseline Scope | Pending | Not executed | 0% |
| 2: Command Unification | Pending | Partial (improvements, not full) | ~40% |
| 3: Canvas Decomposition | Pending | Not executed | 0% |
| 4: Chrome Extraction | Pending | Not executed | 0% |
| 5: Shortcut Registry | Pending | Not executed | 0% |
| 6: PPTX Import Fidelity | Pending | Export hardening only | ~15% |
| 7: Slide Master | Pending | Not executed (gated) | 0% |
| 8: PDF Spike | Pending | Not executed (gated) | 0% |
| 9: Analytics | Pending | Not executed (gated) | 0% |
| 10: Docs/Gates | Pending | Not executed | 0% |

---

## Recommendations

1. **Phase 3 (canvas decomposition) is the critical blocker** — Phase 4, 5, 7+ all depend on it. Without it, the roadmap cannot progress. Consider executing Phase 3 next.

2. **Phase 2 is ~60% complete** — the improvements made are solid (locked-element guards, paste-on-empty, stale closure fixes) but the core plan contract (remove inline clipboard/keyboard from SlideCanvas, unified command wiring) is not met. A focused cleanup pass on SlideCanvas keyboard handler + context menu would complete Phase 2.

3. **PPTX work is export-side, not import-side** — if PPTX import fidelity was the goal, the 1781+ lines of export work doesn't address Phase 6's corpus/gates/metadata requirements.

4. **Test coverage gaps** — Phase 2 required `use-clipboard.test.js` and E2E updates that were never created.

5. **Commit history is clean** — actual changes are well-scoped in commits (`fix: wrap handleUndo/handleRedo in useCallback`, `fix(ui): complete ui/ux tailwind`, etc.). The work is real, just not aligned with the plan phases.

---

## Unresolved Questions

1. Was Phase 2 intentionally stopped after the improvements (locked-element guards, paste-on-empty) without completing the full SlideCanvas refactor?
2. Was the 1781-line PPTX export work planned separately from this roadmap, or was it intended to satisfy Phase 6?
3. Why was `use-history.js` deleted in working copy but not committed? Should this be a formal deletion?
4. Should Phase 3 canvas decomposition be the immediate next step, or are there other higher-priority items?
5. Was the AnimationPreviewModal feature requested separately, or should it be part of a future phase?
