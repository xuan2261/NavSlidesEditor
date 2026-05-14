---
title: "Upstream Selective Port Workflow"
description: "Port only high-value upstream fixes from unrelated-history upstream/main into NavSlidesEditor with worktree isolation, topic batches, and strict test gates."
status: complete
priority: P1
effort: 14h
issue:
branch: sync/upstream-selective-port-20260514
tags: [infra, git, upstream-sync, selective-port, testing]
blockedBy: []
blocks: [260514-0749-upstream-main-merge-sync]
created: 2026-05-14
---

# Upstream Selective Port Workflow

## Overview

Replace the unsafe unrelated-history merge plan with a selective port workflow. `git merge-base HEAD upstream/main` fails, and `HEAD..upstream/main` is about 9,609 files with 888k insertions and 302k deletions. The correct target is not full sync; it is a small, auditable subset of upstream fixes that fit local NavSlidesEditor.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Supersedes | [Upstream Main Merge Sync](../260514-0749-upstream-main-merge-sync/plan.md) | pending, blocked by unrelated histories |
| Related context | [UI/UX Warm Editorial Overhaul](../260513-2243-ui-ux-warm-editorial-overhaul/plan.md) | complete |

## Key Decisions

- Do not run `git merge --allow-unrelated-histories` for production sync.
- Use `git worktree` + topic branches for isolated port work.
- Prefer direct cherry-pick only for low-conflict commits; use manual port for structurally diverged files.
- Scope candidates: Copy URL context menu first, typography/export consistency second, HTML embed reliability only after confirming local defect.
- Defer timeline and image citation commits because local schema/UI surface does not match upstream.
- No rebase, no force push, no direct changes to `master` until all gates pass.

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Safety Snapshot And Baseline](./phase-01-safety-snapshot-and-baseline.md) | Complete |
| 2 | [Upstream Candidate Matrix](./phase-02-upstream-candidate-matrix.md) | Complete |
| 3 | [Worktree And Branch Setup](./phase-03-worktree-and-branch-setup.md) | Complete |
| 4 | [Port Copy URL Context Menu](./phase-04-port-copy-url-context-menu.md) | Complete |
| 5 | [Port Typography And Export Consistency](./phase-05-port-typography-and-export-consistency.md) | Complete, no code port needed |
| 6 | [Verify HTML Embed Reliability](./phase-06-verify-html-embed-reliability.md) | Complete, no code port needed |
| 7 | [Reject Or Defer Non-Fit Upstream Domains](./phase-07-reject-or-defer-non-fit-upstream-domains.md) | Complete |
| 8 | [Full Validation And Regression Sweep](./phase-08-full-validation-and-regression-sweep.md) | Complete |
| 9 | [Docs Release Audit And Final Git Integration](./phase-09-docs-release-audit-and-final-git-integration.md) | Complete |

## Dependencies

- Node.js 20+, npm 8+.
- Git with `worktree`, `cherry-pick`, `revert`.
- Existing remotes: `origin`, `upstream`.
- Upstream target: `https://github.com/jbirky/parallax-presentations.git`, branch `upstream/main`.
- Local validation commands: `npm run lint`, `npm run build`, `npm run test`, targeted `npm run test:e2e -- <spec>`, optional `npm run test:corpus`.

## Success Criteria

- Old unrelated-history merge path is not used for production integration.
- Candidate matrix records keep/drop/defer decision for each relevant upstream commit.
- Ported changes are small, topic-based, auditable, and reversible.
- `master` keeps local custom features and receives only approved upstream fixes.
- Phase-specific tests pass before final integration.
- Final build, lint, unit tests, and targeted E2E pass.
- Rollback path is documented and remains available until final merge is verified.

## Cook Handoff

Run implementation with:

```powershell
/ck:cook --tdd D:\NCKH_2025\NavSlidesEditor\plans\260514-1045-upstream-main-selective-port-workflow\plan.md
```

## Unresolved Questions

- Whether LaTeX font size/color controls should be planned as a separate UX/export feature.
- Whether future roadmap should include upstream timeline element or image citation schema; current plan defers both.
