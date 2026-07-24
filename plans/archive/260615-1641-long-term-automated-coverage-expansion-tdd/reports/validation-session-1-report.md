---
title: "Validation Session 1 Report"
type: report
created: 2026-06-15
plan: ../plan.md
---

# Validation Session 1 Report

## Summary

Validated the post-red-team plan using conservative defaults because the interactive question tool was unavailable in current mode. No blocking plan gaps remain before cook.

## Questions Asked

1. **[Architecture]** Coverage-depth should be implemented at what level in the first cook?
   - Options: Warn-first MVP (Recommended) | Strict gate immediately | Docs only
   - Answer: Warn-first MVP (Recommended)
   - Rationale: The repo already has a non-required feature coverage gate pattern. Warn-first gives visibility without blocking unrelated work while new depth semantics stabilize.

2. **[Scope]** Should Phase 4 keep the default E2E budget of 8 specs / 12 browser tests?
   - Options: Keep cap (Recommended) | Loosen cap | Reduce cap
   - Answer: Keep cap (Recommended)
   - Rationale: Browser tests carry the highest runtime/flakiness risk. Unit/component tests should cover combinatorics; E2E should prove composed workflows.

3. **[Risk]** Which lane should new gates enter first?
   - Options: Warn-first (Recommended) | Merge required | Release only
   - Answer: Warn-first (Recommended)
   - Rationale: New governance, visual, a11y, and perf gates need deterministic local reproduction and two target-branch green runs before required-check promotion.

## Confirmed Decisions

- Coverage-depth rollout: warn-first MVP.
- E2E budget: keep 8 specs / 12 browser tests default cap.
- CI gate promotion: warn-first first; required only after deterministic reproduction and two green target-branch runs.

## Phase Propagation

- Phase 2: added warn-first rollout requirement and strict-gate promotion guard.
- Phase 4: added validated E2E cap tracking task.
- Phase 7: added new-gate warn-first requirement and promotion evidence success criterion.

## Recommendation

Proceed to implementation with `/ck:cook --auto`.

## Unresolved Questions

- None.
