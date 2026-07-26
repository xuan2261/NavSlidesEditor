---
phase: 9
title: "Package-First G2/G3/G4 Capability Status Handoff"
status: pending
priority: P1
effort: "1-2d status review"
dependencies: [7, 8]
---

# Phase 9: Package-First G2/G3/G4 Capability Status Handoff

## Overview

Record the existing package-first plan's G2 edited-package, G3 artifact, and G4 exact-row qualification status without duplicating implementation or gate ownership. This phase is a read/link-only status handoff; all mutation, native re-import, OfficeCLI, artifact, and row-promotion work belongs to the existing package-first plan.

## Requirements

- Functional: consume only exact G0/G1 subject/digest/status from Phase 8 and the owner plan.
- Functional: every output is a typed non-authoritative observation envelope with `authority: observation`, `nonAuthoritative: true`, `sourcePlan`, `ownerGate`, `ownerSubjectHash`, `observedAt`, `freshness`, `outcome`, and `doesNotCloseGates: [G0,G1,G2,G3,G4,G5]`.
- Functional: report whether G2/G3/G4 prerequisites are ready, blocked, stale, or unavailable; do not execute a second qualification flow.
- Functional: preserve exact-row policy: chart/SmartArt/unsupported rows remain preserve-only unless the owner plan has complete adapter, transaction, mutation-surface, native re-import, and independent evidence.
- Functional: report existing HTTP contract accurately: missing idempotency/generation input remains the current 400 contract unless the owner plan deliberately approves and migrates a breaking change; do not state 422 by default.
- Functional: no artifact packaging, corpus metrics, or local feasibility result promotes fidelity/editability.
- Non-functional: existing package-first plan remains sole implementation/status owner; Phase 11 consumes owner status directly, not a self-authored gate verdict.

## Architecture

```text
owner-plan G0/G1 status + Phase-7 evidence
  -> exact prerequisite/status digest
  -> bounded G2/G3/G4 handoff
  -> owner plan decides implementation and gate state
```

This phase never changes capability DTOs, package transactions, edited-export routes, matrix rows, owner-plan checkboxes, or release claims. It only keeps the remediation plan's release matrix synchronized with the owner plan's evidence-backed state.

## Related Code Files

| Action | File/area | Purpose |
|---|---|---|
| Read/link | Existing package-first plan and phase files | Sole gate authority |
| Read/consume | `server/services/validated-edited-export.js`, `server/routes/pptx-edited-export.js` | Current HTTP/idempotency contract reference |
| Read/consume | `server/services/pptx-import/canonical-feature-matrix.js`, capability/fidelity DTO sources | Exact-row policy reference |
| Create | `plans/reports/pptx-package-first-g2-g4-status-<actual-run-id>.md` | Redacted non-authoritative observation envelope |
| Read/consume | Operator-controlled `EVIDENCE_PRIVATE_DIR` outside tracked reports | Private owner artifacts only; never committed or shared by default |

## Implementation Steps

1. Read owner-plan G0/G1 status and Phase-7 current evidence; record exact subject/digest.
2. Inventory owner-plan G2/G3/G4 statuses and identify stale/missing prerequisites without changing them.
3. Verify current edited-export contract wording: missing headers/invalid idempotency are 400 under current route; unavailable/blocked execution remains separately classified.
4. Record exact-row evidence requirements and preserve-only rows; do not run synthetic qualification as a substitute.
5. Produce the typed non-authoritative observation envelope with actual run ID, owner-plan/as-of links, reason codes and no private identifiers.
6. Store any raw owner artifacts only in `EVIDENCE_PRIVATE_DIR`; keep the tracked report as an allowlisted redacted aggregate.
7. Update only this remediation plan's optional status input when the owner plan has a new evidence record; never edit owner gate state here.

## Tests Before

- Existing owner plan has open/conditional G2-G4 work.
- G2/G3/G4 status can be confused with best-effort importer health.
- Current missing-idempotency HTTP contract is 400, not the stale 422 matrix wording.

## Tests After

- Handoff references one exact matrix subject/digest and owner-plan evidence.
- Missing/blocked prerequisite remains blocked without partial promotion.
- G2/G3/G4 status cannot change best-effort release readiness.
- Chart/SmartArt/unsupported rows remain preserve-only absent exact owner-plan evidence.
- HTTP contract wording is compatible with current route behavior.

## Function / Interface Checklist

- [ ] Existing package-first plan is named sole owner.
- [ ] G0/G1 status is consumed, not reimplemented.
- [ ] Observation envelope contains owner gate/subject/as-of/freshness and `doesNotCloseGates`.
- [ ] G2/G3/G4 statuses are exact-row and evidence-bound.
- [ ] Current 400/blocked HTTP semantics are not rewritten accidentally.
- [ ] No source/gate/DTO/package transaction is modified by this phase.
- [ ] Raw artifacts stay in `EVIDENCE_PRIVATE_DIR`; tracked handoff is bounded/redacted.

## Test Scenario Matrix

| State | Expected |
|---|---|
| G0/G1 unavailable | G2-G4 status blocked/unavailable |
| G2 edited package missing native re-import | No promotion; owner-plan blocker |
| G3 artifact probe only | Packaging evidence; no fidelity promotion |
| G4 exact supported row | Promote only if owner plan has complete evidence |
| Chart/SmartArt/unsupported | Preserve-only/unavailable |
| Missing idempotency/generation | Current 400 contract; no mutation |
| Handoff report written | Owner plan remains unchanged |

## Regression Gate

Use the existing package-first owner's named qualification suites and current focused export/package-authority tests. This phase adds no second gateway and does not claim a green result from a handoff file.

```bash
npm run test:pptx:phase13
npm run test:pptx:package:no-officecli
```

Record unavailable OfficeCLI/native evidence as structured blocked status; do not suppress the owner-plan truth gate.

## Success Criteria

- [ ] G2/G3/G4 status is linked to the owner plan and exact subject.
- [ ] No duplicate qualification implementation or gate state exists.
- [ ] HTTP status wording matches current edited-export route.
- [ ] Preserve-only rows remain fail-closed.
- [ ] Best-effort release status is unaffected by optional package-first status.

## Risk Assessment

- Risk: two plans disagree on gate state. Mitigation: owner plan is authoritative; this phase only links/statuses.
- Risk: package artifacts overstate fidelity. Mitigation: exact-row evidence and separate claim labels.
- Risk: a route status correction becomes a breaking change. Mitigation: retain current 400 contract unless separately approved.

## Security Considerations

Do not record package paths, private environment data, credentials, capabilities, or raw OfficeCLI output. Do not claim containment or multi-tenant security from package-first evidence.

## Next Steps

Phase 10 consumes status only for candidate G5 evidence observation under the active owner contract. Phase 11 reports G2-G4 as optional claim rows and never makes them a best-effort dependency.
