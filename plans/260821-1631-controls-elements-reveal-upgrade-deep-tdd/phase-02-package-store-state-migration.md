---
title: "Phase 02: Package-Store Legacy State Migration"
status: completed
---

# Phase 02: Package-Store Legacy State Migration

## Goal

Restore startup compatibility for valid historical package-store roots whose schema-1 state/heads predate matrix authority metadata, without weakening corruption detection or mutating historical indexes.

## Dependencies

- Phase 01 fixtures and hash builders.

## Canonical Files

- `server/services/pptx-import/package-store/schemas.js`
- `server/services/pptx-import/package-store/state-store.js`
- `server/services/pptx-import/package-store/index.js`
- `server/services/pptx-import/package-store-runtime.js`
- Recommended new pure module: `server/services/pptx-import/package-store/state-migrations.js`
- `server/services/pptx-import/package-store/package-store.test.js`
- `server/services/pptx-import/package-store/state-root-bounded-chain.test.js`
- `server/services/pptx-import/package-store/writer-lock-reclaim.test.js`

## Contract

- Split the overloaded schema constant into explicit root, state, head, and unchanged record versions. Current root/state/head become version 2; blobs, revisions, jobs, leases, owners, results, and outbox records remain version 1 unless their shape changes.
- Migration order: parse JSON -> validate legacy root structure -> read index -> verify legacy index hash -> classify exact supported legacy shape -> migrate in memory -> validate current state/head contracts.
- Supported legacy authority migration requires all authority fields to be absent from state and all heads. Mixed presence, invalid values, or unknown fields inside the authority contract are ambiguous and fail closed.
- Derive the migrated epoch from a valid high-water record when present, otherwise `1`. Set every migrated head to that epoch and regenerate `matrixAuthoritySubjects` from the current canonical matrix. Preserve all IDs, generations, arrays, revisions, owner/lease/job/outbox data, and predecessor metadata.
- Recovery may expose a validated migrated state in memory and mark `pendingMigration`, but durable publication happens only after `PackageStore.acquireWriter()` owns the writer lock. Runtime initialization must publish before compatibility outbox drain.
- Publish one normal successor root/index/WAL transaction. Never rewrite the legacy index/root or bypass `StateStore.publish` durability/fault injection.

## RED

- [x] Valid schema-1 fixture without authority fields currently fails open/reload; assert the intended migrated current shape.
- [x] A retained predecessor chain with current root corrupt and valid legacy predecessor must select, migrate, and publish from the verified predecessor.
- [x] Mixed legacy/current authority fields, mismatched state/head epochs, corrupt subject maps, bad hashes, unsupported future versions, and invalid high-water files must reject.
- [x] Two startups, writer-lock reclaim, and concurrent acquire attempts must publish at most one migration successor.
- [x] Inject faults after index, prepared WAL, root replacement, and completion marker; each restart must converge without epoch regression or duplicate semantic migration.
- [x] Read-only open may inspect a migrated in-memory state but cannot publish or mutate without writer ownership.

## GREEN

- [x] Add pure version classifiers and `migrateLegacyState` that clone inputs and return `{ root, state, migratedFrom, actions }`.
- [x] Make `readValidatedRoot` accept only explicitly supported legacy/current root versions and preserve hash verification against the on-disk legacy bytes before migration.
- [x] Track pending migration provenance in `StateStore`; clear it only after a durable current-version successor is published.
- [x] Update `acquireWriter` to reload, publish a pending migration once, refresh fencing/high-water state, and only then return writer capability.
- [x] Ensure `initializePackageStore` completes migration before outbox acknowledgement/drain work.
- [x] Keep predecessor fallback bounded and apply the same parse/hash/classify/migrate/validate sequence to every candidate.

## REFACTOR

- [x] Remove the single ambiguous `SCHEMA_VERSION` from root/state/head call sites; use named constants so future migrations cannot accidentally bump immutable record schemas.
- [x] Centralize authority migration derivation and validation; no duplicated fallback logic in runtime/index/store.
- [x] Emit structured recovery actions such as `loaded-legacy-state-v1`, `published-state-migration-v2`, and existing WAL actions without logging presentation content.

## Focused Verification

```bash
npm test -- server/services/pptx-import/package-store/package-store.test.js
npm test -- server/services/pptx-import/package-store/state-root-bounded-chain.test.js server/services/pptx-import/package-store/writer-lock-reclaim.test.js
```

## Success Criteria

- [x] Valid legacy state opens and becomes one durable current successor under writer lock.
- [x] Restart after success performs no second semantic migration.
- [x] Every injected crash point converges to either the verified predecessor or the published successor; no partial state is accepted.
- [x] Corrupt, mixed, or unsupported shapes still fail closed.
- [x] Authority epoch never regresses below a valid high-water record; all migrated heads carry valid subjects for the chosen epoch.
- [x] Existing current-version package-store tests remain green.

## Risks / Rollback

- Regenerating authority subjects is safe only for the exact pre-authority legacy shape. Any mixed evidence must block startup rather than guess.
- Publishing before writer ownership can race or create split brain; prohibit it by API structure and tests.
- Rollback supports reading both versions but must not write version 1. Reverting the code after version-2 publication is not supported; deployment rollback requires the forward reader or a copied pre-migration store.

## Work Log

- RED: `npx vitest run server/services/pptx-import/package-store/legacy-state-migration.test.js` — 3 intended failures; valid pre-authority schema-1 fixtures stop at `TypeError: Invalid matrix authority epoch` before migration.
- GREEN: added explicit root/state/head v2 and immutable-record v1 constants, exact v1 migration/classification, root-before-read validation, current/legacy authority fail-closed checks, and writer-fenced pending migration/recovery/high-water/WAL publication.
- Verification: `npx vitest run server/services/pptx-import/package-store/*.test.js server/services/pptx-import/package-store/**/*.test.js` — 13 files, 135 tests passed.
- Blast radius: `npx vitest run server/services/pptx-import/canonical-feature-matrix.test.js server/services/validated-edited-export.test.js server/routes/presentations-duplicate-successful-save.test.js` — 3 files, 16 tests passed; CJS syntax checks passed.
- Review: mandatory code reviewer approved; no blocking findings.