---
title: "Upstream Baseline Report"
date: 2026-05-23
status: upstream-baseline-failed
phase: 1
---

# Upstream Baseline Report

## Summary

Phase 1 oracle approval is complete, and the approved upstream worktree was
created at immutable SHA `ce548c535abc7701ac45cc3164560caba121adce`. Current
repo baseline passes, but upstream baseline setup/build is not release-ready:
deterministic install passed, then upstream build failed because the approved
upstream dependency set is not buildable on this Windows environment without
dependency workarounds.

## Hard Gate

| Gate | Status | Evidence |
|---|---|---|
| Upstream remote exists | Pass | `upstream` fetch URL is `https://github.com/jbirky/parallax-presentations.git`; push URL disabled as `DISABLED-PUSH-URL` |
| Candidate immutable upstream SHA | Pass | `upstream/main` resolves to `ce548c535abc7701ac45cc3164560caba121adce` |
| Approved immutable upstream SHA | Pass | `upstream-oracle-approval-record.md` status is `approved` |
| Named approver | Pass | `Xuan`, `Project owner` |
| Approval date | Pass | `2026-05-23` |
| SHA change policy | Pass | Recorded in `upstream-oracle-approval-record.md` |
| Upstream worktree | Pass | `C:\Work\NavSlidesEditor-upstream` at `ce548c535abc7701ac45cc3164560caba121adce` |
| Upstream baseline run | Fail | `npm ci --ignore-scripts` passed; `npm run build` failed in approved upstream dependency set |

Approval artifact: `upstream-oracle-approval-record.md`.
Adapter design artifact: `upstream-adapter-harness-design.md`.

## Historical Candidate Context

Prior upstream comparison artifacts reference a likely upstream source, but this
is not approval for the parity oracle:

| Source | Candidate | Evidence |
|---|---|---|
| `plans/260514-1045-upstream-main-selective-port-workflow/plan.md` | Remote `https://github.com/jbirky/parallax-presentations.git`, branch `upstream/main` | Historical selective-port workflow, complete |
| `plans/reports/xia-compare-260519-parallax-presentations.md` | `main` at `ce548c535abc7701ac45cc3164560caba121adce` | Historical comparison snapshot |

Historical candidates are not approval records. The approved oracle for this
plan is recorded in `upstream-oracle-approval-record.md`.

## Candidate Upstream Snapshot

| Item | Value |
|---|---|
| Fetch URL | `https://github.com/jbirky/parallax-presentations.git` |
| Push URL | `DISABLED-PUSH-URL` |
| Candidate branch | `upstream/main` |
| Candidate SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Commit date | `2026-05-15 00:21:07 -0700` |
| Commit subject | `add line-arrow shape: stroke-only arrow with no fill` |
| Additional fetched refs | `upstream/dev` = `1220c59dd2d66a1a46defa5f0bbca85564078a56`; `upstream/feature/grid-and-axis-tools` = `231135f212f9cac1abb8e263d504d301f52bbd29`; `upstream/saas-migration` = `2a6e0077444e3ea1c3552c5ca0be561d1ff646a9` |

Candidate verification was refreshed on `2026-05-23T09:53:20.7475650+07:00`.
`git fetch upstream --prune` succeeded, `upstream/main` still resolved to
`ce548c535abc7701ac45cc3164560caba121adce`, and `git ls-remote` confirmed the
remote `main` ref currently points to the same SHA. This candidate was approved
later in the session; the approval record is the source of truth.

Candidate tooling comparison before any upstream install:

| File / capability | Current repo | Candidate upstream | Impact |
|---|---|---|---|
| Root `package.json` | Yes, version `1.9.4`, workspaces `server/client/shared/website` | Yes, version `1.0.0`, workspaces `server/client` | Commands are not equivalent without adapter |
| `package-lock.json` | Yes | Yes | Diff review required before install |
| `playwright.config.js` | Yes | No | Current E2E suite cannot be run unchanged on upstream |
| `vitest.config.mjs` | Yes | No | Current Vitest suite cannot be run unchanged on upstream |
| `tests/e2e` | Yes | No | Upstream browser parity needs an external/shared smoke harness |

Pre-approval candidate snapshot command
`git diff --shortstat HEAD..upstream/main -- package.json package-lock.json playwright.config.js vitest.config.mjs`
reported the following when `upstream/main` resolved to
`ce548c535abc7701ac45cc3164560caba121adce`:

```text
4 files changed, 5916 insertions(+), 15692 deletions(-)
```

Do not reuse this floating branch expression after approval. Post-approval
tooling diffs must use the approved immutable SHA or approved worktree `HEAD`.

## Current Repo Snapshot

| Item | Value |
|---|---|
| Worktree | `C:\Work\NavSlidesEditor` |
| Branch | `master` |
| Current HEAD | `643224ac8e2952a8a41e9fdc9c2303b8985e0a67` |
| Origin | `https://github.com/xuan2261/NavSlidesEditor` |
| Candidate upstream | `https://github.com/jbirky/parallax-presentations.git` |
| Node | `v22.22.0` |
| npm | `11.8.0` |
| Lockfile SHA-256 | `59BC6730D177588034EC0DF75CF795E0D09F860EC019A8C560A8C8779F351FEB` |
| `node_modules` present | Yes |
| `package-lock.json` present | Yes |
| Playwright config | `playwright.config.js` |
| Vitest config | `vitest.config.mjs` |

## Script Availability

| Command | Status | Notes |
|---|---|---|
| `npm run build` | Available | Client Vite build |
| `npm run lint` | Available | ESLint repo-wide |
| `npm test` | Available | Vitest |
| `npm run test:e2e` | Available | Playwright with isolated run data |
| `npm run test:corpus` | Available | PPTX corpus strict roundtrip |
| `npm run test:load:api` | Available | Requires local `k6` |
| `npm run test:load:ws` | Available | Requires local `k6` |

## PowerShell Command Map

Use only after the upstream SHA is approved.

```powershell
# Current repo metadata
git remote -v
git branch --show-current
git rev-parse HEAD
node -v
npm -v
Get-FileHash package-lock.json -Algorithm SHA256

# Configure upstream only if missing or different after source-of-truth URL is approved
git remote get-url upstream
git remote add upstream <approved-upstream-url>
git remote set-url --push upstream DISABLED-PUSH-URL
git fetch upstream
git rev-parse <approved-upstream-ref>

# Create immutable oracle worktree
git worktree add ..\NavSlidesEditor-upstream <approved-upstream-sha>

# Deterministic install, after package/lockfile review
npm ci --ignore-scripts
npm run build
npm run lint
npm test
npm run test:e2e

# Upstream equivalent adapter, after approval and script/config diff review
Push-Location ..\NavSlidesEditor-upstream
npm ci --ignore-scripts
npm run build
# Candidate upstream does not currently expose lint/test/e2e scripts or
# Playwright/Vitest config. Do not copy current-repo commands here.
# Define an adapter smoke/parity harness after approval and tooling review.
Pop-Location
```

## Current Baseline Runs

| Command | Status | Evidence |
|---|---|---|
| `npm run build` | Pass | Vite build completed in 15.58s; existing chunk-size warning only |
| `npm run lint` | Pass | 0 errors, 96 warnings |
| `npm test` | Pass | 148 files passed; 1301 passed, 1 skipped; 303.17s |
| `npm run test:e2e` | Pass | 392 passed, 17 skipped; 4.1m |
| `npm run test:corpus` | Pass | 4/4 PPTX files passed; avg semantic 98.0%, avg round-trip 99.0% |

## Current Baseline Evidence

| Command | Start | End | Exit | Log | Status |
|---|---:|---:|---:|---|---|
| `npm run build` | `2026-05-23T08:53:08.5280723+07:00` | `2026-05-23T08:53:25.7411395+07:00` | 0 | `reports/baseline-logs/20260523-085308-npm-run-build.log` | `reports/baseline-logs/20260523-085308-npm-run-build.status.txt` |
| `npm run lint` | `2026-05-23T08:53:25.8120342+07:00` | `2026-05-23T08:53:48.6057394+07:00` | 0 | `reports/baseline-logs/20260523-085325-npm-run-lint.log` | `reports/baseline-logs/20260523-085325-npm-run-lint.status.txt` |
| `npm test` | `2026-05-23T08:53:48.6628819+07:00` | `2026-05-23T08:58:51.6207489+07:00` | 0 | `reports/baseline-logs/20260523-085348-npm-test.log` | `reports/baseline-logs/20260523-085348-npm-test.status.txt` |
| `npm run test:e2e` | `2026-05-23T08:58:51.6788737+07:00` | `2026-05-23T09:03:01.6731656+07:00` | 0 | `reports/baseline-logs/20260523-085851-npm-run-test-e2e.log` | `reports/baseline-logs/20260523-085851-npm-run-test-e2e.status.txt` |
| `npm run test:corpus` | `2026-05-23T09:03:01.7337757+07:00` | `2026-05-23T09:04:52.4099018+07:00` | 0 | `reports/baseline-logs/20260523-090301-npm-run-test-corpus.log` | `reports/baseline-logs/20260523-090301-npm-run-test-corpus.status.txt` |

Post-command dirty status is recorded in each `.status.txt` file. The repeated
dirty status after baseline runs is limited to these known workspace changes:

```text
 M README.md
 M docs/codebase-summary.md
 M docs/project-changelog.md
 M docs/project-roadmap.md
?? .claude/
?? plans/260523-0500-upstream-parity-verification-tdd/
```

No runtime source file change was generated by the baseline commands.

## Current Baseline Fixes Applied

The first full Vitest run failed two release-readiness contract assertions
because release-facing docs lagged behind root `package.json` version `1.9.4`.
The following docs were aligned, then the targeted contract and full Vitest
suite passed:

- `README.md`
- `docs/codebase-summary.md`
- `docs/project-roadmap.md`
- `docs/project-changelog.md`

## Approved Upstream Baseline Evidence

| Command | Start | End | Exit | Log | Status |
|---|---:|---:|---:|---|---|
| `npm ci --ignore-scripts` | `2026-05-23T10:10:54.0373431+07:00` | `2026-05-23T10:11:52.0581219+07:00` | 0 | `reports/baseline-logs/20260523-101054-upstream-npm-ci-ignore-scripts.log` | `reports/baseline-logs/20260523-101054-upstream-npm-ci-ignore-scripts.status.txt` |
| `npm run build` | `2026-05-23T10:12:09.5847334+07:00` | `2026-05-23T10:12:11.0689506+07:00` | 1 | `reports/baseline-logs/20260523-101209-upstream-npm-run-build.log` | `reports/baseline-logs/20260523-101209-upstream-npm-run-build.status.txt` |
| `npm install --ignore-scripts --no-save --package-lock=false @rollup/rollup-win32-x64-msvc@4.59.0` | `2026-05-23T10:34:50.6288090+07:00` | `2026-05-23T10:35:30.7260204+07:00` | 1 | `reports/baseline-logs/20260523-103450-upstream-install-rollup-native-workaround.log` | `reports/baseline-logs/20260523-103450-upstream-install-rollup-native-workaround.status.txt` |
| `npm install --ignore-scripts --no-save --package-lock=false --legacy-peer-deps @rollup/rollup-win32-x64-msvc@4.59.0` | `2026-05-23T10:35:56.3411278+07:00` | `2026-05-23T10:36:30.0838022+07:00` | 0 | `reports/baseline-logs/20260523-103556-upstream-install-rollup-native-workaround-legacy-peer-deps.log` | `reports/baseline-logs/20260523-103556-upstream-install-rollup-native-workaround-legacy-peer-deps.status.txt` |
| `npm run build` after Rollup workaround | `2026-05-23T10:36:46.3966599+07:00` | `2026-05-23T10:37:00.7300908+07:00` | 1 | `reports/baseline-logs/20260523-103646-upstream-npm-run-build-after-rollup-workaround.log` | `reports/baseline-logs/20260523-103646-upstream-npm-run-build-after-rollup-workaround.status.txt` |
| Clean worktree `npm ci --ignore-scripts --include=optional` | `2026-05-23T10:44:05.9158430+07:00` | `2026-05-23T10:44:28.0959812+07:00` | 0 | `reports/baseline-logs/20260523-104405-upstream-clean-npm-ci-ignore-scripts-include-optional.log` | `reports/baseline-logs/20260523-104405-upstream-clean-npm-ci-ignore-scripts-include-optional.status.txt` |
| Clean worktree `npm run build` after include optional | `2026-05-23T10:45:03.8824399+07:00` | `2026-05-23T10:45:05.3161139+07:00` | 1 | `reports/baseline-logs/20260523-104503-upstream-clean-npm-run-build-after-include-optional.log` | `reports/baseline-logs/20260523-104503-upstream-clean-npm-run-build-after-include-optional.status.txt` |

Deterministic upstream install passed but reported 26 vulnerabilities. The
first upstream build failed before product bundling because Rollup could not
load optional native package `@rollup/rollup-win32-x64-msvc`; the lockfile only
references it as a Rollup optional dependency and did not materialize that
package under `node_modules/@rollup`.

The same failure reproduced in a fresh verification worktree
`C:\Work\NavSlidesEditor-upstream-clean` using
`npm ci --ignore-scripts --include=optional`. That install exited 0 but recorded
`rollupNativePresent=False`, and the following `npm run build` failed with the
same missing Rollup native package error. This makes the first failure
reproducible from a clean checkout and not a stale `node_modules` artifact.

A controlled no-save/no-lockfile workaround installed the Rollup native package
only after the deterministic failure was recorded. The first workaround failed
with an upstream TipTap peer dependency conflict. Retrying with
`--legacy-peer-deps` installed the package, but the build still failed because
`@tiptap/extension-highlight` imported `getStyleProperty` from `@tiptap/core`
and the installed upstream dependency set did not export it.

Do not treat the workaround build as parity evidence. It is diagnostic evidence
that the approved upstream cannot currently produce a passing build on this
Windows/npm/Node environment without changing dependency resolution.

## Recommendation

Keep the approved SHA unchanged. Do not patch upstream dependencies inside the
oracle worktree. For Phase 2, the least misleading path is to create future
matrix rows with upstream automation evidence marked `Blocked` where the
approved upstream cannot build, and require either manual oracle evidence or an
explicit signed waiver before any MVP P0 row can be considered release-ready.
No `Pass` status should be assigned from these failed upstream build logs.

## Upstream Worktree Dirty Status

The approved upstream worktree remains at HEAD
`ce548c535abc7701ac45cc3164560caba121adce`. The only scoped dirty file after
the diagnostic retry is `node_modules/.package-lock.json`; the source manifests
checked in this report (`package.json`, `package-lock.json`, `client/package.json`,
and `server/package.json`) were not modified.

The clean verification worktree also remains at HEAD
`ce548c535abc7701ac45cc3164560caba121adce`; its scoped dirty status is limited
to generated `node_modules/.package-lock.json`.

## Downstream Rule

Phase 2 execution remains pending because the approved upstream baseline did
not pass. Non-parity planning notes may remain under `reports/`, but do not
create upstream-derived fixtures, matrix pass/fail rows, or CI gates until the
upstream build/setup blocker is resolved or explicitly waived in the parity
matrix with the required waiver contract.

## Unresolved Questions

- Should the approved upstream build failure block Phase 2, or should upstream
  automation be represented as `Blocked`/`Waived` rows with manual oracle
  evidence?
- If a waiver is allowed, who owns and approves the waiver for MVP P0 rows
  affected by unavailable upstream automation?
