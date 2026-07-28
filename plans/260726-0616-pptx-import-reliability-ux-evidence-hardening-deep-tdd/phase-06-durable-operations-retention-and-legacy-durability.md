---
phase: 6
title: "Durable Operations Retention And Legacy Durability"
status: completed
priority: P2
effort: "5-8d plus policy/compaction rehearsal"
dependencies: [3, 4]
---

# Phase 6: Durable Operations Retention And Legacy Durability

## Overview

Complete the non-destructive retention safety scope: consume durable lifecycle information, preserve recovery authority, and keep retention audit/dry-run default-off. Physical StateStore/WAL compaction, destructive history expiry, and any production enablement remain deferred pending explicit policy and restore evidence.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: Phase 3's reservation, running, cancel, publish, visibility, failure, `reconcile-required`, repair, and resolved states are retained through restart where recovery requires them; this phase does not redefine lifecycle authority.
- Functional: terminal diagnostic history is separable from minimal rollback/idempotency/reconcile tombstones.
- Functional: retention derives `terminalAt`, retention class, failure stage/code, `reconcileRequired`, and bounded `reportSummary` from Phase 3's durable schema; it does not invent a second lifecycle record.
- Functional: active jobs, pending visibility, outbox/repair records, mutation results, heads, owners/leases, live references, and unverifiable legacy receipts are protected.
- Functional: retention policy has explicit age/count/byte limits, trigger, protected classes, tombstone lifetime, expired API semantics, and dry-run report before destructive enablement.
- Functional: eligible history is compacted through existing PackageStore/StateStore writer/WAL mechanisms; full snapshots, predecessor roots, prepared/completed WAL and index history are physically bounded after verified replacement.
- Functional: compaction is atomic, restart-safe, idempotent, and restorable to the previous valid root.
- Functional: legacy `persistOriginalPptx` either reports its actual weak durability contract or is deliberately upgraded; production BlobStore staging/sync/rename/hash behavior remains unchanged.
- Non-functional: retention is not a privacy boundary and never silently deletes package blobs, active heads, or recovery authority.

## Architecture

```text
admission lifecycle + package receipt/repair authority
  -> durable terminal/tombstone classes
  -> audit/dry-run eligibility
  -> protected-reference proof
  -> StateStore root/index/WAL compaction
  -> atomic replacement + restart verification

Blob GC remains separate from job/receipt retention.
```

Use `PackageStore.mutate` and the existing StateStore WAL/root machinery. Do not create a second atomic snapshot writer. A minimal immutable tombstone remains while any package/head/outbox/repair/mutation result can reference the import; only diagnostic/history fields may expire earlier.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Create | New package-store retention/maintenance module | Eligibility, dry-run, protected-reference proof, compaction orchestration |
| Modify/consume | `server/services/pptx-import/package-store/index.js`, `server/services/pptx-import/package-store/state-store.js` | Retention-only serialized maintenance and verified physical root/WAL/index replacement through Phase 3's lifecycle API; no lifecycle schema ownership |
| Modify/audit | `server/services/pptx-import/package-store/collector.js` | Receipt/index/WAL metrics only; keep Blob GC separate |
| Test/integrate | Phase 3 `server/services/pptx-import/package-store/import-commit.js` contract | Consume lifecycle/tombstone/repair fields; no ownership overlap |
| Modify | `server/services/pptx-import/original-package.js` | Explicit legacy durability result or temp/sync/rename path if selected |
| Test | Package-store retention, lifecycle, StateStore/WAL, restart and durable-job suites | Crash/age/count/bytes/reference protection |
| Modify | `plans/reports` / rollback runbook | Policy, dry-run and physical compaction evidence |

## Implementation Steps

1. Characterize current retention state: Map TTL is 10 minutes, durable jobs/receipts grow, Phase 3 lifecycle records may be needed after restart, and StateStore roots/WAL/history remain physically present.
2. Consume the Phase 3 fields `terminalAt`, retention class, failure stage/code, `reconcileRequired`, and bounded `reportSummary`; define retention classes over that lifecycle: active, pending-visibility, published, cancelled, failed, `reconcile-required`, resolved, diagnostic-expired, and authority-tombstone. Do not assume a completed receipt is disposable while a live head can reference it.
3. Define policy before destructive code: age/count/bytes, trigger (manual/startup/threshold), protected references, tombstone lifetime, expired GET behavior, and whether pre-publish failures need durable records.
4. Implement audit/dry-run selection with reason codes and zero mutation. Prove no selected record is referenced by active job, head, owner/lease, outbox, repair state, mutation result, or unresolved presentation.
5. Implement atomic compaction through existing PackageStore/StateStore mutation/WAL. Replace root/index only after complete verified snapshot; clean old predecessor/WAL files only after restart-safe durability proof.
6. Add crash injection before prepare, after prepare, before root replace, after root replace, and during old-root cleanup. On restart, accept old or new valid snapshot, never partial JSON, and resume/rollback maintenance safely.
7. Preserve minimal rollback/idempotency/reconcile tombstones and expose explicit expired/not-found semantics only after authority retirement is proven.
8. Add bounded durable `reportSummary`/failure detail through the Phase 3 contract; never persist raw stacks, stderr, source content, capabilities, or secrets.
9. For legacy originals, either use temp + flush/sync + rename with explicit result or record `durability: legacy-best-effort`; do not imply fsync where absent.
10. Verify BlobStore production staging/sync/rename/hash contract and keep blob collection separate from receipt compaction.

## Tests Before

- In-memory jobs expire while durable records/history grow.
- Pre-publish cancellation/restart has no complete durable lifecycle.
- Completed receipt is needed by rollback/reconcile but retention classes do not prove that reference.
- `mutationResults`, heads, outbox, leases, and StateStore roots are not part of eligibility protection.
- Existing `collector.js` audits blobs only.
- StateStore compaction has no physical index/WAL cleanup or crash boundary tests.
- Legacy original write has no explicit durability result.

## Tests After

- Lifecycle survives restart across active/publish/pending/reconcile/repair states.
- Dry-run selects only provably retired diagnostic/history records and selects zero protected references.
- Minimal tombstone preserves unknown-outcome/rollback/idempotency/reconcile behavior after user-facing history expiry.
- Age/count/byte caps include `jobs[]`, mutation results, index/root history, and WAL, not merely array length.
- Crash at every compaction boundary leaves old/new valid root and restart can resume safely.
- Physical old-root/WAL cleanup is verified and does not remove active authority.
- Expired GET has explicit semantics; no silent false success or destructive auto-repair.
- Durable error/report summary remains bounded after restart; raw diagnostics remain private.
- Legacy path reports actual weak/strong durability; BlobStore tests remain green.

## Completion Checklist — reconciled 2026-07-28

- [x] Retention consumes existing durable lifecycle/repair authority and keeps rollback, idempotency, reconcile, live-head, and related protected references outside destructive selection.
- [x] Retention reporting is dry-run/default-off; blob collection remains separate from job/receipt history.
- [x] The rollback runbook requires a dry-run and isolated restore rehearsal before any policy change.
- [ ] No approved age/count/byte expiry policy is enabled.
- [ ] No physical StateStore root/index/WAL compaction or destructive cleanup is enabled or claimed.
- [ ] No production restart/restore qualification for destructive retention exists; legacy durability is not promoted beyond its documented contract.

## Test Scenario Matrix

| Scenario | Expected |
|---|---|
| Old diagnostic-only record | Selected only after policy/retirement proof |
| Active/pending visibility | Retained |
| Outbox/repair/mutation result reference | Retained |
| Live head/owner/lease reference | Retained |
| Unknown/reconcile-required receipt | Tombstone/authority retained |
| Crash before root replace | Old valid root |
| Crash after root replace | New valid root or safe resume |
| Old predecessor/WAL cleanup | Removed only after verified durable replacement |
| Expired history GET | Explicit expired/not-found contract |
| Legacy original write | Actual durability result |
| Production BlobStore write | Existing sync/rename/hash contract unchanged |

## Regression Gate

```bash
npx vitest run server/services/pptx-import/package-store-runtime-lock-order.test.js server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/package-store/blob-store.test.js server/services/pptx-import/original-package.test.js server/routes/pptx-import-durable-job.test.js
```

Add a retention-specific suite under this phase. Do not cite nonexistent `server/services/pptx-import/package-store-runtime.test.js`.

## Success Criteria — reconciled 2026-07-28

- [x] Recovery authority is retained and retention remains a non-destructive dry-run/default-off operation.
- [x] The release record and rollback procedure keep blob/media collection separate from retention of authority records.
- [ ] Destructive expiry policy, physical compaction, restart-safe replacement, and restore qualification are deferred; no storage-bounding claim is issued.
- [ ] Legacy durability is reported only at its existing documented level and is not promoted by this phase.

## Risk Assessment

- Risk: retention deletes recovery authority. Mitigation: reference proof, protected tombstones, dry-run, atomic restore.
- Risk: compaction claims bounded storage while leaving WAL/history. Mitigation: physical boundary tests and verified cleanup.
- Risk: fsync increases legacy latency. Mitigation: measure and document only if upgrade selected.
- Risk: retention becomes destructive privacy boundary. Mitigation: explicit policy and no automatic deletion of package/media authority.

## Security Considerations

Retention reduces metadata only after a policy decision; it does not authorize cross-user access or destructive repair. Never persist/export capabilities, credentials, raw imported names, private paths, or raw logs. Public/multi-user deployments still require external authentication.

## Next Steps

Phase 7 records retention/compaction provenance and physical storage results. Phase 11 includes dry-run/restore evidence in the rollback gate.
