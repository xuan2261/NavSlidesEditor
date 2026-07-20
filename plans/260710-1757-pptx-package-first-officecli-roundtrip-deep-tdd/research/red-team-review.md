# Red-Team Review

> Historical pre-finalization review. The later four-reviewer adversarial session and applied dispositions are authoritative in `../reports/from-red-team-reviewers-to-planner-package-first-plan-review-report.md`.

## Result

**Conditional pass after amendments.** The initial 13-phase outline was not implementation-ready. Critical transaction, authority, early vertical-slice, package ownership, claim provenance, and export-path requirements are now embedded in `plan.md` and the phase files.

## Critical Findings and Disposition

1. **No atomic package transaction model**
   - Disposition: Phase 3 defines the exclusive writer lock, WAL, immutable metadata indexes, one durable state-root publication, and recovery; Phase 11 extends that transaction.
2. **Full-snapshot save cannot produce trusted journals**
   - Disposition: Phase 5 adds server canonical diffing, authority stripping, lock-scoped generation predicates, idempotency, and net-effect compaction.
3. **Current source identity is not stable**
   - Disposition: Phase 5 keys identity by package/part/native ID/relationship/ancestry/source hash and blocks ambiguity.
4. **Patch export arrived too late**
   - Disposition: Phase 5 now requires no-op and one-text-edit end-to-end vertical slices before feature expansion.
5. **Current visual evidence cannot support claims**
   - Disposition: Phase 1 rejects debt/stale/self evidence; Phase 13 requires fresh PowerPoint-linked composite evidence.

## High Findings and Disposition

- **OfficeCLI supply chain:** Phase 2 locks upstream asset/hash/license/packaging and rollback.
- **Direct spawn is not a sandbox:** Phase 4 specifies platform containment, egress policy, private jobs, resource bounds, and process-tree termination.
- **Package ownership omitted lifecycle surfaces:** Phase 3 covers duplicate/history/templates/project/sync/delete/reference behavior.
- **Chart authority undecided:** Phase 8 contains an explicit workbook/cache decision checkpoint and atomic closure.
- **Complex-object editability could be overstated:** Phase 9 defines five exact tiers and non-execution policy.
- **Divergent export paths:** Phase 11 makes server package export authoritative and labels reconstruction honestly.

## Medium Findings and Disposition

- Streaming/resource budgets are required in Phases 3, 4, 6, 11, and 13.
- Legacy migration and rollback are required in Phases 3, 5, 11, and 13.
- Evidence privacy and retention are required in Phases 1, 9, 12, and 13.

## Cross-Phase Checks Added

- Immutable original and revisions.
- No-edit exact bytes.
- One durable metadata-root transaction for aggregate heads, ownership, leases, and jobs.
- Client authority boundary.
- Deterministic/idempotent journal.
- Ambiguous identity blocks patching.
- Touched-part closure and unrelated-part byte identity.
- Transaction rollback at every boundary.
- Correct reference ownership across all lifecycle operations.
- Layered package validation plus exact-subject provider evidence only for PowerPoint claim level 5.
- OfficeCLI absence never blocks original recovery.
- Public/share DTOs exclude internal package metadata.

## Remaining Risks for Validation

- Approval of an unsigned OfficeCLI asset.
- Provider ownership and licensed PowerPoint runner.
- Per-target OfficeCLI bundling and Linux mutation support.
- Storage quota/retention/backup policy.
- Snapshot-diff versus explicit operation transport.
- Chart workbook/cache authority.
- Exact editability tiers that product requirements demand.
- Signature, macro, encrypted package, and raw-patch policies.
- Whether project export, sync, templates, and history carry package revisions.

These decisions have fail-closed defaults and named phase checkpoints. None may be silently resolved during implementation.

## Final Validation Round

A second independent review returned conditional pass with four amendments, all applied:

1. Added one atomic `PresentationPackageHead` and split-head fault recovery across Phases 3, 5, and 11.
2. Made project export/import, sync, templates, and history carry verified reachable package bytes or fail before publication.
3. Made protected-CI attestation mandatory for every claim and protected-provider attestation additionally mandatory for claim level 5.
4. Replaced the expected failing raw SLA command in Phase 1 validators with a passing harness that asserts fail-closed reason codes.

After these changes, remaining items are product decision checkpoints with explicit fail-closed defaults, not architecture blockers.
