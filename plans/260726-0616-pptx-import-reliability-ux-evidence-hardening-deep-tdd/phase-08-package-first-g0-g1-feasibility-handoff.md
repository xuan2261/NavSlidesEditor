---
phase: 8
title: "Package-First G0/G1 Feasibility Handoff"
status: completed
priority: P1
effort: "1-2d handoff/evidence review"
dependencies: [7]
---

# Phase 8: Package-First G0/G1 Feasibility Handoff

## Overview

Complete the read/link/status handoff for the sibling package-first plan's G0 canonical-contract and G1 feasibility work. This phase is not a second implementation or gate-state authority; it records no G0/G1 closure and contributes no native or OfficeCLI claim.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: handoff observes the owner plan's matrix subject/version/digest and links the existing package-first owner plan; it does not canonicalize or resolve rows independently.
- Functional: G0/G1 prerequisites, contradictions, missing receipts, and exact blockers are recorded without changing the owner plan's state.
- Functional: every handoff uses a typed non-authoritative envelope: `authority: observation`, `nonAuthoritative: true`, `sourcePlan`, `ownerGate`, `ownerSubjectHash`, `observedAt`, `freshness`, `outcome`, and `doesNotCloseGates: [G0,G1,G2,G3,G4,G5]`.
- Functional: OfficeCLI feasibility status records configured absolute executable path authority, version, hash, regular-file/non-reparse checks, shell-free preconditions, and missing-environment reasons without exposing private paths/secrets.
- Functional: direct-gateway versus launcher/qualified-receipt contradiction is handed to the owner plan as an unresolved G1 decision; no local choice is silently made.
- Functional: `maxMemory`/`maxProcesses` claims are not promoted unless the actual runner enforces them.
- Non-functional: no G0-G5 claim or owner-plan status is promoted from this handoff.

## Architecture

```text
Phase-7 evidence + owner-plan state
  -> read-only matrix/OfficeCLI prerequisite digest
  -> bounded handoff report
  -> existing package-first plan consumes/decides
```

The sibling `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd` plan owns matrix propagation, gateway/launcher implementation, receipts, and gate status. This phase may report a blocked or unavailable prerequisite, but it does not edit those phase files or close a gate.

## Related Code Files

| Action | File/area | Purpose |
|---|---|---|
| Read/link | Existing package-first `plan.md` and phase files | Sole G0-G5 authority |
| Read/consume | `server/services/pptx-import/canonical-feature-matrix.js` and capability DTO sources | Matrix subject/digest check |
| Read/consume | `server/services/validated-edited-export.js`, OfficeCLI gateway/launcher contracts | Contradiction/status inventory |
| Create | `plans/reports/pptx-package-first-g0-g1-handoff-<actual-run-id>.md` | Redacted non-authoritative observation envelope |
| Read/consume | Operator-controlled `EVIDENCE_PRIVATE_DIR` outside tracked reports | Private inputs only; never committed or shared by default |

## Implementation Steps

1. Read owner-plan status and current matrix subject/digest; identify duplicate/unknown/stale bindings without independently resolving rows.
2. Copy the owner-produced subject/version/digest and record actual run ID/as-of; do not create a competing canonical receipt.
3. Verify each prerequisite consumer either binds the owner subject or is labelled stale.
4. Verify administrator-configured OfficeCLI executable authority without logging private paths: absolute path policy, regular/non-reparse, version, hash and shell-free preconditions.
5. Record direct-gateway/launcher and process/memory-enforcement contradictions as owner-plan G1 blockers; do not select a policy here.
6. Produce the typed non-authoritative observation envelope with statuses `input-available`, `blocked`, `unavailable`, or `stale`; link it to the owner plan without editing gate state.

## Tests Before

- Existing package-first plan reports open G0/G1 work.
- Matrix consumers and OfficeCLI contracts have contradictory/missing prerequisite evidence.
- No trusted local OfficeCLI receipt is assumed.

## Tests After

- Subject/digest is stable and reproducible.
- Missing/duplicate/unknown rows are blocked, not silently dropped.
- Exact binary/path/version/hash mismatch is blocked; PATH fallback is not accepted.
- Direct-vs-launcher and resource-limit contradictions are visible to the owner plan.
- Handoff cannot be mistaken for G2-G5 qualification.

## Completion Checklist — reconciled 2026-07-28

- [x] The sibling package-first plan remains the sole G0-G5 authority.
- [x] This phase records only non-authoritative handoff/status observations and does not alter package-first source, receipts, or gate state.
- [x] Any private qualification material remains outside publishable closeout artifacts.
- [ ] No fresh owner-provided G0 subject/digest receipt is promoted by this plan.
- [ ] No G1 feasibility, containment, native validation, or OfficeCLI qualification is claimed.

## Test Scenario Matrix

| Scenario | Expected |
|---|---|
| Matrix digest mismatch | G0 status blocked in handoff |
| Duplicate/unknown row | G0 status blocked |
| Binary absent/unconfigured | G1 unavailable/blocked; no PATH fallback |
| Hash/version/path mismatch | G1 blocked |
| Safe local probe | G1 feasibility evidence only |
| Direct/launcher mismatch | G1 policy blocker; no silent selection |
| Handoff complete | Owner plan remains responsible for gate closure |

## Regression Gate

Use the existing package-first plan's named matrix/OfficeCLI commands and the current package-claim safety command where applicable:

```bash
npm run test:pptx:package:no-officecli
```

Do not invent a second gateway or claim G0/G1 closed from this command alone. Record any owner-plan command skip and its reason.

## Success Criteria — reconciled 2026-07-28

- [x] No package-first source or gate state is edited by this plan, and no G2-G5 claim is promoted.
- [x] The handoff boundary remains explicit in the release readiness record.
- [ ] Canonical G0 subject/digest and G1 prerequisite qualification remain owner-plan inputs, not outcomes of this phase.

## Risk Assessment

- Risk: handoff becomes duplicate authority. Mitigation: read/link-only scope and owner-plan link in every report.
- Risk: local feasibility is mistaken for containment/qualification. Mitigation: separate `feasibility` from `qualified` reason codes.
- Risk: private Windows paths leak. Mitigation: hashes/version/high-level environment only.

## Security Considerations

Keep raw inputs in operator-controlled `EVIDENCE_PRIVATE_DIR` outside tracked reports. Do not record executable private paths, credentials, tokens, machine dumps, or OfficeCLI output in the redacted observation. No containment, multi-tenant, or external-auth claim is created by this phase.

## Next Steps

The owner package-first plan decides G0/G1 and owns any implementation. Phase 9 only consumes/link status; best-effort remediation can continue if G1 is unavailable.
