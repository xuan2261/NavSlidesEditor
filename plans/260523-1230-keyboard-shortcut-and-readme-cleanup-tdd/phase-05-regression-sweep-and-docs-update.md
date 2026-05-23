---
phase: 5
title: "Regression Sweep & Docs Update"
status: completed
priority: P0
effort: "2-3h"
dependencies: [2, 3, 4]
---

# Phase 5: Regression Sweep & Docs Update

## Overview

Final gate. Run the full quality bar (lint, build, unit, e2e), document closures in changelog, update codebase-summary if the contributing pattern surfaces a new rule, and confirm Phase 1's contract test stays green as a regression guard for future shortcuts.

Gates on Phases 2, 3, and 4 turning green. No new code unless a regression surfaces.

## Requirements

### Functional
- `npm run lint` passes, 0 new errors, 0 new warnings on changed files.
- `npm run build` passes (Vite production build).
- `npm run test` passes (Vitest unit + integration including new contract test).
- `npm run test:e2e -- --grep keyboard` passes for any new Playwright keyboard spec (if added).
- Manual smoke retest: all 8 chords trigger expected actions live in editor.
- `docs/project-changelog.md` gains a 2026-05-23 entry summarizing Q1/Q2 closures (link to plan dir).
- `docs/codebase-summary.md` updated if the contributing pattern materially changes existing structure (likely no-op).

### Non-functional
- Run order parallelizable: lint + unit can run in parallel; build sequential after; e2e last.
- Evidence captured in `reports/phase-05-final-report.md` for audit.

## Architecture

Phase 5 produces no new code (one optional e2e spec). It is verification + documentation.

## Related Code Files

- **Modify:** `docs/project-changelog.md`, optionally `docs/codebase-summary.md`
- **Create (optional):** `tests/e2e/regression-keyboard-shortcuts.spec.js` — only if manual smoke reveals a chord that JSDOM test can't catch. Default: skip; Phase 1 contract test is the primary guard.
- **Read for context:** all 4 prior phase files, `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-07-final-report.md` (this plan's "Unresolved Questions" source)

## Implementation Steps

### 5.1 — Run gates in order

```powershell
npm run lint
npm run test
npm run build
```

Lint + test can run sequentially in PowerShell or chained with `&&`. Capture full output for evidence.

### 5.2 — Run contract test in isolation

```powershell
npx vitest run client/src/hooks/use-keyboard-contract.test.js
```

Expected: all editor-scope shortcuts (the 8 + existing) green. `test.each` table fully passing.

### 5.3 — Optional: e2e smoke for keyboard

If team policy requires a Playwright spec for keyboard shortcuts, add `tests/e2e/regression-keyboard-shortcuts.spec.js` covering 2-3 representative chords (Ctrl+M opens modal, Ctrl+G groups selection, Ctrl+0 resets zoom). Pattern: same as existing `tests/e2e/regression-smoke-fixes.spec.js` (create presentation via API, navigate, click body, press chord, assert side effect).

If skipping, document rationale in evidence: "Contract test at unit level covers all 8 chords; e2e adds no new signal."

### 5.4 — Manual smoke retest

Open the dev server (`npm run dev`), load a presentation, click canvas body, press each of:
- `Ctrl+M` → template modal opens.
- `Ctrl+G` → 2+ selected elements group.
- `Ctrl+Shift+G` → group ungroups.
- `Ctrl+]` → single-selected element moves up in z-order.
- `Ctrl+[` → single-selected element moves down in z-order.
- `Ctrl+0` → zoom resets to 100%.
- `Ctrl+=` → zoom in by 10% (max 300%).
- `Ctrl+-` → zoom out by 10% (min 20%).

Document any drift. If a chord doesn't fire (e.g., Ctrl+= blocked by browser), confirm via DevTools console (`document.activeElement` should be body, not a TipTap input).

### 5.5 — Changelog entry

Append to `docs/project-changelog.md`:

```markdown
## [Unreleased] — 2026-05-23 — Keyboard Shortcut Wiring & README Cleanup

### Fixed
- **Keyboard:** 8 editor-scope shortcuts now fire their actions (previously silent no-op due to missing callback forwarding in `useKeyboard`). Shortcuts: insertSlide (Ctrl+M), group/ungroup (Ctrl+G / Ctrl+Shift+G), bringForward/sendBackward (Ctrl+] / Ctrl+[), resetZoom/zoomIn/zoomOut (Ctrl+0 / Ctrl+= / Ctrl+-).
- **Regression guard:** Added `use-keyboard-contract.test.js` — fails CI if a registry shortcut is not forwarded by the hook.
- **Docs:** README element count corrected (20 → 19, matching `Object.keys(ELEMENT_DEFAULTS).length`). Footnote distinguishes element types from insert ribbon actions. Contributing note added.

### Internal
- Plan: `plans/260523-1230-keyboard-shortcut-and-readme-cleanup-tdd/`.
- Closes Unresolved Questions Q1 and Q2 from `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-07-final-report.md`.
```

### 5.6 — Codebase summary update (conditional)

If `docs/codebase-summary.md` documents the `useKeyboard` hook architecture, add a 1-line note: "Contract test guards registry → hook forwarding; see `use-keyboard-contract.test.js`."

If no relevant section exists, skip — strict YAGNI per plan.

### 5.7 — Final report

Write `reports/phase-05-final-report.md`:

- Test results table (lint, build, unit, e2e, contract).
- 8-shortcut verification table (chord, expected action, observed result, pass/fail).
- README diff summary (before/after counts, footnote text).
- Files changed table (path, LOC delta, phase).
- Risks accepted (if any).
- Cross-plan dependency status (none for this plan — confirmed independent).
- Recommendation for next session: cook handoff or close.

## Success Criteria

- [x] `npm run lint` exit 0, 0 new warnings on touched files.
- [x] `npm run build` exit 0.
- [x] `npm run test` exit 0 — including new contract test.
- [x] Contract test full green (no `test.each` failures).
- [x] Manual smoke: 8/8 chords trigger expected behavior.
- [x] `docs/project-changelog.md` updated.
- [x] `reports/phase-05-final-report.md` written with full evidence.
- [x] No regression in any of the 1300+ existing unit tests.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Lint suite picks up new warning on hook deps spec | Phase 2 step 2.5 already lints; resolves before Phase 5. |
| Build pulls in new bundle weight (unlikely — no new deps) | Hand-written check on `client/dist/` chunk sizes; pre-existing 3MB advisory unchanged. |
| One chord behaves differently than expected (e.g., browser intercepts Ctrl+=) | Document in smoke evidence. Note: registry uses `Ctrl+=`; if browser intercepts at the OS/app level (e.g., zoom UI on macOS), the hook's `e.preventDefault()` should suppress — verify in DevTools. |
| E2E e2e spec flake on keyboard timing | Use `page.keyboard.press` with explicit chord notation (`Control+M`); allow 2s timeout for modal visibility. Pattern proven in I-003 spec. |
| Changelog merge conflict if other plan lands concurrently | Insert at top of "Unreleased" section; conflict resolution is trivial (additive). |

## Next Steps

After Phase 5: ready for `/ck:cook` (if user opts to implement) or close the plan as complete. Cross-plan dependency: this plan stays independent — parity verification plan (`260523-0500-...`) is unaffected.
