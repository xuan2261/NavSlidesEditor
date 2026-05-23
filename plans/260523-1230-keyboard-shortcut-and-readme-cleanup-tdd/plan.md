---
title: "Keyboard Shortcut Wiring & README Element Count Cleanup TDD"
description: "Resolve two unresolved follow-ups from smoke-test fix plan: (Q1) close 8 latent silent-no-op editor shortcuts by forwarding callbacks through useKeyboard + add registry-driven contract test; (Q2) reconcile README element-type count with element-defaults source of truth and codify distinction between element types vs insert actions."
status: completed
priority: P1
effort: "1-1.5 days single dev"
branch: master
tags: [bugfix, tdd, regression, keyboard, hook, docs, readme]
created: 2026-05-23
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: []
blocks: []
---

# Keyboard Shortcut Wiring & README Element Count Cleanup TDD

## Overview

Goal: close two follow-ups left open by `260523-0900-smoke-test-bug-fixes-tdd` Phase 7. Both are non-blocking but compounding tech debt: the keyboard issue is a class of latent bugs identical to I-003, the README drift is an ongoing parity-test trap.

Two issues:

| ID | Severity | Title | Root cause area |
|---|---|---|---|
| Q1 | Low (P1, latent) | 8 editor-scope shortcuts silently fail (preventDefault fires but no callback invoked) | `client/src/hooks/use-keyboard.js` missing destructure entries + `client/src/pages/EditorPage.jsx:1119` missing callback props |
| Q2 | Low (P2, docs) | `README.md` claims 20 element types; element-defaults has 19; prose enumerates 21; ribbon Insert shows 27+ insert actions | `README.md:36` + missing distinction between "element type" and "insert action" |

## Context

| Source | Use |
|---|---|
| `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-07-final-report.md` | "Unresolved Questions" section (lines 94-97) — authoritative source of the 2 follow-ups |
| `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-05-green-evidence.md` | Original discovery of Q1 latent forwarding bug class |
| `client/src/hooks/use-keyboard.js:94-132` | Q1 destructure list — missing 8 entries (insertSlide, group, ungroup, bringForward, sendBackward, resetZoom, zoomIn, zoomOut) |
| `client/src/hooks/use-keyboard.js:176-214` | Q1 dep array — must match destructure additions |
| `client/src/hooks/use-keyboard.js:142-174` | Q1 callbacks bag passed to `createKeyboardHandler` — must match destructure additions |
| `client/src/utils/default-keyboard-shortcut-definitions-registry.js:44-52` | Q1 — 8 editor-scope shortcuts that need forwarding |
| `client/src/pages/EditorPage.jsx:1119-1187` | Q1 — `useKeyboard({...})` call site missing 8 props |
| `client/src/hooks/use-slide-operations.js:93,113` | Q1 — `groupElements`, `ungroupElements` already defined |
| `client/src/pages/EditorPage.jsx:1506-1509,1620-1621` | Q1 — `bringElementForward`, `sendElementBackward`, `bringElementToFront`, `sendElementToBack` already wired to UI |
| `client/src/components/ribbon/controls/canvas-controls.jsx:74,83,92` | Q1 — canonical zoom expressions: in=`Math.min((zoom\|\|1)+0.1, 3)`, out=`Math.max((zoom\|\|1)-0.1, 0.2)`, reset=`1` |
| `client/src/pages/EditorPage.jsx:1102` | Q1 — `insertSlide` command palette action: `setShowTemplateModal(true)` |
| `client/src/data/element-defaults.js:5-281` | Q2 — canonical ELEMENT_DEFAULTS keys = 19 element types |
| `client/src/components/canvas/element-renderers/registry.js` | Q2 — 13 dedicated renderers (text/image/video/audio/code/html/markdown use other rendering paths) |
| `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` | Q2 — Insert ribbon panel; count insert actions including shape/game sub-variants |
| `README.md:36` | Q2 — text to update |
| `client/src/hooks/use-keyboard.test.js` | Existing test harness — `renderHook` + `KeyboardEvent` dispatch pattern already proven (lines 109-127) |

## Phases

| # | Phase | Status | Priority | File |
|---|---|---|---|---|
| 1 | RED Contract Test + Wiring Test | completed | P0 | [phase-01-red-contract-test-and-wiring-test.md](./phase-01-red-contract-test-and-wiring-test.md) |
| 2 | GREEN Forward 8 Callbacks Through useKeyboard | completed | P0 | [phase-02-green-forward-callbacks-through-usekeyboard.md](./phase-02-green-forward-callbacks-through-usekeyboard.md) |
| 3 | GREEN Wire 8 Callbacks in EditorPage | completed | P0 | [phase-03-green-wire-callbacks-in-editorpage.md](./phase-03-green-wire-callbacks-in-editorpage.md) |
| 4 | Fix README Element Count + Contributing Note | completed | P1 | [phase-04-fix-readme-element-count-and-contributing-note.md](./phase-04-fix-readme-element-count-and-contributing-note.md) |
| 5 | Regression Sweep & Docs Update | completed | P0 | [phase-05-regression-sweep-and-docs-update.md](./phase-05-regression-sweep-and-docs-update.md) |

## Dependency Graph

```text
Phase 1 (RED tests) -> Phase 2 (hook forwarding GREEN)
                    -> Phase 3 (EditorPage wiring GREEN, parallel-safe with Phase 2)
                    -> Phase 4 (README fix, parallel-safe with Phase 2/3)
Phase 2 + Phase 3 -> Phase 5 (regression sweep, lint, build, docs, changelog)
Phase 4         -> Phase 5
```

Phase 1 must land first (RED). Phases 2, 3, 4 are independent and can run in parallel by file ownership. Phase 5 gates on all four turning GREEN.

## Parallel Opportunities (post Phase 1)

| Lane | Files owned | Phases |
|---|---|---|
| Hook lane | `client/src/hooks/use-keyboard.js` | Phase 2 |
| EditorPage lane | `client/src/pages/EditorPage.jsx` | Phase 3 |
| Docs lane | `README.md`, `CONTRIBUTING.md` (or `CLAUDE.md` if no CONTRIBUTING.md) | Phase 4 |
| Test lane (Phase 1 only) | `client/src/hooks/use-keyboard.test.js` | Phase 1 |

## Success Criteria

- Contract test enumerates every `scopes.includes('editor')` shortcut from `getShortcuts(loadOverrides())` and asserts the hook forwards each callback when the chord is dispatched.
- Pre-fix: contract test fails RED for 8 specific shortcuts (insertSlide, group, ungroup, bringForward, sendBackward, resetZoom, zoomIn, zoomOut).
- Post-Phase-2: contract test passes GREEN for all editor-scope shortcuts.
- Adding a new editor-scope shortcut to the registry without updating the hook causes the contract test to fail in CI — verified by simulated registry addition during Phase 1 design.
- `Ctrl+M`, `Ctrl+G`, `Ctrl+Shift+G`, `Ctrl+]`, `Ctrl+[`, `Ctrl+0`, `Ctrl+=`, `Ctrl+-` each trigger their canonical action in editor (manual smoke test scenario in Phase 5).
- README element-types section reads "**N element types**" where N matches `Object.keys(ELEMENT_DEFAULTS).length` at HEAD, with an explicit distinction line: "Insert ribbon offers M actions because shapes and games expose sub-variants."
- Contributing note (3-5 lines, added to `CLAUDE.md` or new `CONTRIBUTING.md`) instructs future contributors to re-run the element-count check when adding a new renderer.
- `npm run lint` and `npm run build` pass.
- `npm run test` (Vitest) passes including new contract test.
- `npm run test:e2e -- --grep keyboard` passes for any new Playwright spec.
- `docs/project-changelog.md` carries a 2026-05-23 entry summarizing Q1/Q2 closures.
- `docs/codebase-summary.md` is updated if the contributing pattern adds a new rule.

## Out of Scope

- Forwarding presentation/game-scope shortcuts beyond the editor 8 — those work today via the same hook because their callbacks ARE destructured (commandPalette + game callbacks). **EXCEPTION:** annotation callbacks (`onPenTool`, `onLaserPointer`, `onHighlighterTool`, `onEraseAnnotations`) are passed by EditorPage but NOT destructured by useKeyboard — same bug class as the 8 editor shortcuts. **Decision (user-confirmed 2026-05-23):** documented as known gap; deferred to a follow-up plan to keep this plan's scope focused on the user's named 8 editor shortcuts. See Unresolved Questions section.
- Generic forwarding refactor that drops the destructure list entirely in favor of `...callbacks` rest spread — explicit list is currently the API contract; refactoring is YAGNI and would lose React hook lint warnings on missing deps.
- README rewrites beyond the element-count paragraph and an inline footnote.
- Building a doc generator for element types — strict YAGNI; contributing note + count guard test are enough until drift recurs.
- Touching `LiveViewPage` or game-mode keyboard handlers — `LiveViewPage` does NOT import `useKeyboard` (verified by grep); game callbacks ARE destructured.
- Fixing element-renderer registry to include text/image/code/html/markdown — those render via dedicated React components outside the registry, intentionally.
- Reconciling `canvas-controls.jsx` zoom expressions (step 0.1, clamp 0.2-3) with editor-store actions (step 0.25, clamp 0.25-4) — pre-existing inconsistency. Keyboard uses store actions (canonical). Ribbon button cleanup is out of scope.

## Risks

| Risk | Mitigation |
|---|---|
| Adding 8 destructure entries + 8 dep-array entries + 8 callbacks-bag entries in `useKeyboard` triggers React hook exhaustive-deps lint with stale references | Re-run `npm run lint` after Phase 2; all 8 are leaf callbacks (no closure capture), so deps are stable identity refs from the caller. |
| `Ctrl+=` and `Ctrl+-` may not dispatch as the expected key in JSDOM (browser sometimes sends `=` vs `Equal` `code`) | Phase 1 contract test uses `key: '='` (post-`normalizeKey` uppercase) and asserts; falls back to `key: 'Equal'` only if JSDOM diverges from browser. Document in test. |
| EditorPage zoom handlers need access to `zoom` state from editor-store; passing `setZoom(z => ...)` form may require `getState()` or selector inside callback | Phase 3 uses functional update via `setZoom((z) => ...)` if store exposes it; otherwise reads `zoom` selector once per render (acceptable — keyboard callbacks aren't hot path). Verify pattern with store API at edit time. |
| README element-count update may shift visual-baseline screenshots that include README text indirectly (unlikely but possible if README is rendered on home page) | Grep for README rendering in client; if any rendering path consumes README, update visual baselines accordingly. Most likely: no impact. |
| Future shortcuts added without contributing note awareness still drift | Contract test is the real guard — drift surfaces as test failure; contributing note is a polite reminder, not load-bearing. |
| Q1 fix touches a hook used by both editor and live-view paths; live-view path may have callback gaps that surface as new failures | Verify `useKeyboard` callers via grep; live-view uses its own scope filter (`isPresenting=true`), so editor-scope additions do not affect presentation mode. Confirm at Phase 2 edit time. |

## Recommended Cook Command

```powershell
/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260523-1230-keyboard-shortcut-and-readme-cleanup-tdd\plan.md
```

## Unresolved Questions

- **Q1.A (test architecture):** `test.each(editorScopeShortcuts)` table-driven Vitest pattern vs single looping test. **Decision (researcher-01 verified):** `test.each` for per-shortcut failure clarity. Pattern documented in Phase 1.
- **Q1.B (chord parsing in test):** How to construct `KeyboardEvent` for `Ctrl+=`, `Ctrl+-`, `Ctrl+]`, `Ctrl+[` in JSDOM. **Decision (researcher-01 verified):** `parseChord` round-trip works for all 8 chords. JSDOM honors init dict; no fallback needed.
- **Q1.C (refactor scope):** Should Phase 2 introduce a callback bag spread or keep explicit named props? **Decision:** keep explicit named props. React hook exhaustive-deps lint requires named deps; rest spread loses warnings.
- **Q1.D (annotation callbacks gap — surfaced by Red-Team F2):** EditorPage passes `onPenTool`, `onLaserPointer`, `onHighlighterTool`, `onEraseAnnotations` but `useKeyboard` does NOT destructure them. Same bug class as the 8 editor shortcuts. **Decision (user-confirmed 2026-05-23):** defer to follow-up plan. Rationale: keeps this plan focused on the user's named 8 editor shortcuts; doesn't drift scope. Track as a single follow-up: "Wire annotation callbacks through useKeyboard + extend contract test to presentation scope". Severity: presentation-mode annotations silently broken — moderate-impact, non-blocking for editor work.
- **Q1.E (Ctrl+M intent — surfaced by Red-Team F5):** Should Ctrl+M open template modal or insert a blank slide? **Decision (user-confirmed 2026-05-23):** open template picker (`setShowTemplateModal(true)`). Matches slide panel "+" button UX.
- **Q2.A (contributing note location):** `CONTRIBUTING.md` (new file) vs append to `CLAUDE.md`. **Decision:** check if `CONTRIBUTING.md` exists first; if not, append to `CLAUDE.md` under a "Documentation Drift" section.
- **Q2.B (count source):** which file is the canonical "truth" for element count? `client/src/data/element-defaults.js` (19) vs `registry.js` (13) vs prose enumeration (21). **Decision (researcher-02 verified):** `element-defaults.js` — it's read by `element-factory.js` which is the canonical instantiation path. Phase 4 adds a CI guard test pinning the count to 19.
- **Q2.C (insert action count):** count exact insert actions in Insert ribbon panel. **Decision (researcher-02 verified):** 27 actions (28 with conditional file-browser).
- **Q3 (zoom clamp source — surfaced by Red-Team F1):** Should keyboard zoom shortcuts use canvas-controls.jsx inline expressions (step 0.1, clamp 0.2-3) or editor-store actions (step 0.25, clamp 0.25-4)? **Decision (Claude-applied 2026-05-23):** store actions = canonical. Pre-existing canvas-controls.jsx divergence is out of scope.

## Red Team Review

### Session 1 — 2026-05-23 (post-draft adversarial review)

**Findings:** 11 (2 Critical, 4 High, 3 Medium, 2 Low). Full report: `reports/red-team-session-1.md`.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | Critical | Phase 3 zoom clamps (0.1/0.2-3) diverge from canonical editor-store actions (`zoomIn`/`zoomOut`/`resetZoom` at `editor-store.js:71-75`, step 0.25, clamp 0.25-4) | Accept — Phase 3 rewritten to call store actions directly |
| F2 | Critical | 4 annotation callbacks (`onPenTool`, `onLaserPointer`, `onHighlighterTool`, `onEraseAnnotations`) passed by EditorPage but NOT destructured in useKeyboard — same bug class as the 8 editor shortcuts. Plan claimed "annotation callbacks excluded but verified" — incorrect | Accept (partial) — gap documented; user confirmed defer to follow-up plan (Q1.D) |
| F3 | High | "Exactly 8 RED" count not justified — registry filter picks up 17+ shortcuts. 11 already wired | Accept — Phase 1 enumerates exact 8 IDs explicitly |
| F4 | High | README prose still enumerates "divider" and "inline math" which are NOT in ELEMENT_DEFAULTS — Phase 4 v1 only fixed headline | Accept — Phase 4 step 4.2 explicit prose enumeration update |
| F5 | High | Ctrl+M intent ambiguous: `setShowTemplateModal(true)` vs `addSlide('blank')` — UX decision | Accept (user-resolved) — template picker confirmed (Q1.E) |
| F6 | High | `parseChord` JSDOM fallback hedge unnecessary — researcher-01 verified round-trip for all 8 chords | Accept — Phase 1 risk row updated, hedge dropped |
| F7 | Medium | No CI guard for element-defaults count drift | Accept — Phase 4 step 4.3 adds 10-line vitest count guard |
| F8 | Medium | `useMemo` deps must include all 8 callbacks | Accept (already in Phase 2 step 2.4); flagged explicitly |
| F9 | Medium | Phase 1 step 1.2 wiring smoke test is dead weight — JS doesn't throw on extra props | Accept — step removed |
| F10 | Low | Phase 3 step 3.1 hedge "ADD setZoom if missing" wrong — exists at `editor-store.js:72` | Accept — hedge removed |
| F11 | Low | Plan claimed LiveViewPage uses `useKeyboard` — verified false (grep) | Accept — Phase 2 risk row updated |

All adjustments applied inline as `## Red-Team Adjustments` sections in respective phase files.

## Validation Log

### Session 1 — 2026-05-23 (post-red-team validation)

**Trigger:** `--deep` mode auto-validation after Red-Team Session 1.

**Critical decisions surfaced to user:**

| # | Category | Question | User Decision | Rationale |
|---|---|---|---|---|
| Q1.E | UX | Ctrl+M (Insert Slide) — what should it do? | Open template picker | Matches existing slide panel "+" button UX; user picked from 3 options |
| Q1.D | Scope | Wire 4 annotation callbacks in this plan or defer? | Defer to follow-up plan | Keeps plan focused on user's named 8 editor shortcuts; annotation gap documented as known issue with follow-up reference |

**Auto-resolved (Claude-applied, all consistent with red-team findings):**

- Q3 (zoom clamp source): use store actions — canonical, simpler.
- F3 (RED count enumeration): explicit list of 8 IDs in Phase 1.
- F6 (parseChord fallback): dropped — verified by researcher-01.
- F7 (count guard test): added to Phase 4.
- F9 (dead test removal): removed.
- F10 (setZoom hedge): removed.
- F11 (LiveViewPage claim): removed.

**Whole-plan consistency sweep:** Performed. No stale references to "20 element types", no inconsistent claims about LiveViewPage, no leftover wiring-smoke-test mentions. All 5 phase files self-consistent with plan.md.

## Cross-Plan Dependency

- This plan is **independent** of the parity verification plan (`plans/260523-0500-upstream-parity-verification-tdd/`). Both touch keyboard shortcuts, but parity tests exercise the existing scope filter; this plan adds new forwarding plus a regression guard that helps parity testing surface latent issues sooner.
- No reciprocal `blockedBy`/`blocks` edits required. Parity plan's existing `blockedBy: [260523-0900-smoke-test-bug-fixes-tdd]` is unchanged.

## Visualization

- Phase visuals (registry-to-hook trace, RED→GREEN matrix, contributing-note flow) saved to `{plan_dir}/visuals/` if `/ck:preview` is invoked.
