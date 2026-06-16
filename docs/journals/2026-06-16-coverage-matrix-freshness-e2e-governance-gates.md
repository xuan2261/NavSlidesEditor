# Coverage Matrix Freshness and E2E Governance Fixes

**Date**: 2026-06-16 14:53
**Severity**: Medium
**Component**: Coverage matrix runner, tagged evidence pipeline, Markdown import/export E2E, test governance
**Status**: Resolved

## What Happened

We fixed two stale-signal problems and two E2E stability problems in the same pass. The coverage matrix runner-specific freshness check was adjusted so it no longer misread unrelated file churn as stale evidence. Matrix freshness is now scoped to tagged evidence files only, which removed false negatives from the freshness gate.

On the browser side, Markdown import/export E2E stopped relying on brittle markers and was stabilized around explicit import/export markers. The E2E governance layer was also cleaned up: tests no longer create root presentations directly, and the blind `setTimeout` sleep was removed.

## The Brutal Truth

This was a messy verification problem, not a feature problem. The suite was leaking confidence because freshness logic was too broad and the E2E flow had timing crutches. That is exactly the kind of drift that burns time at the end of a release, and it is frustrating because none of it was hard once we stopped trusting the old assumptions.

## Technical Details

- Coverage matrix freshness now checks tagged evidence files instead of the whole runner workspace.
- Markdown import/export E2E uses stable markers instead of timing-dependent DOM assumptions.
- Governance cleanup removed direct root presentation creation from the test path.
- `setTimeout` sleep was removed in favor of deterministic wait/marker flow.
- Final gates passed: `test`, `e2e`, `matrix`, `extended report`, `lint`, `build`, `k6 smoke`.

## What We Tried

- Tightened freshness detection first at the runner level.
- Scoped the matrix signal to tagged evidence files after false stale hits kept showing up.
- Reworked the Markdown E2E assertions around explicit markers instead of arbitrary delay.
- Removed direct presentation creation and sleep-based waiting to force the suite onto real state transitions.

## Root Cause Analysis

The root cause was weak test governance. Freshness logic was too coarse, and the E2E suite depended on implementation detail and timing slack. Both problems let the suite look healthy while still being flaky or noisy.

## Lessons Learned

- Freshness checks must be scoped to the actual evidence signal, not the whole workspace.
- E2E tests need stable markers and deterministic waits, not sleep hacks.
- Test helpers should own presentation setup, not ad hoc root creation in specs.

## Next Steps

- Keep tagged evidence as the only freshness input for matrix validation.
- Treat any new `setTimeout` in E2E as a review failure unless it is explicitly justified.
- Reuse the stabilized import/export markers for the next browser assertions that drift.

Status: Resolved
Summary: Fixed matrix freshness scoping, stabilized Markdown import/export E2E markers, removed direct root presentation creation and blind sleep, and closed the loop with all final gates green.
Concerns: None.
