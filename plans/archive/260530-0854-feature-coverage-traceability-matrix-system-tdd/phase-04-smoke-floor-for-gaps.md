---
phase: 4
title: "Smoke Floor for Gaps"
status: completed
priority: P2
effort: "2.5d"
dependencies: [3]
---

# Phase 4: Smoke Floor for Gaps

## Overview

Give every editor-core capability a baseline smoke test: it renders without crashing, its primary operation runs, and its state persists (create → save → reload survives). This is the cheap, broad floor that catches the majority of serious breakage. Targets the GAP rows the Phase 3 retrofit could not honestly tag.

**Scope is GAP/SKIP rows AFTER Phase 3** — and Phase 3 already tagged existing e2e + unit coverage. So elements covered by `tests/e2e/elements/*` are already PASS and MUST NOT get a duplicate smoke test (red-team HIGH #3). Only write smoke for capabilities the matrix still shows GAP (genuinely untested) or SKIP (test exists but skipped — fix or replace). Re-read the matrix before writing each test; if it's already PASS, skip it.

**Includes untested `shortcut.*`** left GAP after Phase 3 retrofit (red-team HIGH #4): each gets a smoke test asserting keypress→action wiring, or a dated allowlist entry — never a silent pass.

## Requirements

- **Functional**
  - For each GAP capability (post-Phase 3), add a smoke test tagged `[cap:<id>]` that asserts: (1) renders/mounts, (2) basic op does not throw, (3) round-trips through persistence where applicable.
  - Elements: insert via factory/store → element exists on slide → serializes and re-hydrates with same type/props.
  - Controls: control renders in its ribbon tab → clicking/invoking dispatches the expected store action (assert store mutation, not just no-throw).
  - Canvas ops: invoke store action (move/resize/lock/zorder) → element geometry/flags change as expected (smoke level: changed, not exact-math — that's Phase 5).
  - Commands: each `commands` array entry → action callback fires (mock the target).
- **Non-functional**
  - Prefer unit/integration (vitest + Testing Library + store) over e2e for speed — these run every PR.
  - Each test file ≤ 200 LOC; group by capability category.
  - Reuse existing patterns: store tests follow `editor-store.test.js`; renderer tests follow existing element-renderer test style; ribbon tests follow `paragraph-formatting-and-alignment-controls.test.jsx`.

## Architecture

```
client/src/  (co-located with source, matching existing convention)
├── components/canvas/element-renderers/<type>-element-renderer.smoke.test.jsx   (per missing element)
├── components/ribbon/controls/<control>.smoke.test.jsx                          (per missing control)
└── stores/editor-store-canvas-ops.smoke.test.js                                 (canvas ops batch)
```

**Smoke contract (the floor) per capability type:**
- `element.*`: `createElement(type)` → defaults applied → renderer mounts → JSON round-trip preserves type + key props.
- `control.*`: render control with a mock store → user interaction → assert `store.<action>` called with expected args.
- `canvas.*`: dispatch store action on a fixture element → assert target field changed (e.g. `lock` sets `locked:true`; `bringForward` raises `zIndex`).
- `command.*`: invoke command action → assert side-effect callback fired.

**Scope from matrix:** the exact GAP list is whatever Phase 2/3 leaves red AFTER e2e + unit retrofit. Elements with `tests/e2e/elements/*` coverage (chart, code, shape, image, text, markdown, html, latex, qrcode, icon, callout, line, drawing, svg) are already PASS — DO NOT re-smoke them. Anticipated genuine smoke-only GAPs: `element.timeline` (if shallow), `element.audio`/`element.video` (trim props), low-risk controls without tests, `command.insertLink`, `command.startSlideshow` (note: action is a `console.log` stub at EditorPage.jsx:912 — smoke test should assert the WIRING that exists, and the stub itself is flagged as a real finding, not papered over), and any `shortcut.*` still GAP after Phase 3.

## Related Code Files

- **Create:** smoke test files per GAP capability (co-located, `.smoke.test.{js,jsx}` suffix for discoverability).
- **Read:** `feature-coverage-matrix.md` (GAP rows), `client/src/data/element-defaults.js` (factory), `client/src/stores/editor-store.js` (actions), `tag-retrofit-audit.md` (leave-GAP list from Phase 3).
- **Modify:** none of the source — tests only. (If a capability is untestable because it lacks a stable hook/testid, add a minimal `data-testid` to the source — flag such cases, keep additive.)

## Implementation Steps (TDD)

> TDD nuance: these tests ARE the red. Each new smoke test is written to assert correct behavior; if the capability is actually broken, the test goes red and reveals a real bug (a win — that's the point of the floor). Sequence per capability: write smoke test (`red:` if behavior missing/broken, else green on first run) → fix source only if a real bug is found (`green:`) → tidy (`refactor:`).

1. Enumerate GAP capabilities from the current matrix JSON (post-Phase 3).
2. Batch by category (elements, controls, canvas ops, commands).
3. **Per capability:** write the tagged smoke test asserting the smoke contract. Run.
   - If it passes → capability was fine, now visible-green.
   - If it fails → real bug found. Fix source (`green:`), re-run. Record the bug in `reports/smoke-floor-findings.md`.
4. Re-run `npm run matrix` after each batch; watch GAP count fall.
5. **`refactor:`** dedupe shared fixtures into a helper (`smoke-test-helpers.js`); keep files ≤ 200 LOC.

## Success Criteria

- [ ] Every editor-core element type is PASS — either via existing e2e (tagged in Phase 3) OR a NEW `[cap:element.<type>]` smoke test for genuine GAPs. **No duplicate smoke test for an element already PASS via e2e** (verified: re-check matrix before writing each)
- [ ] Every primary ribbon control has a `[cap:control.<tab>.<name>]` smoke test asserting its store action
- [ ] Every canvas op has a smoke test asserting the targeted state change
- [ ] Every `commands` entry has a smoke test asserting its action fires; stub actions (e.g. `startSlideshow` console.log) are recorded as findings, not hidden by a passing wiring test
- [ ] Every `shortcut.*` still GAP after Phase 3 gets a smoke test (keypress→action) or a dated allowlist entry
- [ ] Matrix GAP/SKIP count for editor-core reaches 0 OR remaining items are allowlisted with reason (Phase 6)
- [ ] Any real bug found during smoke writing is fixed (against the SEPARATE bug-fix budget) + recorded in `smoke-floor-findings.md`
- [ ] New tests do not lower coverage below `vitest.config.mjs` thresholds (they should raise it)
- [ ] Commit log shows TDD sequence; bug-fix commits reference the behavior, not the phase

## Risk Assessment

- **Duplicate work on e2e-covered elements** (red-team HIGH #3) → matrix already shows them PASS after Phase 3; explicit "re-check before writing" rule + success criterion. Phase 4 only touches red rows.
- **Volume of tests** → batch by category, share fixtures; smoke tests are intentionally thin (≤ ~15 LOC each).
- **Bug-fix time blows the budget** (red-team HIGH #4b) → bug fixes are charged to a SEPARATE budget tracked in `smoke-floor-findings.md`, not the test-writing effort. A large pre-existing defect → escalate to user, don't absorb silently.
- **Capability lacks a testable seam** (no testid/hook) → add minimal additive `data-testid`; flag to user; do not refactor structure.
- **Smoke passes but logic subtly wrong** → acceptable; that's exactly what Phase 5 deep tests cover for high-risk caps. Smoke is a floor, not a ceiling.
