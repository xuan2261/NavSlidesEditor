# Upstream Feature Audit Port Roadmap Plan Journal

## Context

Created plan `plans/260514-1024-upstream-feature-audit-and-port-roadmap/`.

## What Happened

- Confirmed upstream full merge is still unsafe: no merge-base, huge diff.
- Preserved prior decision: selective port, not unrelated-history merge.
- Planned primary scope as `upstream/main`.
- Planned read-only scan for `upstream/dev` and `upstream/feature/grid-and-axis-tools`.
- Skipped SaaS/billing/auth by default.
- Split work into 9 phases with test/build gates.

## Decisions

- Start with safety baseline and candidate matrix.
- Port export/editor/media improvements only after matrix approval.
- Treat timeline and plugin/Manim as feasibility gates, not default implementation.
- Final gate requires lint, build, unit tests, targeted E2E, full E2E, and corpus if export/PPTX touched.

## Next

Run:

```powershell
/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260514-1024-upstream-feature-audit-and-port-roadmap\plan.md
```

## Unresolved Questions

- Whether timeline element becomes separate implementation plan.
- Whether plugin/Manim becomes separate P1 epic.
