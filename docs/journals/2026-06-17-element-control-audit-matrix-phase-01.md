# Element-Control Audit Matrix Harness - Phase 01

**Date**: 2026-06-17 14:32
**Severity**: Medium
**Component**: `scripts/feature-inventory`, package scripts, validation harness, docs
**Status**: Resolved

## What Happened

Phase 01 of the element-control audit matrix harness landed. I added the expected-controls source, the audit matrix JSON, a validator, and a dedicated test file. I also wired `package.json` with `matrix:element-control` and `matrix:gate`, then updated `plans/260617-0739-element-control-audit-matrix-tdd/reports/element-control-audit-matrix-current.md` plus `docs/code-standards.md` and `docs/codebase-summary.md`.

The first pass was not clean. Reviewer feedback caught three holes in the validator: aggregate `surface: all` coverage was underchecked, duplicate rows were allowed, and empty expected surfaces were not rejected. I fixed those gaps and added coverage for them.

## The Brutal Truth

This was the kind of validation work that looks finished until someone reads it with a hostile eye. The harness would have been useless if those gaps shipped, because it could have passed bad data and still claimed confidence. That is exactly the sort of dumb failure that wastes time later, and it is annoying because it was preventable.

## Technical Details

- New files:
  - `scripts/feature-inventory/element-control-expected-controls.json`
  - `scripts/feature-inventory/element-control-audit-matrix.json`
  - `scripts/feature-inventory/validate-element-control-audit-matrix.mjs`
  - `scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs`
- `matrix:element-control` runs the validator, `matrix:gate` gates the matrix flow.
- Fixed validator checks:
  - reject duplicate matrix rows
  - reject empty expected surfaces
  - validate aggregate `surface: all` coverage
- Verification:
  - validator tests: `10/10` pass
  - `feature-inventory`: `103/103` pass
  - `matrix:gate`: pass, but with stale-run evidence warning
  - lint: pass, `0` errors and `23` pre-existing warnings
  - build: pass

## What We Tried

- Ran the validator against the first matrix shape.
- Reviewed the matrix output after the reviewer flagged coverage gaps.
- Tightened the checks instead of papering over bad rows.
- Added tests for each failure mode so the same mistake does not come back.

## Root Cause Analysis

The root cause was weak guardrail logic in the first validator draft. It assumed the matrix was well-formed instead of proving it. That is a bad assumption for a harness whose only job is to catch drift.

## Lessons Learned

- A matrix validator must fail closed, not trust the input shape.
- `surface: all` needs explicit aggregate coverage checks, not implied behavior.
- Duplicate rows and empty expected sets are not edge cases; they are basic integrity failures.

## Next Steps

- Keep Phase 02 scoped to the harness contract already verified here.
- Treat the stale-run evidence warning as follow-up debt, not a blocker.
- Reuse these validator rules for the next inventory matrix so the same gaps do not reappear.
