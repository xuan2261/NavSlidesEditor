# Element-Control Functional Fixes — 6-Phase TDD + Mandatory Code Review

**Date**: 2026-06-11 08:18
**Severity**: High
**Component**: Element renderers, properties panel, ribbon controls, PPTX export, E2E suite
**Status**: Resolved

## What Happened

A prior read-only audit (plans/archive/260609-0830-element-control-functional-fixes-tdd/) catalogued element/control defects across rendering, property controls, and export — each backed by a file:line evidence reference. A 6-phase TDD plan fixed them failing-test-first. Four commits landed, the last being a mandatory post-implementation code review that caught two defects the green unit suite had missed.

Key commit surface:
- `6cbf5924` — opacity content-layer + single-apply, code border-radius, image flip, pptx image transparency, markdown reveal color/size, reveal image border, table colspan/rowspan via shared `resolveMergedCells`, SVG override-color allowlist
- `d33ee768` — line-fill ribbon gate, video src unify + `migrateVideoSrc`, markdown controls, `computeMixedValues` indeterminate multi-select (opacity/X/Y/W/H/rotation/colors), Phase-4 missing controls (saturation, chart area/stacked, `headerTextColor`/`borderStyle`, SVG content editor, timeline connector, generic panel opacity)
- `377d7640` — E2E: autosave-flush-on-leave, apply-to-selection, zorder, group-paste remap, Ctrl+D clipboard; marquee invariant moved to unit test
- `d5a84d15` — plan + audit + code-review report

## The Brutal Truth

Two bugs survived all-green unit tests and only surfaced because a code-reviewer subagent was mandatory at the end. Both were "looks done but half-wired" failures — exactly the class TDD is supposed to catch. The first (`migrateVideoSrc` leaving `videoUrl` in place) was the P0 defect the entire plan was written to prevent, and it slipped through the implementation phase anyway. That is not a good look. The table `borderStyle` control was wired to the properties panel but the reveal renderer hardcoded `'solid'` — a dead control shipping as a feature.

The marquee drag-select flakiness ate real time: three coordinate/sequence variants tried before accepting that synthetic Playwright pointer events in headless Chromium simply cannot reliably reproduce a rubberband drag. Spending that effort before checking whether it was a Playwright limitation rather than a product bug was a poor sequencing call.

## Technical Details

**H1 (code review catch)**: `migrateVideoSrc` in `client/src/utils/migrate-video-src.js` set `element.src = element.videoUrl` but left `videoUrl` on the object. Renderer fallback `videoUrl || src` would silently shadow any subsequent `src` edit on migrated decks — the exact regression being guarded against. Fix: delete `videoUrl` after copy.

**M1 (code review catch)**: `shared/src/element-renderers.js` `renderTable` dropped `headerTextColor` and table-level `borderStyle` that the canvas renderer already honored. Share-link and PDF export would lose those styles silently. Fixed for parity + parity tests added.

**Marquee E2E**: `tests/e2e/canvas/marquee-and-zorder.spec.js` flaky under 3 pointer-event variants. Root cause: Playwright synthetic `pointerdown`/`pointermove`/`pointerup` sequence does not reliably trigger rubberband logic in headless Chromium — Stream B had flagged this class of issue. The hidden/locked-exclusion invariant was the load-bearing assertion; moved to a unit test on `endRubberBand` in `rubber-band-marquee-selection.test.js`. Spec renamed to `zorder-arrange.spec.js` and covers only z-order operations that don't require drag-select.

**Parallel-worker race**: 9 E2E failures under `workers=4` were seed API writes returning non-ok due to file-based-storage contention, not regressions. Proven by `workers=1` pass. Pre-existing tests failed identically — that was the tell.

**Final gate**: 2392 unit tests passed / 1 skipped / 0 failed. Build OK. Lint 0 errors. 15/15 new E2E specs green at `workers=1`.

## What We Tried

- Three pointer-event sequences for marquee E2E before accepting the Playwright limitation diagnosis.
- Parallel E2E workers (4) before isolating the storage race at workers=1.
- Full unit suite after each phase to catch cross-phase regressions early.

## Root Cause Analysis

**H1**: `migrateVideoSrc` was written as a "copy then use" migration without a cleanup step. The renderer's `videoUrl || src` fallback existed for backward compat with old decks, which made the bug invisible in unit tests — both fields present, fallback wins, test passes, product is wrong.

**M1**: `renderTable` in shared was never updated when `headerTextColor` and `borderStyle` were added to the canvas renderer. Canvas and shared renderers drifted apart silently because there were no cross-surface parity tests until now.

**Marquee flake**: E2E was used to test a pure-logic invariant (locked elements excluded from selection) that has no UI dependency. Unit test was always the right vehicle; E2E was chosen out of convenience and paid for it in flake debugging time.

## Lessons Learned

- **Mandatory post-implementation code review catches "looks done" half-wired bugs that green tests miss.** Both H1 and M1 were invisible to unit tests because the units tested the half-wired path and passed. The reviewer caught them by reading the full data flow.
- **Renderer parity is a silent drift risk.** Canvas renderer and shared renderer (used for export/share-link) are separate code paths. Any feature added to one needs a parity test that exercises both, or it will diverge on export.
- **Test the invariant at the right layer.** If an assertion has no browser-interaction dependency, it belongs in a unit test. Using E2E for it buys nothing and adds flake surface.
- **Storage-race failures at N workers = pre-existing infra issue, not a regression.** Check whether existing tests also fail before debugging the new ones.

## Next Steps

- **Parity test harness for canvas vs. shared renderers** (owner: next feature sprint): a lightweight test that renders the same element through both paths and diffs the output. Prevents silent export-only style loss.
- **E2E worker-count stability**: file-based storage race under `workers>1` is a pre-existing issue that will keep biting. Either serialize seed writes with a global setup fixture or switch to in-memory storage for E2E. No owner yet — document as tech debt.
- **Audit other migration utilities** for the same "copy without cleanup" pattern as `migrateVideoSrc`. One-pass grep of `client/src/utils/migrate-*.js`.
