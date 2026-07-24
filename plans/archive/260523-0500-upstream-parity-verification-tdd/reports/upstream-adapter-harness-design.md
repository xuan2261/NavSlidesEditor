---
title: "Upstream Adapter Harness Design"
date: 2026-05-23
status: pre-approval-design
phase: 1
---

# Upstream Adapter Harness Design

## Scope Guard

This design started pre-approval and was updated after oracle approval. It does
not claim parity. Use it with `upstream-baseline-report.md`, which records the
approved upstream setup/build failure.

## Tooling Facts

| Capability | Current repo | Candidate upstream |
|---|---|---|
| Workspaces | `server`, `client`, `shared`, `website` | `server`, `client` |
| Root build | `npm run build` | `npm run build` |
| Root dev | `npm run dev` | `npm run dev` |
| Root start | `npm start` / `npm run start` | `npm start` / `npm run start` |
| Electron scripts | `electron:*` | `electron:*` |
| Root lint | `npm run lint` | Not available |
| Unit/integration | `npm test` | Not available |
| E2E | `npm run test:e2e` | Not available |
| PPTX corpus | `npm run test:corpus` | Not available |
| Load tests | `npm run test:load:*` | Not available |
| Playwright config | `playwright.config.js` | Not available |
| Vitest config | `vitest.config.mjs` | Not available |

## Adapter Principles

- Compare behavior intent, not identical command names.
- Do not copy current repo test commands into upstream unless upstream exposes
  equivalent scripts/config.
- Keep upstream execution in a separate worktree and avoid real credentials.
- Use `npm ci --ignore-scripts` first; review package/lockfile diffs before any
  lifecycle script execution.
- Treat upstream build pass as setup evidence only, not parity proof.
- Produce logs with start/end timestamps, exit codes, and dirty status like the
  current baseline logs.

## Proposed Post-Approval Command Plan

### 1. Oracle Worktree Setup

```powershell
git rev-parse <approved-upstream-sha>
git worktree add ..\NavSlidesEditor-upstream <approved-upstream-sha>
git -C ..\NavSlidesEditor-upstream status --short
```

### 2. Tooling Review

```powershell
git -C ..\NavSlidesEditor-upstream rev-parse HEAD
git -C ..\NavSlidesEditor-upstream show HEAD:package.json
git diff --shortstat HEAD..<approved-upstream-sha> -- package.json package-lock.json playwright.config.js vitest.config.mjs
```

Expected candidate result: upstream has no root lint/test/e2e scripts and no
Playwright/Vitest config.

Do not use a floating branch such as `upstream/main` for post-approval tooling
diffs. If a branch is fetched for convenience, first prove that it still resolves
to the approved SHA and record both values in the evidence log.

### 3. Upstream Setup Smoke

```powershell
Push-Location ..\NavSlidesEditor-upstream
npm ci --ignore-scripts
npm run build
git status --short
Pop-Location
```

This proves the approved upstream candidate can install/build in the local
environment. It does not prove feature parity.

### 4. External Smoke Harness Decision

After approval, choose one adapter path:

| Path | Use when | Output |
|---|---|---|
| Minimal browser smoke | Upstream can serve a usable app with `npm run dev` or `npm start` | Playwright smoke outside upstream repo verifies homepage/editor load and export/present routes where available |
| Static artifact smoke | Upstream build works but runtime routes differ | Inspect build output and run static server smoke if possible |
| Manual oracle capture | Runtime automation is not viable | Capture approved screenshots/behavior notes with approver signoff; mark automated upstream evidence unavailable |

## Proposed Evidence Schema

| Field | Required |
|---|---|
| Approved upstream SHA | Yes |
| Worktree path | Yes |
| Command | Yes |
| Start timestamp | Yes |
| End timestamp | Yes |
| Exit code | Yes |
| Log path | Yes |
| Dirty status after command | Yes |
| Adapter rationale | Yes |
| Known limitations | Yes |

## Current Repo Baseline Mapping

| Current gate | Existing command | Upstream adapter |
|---|---|---|
| Build | `npm run build` | `npm run build` |
| Lint | `npm run lint` | Not equivalent; record unavailable or define external lint if approved |
| Unit/integration | `npm test` | Not equivalent; no upstream Vitest config |
| E2E | `npm run test:e2e` | External Playwright smoke harness if upstream runtime supports it |
| PPTX corpus | `npm run test:corpus` | No upstream equivalent; current-only regression gate |
| Load | `npm run test:load:*` | No upstream equivalent; current-only regression gate |

## Non-Goals

- No upstream merge or cherry-pick.
- No upstream test script injection before approval.
- No generated fixtures from current repo behavior.
- No real AI, cloud, GitHub, rclone, or production credentials.

## Acceptance To Proceed After Approval

- Approval record complete.
- Upstream worktree created at immutable SHA.
- Upstream package/lockfile reviewed.
- Adapter path selected and recorded.
- Baseline logs generated with the evidence schema above.
- Matrix rows reference approved upstream evidence or explicitly mark upstream
  evidence unavailable.

## Post-Approval Failure Decision

The approved upstream SHA was created in `C:\Work\NavSlidesEditor-upstream` and
validated again in `C:\Work\NavSlidesEditor-upstream-clean`. Both worktrees
failed to produce a passing build on the local Windows/npm/Node environment.

Decision for downstream planning:

- Do not patch upstream package manifests or lockfiles inside the oracle
  worktree.
- Do not treat workaround installs/builds as parity evidence.
- Future matrix rows may use approved upstream baseline logs as evidence that
  upstream automation is unavailable, but those rows must be marked `Blocked`
  unless manual oracle evidence or a signed waiver exists.
- MVP P0 rows cannot be release-ready from failed upstream build logs alone.

## Unresolved Questions

- Whether manual oracle capture is acceptable for MVP P0 rows affected by the
  upstream build failure.
- Should unavailable upstream automation be treated as `Unknown`, `Blocked`, or
  signed waiver for each MVP P0 row?
