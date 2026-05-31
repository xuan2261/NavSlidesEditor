---
type: brainstorm-report
topic: test-system-review-and-roadmap
created: 2026-05-31
scope: research-only
status: proposed
---

# Test System Review And Roadmap

## Summary

NavSlides Editor already has a serious multi-layer test system: Vitest, Playwright, k6, PPTX corpus/browser audit, visual regression, feature coverage matrix, and CI fan-in gate. Current weakness is not "lack of tests" in general. Current weakness is test governance drift after plan archiving and hard-coded report paths.

Recommendation: fix governance breakage first, then close the 10 allowlisted feature-coverage debts. Do not start a broad test platform overhaul yet.

## Evidence

| Command | Result | Notes |
|---|---|---|
| `npm run matrix:gate` | PASS | 90/100 verified, 10 allowlisted warnings, 0 failures |
| `npm run test:coverage` | FAIL | 2200/2202 tests passed; failure from missing plan/report paths and one skipped suite evaluated too early |
| Scout file count | 359 test/spec files | `client` 140, `server` 54, `shared` 16, `scripts` 14, `tests/e2e` 106, `tests/unit` 29 |

Observed `test:coverage` failures:

- `tests/unit/github-actions-ci-release-confidence-contract.test.js` expects `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/ci-gate-verification.md`, but plan appears archived under `plans/archive/...`.
- `tests/unit/release-verification-docs-contract.test.js` expects `release-verification-summary.md` at the old top-level plan path.
- `tests/unit/plan-completion-gate.test.js` calls `readdirSync(PLAN_DIR)` inside the `describe.skipIf` callback body before skip prevents evaluation, so missing archived plan dir fails collection.

## Current Strengths

- CI covers lint, unit coverage, build, Playwright Chromium shards, live, mobile a11y, visual regression, PPTX corpus, k6 smoke, and required checks summary.
- E2E infra has run-level data isolation and loopback guard for destructive API helpers.
- Feature coverage matrix is better than raw line coverage because it maps behavior to capability IDs.
- Critical journeys are documented: create/edit/persist, share password/revoke, insert/format/export, live reconnect, PPTX import/edit/export, AI failure handling.
- Visual baseline process is clear: Linux Playwright Docker image only, with GitHub Actions fallback.
- Test docs are unusually strong for this project size.

## Findings

### P0 - Full Coverage Gate Broken By Archived Plan Paths

This is the top issue. Tests should not fail because historical plan reports were moved into `plans/archive/`. A release-confidence contract can reference archived reports, but it must use stable path resolution or evergreen docs.

Impact:

- Local `npm run test:coverage` cannot be trusted as green.
- CI `unit-coverage` likely fails if same tree state is pushed.
- Developers may waste time debugging app code while failure is documentation path drift.

Recommended fix:

- Update tests to resolve plan reports from either active or archived path, or better, assert against evergreen docs under `docs/`.
- For generated/release evidence reports, do not hard-code top-level plan directories after plans are allowed to archive.
- Fix `plan-completion-gate.test.js` so all filesystem reads happen inside `it` or guarded setup only when `RUN_PLAN_GATE` is set.

### P1 - Feature Coverage Gate Is Warn-First With 10 Known Debts

`matrix:gate` passes but has 10 allowlisted warnings:

- `canvas.lock`
- `canvas.move`
- `command.insertLink`
- `command.insertSlide`
- `command.startSlideshow`
- `control.file.menu`
- `shortcut.eraseAnnotations`
- `shortcut.highlighterTool`
- `shortcut.laserPointer`
- `shortcut.penTool`

This is acceptable short-term. It becomes risky if the allowlist remains static while features change.

Recommended fix:

- Keep warn-first until P0 is fixed.
- Then close debts in two focused batches:
  - Batch 1: command/file-menu seams.
  - Batch 2: canvas move/lock and annotation shortcut wiring.
- Keep the allowlist shrinking. Do not add new allowlist entries without owner, target layer, and expiry.

### P1 - Report/Docs Contracts Depend On Temporal Artifacts

Some tests assert plan-scoped reports directly. That is brittle because `plans/` is operational history, not stable product documentation.

Recommended fix:

- Move final release-confidence facts into evergreen docs:
  - `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
  - `docs/critical-user-journeys.md`
  - `docs/manual-smoke-checklist.md`
  - `docs/feature-coverage-matrix.md`
- Tests should assert evergreen docs contain required release facts.
- Plan reports can remain evidence, but not the single required path.

### P2 - Raw Coverage Is Secondary Signal

The repo has many UI and integration-heavy flows. Chasing 80% line coverage globally now would be inefficient and may create brittle render tests.

Recommended approach:

- Keep current threshold as anti-regression, not a vanity target.
- Raise thresholds only after meaningful unit seams are extracted.
- Prefer capability matrix + critical journeys over raw line coverage.

### P2 - Playwright Per-Worker Isolation Is Deferred Correctly

Docs note run-level isolation only; workers share one data root. Current fixture strategy uses unique presentation IDs. This is okay unless flakes show shared-state collision.

Recommendation:

- Do not build per-worker server pairs now.
- Revisit only if CI flakes point to shared state.

### P2 - External Provider Coverage Should Stay Contract-Only

AI, rclone, GitHub push, and external sync should not require real credentials in CI.

Recommendation:

- Keep contract/local failure tests.
- Add hermetic adapter tests only when provider abstraction changes.
- Manual smoke remains the right release gate for external credentials.

## Evaluated Approaches

### Approach A - Governance Fix First

Fix hard-coded plan/report path drift and skipped-suite collection bug before expanding tests.

Pros:

- Smallest scope.
- Unblocks full coverage gate.
- Directly addresses current red suite.
- Preserves existing architecture.

Cons:

- Does not increase capability count immediately.

Verdict: recommended.

### Approach B - Coverage Expansion First

Close all 10 allowlisted capability debts.

Pros:

- Moves matrix from 90/100 toward 100/100.
- Improves behavior confidence.

Cons:

- Leaves full coverage red.
- Risks expanding test volume while governance is broken.

Verdict: do after Approach A.

### Approach C - Test Platform Overhaul

Add per-worker isolated servers, dashboards, quarantine automation, ownership service, and broader lane taxonomy.

Pros:

- More enterprise-grade.

Cons:

- Too much for current evidence.
- Higher maintenance.
- Violates YAGNI until flakes/runtime prove need.

Verdict: reject for now.

## Recommended Roadmap

### Phase 1 - P0 Test Governance Repair

Goal: make `npm run test:coverage` pass again without weakening assertions.

Tasks:

1. Fix `plan-completion-gate.test.js` so missing plan dir cannot fail when `RUN_PLAN_GATE` is unset.
2. Update release-confidence docs contract tests to use archived plan paths or evergreen docs.
3. Update docs references that still point to moved top-level plan reports.
4. Run `npm run test:coverage`.
5. Run `npm run matrix:gate`.

Success criteria:

- `npm run test:coverage` pass.
- `npm run matrix:gate` pass.
- No test relaxed to hide real release-confidence requirements.

### Phase 2 - Close 10 Feature Matrix Debts

Goal: reduce allowlist from 10 to 0 or near 0 through real seams/tests.

Tasks:

1. Extract command handlers from `EditorPage` where tests currently cite inline closures.
2. Add focused unit/component tests for `command.insertLink`, `command.insertSlide`, `command.startSlideshow`, `control.file.menu`.
3. Add canvas lock/move tests at the lowest stable layer.
4. Add annotation shortcut wiring tests for pen/highlighter/laser/erase.
5. Regenerate matrix and remove resolved allowlist entries.

Success criteria:

- `matrix:gate` reports fewer or zero ALLOWED warnings.
- No new brittle full-page tests where pure/unit tests are possible.

### Phase 3 - Release Lane Hygiene

Goal: keep CI useful without making PRs too slow.

Tasks:

1. Keep feature coverage gate warn-first until two consecutive green CI runs after Phase 1.
2. Promote only after evidence, not before.
3. Keep branch protection requiring `required-checks`, not every shard.
4. Keep manual smoke checklist under 45 minutes.

Success criteria:

- PR lane remains practical.
- Merge lane catches regressions.
- Release strict lane remains documented and bounded.

## What Not To Do

- Do not chase global 80% coverage now.
- Do not add more Playwright tests for logic that can be unit-tested.
- Do not make external AI/sync/GitHub tests require real credentials in CI.
- Do not build per-worker Playwright servers until shared-state flakes are proven.
- Do not keep tests coupled to movable `plans/` paths unless the path resolver supports archive.

## Proposed Next Step

Use `/ck:plan --tdd` for Phase 1 only:

```text
/ck:plan --tdd plans/reports/260531-1908-test-system-review-and-roadmap.md
```

Reason: this is a test-system refactor/fix, and current behavior should be locked before editing tests/docs.

## Unresolved Questions

- None.
