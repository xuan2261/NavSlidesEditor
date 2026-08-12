---
title: Production Readiness Remediation Plan
date: 2026-08-11
summary: "Verified and validated a seven-phase deep TDD remediation plan for live, export, deployment/SVG, and PPTX defects."
---

# Production Readiness Remediation Plan

## What happened
- Re-audited and independently reproduced live-capability escalation, portable HTML root dependencies, conditional network exposure, active SVG navigation, PPTX CRC ordering, compatibility ghost/false-success outcomes, crash-leaked media, and unreachable generic game controls.
- Built `plans/260810-0921-verified-production-readiness-remediation-deep-tdd/` with one overview, seven TDD phases, three research reports, and the debug baseline.
- Red team produced 29 raw findings, deduplicated to 15. Applied 13 and rejected two scope expansions.

## Decisions
- The remediation plan hard-blocks the active package-first PPTX plan.
- Privileged live fragments are scrubbed into memory; portable HTML uses pinned CDN/SRI plus inlined unverifiable transitive assets.
- Missing non-loopback danger acknowledgement warns and continues; package storage remains single-writer.
- GitHub folders use safe title plus stable presentation ID.
- Environment-only lanes may close as PASS WITH DEFERRED CI, but package-first remains blocked until actual evidence is green.
- Release notes use `docs/project-changelog.md`.

## Validation
- AgentKit structure validation passed.
- Checked 118 cited paths with zero unexpected missing paths and zero placeholders after planned-create classification.
- Verified all 15 planned npm script names exist.
- Whole-plan reread found and reconciled Phase 2 dependencies, network-warning wording, deferred CI policy, changelog authority, and runtime-smoke wording.

## Next steps
- Implement test-first from Phase 1/3/4, then Phase 2 and Phase 5/6, followed by Phase 7 closeout.
- Recommended handoff: `/ak:cook C:\Work\NavSlidesEditor\plans\260810-0921-verified-production-readiness-remediation-deep-tdd\plan.md --tdd`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
