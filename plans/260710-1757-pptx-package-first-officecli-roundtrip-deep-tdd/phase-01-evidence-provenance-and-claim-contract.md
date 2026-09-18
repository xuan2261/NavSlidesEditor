---
phase: 1
title: 'Evidence provenance and claim contract'
status: in-progress
effort: '1-2 weeks'
dependsOn: []
priority: P0
gates: [G0, G5-contract]
---

# Phase 1: Evidence provenance and claim contract

## Overview

Replace the current static/debt-tolerant SLA evaluator with a versioned, fail-closed claim contract. Separate byte recovery, package preservation, validity, semantic editability, and PowerPoint visual fidelity so one metric cannot greenwash another.

This phase owns `G0`: one canonical feature-row schema and content hash consumed
by the planner, product DTO, corpus, and evidence subject. It owns only the
level-5 provider contract; Phase 13 owns protected infrastructure.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [Main gate roadmap](./plan.md#claim-gate-roadmap)

## Existing Seams

- `server/services/pptx-import/sla-contract.js`
- `server/services/pptx-import/pptx-sla-1to1-cli.js`
- `server/services/pptx-import/oracle/`
- `server/services/pptx-import/oracle/baseline-ssim.json`
- `server/data/test-corpus/`
- `server/services/pptx-import/pptx-import-corpus-cli.js`
- `server/services/pptx-import/corpus-baseline.json`
- `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- `package.json` PPTX corpus/oracle/SLA scripts

Current blockers to encode as red tests: the corpus has an importer path separate from production, 8x8 placeholder/self-comparison visual evidence, stale corpus evidence, incomplete corpus alignment, and a gate that can read old static artifacts.

## Contract to Define

- `ClaimLevel`: `original-recovery`, `package-preservation`, `valid-edited-package`, `feature-editability`, `powerpoint-compatibility-visual-fidelity`.
- `EvidenceManifest`: schema version, claim level, source/export SHA-256, package revision, corpus manifest hash, test commit, command, selected lane identities, optional renderer/provider fields, OS, optional Office build/fonts, optional OfficeCLI binary hash/version, thresholds, policy digest, monotonic evidence epoch, timestamps, artifact hashes, and required protected-CI/provider attestations for that claim.
- `FeatureCoverageRow`: feature, fixture IDs, editability tier, required tests, claim level, optional level-5 provider evidence, status, and explicit exclusion reason.
- `CanonicalFeatureRow`: stable row ID, family, exact property/operation scope,
  canonical tier, claim ceiling, source-authority rule, patch adapter ID, impact
  policy ID, input transport/schema, eligibility-policy ID/version,
  canonical-normalization contract, fixtures, required test IDs, independent
  adapter qualification, transaction-validation eligibility, level-4 promotion
  state, and block/preservation reason. A G2 seed row may execute only when its
  real production transport, adapter, and transaction validation qualify; this
  never implies level-4 promotion.
- `CanonicalFeatureMatrix`: schema version, matrix version, canonically sorted
  rows, and deterministic SHA-256. Unknown rows/properties resolve to
  `unsupported-blocking`.
- `CompositeRun`: one invocation ID linking every semantic, package, optional visual, security, and resource artifact selected for the requested claim and produced from the same release candidate.
- Claim policy: missing, stale, mismatched, placeholder, self-comparison, or untrusted required-authority evidence is a hard failure for the corresponding claim.

## TDD Matrix

| Test first                            | Expected red                                          | Green behavior                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reject 8x8/debt goldens               | Current debt baseline accepted as data                | Placeholder dimensions/markers invalidate visual evidence                                                                                                                  |
| Reject self-comparison                | Same source and candidate accepted                    | Source/export identity and renderer lineage must differ as required                                                                                                        |
| Reject stale corpus                   | Old report can satisfy current corpus                 | Exact manifest hash and complete deck set required                                                                                                                         |
| Reject cross-run evidence             | Independent old files compose                         | All required artifacts share one composite run ID                                                                                                                          |
| Reject missing provider provenance    | Renderer fields absent                                | PowerPoint claim requires Office build, OS, fonts, and runner                                                                                                              |
| Reject source/export hash mismatch    | Visuals not tied to package                           | Evidence references exact package revision rendered                                                                                                                        |
| Production/corpus entrypoint mismatch | Corpus-only mapper can produce evidence               | Corpus invokes the production importer with identical guards, scene graph, strict policy, and flags                                                                        |
| Claim-ladder isolation                | One aggregate boolean hides gaps                      | Each level evaluates and reports independently                                                                                                                             |
| Honest lower-level pass               | Visual evidence absent                                | Original/package claims may pass without visual claim                                                                                                                      |
| Tamper detection                      | Hand-edited report and hashes are trusted             | Protected CI/provider attestation mismatch fails closed                                                                                                                    |
| Replay/policy downgrade               | Older valid evidence or thresholds are accepted       | Verifier checks a protected per-channel/claim/policy epoch ledger, issuer, workflow/ref, policy digest, release commit, predecessor, and highest transparency-backed epoch |
| Privacy retention                     | Screenshots retained indefinitely                     | Policy records visibility, redaction, and expiration                                                                                                                       |
| Matrix vocabulary drift               | Feature families define incompatible tiers            | Every family consumes the canonical five-tier vocabulary                                                                                                                   |
| Broad row overclaim                   | One passing property promotes a family                | Schema requires exact property/operation scope                                                                                                                             |
| Matrix subject mismatch               | Planner and evidence use different capabilities       | DTO, planner, corpus, and claim expose the same matrix hash                                                                                                                |
| Provider lane mismatch                | Policy and aggregator use different names             | `protected-powerpoint-provider` is the only authoritative lane                                                                                                             |
| G2/G4 promotion cycle                 | Seed operation must be promoted before validation     | Adapter qualification, transaction eligibility, and claim promotion are independent                                                                                        |
| Test-only transport qualification     | Plain string fixture qualifies TipTap production path | Row/evidence bind input transport, eligibility policy/version, and normalization contract                                                                                  |

## Implementation Steps

1. Write a failing production/corpus parity test, then remove the corpus-only import implementation and route corpus runs through the production importer before generating claim evidence. Add an architecture test that rejects any later corpus-only extractor path.
2. Write failing schema, replay, downgrade, and policy-identity tests before changing evaluators.
3. Write failing canonical-row tests, then define one versioned matrix schema and
   deterministic hash. Migrate existing family rows without broadening support.
4. Derive planner lookup, safe fidelity DTO rows, corpus coverage rows, and
   evidence-subject fields from the canonical matrix.
5. Model adapter qualification, transaction validation, and claim-level-4
   promotion independently. Only the last field authorizes level-4 wording.
   Bind each state to the row's exact input transport/schema,
   eligibility-policy ID/version, and canonical-normalization contract.
6. Version the evidence manifest and add strict parsers in a small service module.
7. Split the current SLA contract into independent claim-level evaluators and
   converge composite evaluation on one authoritative path.
8. Make the SLA CLI invoke or consume a fresh composite run directory, never implicit static baselines.
9. Generate a versioned corpus manifest from exact fixture bytes and canonical feature rows.
10. Add provider adapters with an explicit `informative` versus `claim-authoritative` role.
11. Normalize the provider lane to `protected-powerpoint-provider`.
12. Mark all current placeholder/self-comparison reports as non-claim debt evidence.
13. Define artifact hashing plus an independently verified claim trust policy with pinned OIDC issuer, repository, workflow path/ref, protected environment, artifact/policy digest, release commit, transparency evidence, and a protected append-only epoch ledger keyed by release channel, claim ID, and policy digest. Use a fake serialized ledger in Phase 1 tests; Phase 13 owns the protected production authority.
14. Produce human-readable and JSON reports with the same verdict and reason codes.
15. Document product wording allowed at each claim level in the machine-readable contract.

## File Plan

- Modify `server/services/pptx-import/sla-contract.js`.
- Modify `server/services/pptx-import/pptx-sla-1to1-cli.js`.
- Add `server/services/pptx-import/canonical-feature-matrix.js` and focused
  contract tests; family-specific files become data suppliers/adapters.
- Add focused modules under `server/services/pptx-import/evidence/`.
- Update oracle/corpus runners to emit the new manifest.
- Modify the corpus tester to call the production import entrypoint instead of its private parser/mapper path.
- Add unit tests beside the new evidence modules and integration tests for the CLI.
- Update CI scripts only enough to generate local non-authoritative evidence; authoritative provider wiring lands in Phase 13.

## Verification

```powershell
npx vitest run server/services/pptx-import/evidence-contract.test.js
npx vitest run server/services/pptx-import/sla-failclosed.test.js
npx vitest run server/services/pptx-import/production-corpus-parity.test.js
npm run test:corpus
npm run lint
npm run test
```

The fail-closed harness invokes the claim CLI, asserts non-zero for missing PowerPoint evidence only when level 5 is requested and for incomplete editability coverage only when level 4 or 5 is requested, and exits zero when those reason codes are correct. It also proves levels 1-3 do not require those higher lanes. The raw claim CLI remains a diagnostic and is not a passing Phase 1 validator.

## Deep File Inventory

| Action | File/interface                                                 | Planned change                                            | Test impact                                 |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| Create | `server/services/pptx-import/canonical-feature-matrix.js`      | Versioned rows, normalization, lookup, deterministic hash | New contract/property tests                 |
| Modify | `server/services/pptx-import/evidence/manifest-schema.js`      | Bind evidence to matrix schema/hash and exact test IDs    | Evidence negative/positive tests            |
| Modify | `server/services/pptx-import/evidence/composite-run.js`        | Canonical provider lane and one subject lineage           | Composite tests                             |
| Modify | `server/services/pptx-import/evidence/release-claim-policy.js` | Consume canonical lane and claim ceilings                 | Policy tests                                |
| Modify | `server/services/pptx-import/fidelity-contract.js`             | Derive safe row summary and claim ceiling                 | DTO/route tests                             |
| Modify | Family matrix modules                                          | Map legacy terms without promotion                        | Family migration tests                      |
| Modify | Corpus/SLA CLIs                                                | Emit and require matrix hash                              | CLI/corpus tests                            |
| Delete | None                                                           | Keep old evidence diagnostic until migration proves safe  | Architecture guard prevents authority reuse |

## Function and Interface Checklist

- [ ] Define `parseCanonicalFeatureMatrix(input)`.
- [ ] Define `canonicalFeatureMatrixHash(matrix)`.
- [ ] Define `featureRow(rowId)` with unknown-row fail-closed behavior.
- [ ] Derive planner, DTO, corpus, and evidence adapters from one envelope.
- [ ] Bind each row to input transport/schema, eligibility-policy ID/version, and
      canonical-normalization contract.
- [ ] Preserve `evaluateClaim()`, `requiredLanes()`, and production importer entrypoint.
- [ ] Remove the `protected-provider` lookup alias from authoritative evaluation.

## Tests Before

1. Unknown row/property blocks before adapter selection.
2. Broad row without exact property/operation scope is rejected.
3. Legacy tier vocabulary cannot enter a claim manifest.
4. Planner, DTO, corpus, and evidence with different matrix hashes fail.
5. Positive level-5 provider lane fails under the current naming mismatch.
6. A G2 seed row can validate without appearing in level-4 claims.
7. Evidence from a test-only plain string cannot satisfy a row requiring
   production TipTap JSON/HTML transport.

## Refactor

Introduce the canonical matrix seam, migrate family rows, then remove duplicate tier
translation and static authoritative SLA paths while lower claims stay green.

## Tests After

- Deterministic hash across row ordering.
- Backward-compatible safe DTO mapping without implied promotion.
- Claims 1-2 pass while G1-G5 inputs are absent.
- Level 3-5 subjects include exact matrix schema/version/hash.

## Dependency Map

```text
production importer -> corpus manifest -> claim evaluator
family row suppliers -> canonical matrix
canonical matrix -> planner + DTO + corpus + claim subject
canonical provider contract -> Phase 13 protected workflow
```

## Debug and Reports

- `reports/phase-01/claim-contract-red-green.json`
- `reports/phase-01/corpus-manifest.json`
- `reports/phase-01/evidence-debt-inventory.md`
- `reports/phase-01/claim-wording-matrix.md`
- Log hashes, dimensions, provenance, and reason codes, never slide content by default.

## Risks and Controls

- **Metric gaming:** lock thresholds and required feature rows in reviewed policy.
- **Private content leakage:** use synthetic/licensed corpus only for release evidence; restrict artifact access and retention.
- **Provider drift:** pin Office build, OS image, fonts, and rendering settings.
- **Manifest rewriting:** every claim requires protected-CI attestation and level 5
  additionally requires `protected-powerpoint-provider` attestation; self-authored
  hash manifests are non-authoritative.
- **Valid-evidence replay:** require release-commit binding, pinned policy digest, and the highest valid entry from the protected append-only epoch ledger; a manifest-carried counter alone is never authoritative.
- **Test-only importer proof:** prohibit claim evidence until corpus and production import entrypoints are identical.
- **False confidence from lower tiers:** UI and marketing consume the exact claim level, not a single `passed` flag.

## Success Criteria

- [x] Placeholder, self-comparison, stale, cross-run, and mismatched evidence fail for deterministic reason codes.
- [x] Exact original and package-preservation claims can pass independently of visual fidelity.
- [x] The current repository still rejects the 1:1 product claim honestly.
- [x] Every required corpus deck and feature row is hash-addressed.
- [ ] Every claim verifies against a protected-CI trust root; level 5 additionally
      verifies against the `protected-powerpoint-provider` trust root.
- [x] Older/forked ledger evidence, duplicate concurrent epochs, downgraded policy, unapproved workflow identity, or wrong release commit fails closed.
- [x] Corpus and production imports use the same guards, scene graph, strict policy, and mapper entrypoint; no private corpus extractor remains.
- [x] Evidence privacy, retention, and provider-authority policies are explicit.
- [ ] One canonical feature matrix drives planner, DTO, corpus, and evidence with
      one deterministic schema/version/hash.
- [ ] Unknown rows and properties fail closed, and broad family rows cannot imply
      untested editability.
- [ ] G2 transaction eligibility and G4 claim promotion are independent states.
- [ ] Planner, adapter, corpus, evidence, and claim hashes reject transport,
      eligibility-policy, or normalization-contract mismatch.
- [ ] `protected-powerpoint-provider` is the only authoritative provider lane.
- [ ] Focused tests, corpus tests, lint, and unit suite pass.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active provider, protected-CI,
attestation, and independent-approval requirements above. Earlier records remain
historical and must not be reinterpreted as current local evidence.

### Active Goal and Contract

- Define `authority:"local"` evidence with one versioned canonical matrix schema,
  deterministic matrix hash, stable reason-code schema, exact row IDs, evidence
  subjects, and bounded local claim wording.
- Bind each claim to the exact package revision, Original/export hashes,
  projection, source map, journal, corpus, policy, configuration, commands,
  thresholds, OfficeCLI identity, PowerPoint/Windows/fonts/locale/DPI identity,
  outputs, and Windows Electron artifact hashes applicable to that claim.
- Preserve historical protected-provider, launcher, cloud, LibreOffice, manual,
  placeholder, and prior-schema records byte-immutably with their original
  authority. A current local verdict requires a fresh local run.
- Require every claim-bearing representation to disclose that profile access,
  egress isolation, independent descendant containment, teardown attestation,
  independent attestation, and separate approvers are not proven.
- Keep original recovery, package validity, row editability, and local PowerPoint
  evidence as independent claim levels.
- Allow one disclosed owner to approve three distinct immutable `app-storage`,
  `security`, and `release` receipts. Do not claim separation of duties.
- Require the canonical matrix to carry closed impact-policy, transport/schema,
  normalization-contract/version, eligibility-policy/version, and adapter
  catalogs. Canonical object keys, rows, and identifier sets serialize to one
  UTF-8 subject and SHA-256. Every consumer carries its exact schema, matrix
  version, and hash, and rejects an omitted, unknown, stale, contradictory, or
  noncanonical binding before adapter selection or claim issuance.
- Keep adapter qualification, transaction eligibility, and level-4 promotion as
  independent exact-row states. Executable or promoted rows require one exact
  current qualified adapter; preservation and blocking rows have no adapter and
  cannot become eligible or promoted through sibling or family evidence.
- Version the fail-closed reason-code vocabulary and deterministic primary and
  supplemental ordering. Unknown internal codes map to a safe public fallback.
  Every transaction-worker non-success return must emit registered `reasonCodes`
  and the current `reasonCodeSubject`; inventory and test every such return.
  Changing a matrix, scope, tier, catalog binding, qualification, eligibility,
  normalization, impact, or promotion creates a new subject, stales dependent
  pending authority, and never mutates or reinterprets historical records.
- Define `matrixAuthorityEpoch` as one global monotonic high-water epoch per
  package data directory. Crash recovery may never lower it. Matrix evolution or
  restore-forward authority changes must atomically reissue the current authority
  to every live presentation head, or invalidate unreissued heads fail-closed,
  before any later save or export.

### Active Dependencies, Validation, and Completion

Phase 1 owns `G0` and supplies the canonical subject consumed by Phases 2 through 13. Local hashes and receipts provide integrity and traceability, not an external
trust root. Product wording is limited to the exact recorded local environment
and must reject universal or cross-platform compatibility language.

Run focused evidence-schema, matrix-determinism, stale-history, representation,
reason-code, one-owner receipt, and tamper-negative tests, followed by:

```powershell
npm run lint
npm run test
npm run test:corpus
npx vitest run server/services/pptx-import/sla-failclosed.test.js
```

This phase is complete when `G0` is canonical and deterministic, every consumer
fails closed on a missing or mismatched subject, historical evidence remains
unchanged, all claim-bearing surfaces carry the local limitations, and the
global authority epoch and transaction-worker reason-code contracts above are
proven, and the applicable validators pass.
