# P0 PPTX Readiness: Rollback Authority Is Now Head-Bound

**Date**: 2026-07-22 21:59
**Severity**: High
**Component**: Package-backed PPTX rollback and visual-oracle capture
**Status**: Phase 3 software complete; Phase 4 evidence blocked

## What Happened

Rollback trusted R0 only. A normal `savePackageProjection()` made generation 2 while retaining R0, so delayed cleanup could delete the evolved head. Receipts now bind `presentationId`, `outcomeRevisionId`, `outcomeGeneration`, and `outcomeHeadHash`; an exact live-head match is required. A completed retry is no-op only when job/presentation identity matches and does not publish a root. Task #37 found two authority blockers; Tasks #39/#40 closed them on 2026-07-24 with focused regression evidence.

## The Brutal Truth

We confused “same original bytes” with “same presentation state.” The later matrix epoch 1→2 bypass proved automatic legacy migration unsafe.

## Technical Details

`package-store.test.js` reproduces same-R0 generation 2 and requires `Import rollback authority no longer matches the recorded job`. `import-commit.js` records `hashCanonical(head)`; `PackageStore.mutate()` honors `false`, preserving state and root generation.

Inferred legacy migration is rejected. An all-absent v1 receipt remains loadable for recovery, but rollback returns `LEGACY_IMPORT_RECEIPT_UNSUPPORTED` and retains job/head; partial fields fail schema. Matrix, fencing, and head drift cannot manufacture authority.

Review found two breaches (Tasks #39/#40): reconciliation dropped server 409 `reasonCode` from timeout/cleanup reports; a missing-head no-op could accept a mismatched job/presentation identity. Both are repaired: job-lifecycle uses shared `safeServerReasonCode` and package-backed capture surfaces `reasonCode` on failure reports; rollback no-ops require matching job and presentation identity (wrong jobId or presentationId fails closed).

Snapshot/original fencing binds revision, head hash, generation, R0 SHA-256, and length; mismatch returns `STALE_PACKAGE_AUTHORITY`. Under jsdom, native multipart import returned `{ ok: false, error: 'http-request-timeout' }` before `jobId`. `@vitest-environment node` proves import, fenced R0, capture identity, and cleanup.

## What We Tried

We rejected revision-only rollback, inferred legacy fields, and jsdom emulation. Exact fences and Node-native multipart are safer than compatibility guesses.

## Root Cause Analysis

The receipt modeled source bytes instead of the aggregate head, and no-op cleanup still mutated durable metadata. The browser-like test environment hid a real HTTP multipart failure.

## Lessons Learned

Rollback must bind the full committed outcome. An idempotent no-op must not publish. Package visual evidence needs snapshot/original fences and an actual Node HTTP runtime.

## Validation

Focused evidence: Phase 1 5 files / 51 tests (API 27/27); Phase 3 implementation 12 files / 166 tests plus Playwright 3/3; combined authority/oracle earlier 21 files / 142 passed / 1 skipped. After #39/#40: package-store + package-backed actuals + HTTP boundary + durable-job route = 4 files / 71 tests pass; scoped ESLint clean.

Strict qualification remains intentionally non-zero: `Bai_2_1.pptx` reports `emf-convert-disabled` and `STTre_Duc.pptx` has 174 unmapped native leaves. Oracle integrity/qualification remain blocked without a trusted PowerPoint envelope and role receipts. Broad `npm test` earlier reported three matrix-contract failures because live matrix reports lived under a deleted plan path; on 2026-07-24 reports moved to stable `scripts/feature-inventory/reports/` and all consumers were updated (matrix-related 5 files / 59 tests pass). Full aggregate suite not re-run.

## Next Steps

- **Phase 4 / Release**: supply controlled PowerPoint goldens, envelope, receipts, and numeric comparison evidence before any visual-fidelity claim.
- **Validation (optional)**: re-run full `npm test` for an aggregate summary.

## Unresolved Questions

None. Tasks #39/#40, strict-importer, PowerPoint, and broad-suite conditions are explicit blockers, not design questions.
