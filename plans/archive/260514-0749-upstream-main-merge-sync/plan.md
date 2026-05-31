---
title: "Upstream Main Merge Sync"
description: "Safely merge upstream/main from jbirky/parallax-presentations into the customized NavSlidesEditor repository using a dedicated sync branch and validation gates."
status: cancelled
priority: P1
effort: 10h
issue:
branch: master
tags: [infra, git, maintenance, critical]
blockedBy: [260514-1045-upstream-main-selective-port-workflow]
blocks: []
created: 2026-05-14
---

# Upstream Main Merge Sync

## Overview

Cancelled after Phase 02 because `HEAD` and `upstream/main` have no merge-base. A full unrelated-history merge would touch about 9,609 files and is too risky for the customized repo. Use [Upstream Selective Port Workflow](../260514-1045-upstream-main-selective-port-workflow/plan.md) instead.

Original goal was to merge latest `upstream/main` from `https://github.com/jbirky/parallax-presentations` into local customized repo. This is no longer the selected approach.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Superseded by | [Upstream Selective Port Workflow](../260514-1045-upstream-main-selective-port-workflow/plan.md) | complete |
| Related context | [UI/UX Warm Editorial Overhaul](../260513-2243-ui-ux-warm-editorial-overhaul/plan.md) | complete |

## Key Decisions

- Use merge, not rebase.
- Merge only `upstream/main`; `upstream/dev` out of scope.
- Use `npm install` to resolve dependency/lockfile state.
- Keep `master` untouched until sync branch passes verification.
- Prefer local changes for product-specific UI/custom features; prefer upstream for isolated bug/security fixes.

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Preflight And Checkpoint](./phase-01-preflight-and-checkpoint.md) | Pending |
| 2 | [Configure Upstream And Inspect Diff](./phase-02-configure-upstream-and-inspect-diff.md) | Pending |
| 3 | [Create Sync Branch And Merge Upstream Main](./phase-03-create-sync-branch-and-merge-upstream-main.md) | Pending |
| 4 | [Resolve Conflicts By Domain](./phase-04-resolve-conflicts-by-domain.md) | Pending |
| 5 | [Dependency And Build Stabilization](./phase-05-dependency-and-build-stabilization.md) | Pending |
| 6 | [Test Gate And Regression Sweep](./phase-06-test-gate-and-regression-sweep.md) | Pending |
| 7 | [Docs And Release Audit](./phase-07-docs-and-release-audit.md) | Pending |
| 8 | [Finalize Merge Back Or Rollback](./phase-08-finalize-merge-back-or-rollback.md) | Pending |

## Dependencies

- Node.js 20+.
- npm with `package-lock.json`.
- Network access to GitHub.
- Existing local repo remote `origin`.
- New remote `upstream` pointing to `jbirky/parallax-presentations`.

## Success Criteria

- Sync branch exists and includes `upstream/main`.
- No accidental rebase/history rewrite.
- `npm run build` passes.
- `npm run test` passes or failures are documented with root cause and fixed before final merge.
- Targeted E2E passes for impacted flows.
- `master` is updated only after validation passes.

## Cook Handoff

Run implementation with:

```powershell
/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260514-0749-upstream-main-merge-sync\plan.md
```

## Unresolved Questions

- None.
