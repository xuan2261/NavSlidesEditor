---
title: Validation Interview — E2E Cleanup + Coverage TDD Plan
date: 2026-05-24
reviewer: planner (validation pass)
plan_under_review: plans/260524-0959-e2e-cleanup-and-coverage-tdd/
verdict: NOT READY FOR EXECUTION — blocking issues in Phase 1, 2, 5, 6
---

# Validation Interview — E2E Cleanup + Coverage TDD Plan

## Blocking Findings (must resolve before any phase runs)

1. **Phase 1 will DESTROY active CI specs.** Plan says delete 4 "dead" files but:
   - `tests/e2e/elements.spec.js` (44 LOC) has REAL assertions (text/shape insertion + count growth) — `tests/e2e/elements.spec.js:23-42`.
   - `tests/e2e/slides.spec.js` (25 LOC) has REAL add/delete-slide assertions — `tests/e2e/slides.spec.js:6-21`.
   - `tests/e2e/export.spec.js` (45 LOC) has REAL HTML-export + reveal.js render assertions — `tests/e2e/export.spec.js:22-43`.
   - `tests/e2e/visual-regression.spec.js` (108 LOC) contains active `toHaveScreenshot('editor-canvas-basic.png')` AND is referenced explicitly in `.github/workflows/manual-update-playwright-visual-baselines.yml:38,45,53`.
   - Plan claim "all 4 contain only `test.skip(...)` or empty placeholders" is **false** for all four.

2. **Phase 1 cites wrong helper name.** Plan says fix `apiCreateShareToken` identity-replace at `test-fixtures.js:104`. Actual function is `apiRevokeShareToken` (line 102-106). `apiCreateShareToken` does not exist. The `API_BASE.replace('/api','/api')` is real (line 104) but inside the revoke helper.

3. **Phase 7 will DELETE a workflow-referenced spec.** `tests/e2e/ribbon-layout.spec.js` is invoked by `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` with `--grep "768px"`. Splitting into 7 files breaks that nightly job unless the workflow is updated in the same PR.

4. **Phase 4/6 reference non-existent file paths.** Plan cites `client/src/components/canvas/SlideCanvas.jsx:458` — actual location is `client/src/components/SlideCanvas.jsx:458` (no `/canvas/` subdir). Reused as Phase 4 wiring + Phase 6 testid assumptions. Anyone executing Phase 4 will get "file not found".

5. **Phase 2 cites stale file paths.** `tests/e2e/live/annotation-sync-multi-user-and-clear-broadcasts.spec.js` and `tests/e2e/live/live-timer-sync-presenter-to-viewer.spec.js` do not exist. Actual: `annotation-sync-and-persistence.spec.js`, `live-timer-broadcast-via-game-timer-socket-events.spec.js`. Counts also shifted — plan says "34 occurrences across 17 files"; current grep is 10 files (subtotal looks ~17 occurrences not 34).

---

## Phase 1 — P0 Quick Wins

### Open Questions

- **Success criteria measurable?** "Lint passes" yes; "live.spec.js excluded" yes. But missing: confirmation that deleting `elements/slides/export/visual-regression.spec.js` does NOT regress assertion count. Plan needs explicit `playwright --list` before/after diff committed to PR.
- **Red test sufficient?** Yes for `testIgnore`. NO for the deletion claim — there is zero test that the deleted specs are actually dead. Add: `git grep -E "elements\\.spec|slides\\.spec|export\\.spec|visual-regression\\.spec" .github/` MUST return zero before proceeding.
- **Rollback?** Not stated. Reverting 4 file deletions + 1 regex is `git revert <SHA>` — acceptable, but doc this.
- **Dependency assumptions?** Assumes CI uses loopback `127.0.0.1` for `PLAYWRIGHT_TEST_BASE_URL` — verified at `playwright.config.js:5`. Confirmed.
- **User-facing decision?** Deletion of `visual-regression.spec.js` is a user-facing decision (loses baseline). Was user asked?
- **Config decision before execution?** New `testIgnore` regex `/tests\/e2e\/(live(\/.*)?|mobile\/.*|visual\/.*|a11y\/.*)\.spec\.js$/` — note it now excludes ALL of `mobile/`, `visual/`, `a11y/` from `chromium` project. Was that the intent or just `live`?

---

## Phase 2 — De-flake (waitForTimeout removal)

### Open Questions

- **Success criteria measurable?** "Total 0" assertion via grep is good. "wallclock ≤ baseline + 5%" — what IS the baseline? Plan says "record in `reports/de-flake-perf.md`" but never establishes the prior number.
- **Red test sufficient?** The ESLint rule + grep test will fail consistently. OK.
- **Rollback?** Per-file commits allow `git revert <SHA>` per file. Stated. Good.
- **Dependency assumption?** Plan adds `window.__lastAnnotation` instrumentation behind `import.meta.env.MODE === 'test'`. Vite sets `MODE` to `production` for `build`, `development` for `dev`, `test` for Vitest only — **`MODE` will NOT be `'test'` during Playwright runs** (which use the production preview build). Instrumentation must hook `VITE_E2E=1` flag instead.
- **User-facing decision?** `expect.poll` default `intervals:[250]`, `timeout:10_000` was AI-chosen. User-confirm? On slow Linux CI runners, 4Hz polling on every spec × 34 sites = measurable CPU load.
- **Config decision?** YES — interval, timeout, and the "one allowed `waitForTimeout(500)` race fallback" all need user sign-off. Also: should the spec also fail CI when retry is used (`--reporter=html` shows retries — not failures)?
- **Stale path refs:** annotation-sync + timer-sync file paths wrong (see Blocking #5). Re-verify before edit.

---

## Phase 3 — Selector Hardening (data-testid)

### Open Questions

- **Success criteria measurable?** Grep-counted testids OK. But "Zero `.modal-overlay` class selectors" — need to also cover `.modal-dialog`, `[role="dialog"]`. Acceptance check listed only the first.
- **Red test sufficient?** Yes — contract spec is genuinely red. OK.
- **Rollback?** Removing 6 testid props is low-risk; spec contract spec retained as guard. Stated.
- **Dependency assumption?** `home-new-presentation-btn` placement at `HomePage.jsx:705` — needs re-verify; HomePage is 68k LOC and line numbers drift.
- **User-facing decision?** Testid name choices (`modal-shell-overlay` vs `modal-overlay`) AI-chosen. Existing convention from CLAUDE.md: kebab-case `{scope}-{noun}`. Names follow it. OK.
- **Config decision?** Are reviewer-OK with `data-testid` shipping in prod bundle? Plan says yes (180 bytes). Confirm with user that this isn't a security/clutter concern.
- **Phase 4/5/6 cross-check:** Phase 4 uses `[data-testid="canvas-area"]`, `[data-testid="ribbon-insert-text"]`, `[data-testid="ribbon-tab-view"]`, `[data-testid="ribbon-tab-insert"]`, `[data-testid="view-toggle-selection-pane"]`, `[data-testid="selection-pane-toggle-visibility-${id}"]`, `[data-testid^="selection-pane-toggle-visibility-"]`, `[data-element-type="text"]`. **Only 6 testids defined in Phase 3.** 7+ testids used in Phase 4 are NOT in Phase 3 scope. Either Phase 3 expands or Phase 4 adds them mid-flight (breaks "no scope creep").

---

## Phase 4 — Coverage: Editor Features

### Open Questions

- **Success criteria measurable?** "9 tests pass" — clear. But "schema includes element-level `hidden` boolean" is a Risk note, not a verified fact. Schema needs scout pass first.
- **Red test sufficient?** Mostly. The "paste position offsets" test asserts `after.x !== before.x` — too loose; should assert specific offset (10/20px) matching `use-clipboard.js` config.
- **Rollback?** New specs only — `git rm` is clean. OK.
- **Dependency assumption?** Phase 4 depends on `testPresentation` fixture (exists at `test-fixtures.js:123-133`) — **verified**. But Phase 4 also implicitly depends on `canvas-actions-helper.js` (Refactor step 7) which doesn't exist yet → not a Phase 4 deliverable but a Phase 7 candidate. Move?
- **User-facing decision?** `use-clipboard.js` "internal store vs navigator.clipboard" — Plan asserts internal-store. If wrong, every clipboard test breaks. Scout this before commit.
- **Config decision?** Spec uses `2000ms` smart-guide timeout. User-confirm.
- **Cross-check Phase 3 testids:** `canvas-area`, `ribbon-tab-insert`, `ribbon-tab-view`, `ribbon-insert-text`, `view-toggle-selection-pane`, `selection-pane-toggle-visibility-${id}` — **NONE listed in Phase 3 "Add testid" table**. Phase 4 silently expands selector contract.
- **Path correctness:** `SlideCanvas.jsx` is at `client/src/components/SlideCanvas.jsx`, NOT `client/src/components/canvas/SlideCanvas.jsx` (Blocking #4). Fix before execution.

---

## Phase 5 — Coverage: Export/Import/Sync

### Open Questions

- **Success criteria measurable?** "6 tests pass + no real cloud calls" — clear.
- **Red test sufficient?** PPTX export test is the strongest. Markdown test reasonable. Sync mock tests OK.
- **Rollback?** New specs + mock helpers only. Clean.
- **Dependency assumption?** Plan: "Validate JSZip is installed (`npm ls jszip`); if not, add". **Status: JSZip 3.10.1 IS installed transitively via `pptxgenjs`, `pptx2json`, `pptxtojson`, AND directly in server workspace.** But NOT at root `package.json` `devDependencies`. Tests run from root — needs explicit `devDependencies.jszip` entry to satisfy `import JSZip from 'jszip'`. Add to plan as a deliverable.
- **User-facing decision?** Sync mocks return fixed `files:12, bytes:145_678` — was 12 files/145KB the right contract? Need to spec-test against actual `server/routes/sync.js` response shape.
- **Config decision?** YES — testids invented by Phase 5: `sync-modal-dialog`, `sync-provider-proton-drive`, `sync-configure-confirm`, `sync-status-configured`, `sync-push-btn`, `sync-pull-btn`, `sync-push-result`, `sync-pull-result`, `sync-error-toast`, `settings-open-sync`, `home-import-markdown-btn`, `slide-panel-item`, `ribbon-file-export-pptx`, `ribbon-tab-file`. **14 NEW testids in scope but only 6 in Phase 3.** Either Phase 3 expands or this phase silently grows scope.
- **Rollback for sync mocks:** Mocks short-circuit `/api/sync/**` but plan never says how to verify the REAL endpoint still works. Need a follow-up smoke that hits the real sync handler in CI without rclone configured.

---

## Phase 6 — Games + Parametrize Visual

### Open Questions

- **Success criteria measurable?** "36 visual snapshots green" — measurable. But "Visual matrix coverage ≥ baseline" — what IS baseline?
- **Red test sufficient?** Game tests OK. Visual matrix tests will be red until snapshots baselined.
- **Rollback?** Could revert specs, but snapshot regeneration is destructive — once committed, prior baselines lost. Need branch protection / staging.
- **Dependency assumption?** Plan: "Layouts: from `client/src/data/element-defaults.js` LAYOUT_DEFAULTS — confirm names during impl". This is hand-wavy. Scout NOW and update plan.
- **User-facing decision (FLAGGED — was this user-confirmed?):** "3 themes × 3 transitions × 4 layouts = 36 combos" is **AI-chosen subset**. Themes hardcoded as `['black','white','league']` but full set is 9. Skips solarized/night/serif/beige/sky/simple. Layouts `['title','titleContent','twoContent','comparison']` — guess. **Was this matrix user-approved?** Per `review-audit-self-decision.md` rule 3, this is a thresholdvalue Claude picked, not user — needs user sign-off.
- **Config decision?** YES — matrix size, theme/transition/layout pick list, `maxDiffPixelRatio: 0.02` all need user confirmation.
- **Linux-only baselines:** Plan says "Linux only via config" — `playwright.config.js` does NOT currently have a Linux-only filter. Manual workflow `manual-update-playwright-visual-baselines.yml` runs on Linux but only updates `visual-regression.spec.js` snapshots (line 38). New matrix file needs new workflow step or extension of existing workflow.
- **Cross-check Phase 3:** Needs `game-hud`, `game-leaderboard`, `game-active-indicator`, `ribbon-insert-game` testids — none in Phase 3. Scope creep.

---

## Phase 7 — Fixture Migration + Architecture

### Open Questions

- **Success criteria measurable?** Filename/loc tests are clear & checkable.
- **Red test sufficient?** Yes for filename audit. The "no ad-hoc presentation creation" test uses `git grep | grep -v "fixtures/"` — case-sensitive issue on Windows? Verify across platforms.
- **Rollback?** Renames + splits are git-mv operations — reversible. OK. But "delete `ribbon-layout.spec.js`" is **destructive** if nightly workflow not updated in the SAME commit (Blocking #3).
- **Dependency assumption?** Plan dependencies field says `[2, 3]`. But Phase 7's fixture migration only really needs the fixture (which already exists at Phase 1's edit). Could it depend on `[1, 3]` instead of `[2, 3]`? Phase 2's wait-helpers are not consumed by Phase 7. Dependency 2 may be wrong.
- **User-facing decision?** Kebab-case rename — codified in CLAUDE.md, so this is policy-aligned. OK.
- **Config decision?** YES — `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` must be updated in this phase. Add as explicit deliverable. Without it, the nightly run breaks the day after merge.
- **Imports breaking on Linux CI:** Plan acknowledges Windows FS case-insensitivity risk. Good. But what about other consumers? `tests/smoke.spec.js` (referenced in CLAUDE.md commands) may import `EditorPage.js`. Grep before rename.

---

## Phase 8 — Final Regression + CI Verification

### Open Questions

- **Success criteria measurable?** Yes (CI exit 0 across 4 jobs is binary).
- **Red test sufficient?** The `plan-completion-gate.test.js` requires `gray-matter` package — not in `devDependencies`. Either add as devDep or use plain text parse.
- **Rollback?** Phase 8 doesn't change code (docs only). No rollback risk.
- **Dependency assumption?** Plan asserts CI has 4 e2e jobs (chromium/live/mobile/visual). **Verified** — `e2e-chromium` (shards 1-4), `e2e-live`, `e2e-mobile`, `e2e-visual` exist at workflow lines 59/90/117/145.
- **User-facing decision?** README + changelog updates — minor, no decision.
- **Config decision?** "Coverage % equal-or-higher" — baseline coverage NEVER measured in plan. Add baseline capture as a Phase 1 task (1 line: `npm run test:coverage > reports/baseline-coverage.txt`).

---

## Cross-Phase Cross-Checks

| Check | Status |
|---|---|
| All testids in Phase 4/5/6 defined in Phase 3? | **FAIL** — at least 25+ new testids introduced in Phase 4/5/6 not enumerated in Phase 3 |
| Phase 7 fixture migration depends on Phase 2? | **DOUBTFUL** — only the fixture (Phase 1) and Phase 3 needed. Edit Phase 7 frontmatter `dependencies: [1, 3]`. |
| Phase 6 "Linux only baselines" supported by current CI? | **PARTIAL** — Linux runner exists (`e2e-visual` job), but no testIgnore filter exists at config level. Plan needs to add `testIgnore` in Phase 6. |
| Phase 1 deletions referenced by any CI job? | **FAIL** — `visual-regression.spec.js` in `manual-update-playwright-visual-baselines.yml`; `ribbon-layout.spec.js` (Phase 7 split) in `nightly-ribbon-layout-768px...yml`. |
| Baseline metrics accurate? | **STALE** — "34 waitForTimeout in 17 files" outdated; current is ~17 occurrences in 10 files |

---

## Decisions Needed Before Execution

1. **Phase 1 deletions:** confirm with user that `elements.spec.js`, `slides.spec.js`, `export.spec.js` should be deleted DESPITE having real assertions, or kept (rewrite as proper specs instead). Default: KEEP all 4 specs; rewrite Phase 1 to only delete after equivalent coverage proven elsewhere.
2. **Phase 1 visual-regression.spec.js:** delete only AFTER updating `manual-update-playwright-visual-baselines.yml:38,45,53` in the same commit. Make this an explicit deliverable.
3. **Phase 1 helper rename:** correct `apiCreateShareToken` → `apiRevokeShareToken` everywhere in plan.
4. **Phase 2 instrumentation gate:** swap `import.meta.env.MODE === 'test'` for `VITE_E2E === '1'` flag (or equivalent). Confirm with user that adding `__lastAnnotation` window prop is acceptable.
5. **Phase 2 polling defaults:** user-confirm `intervals:[250], timeout:10_000` (4Hz × 10s) — too aggressive? Too lenient?
6. **Phase 3 testid name scope:** expand Phase 3 to cover EVERY testid used in Phases 4/5/6 (~25 more). Otherwise Phase 4/5/6 become "Phase 3 part 2".
7. **Phase 4 file path:** correct `components/canvas/SlideCanvas.jsx` → `components/SlideCanvas.jsx` everywhere in plan.
8. **Phase 5 JSZip:** add `jszip` to root `devDependencies` as explicit Phase 5 deliverable (not "verify if installed").
9. **Phase 5 sync mock contract:** add a server-side test that the REAL `/api/sync/*` handlers produce shapes matching the mock. Otherwise mocks drift silently.
10. **Phase 6 matrix size & content:** confirm `3×3×4=36` AI-picked subset is correct, OR get user pick. Confirm specific theme/transition/layout names against `client/src/data/themes.js` + `client/src/data/element-defaults.js` (scout first).
11. **Phase 6 Linux-only filter:** add explicit `testIgnore` for `themes-transitions-layouts-matrix.spec.js` on non-Linux runners.
12. **Phase 7 nightly workflow:** update `nightly-ribbon-layout-768px-...yml` in the SAME commit as `ribbon-layout.spec.js` split. Currently it greps `--grep "768px"`; new structure may need 7 invocations or one against the new `ribbon/` dir.
13. **Phase 7 dependency:** change `dependencies: [2, 3]` → `[1, 3]`. Phase 2 is not actually a blocker.
14. **Phase 8 baseline metrics:** add "capture baseline coverage % + wallclock" as a Phase 1 deliverable so Phase 8 has a real comparison point.
15. **Plan-wide rule 3 check (user-confirmed values):** verify with user — were `36 visual combos`, `200 LOC spec ceiling`, `250ms poll interval`, `5% wallclock budget`, `0.02 maxDiffPixelRatio` all USER-confirmed, or AI-chosen? Per `review-audit-self-decision.md` §3, AI-chosen numeric thresholds need explicit user sign-off.

---

## Unresolved Questions

- Does user want to keep `tests/e2e/elements/slides/export.spec.js` (rewrite into proper specs) or delete and rely on Phase 4-6 coverage to replace? (My recommendation: KEEP — they assert real behaviour.)
- Are `data-testid` props acceptable in prod bundle (180-byte cost)? Reviewer/sec OK?
- Is the AI-chosen visual matrix (3×3×4) acceptable, or does user want all 9 themes × 6 transitions × full layouts?
- Should `mobile/`, `a11y/`, `visual/` directories be IN the `chromium` project (current behavior) or OUT (proposed `testIgnore` over-matches)?
- For Phase 6's Linux-only filter, is it OK to add a NEW project (`chromium-visual`, Linux-only) instead of editing `testIgnore`?
