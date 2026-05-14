---
title: "Upstream Feature Audit And Port Roadmap"
description: "Audit jbirky/parallax-presentations and port only high-value upstream fixes/features into NavSlidesEditor with local-change preservation and strict gates."
status: ready-for-merge
priority: P1
effort: 34h
issue:
branch: sync/upstream-feature-audit-port-260514
tags: [infra, git, upstream-sync, testing, frontend, export]
blockedBy: []
blocks: []
created: 2026-05-14
---

# Upstream Feature Audit And Port Roadmap

## Overview

Create a controlled roadmap for syncing high-value upstream work from `jbirky/parallax-presentations` into NavSlidesEditor. Do not full-merge upstream. Preserve local custom features. Port only audited, approved topic batches with test/build gates.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Builds on | [Upstream Selective Port Workflow](../260514-1045-upstream-main-selective-port-workflow/plan.md) | complete |
| Supersedes unsafe path | [Upstream Main Merge Sync](../260514-0749-upstream-main-merge-sync/plan.md) | cancelled |

## Scope Decisions

- Primary source: `upstream/main`.
- Read-only idea scan: `upstream/dev`, `upstream/feature/grid-and-axis-tools`.
- Skip by default: `upstream/saas-migration`, billing/auth/Stripe/Clerk, built artifacts, landing/pricing.
- No `git merge --allow-unrelated-histories`.
- No rebase or force push.
- Use worktrees/topic branches and small auditable ports.

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Safety Baseline And Git Guardrails](./phase-01-safety-baseline-and-git-guardrails.md) | Complete |
| 2 | [Upstream Candidate Matrix](./phase-02-upstream-candidate-matrix.md) | Complete |
| 3 | [Export And HTML Embed Reliability Ports](./phase-03-export-and-html-embed-reliability-ports.md) | Complete |
| 4 | [Editor UX Micro Ports](./phase-04-editor-ux-micro-ports.md) | Complete |
| 5 | [Media Playback And Presentation Polish Audit](./phase-05-media-playback-and-presentation-polish-audit.md) | Complete |
| 6 | [Timeline Element Feasibility Gate](./phase-06-timeline-element-feasibility-gate.md) | Complete |
| 7 | [Plugin Architecture Feasibility Gate](./phase-07-plugin-architecture-feasibility-gate.md) | Complete |
| 8 | [Regression Sweep And Integration Merge](./phase-08-regression-sweep-and-integration-merge.md) | Ready for Merge |
| 9 | [Docs Release Audit And Future Backlog](./phase-09-docs-release-audit-and-future-backlog.md) | Complete |

## Dependencies

- Node.js 20+, npm 8+.
- Existing remotes: `origin`, `upstream`.
- Git worktree support.
- Local baseline tests: `npm run lint`, `npm run build`, `npm run test`, `npm run test:e2e`, optional `npm run test:corpus`.
- Existing docs: `docs/code-standards.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`, `docs/project-changelog.md`.

## Success Criteria

- Candidate matrix covers upstream `main` plus read-only `dev/grid` highlights.
- Every accepted port has source commit, local target files, risk rating, gate list.
- Local features remain intact: PPTX, live, games, GitHub/rclone sync, Electron.
- Each implementation batch passes phase gates before merge.
- Final integration passes lint, build, unit tests, targeted E2E, and full E2E when ready.
- Docs record actual shipped changes and explicitly list skipped/deferred upstream topics.

## Cook Handoff

```powershell
/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260514-1024-upstream-feature-audit-and-port-roadmap\plan.md
```

## Unresolved Questions

- Merge not performed yet.
