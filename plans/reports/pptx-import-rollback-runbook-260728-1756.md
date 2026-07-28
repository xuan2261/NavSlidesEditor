# PPTX Import Rollback and Recovery Runbook — 2026-07-28 / Run 1756

> **Scope:** operational safety procedure for the bounded best-effort PPTX import contract. This is not an authorization to delete records, enable retention, publish evidence, or perform a release.

## Operating rules

1. Observe first. Preserve durable state, package authority, compatibility data, and media references before any repair decision.
2. Do not use automatic timeout recovery as repair. Unknown outcome handling is read-only status inspection followed by a user check of existing presentations.
3. Do not bulk-delete records to restore service. A record that cannot be identity-verified remains isolated and repair-required.
4. Keep unrelated healthy presentations and imports available wherever list isolation permits.
5. Keep retention dry-run/default-off. No physical compaction or destructive history expiry is enabled by this runbook.
6. Record only aggregate outcomes in publishable material. Keep operational references and detailed diagnostics in approved private incident handling.

## Entry criteria and stop conditions

| Check | Required before action | Stop when |
| --- | --- | --- |
| Incident scope | Classify as client race, visibility/repair, outbox, startup, media, or retention | Classification is ambiguous or authority cannot be verified |
| Authorization | Use the deployment's approved job-control authorization boundary | Authorization is absent, invalid, or not verified |
| Data safety | Preserve current durable state and relevant recovery evidence | Preservation cannot be confirmed |
| Change control | Obtain the required operator approval for any state-changing repair | Approval is missing or repair would be broad/destructive |
| Healthy traffic | Confirm healthy rows/imports can remain isolated from the affected record | Recovery would make healthy data unavailable |

If any stop condition applies, leave the affected work in a bounded repair-required state, preserve evidence privately, and escalate. Do not improvise deletion, overwrite, or retry loops.

## 1. Durable repair-state and saga recovery

**Use when:** import publication, compatibility application, rollback, or recovery state is incomplete.

1. Read the durable terminal and repair state through the approved internal operating surface.
2. Verify the affected record's current authority, generation/provenance fence, and whether a visible presentation already exists.
3. If identity proof is complete, run the narrow authorized repair/replay path for that one record.
4. Re-read both the package authority and compatibility visibility result after repair.
5. If proof is incomplete, inconsistent, or points to a newer incarnation, stop. Keep the record repair-required; never compensate with an identifier-only delete.
6. Record the aggregate state transition and decision outside publishable reports.

**Success:** exactly one verified current authority remains; no newer incarnation is removed; healthy rows remain available.

## 2. Outbox acknowledgement failure

**Use when:** compatibility application appears complete but acknowledgement/replay did not complete.

1. Preserve the durable outbox item and repair context. Do not clear an entire queue or acknowledge a batch blindly.
2. Isolate the affected item so unrelated startup and imports can proceed.
3. Verify whether the compatibility write happened before retrying acknowledgement.
4. Replay only the affected item through the authorized recovery path, with its identity fence intact.
5. Verify acknowledgement and visibility after replay. If either side disagrees, keep the item repair-required and escalate.

**Success:** the item is acknowledged exactly once or remains safely isolated; no unrelated item is discarded.

## 3. Missing-head list isolation

**Use when:** one presentation row lacks its authoritative package head.

1. Keep healthy rows readable; do not turn a single missing-head row into a list-wide outage.
2. Classify the affected row as quarantined or repair-required without changing the public list shape.
3. Do not open, export, sync, or delete the affected row as if it were healthy.
4. Use a separately authorized repair only after identity and current ownership are proven.
5. Verify that repaired visibility returns only when the authoritative head and compatibility projection agree.

**Success:** healthy list entries continue to work, the affected row remains non-openable until repaired, and no automatic deletion occurs.

## 4. Poisoned startup record

**Use when:** startup recovery encounters an unreadable or repeatedly failing outbox/repair record.

1. Isolate the record using the bounded dead-letter or quarantine mechanism.
2. Allow startup and unrelated imports to continue; do not retry the same poisoned record indefinitely.
3. Preserve enough private incident evidence to reproduce the operator decision without placing it in a publishable report.
4. Diagnose and repair through a controlled, single-record path only after the state can be verified.
5. If repair cannot establish safe authority, retain the isolate state and escalate rather than deleting it.

**Success:** service starts for healthy work, the poison record is contained, and future repair remains possible.

## 5. Media policy and recovery boundary

**Use when:** import media write/finalization, cleanup, or external-media policy is implicated.

1. Preserve package and presentation authority before considering media cleanup.
2. Treat media recovery as best-effort. This runbook does not establish crash-safe media consistency because no durable media manifest/replay gate is complete.
3. Keep imported external media blocked unless deployment policy explicitly permits a safe, pinned origin.
4. Keep vector conversion disabled unless the separately configured policy validates; do not substitute an unverified executable.
5. Do not bulk-delete possibly referenced media. Reconcile one verified record at a time and retain ambiguous media for follow-up.

**Success:** no visible presentation loses verified referenced media; no external fetch or converter policy is broadened during recovery.

## 6. Retention dry-run and restore rehearsal

**Use when:** an operator requests retention, compaction, cleanup, or storage recovery.

1. Confirm that retention remains dry-run/default-off.
2. Create an approved recoverable backup or isolated copy before evaluating candidates.
3. Run the dry-run only. Verify that active jobs, pending visibility, repair/outbox records, heads, leases, mutation results, and authority tombstones are excluded.
4. Rehearse restore against an isolated copy; accept only a complete prior or complete replacement state, never partial state.
5. Record the aggregate dry-run and restore outcome. Do not enable destructive expiry, root replacement, or physical compaction from this result.
6. Escalate for separate policy approval and crash-safe implementation before any production enablement.

**Success:** protected references are selected zero times, restore evidence is isolated and complete, and no production data is deleted.

## 7. Client unknown and cancellation races

**Use when:** the dashboard times out, reports an unknown outcome, unmounts, or receives cancellation-related status.

1. Treat unknown outcome as unconfirmed, not failed and not successful. User-facing copy must not say cancellation was requested unless a cancellation action actually occurred; an admission body timeout after server acceptance is also unconfirmed.
2. Instruct the user to check existing presentations before retrying. Do not trigger reconcile, delete, or retry automatically.
3. If cancellation is accepted or still progressing, wait for the authoritative terminal status.
4. If cancellation is too late because the job is already visible or done, preserve the presentation and finish normal finalization; do not roll it back.
5. Fence progress delivered after the SSE-to-poll/final handoff or public settlement. Retained terminal SSE outcomes may settle the wait; settlement aborts the wait-owned recovery transport while leaving the caller ownership signal independent.
6. Escalate only when the final status and visibility remain inconsistent after the bounded read-only recovery path.

**Success:** no duplicate import, no destructive recovery, no late UI effect, and no deletion of a visible presentation.

## 8. Deployment rollback

**Use when:** a verified core regression requires reverting the release candidate.

1. Stop rollout through normal change control; preserve current durable state and incident evidence first.
2. Revert application behavior only through an approved release rollback. Do not delete package, compatibility, outbox, media, or retention records to simulate rollback.
3. Start with focused post-rollback health checks for admission, terminal status, list isolation, and startup recovery.
4. Keep isolated repair-required records intact for later authorized recovery.
5. Re-run the final release matrix against the rolled-back state before attempting a new rollout.

**Success:** the prior approved application behavior is restored without data-loss shortcuts, and unresolved records remain recoverable.

## Ownership and follow-up

| Owner | Required action | Definition of done |
| --- | --- | --- |
| Incident operator | Classify the failure and apply the narrow matching section above | One bounded path chosen; stop conditions documented privately |
| Release validation owner | Preserve the completed final-source verification record | Full unit exit 0 with 518 files passed / 1 skipped, 4196 tests passed / 3 skipped, 1227.75s; lint/build/browser outcomes and documented exclusions remain attached to the readiness decision |
| Main implementation owner | Finish the implementation plan and unfinished residual tasks | Each residual has source, tests, and evidence or remains explicitly open |
| Operations policy owner | Keep retention and media boundaries conservative | No destructive retention or crash-safe media claim without approved replay/restore evidence |
| Package-first/oracle owner | Preserve separate G0-G5 and G5 authority | No native or PowerPoint claim changes without owner evidence |

## Unresolved questions

1. Which job-control authorization method is the approved deployment policy?
2. Should missing-head repair remain read-only classification plus scheduled repair, or gain a separately authorized writer action?
3. Is durable media manifest/replay required for the intended recovery promise, or should media remain explicitly best-effort?
4. What retention age/count/byte policy and authority-tombstone lifetime are acceptable before any destructive compaction?
5. Must imported external media remain always blocked, or is a fully pinned administrator origin policy required?
6. Does the sibling local G5 authority remain in force, or will an owner-approved external trust model supersede it?
