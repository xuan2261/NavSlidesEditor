---
phase: 10
title: "PowerPoint Oracle G5 Candidate Evidence Intake"
status: completed
priority: P1
effort: "1-3d intake/review plus external evidence preparation"
dependencies: [7, 8, 9]
---

# Phase 10: PowerPoint Oracle G5 Candidate Evidence Intake

## Overview

Complete bounded status intake for candidate controlled PowerPoint evidence. The sibling package-first/local oracle contract remains the authority; no evidence manifest or visual comparison was available at closeout, so G5 remains blocked and this phase creates no trust root, golden, verdict, or PowerPoint-fidelity claim.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: candidate intake is quarantined before parsing and bounded by manifest/receipt bytes, artifact count, per-artifact/aggregate bytes, slide count, and compressed image size.
- Functional: symlinks/junctions/reparse points and lexical path escapes are rejected with `lstat`/`realpath` checks.
- Functional: candidate hashes, exact source/golden hashes, environment/fonts/locale/DPI/config, capture method and all-slide identity are recorded as a bounded observation.
- Functional: self-hashed/unkeyed receipts are integrity evidence only. Under the active local owner contract, three one-owner receipts are not independent provider attestation.
- Functional: any external/provider-authoritative trust model is an unresolved owner/user decision; this phase must not silently supersede the active local authority.
- Functional: placeholder/8x8/invalid/missing/stale/mismatched evidence is rejected before comparison.
- Functional: actuals use the real package-backed HTTP import/read/capture flow and bind exact package identity; no repeated slide 0/substituted capture.
- Functional: every output is a typed non-authoritative envelope with `authority: observation`, `nonAuthoritative: true`, `sourcePlan`, `ownerGate: G5`, `ownerSubjectHash`, `observedAt`, `freshness`, `outcome`, and `doesNotCloseGates: [G0,G1,G2,G3,G4,G5]`.
- Functional: publishable reports use aliases/aggregates and omit job/presentation/revision/head IDs, private paths, raw logs, credentials and machine dumps.
- Non-functional: no universal compatibility, containment, multi-tenant security, or PowerPoint parity claim outside the exact owner-scoped local subject.

## Architecture

```text
operator-controlled candidate bundle in EVIDENCE_PRIVATE_DIR
  -> bounded path/count/byte/hash validation
  -> active owner local evidence-envelope validation
  -> real package-backed actual capture
  -> all-slide identity validation
  -> finite comparison/threshold observation
  -> private owner input + redacted non-authoritative observation
```

No bundle means `G5 blocked: missing-evidence-manifest`. A browser screenshot, reconstructed corpus metric, placeholder golden, self-attested receipt, or null SSIM is not a substitute. A candidate bundle may be independently authorized in a future policy, but this plan records that as an observation and does not create that authority.

## Related Code Files

| Action | File/area | Purpose |
|---|---|---|
| Read/consume | `server/services/pptx-import/oracle/pptx-oracle-cli.js`, `oracle-evidence-runner.js`, `visual-evidence.js` | Existing validator/runner; identify bounded-input gaps |
| Read/consume | `server/services/pptx-import/evidence/local-evidence-contract.js`, `local-role-receipts.js` | Active local envelope/receipt authority |
| Read/consume | `server/routes/pptx-import.js`, package-backed capture helpers | Real import/read identity flow |
| Read/link | Existing P0 oracle phase and package-first owner plan | Current local G5 claim boundary; no owner-plan edits |
| Create | `plans/reports/pptx-oracle-g5-observation-<actual-run-id>.json` | Redacted non-authoritative observation envelope |
| Read/consume | Operator-controlled `EVIDENCE_PRIVATE_DIR` outside tracked reports | Private candidate manifest/actuals; never committed/shared by default |

## Implementation Steps

1. Read the active owner plan/local evidence contract and record its subject/version/authority as the source of truth; do not reintroduce superseded external-provider terminology.
2. Obtain a candidate bundle through an authorized local path and keep raw bundle/actuals in `EVIDENCE_PRIVATE_DIR` outside tracked reports.
3. Quarantine the candidate and perform count/byte/path/reparse checks before parsing. Stream hashes; reject duplicate, missing, stale, placeholder, symlink/reparse, oversized or mismatched evidence.
4. Validate the active local evidence envelope and role receipts. Record `authority: local`/owner status; do not claim independent attestation from plain hashes or one-owner receipts.
5. If an external/provider-authoritative trust model is requested later, stop and require a separate owner/user decision before adding signer/manual-approval requirements.
6. Verify source/golden hashes, environment, PowerPoint version, fonts/locale/DPI, capture method, and all-slide identity.
7. Capture actuals through the real package-backed HTTP flow and bind presentation/revision/generation/original/package hash only in private evidence.
8. Validate every expected slide identity and compare with fixed thresholds; require finite per-slide/aggregate results.
9. Write a redacted observation envelope with `ownerSubjectHash`, `observedAt`, `freshness`, `outcome`, and `doesNotCloseGates`; run forbidden-field scan before any report is shared or committed.
10. Publish only the scoped observation to Phase 11; the sibling owner plan independently decides whether any local G5 gate changes.

## Tests Before

- Current bare integrity probe fails with missing manifest/bundle.
- Existing local role receipts are plain canonical hashes and do not establish external signer identity.
- Validator reads unbounded manifest/artifacts and has no complete reparse/symlink contract.
- Oracle lifecycle may call POST reconcile for fixture teardown; this must be labelled teardown-only and never used as product timeout recovery.
- Historical placeholder-golden details cannot prove current evidence.

## Tests After

- Oversized/count/path/reparse/duplicate candidate fails before unbounded read.
- Missing candidate remains blocked with a typed observation envelope.
- Active local evidence envelope mismatch/invalid role receipt fails precisely.
- Hash mismatch, placeholder, missing slide, wrong slide identity, and stale environment fail precisely.
- Real capture binds all-slide identity and package authority privately.
- Finite result is reproducible from the owner-bound manifest; threshold failure remains a negative observation.
- Redacted observation contains only allowlisted fields and cannot close G5.
- Oracle timeout cleanup cannot be interpreted as product status recovery or silently delete a completed deck.

## Completion Checklist — reconciled 2026-07-28

- [x] The sibling local oracle contract remains the sole owner for any G5 decision; this phase is non-authoritative status intake.
- [x] Product timeout recovery remains GET-only; no oracle teardown action is treated as client recovery.
- [x] Any future candidate input must remain bounded and private/public evidence must remain separated.
- [ ] No trusted evidence manifest, visual comparison, actual-capture record, finite threshold result, or owner-approved G5 outcome is available at closeout.
- [ ] G5 is blocked and no PowerPoint, native, or pixel-perfect claim is issued.

## Test Scenario Matrix

| Candidate state | Expected |
|---|---|
| Missing manifest | Non-authoritative G5 blocked observation; no comparison |
| Invalid local envelope/receipt | Integrity failure; owner G5 unchanged |
| Symlink/reparse/path escape | Intake failure |
| Oversized manifest/artifact set | Bounded intake failure |
| Hash mismatch | Integrity failure |
| Placeholder golden | Integrity failure |
| Valid local envelope, visual below threshold | Finite negative observation; no automatic promotion |
| Valid local envelope, threshold pass | Scoped owner-plan candidate input; no self-authored gate closure |
| Repeated/wrong slide identity | Capture failure |
| Missing PowerPoint environment | External prerequisite blocked |
| External signer/manual-approval proposal | Unresolved policy; no silent authority change |

## Regression Gate

No-bundle integrity probe (expected structured non-zero):

```bash
npm run test:pptx:oracle:integrity
```

For an approved candidate bundle, use parameterized commands; placeholders are conceptual and must not be committed as private paths:

```bash
npm run test:pptx:oracle:integrity -- --evidence-manifest <manifest> --role-receipts <receipts>
npm run test:pptx:oracle:qualify -- --evidence-manifest <manifest> --role-receipts <receipts>
npm run test:pptx:oracle:capture -- --base-url <approved-base-url> --corpus-manifest <corpus-manifest> --actuals-dir <private-actuals-dir>
```

Without a candidate bundle/local owner envelope, only the integrity-blocked result is expected. These commands observe owner evidence; they do not close the owner gate here.

## Success Criteria — reconciled 2026-07-28

- [x] Owner authority and non-authoritative observation boundaries are preserved; no heuristic or self-authored result becomes a 1:1 claim.
- [x] G5 blocked status is explicit and separate from best-effort readiness.
- [ ] Candidate intake, authoritative actuals, finite/reproducible comparison, and any G5 decision await a trusted owner-bound evidence bundle.

## Risk Assessment

- Risk: external evidence terminology revives superseded provider authority. Mitigation: active local contract is source of truth; any change is a separate decision.
- Risk: candidate bundle consumes memory or reads outside root. Mitigation: quarantine, lstat/realpath and bounded streaming intake.
- Risk: oracle teardown calls destructive reconcile. Mitigation: label teardown-only and test no product wait path uses it.
- Risk: environment drift. Mitigation: bind exact environment/fonts/locale/DPI in private owner-bound manifest.

## Security Considerations

Treat candidate bundles, receipts, package paths and actuals as sensitive. Keep them in `EVIDENCE_PRIVATE_DIR`; do not print credentials, tokens, private keys, raw machine configuration, live IDs, or raw logs. Redacted observations contain aliases/aggregates only.

## Next Steps

Phase 11 consumes this as an optional G5 observation. The existing package-first/local owner plan independently controls any G5 state or claim wording.
