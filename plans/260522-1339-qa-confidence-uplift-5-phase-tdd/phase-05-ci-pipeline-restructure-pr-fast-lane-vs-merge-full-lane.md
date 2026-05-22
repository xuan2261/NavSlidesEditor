---
phase: 5
title: "CI Pipeline Split (PR fast lane / merge full lane) — MVP-lite"
status: pending
priority: P2
effort: "1.5d"
dependencies: [1, 2]
---

# Phase 5-lite: CI Pipeline Split — PR Fast Lane vs Merge Full Lane (MVP)

## Overview

CI hiện chạy **tất cả** (lint, unit-coverage, build, 4-shard chromium E2E, live, mobile a11y, visual, pptx-corpus, k6 smoke) trên MỌI PR → ~30 phút wall-clock cho mọi feedback. MVP-lite tách thành 2 lane:

- **PR fast lane** (≤ 15 phút wall-clock): lint + unit + build + smoke (5 GP via `@smoke`) + Electron smoke (gated by changed paths)
- **Merge full lane** (≤ 30 phút): everything else (4-shard chromium E2E, live, mobile a11y, visual, pptx-corpus, load smoke)

**DEFERRED** to follow-up plan: nightly cross-browser (webkit + firefox), reusable workflow extract, README CI badges, coverage-ratchet job (depends on Phase 4 which is also deferred).

Block merge bằng required-checks group "PR-gate"; full lane chạy sau merge, fail → revert.

## Requirements

**Functional:**
- Split `github-actions-ci-pipeline-...yml` thành 2 workflow file:
  - `ci-pr-fast-lane.yml` — trigger `pull_request`
  - `ci-merge-full-lane.yml` — trigger `push` to master/main
- 5 GP spec (Phase 1) marked với `@smoke` annotation, run in PR fast lane only via `--grep @smoke`
- Required-checks GitHub branch protection rules updated qua API call documented trong PR description
- Electron smoke (Phase 2) wired into PR fast lane (path-filtered: only run when `electron/**` or `server/**` or `client/**` changed)

**Non-functional:**
- PR lane median ≤ 15 phút (measure trên 10 PR sau merge — loosened from 12 per technical red-team feedback)
- Full lane median ≤ 30 phút
- No regression in test detection: full lane phải catch tất cả issue CI hiện catch

**Deferred (follow-up plan):**
- `ci-nightly-cross-browser.yml` (webkit + firefox)
- Webkit + firefox project additions to `playwright.config.js`
- Reusable workflow `_reusable-playwright-shard.yml`
- README CI badges
- `coverage-ratchet` CI job (blocked on Phase 4 coverage roadmap, also deferred)

## Architecture

```
.github/workflows/
├── ci-pr-fast-lane.yml              # NEW — gates PR merge
├── ci-merge-full-lane.yml           # NEW — post-merge sanity
├── release.yml                      # UNCHANGED (already separate)
├── nightly-ribbon-layout-...yml     # UNCHANGED (already separate)
├── manual-update-playwright-...yml  # UNCHANGED
└── website-deploy-github-pages.yml  # UNCHANGED

(DELETED): github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml
```

**Job topology — PR fast lane:**

```
┌─ lint ──────────┐
├─ unit-coverage ─┤
├─ build ─────────┼─► smoke-e2e (--grep @smoke, 5 GP only)
│                 │
│                 ├─► electron-smoke (only if electron/server/client paths changed)
│                 │
│                 └─► pr-required-checks (aggregate)
```

**Job topology — Merge full lane:**

```
build ──┬─► e2e-chromium (4 shards)
        ├─► e2e-live
        ├─► e2e-mobile-a11y
        ├─► e2e-visual
        ├─► pptx-corpus
        └─► load-smoke
                │
                ▼
         post-merge-summary (notify Issue on failure)
```

**Branch protection rules (require update via GitHub API):**

Required checks for `master`:
- `pr-required-checks` (aggregate from PR fast lane)
- Remove old `required-checks`

Rollout sequence: add new check `pr-required-checks` parallel với old check → 1 week observation, no PR stranded → remove old `required-checks`. Documented in PR description.

## Related Code Files

**Create:**
- `.github/workflows/ci-pr-fast-lane.yml`
- `.github/workflows/ci-merge-full-lane.yml`
- `tests/unit/qa-foundation/ci-workflow-pr-fast-lane-job-list.test.js`
- `tests/unit/qa-foundation/ci-workflow-merge-full-lane-covers-all-previous-jobs.test.js`
- `docs/ci-pipeline-architecture.md`

**Delete:**
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`

**Modify:**
- 5 GP specs (Phase 1) → add `@smoke` tag using CORRECT Playwright syntax: `test('GP-01 create-edit-persist', { tag: '@smoke' }, async ({page}) => {...})` per [Playwright annotations docs](https://playwright.dev/docs/test-annotations#tag-tests). The `test.describe.configure({tag})` pattern does NOT exist — `describe.configure()` accepts `mode/retries/timeout` only.
- `docs/codebase-summary.md` (link new CI doc)

**Read for context:**
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` (current monolithic file)
- `.github/workflows/release.yml` (already-split pattern to follow)

**Deferred (follow-up plan):**
- `.github/workflows/ci-nightly-cross-browser.yml`
- `.github/workflows/_reusable-playwright-shard.yml`
- `tests/unit/qa-foundation/ci-workflow-nightly-has-cross-browser-projects.test.js`
- `playwright.config.js` webkit + firefox project additions
- README CI badges

## Implementation Steps (TDD)

### Red — Failing contract tests

1. **Test: PR fast lane workflow exists + has expected jobs**
   - Spec: parse `ci-pr-fast-lane.yml`, assert jobs include `lint`, `unit-coverage`, `build`, `smoke-e2e`, `electron-smoke`, `pr-required-checks`
   - Assert `pr-required-checks` has `needs: [...]` covering all above
   - Run → **FAIL**
   - Commit: `red: phase-5 add failing test for PR fast lane workflow shape`

2. **Test: merge full lane covers all previous monolithic jobs**
   - Spec: parse old workflow + new `ci-merge-full-lane.yml`
   - Assert: every job name từ old workflow (except those moved to PR lane) tồn tại trong full lane
   - Assert: `e2e-chromium` still 4-shard matrix
   - Run → **FAIL**
   - Commit: `red: phase-5 add failing test for full-lane job coverage`

### Green — Implement workflows

3. **Tag 5 GP specs with `@smoke`** (CORRECT Playwright syntax)
   - Edit each GP spec → wrap `test(...)` with `{ tag: '@smoke' }` option:
     ```js
     test('GP-01 create-edit-persist', { tag: '@smoke' }, async ({page}) => {...})
     ```
   - **NOT** `test.describe.configure({tag: '@smoke'})` — that API does not exist
   - Verify locally: `npx playwright test --grep @smoke` runs exactly 5 (or close, allowing for multi-test specs)
   - Commit: `green: phase-5 tag 5 golden-path specs with @smoke`

4. **Write `ci-pr-fast-lane.yml`**
   - Trigger: `pull_request: branches: [master, main]`
   - Jobs: lint, unit-coverage, build, smoke-e2e (`--grep @smoke`), electron-smoke (with `paths` filter for `electron/**`, `server/**`, `client/**`), pr-required-checks
   - Target wall-clock: ≤ 15 phút
   - Add `actionlint` step at top (cheap ~2s, catches YAML syntax errors)
   - Test 1 **PASS**
   - Commit: `green: phase-5 add PR fast lane workflow`

5. **Write `ci-merge-full-lane.yml`**
   - Trigger: `push: branches: [master, main]`
   - Jobs: build → (e2e-chromium 4-shard, e2e-live, e2e-mobile-a11y, e2e-visual, pptx-corpus, load-smoke)
   - Add `post-merge-summary` step: if any fail, `gh issue create --label post-merge-failure`
   - Test 2 **PASS**
   - Commit: `green: phase-5 add merge full lane workflow`

6. **Delete old workflow + update branch protection**
   - `git rm .github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`
   - Document `gh api repos/{owner}/{repo}/branches/master/protection ...` command trong PR description (manual step — requires admin)
   - Rollout: add new `pr-required-checks` parallel với existing `required-checks` for 1 week → confirm zero PR stranded → remove old
   - Commit: `chore: phase-5 remove monolithic CI workflow superseded by fast/full split`

### Refactor

7. **Write `docs/ci-pipeline-architecture.md`**
   - Section: Job topology diagrams (fast lane, full lane)
   - Section: When each lane runs (trigger, jobs, expected wall-clock)
   - Section: How to debug a failure (log location, artifact retention)
   - Section: Runbook for `post-merge-failure` issue auto-creation
   - Section: Deferred items (nightly cross-browser, reusable workflow, badges) with pointer to follow-up plan
   - Commit: `refactor: phase-5 add CI pipeline architecture doc`

8. **Update `docs/codebase-summary.md`** to link new CI doc
   - Commit: `docs: phase-5 link CI architecture from codebase summary`

## Todo List

- [ ] Failing test: PR fast lane shape (red)
- [ ] Failing test: full lane coverage (red)
- [ ] Tag 5 GP specs with @smoke (green) — use `test('...', { tag: '@smoke' }, ...)` syntax
- [ ] Write ci-pr-fast-lane.yml (green) — include actionlint step
- [ ] Write ci-merge-full-lane.yml (green) — include post-merge-failure issue auto-create
- [ ] Delete old monolithic workflow (green)
- [ ] Document branch protection update commands (manual admin step)
- [ ] Write docs/ci-pipeline-architecture.md (refactor)
- [ ] Update codebase-summary.md (refactor)
- [ ] Measure 10 PR sample for PR lane median wall-clock
- [ ] Verify branch protection update applied (gh api dry-run)

## Success Criteria

- [ ] PR fast lane median ≤ 15 phút (measure 10 consecutive PR sau merge)
- [ ] Merge full lane median ≤ 30 phút
- [ ] Branch protection updated: `pr-required-checks` is the only required status check (after 1-week parallel rollout)
- [ ] All previous CI jobs still run (no detection regression) — verify by simulated bug PR
- [ ] `npx playwright test --grep @smoke` runs exactly the 5 revised golden paths
- [ ] `actionlint` step catches YAML syntax errors before fast lane completes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Branch protection misconfig blocks all merges | L | H | Test on protected branch sandbox first; document rollback command. **Rollout:** add new check `pr-required-checks` first → run parallel với old `required-checks` 1 week → confirm no in-flight PR stranded → remove old |
| @smoke tag drift (specs untagged) | M | M | Phase 1 GP doc has spec→GP mapping; CI step validates @smoke count ≥ 5 |
| Post-merge full-lane fail không ai notice | M | H | Auto-issue on failure (label `post-merge-failure`); require triage SLA 24h |
| Duplicate workflow run cost (PR + merge after squash) | L | L | Acceptable trade-off for faster feedback |
| `actionlint` not run → YAML syntax errors slip in | M | M | Add `actionlint` step to PR fast lane (cheap, ~2s) |
| Electron smoke path filter too narrow misses real failure | M | M | Include `client/**` + `server/**` + `electron/**` + `package.json` in filter — broad enough to catch dependency changes |

## Security Considerations

- Workflow files exposed publicly — KHÔNG embed token/secret
- Auto-issue creation requires `issues: write` permission (precedent in existing `nightly-ribbon-...yml`)
- Branch protection changes audited via gh API + commit message

## Open Questions

1. Squash merge vs merge commit: PR squash → 1 commit pushed → 1 full-lane run. Merge commit → 2 commits → 2 runs. Standard hiện tại? (Verify in repo settings)
2. Auto-issue spam threshold: tạo issue mỗi lần fail, hay aggregate sau 3 consecutive fail? (Recommend: aggregate sau 3 to reduce noise)
3. Branch protection: ai có quyền update? Hiện chỉ admin — Phase 5 cần admin coordination

## Next Steps

- Sau Phase 5-lite: monitor 2 sprint, calibrate timing budget
- **Follow-up plan** sẽ thêm:
  - Nightly cross-browser workflow (webkit + firefox + iOS Safari)
  - Reusable workflow `_reusable-playwright-shard.yml` (DRY between lanes)
  - README CI badges
  - `coverage-ratchet` CI job (depends on Phase 4 coverage roadmap)
  - Linux Electron build job (currently Windows-only) → cross-platform smoke
