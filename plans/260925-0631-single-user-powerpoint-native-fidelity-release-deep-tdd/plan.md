---
title: 'Single-User PowerPoint Native Fidelity and Release Deep TDD'
description: 'Consolidate release governance, package authority, native edited-PPTX qualification, PowerPoint visual evidence, operational hardening, architecture cleanup, and full release tests for the single-user NavSlides product.'
status: pending
priority: P0
effort: '33-46 engineer-weeks plus CI and physical Windows/PowerPoint runtime'
issue: null
branch: master
tags:
  [pptx, powerpoint, native-fidelity, release, ci, architecture, operations, refactor, deep, tdd]
blockedBy: []
blocks: []
created: 2026-09-25
mode: '--deep --tdd'
scopeDecision: hold
productScope: single-user-self-hosted
strategicGoal: powerpoint-native-fidelity
---

# Single-User PowerPoint Native Fidelity and Release Deep TDD

## Overview

This is the execution authority for moving NavSlides from a conditionally
production-ready single-user editor to a release with qualified native edited
PPTX rows and environment-bounded Microsoft PowerPoint fidelity evidence. It
reuses completed importer, runtime, security, export-policy, and package-store
work rather than creating parallel implementations.

## Locked Decisions

- Product scope remains single-user and self-hosted. Built-in accounts,
  multi-tenancy, Redis rooms, and horizontal scaling are out of scope.
- PowerPoint native fidelity is a strategic release requirement. Claims remain
  limited to exact promoted rows, corpus, Windows/PowerPoint build, fonts, and
  artifact hashes.
- Direct local OfficeCLI is the active G1 policy. Historical launcher, cloud,
  KMS/HSM, protected-provider, and independent-attestation requirements are not
  active requirements.
- Upstream parity is historical documentation and cannot gate releases.
- Package state remains authoritative; `presentations.json` is a recoverable
  compatibility projection. No second package store, outbox, journal, or
  transaction engine may be introduced. One composite claim evaluator supports
  distinct protected-provider and environment-bounded local PowerPoint claim kinds.
- The next release uses a new SemVer greater than `1.16.0`; the existing
  `v1.16.0` tag is immutable and never moved or reused.
- Release evidence is a multi-host DAG bound to one source SHA and one prebuilt
  client artifact, not an assumption that Docker, Electron, OfficeCLI, and
  PowerPoint run on one machine.

## Existing Work Reused

- Completed baseline: [`260917` strict importer 11/11](../260917-1500-pptx-native-strict-11-of-11-qualification-deep-tdd/plan.md).
- Technical annex: [`260710` package-first architecture](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md).
- Remaining reliability work migrated from [`260810`](../260810-0921-verified-production-readiness-remediation-deep-tdd/plan.md).
- Existing reconstructed-export contracts reused from [`260808`](../260808-1700-pptx-export-fidelity-all-surfaces/plan.md).
- Runtime/security/artifact baseline reused from [`260820`](../260820-0235-full-codebase-review/plan.md).

## Gate and Dependency Map

```text
01 baseline
  -> 02 release state/docs -> 03 test topology -> 04 green-SHA release
  -> 05 operations -> 06 compatibility/media -> 07 G0 authority
                                             -> 08 G1 OfficeCLI
G0 + G1 -> 09 transaction/native validation -> 10 physical G2
G2 -> 11 primitive G4 rows -> 12 chart/workbook row
11 + 12 -> 13 shared export parity
13 -> 14 behavior-preserving decomposition
04 + 10-14 -> 15 Windows artifact G3 + local PowerPoint G5
all phases -> 16 clean RC full verification and release decision
```

## Phases

| Phase | Name                                                                                                                     | Priority | Dependencies          | Status  |
| ----: | ------------------------------------------------------------------------------------------------------------------------ | -------: | --------------------- | ------- |
|     1 | [Baseline consolidation and scope lock](./phase-01-start.md)                                                             |       P0 | None                  | Pending |
|     2 | [Release state and documentation governance](./phase-02-release-state-and-documentation-governance.md)                   |       P0 | 1                     | Pending |
|     3 | [Vitest topology and full-suite performance](./phase-03-vitest-topology-and-full-suite-performance.md)                   |       P0 | 1, 2                  | Pending |
|     4 | [Build-once CI and exact green-SHA release](./phase-04-build-once-ci-and-green-sha-release.md)                           |       P0 | 2, 3                  | Pending |
|     5 | [Single-user operational hardening](./phase-05-single-user-operational-hardening.md)                                     |       P0 | 4                     | Pending |
|     6 | [Compatibility projection and durable media recovery](./phase-06-compatibility-projection-and-durable-media-recovery.md) |       P0 | 5                     | Pending |
|     7 | [Package authority and matrix G0](./phase-07-package-authority-and-matrix-g0.md)                                         |       P0 | 6                     | Pending |
|     8 | [Direct OfficeCLI qualification G1](./phase-08-direct-officecli-qualification-g1.md)                                     |       P0 | 7                     | Pending |
|     9 | [Native re-import and transactional publication](./phase-09-native-reimport-and-transactional-publication.md)            |       P0 | 7, 8                  | Pending |
|    10 | [Physical edited-package seed G2](./phase-10-physical-edited-package-seed-g2.md)                                         |       P0 | 8, 9                  | Pending |
|    11 | [Central mutation gating and primitive G4 rows](./phase-11-central-mutation-gating-and-primitive-g4-rows.md)             |       P0 | 9, 10                 | Pending |
|    12 | [Native chart and workbook editability](./phase-12-native-chart-and-workbook-editability.md)                             |       P1 | 9, 10, 11             | Pending |
|    13 | [Shared PPTX export plan and parity](./phase-13-shared-pptx-export-plan-and-parity.md)                                   |       P1 | 11, 12                | Pending |
|    14 | [Module decomposition and registry cleanup](./phase-14-module-decomposition-and-registry-cleanup.md)                     |       P1 | 13                    | Pending |
|    15 | [PowerPoint oracle and Windows artifact G3/G5](./phase-15-powerpoint-oracle-and-windows-artifact-g3-g5.md)               |       P0 | 4, 10, 11, 12, 13, 14 | Pending |
|    16 | [Final full verification and release rehearsal](./phase-16-final-full-verification-and-release-rehearsal.md)             |       P0 | 1-15                  | Pending |

## Full-Test Policy

- Every phase uses RED → GREEN → REFACTOR and must pass its focused mechanical
  gate before the next dependent phase starts.
- Phase 16 reruns installation, lint, all Vitest projects, merged coverage,
  unsharded full Vitest, build, docs, matrices, audits, all Playwright projects,
  strict PPTX/import/package-first gates, browser audit, adversarial/performance
  checks, load smoke, Docker, Electron, runtime closure, artifact checksums,
  SBOM/provenance, and local PowerPoint evidence.
- A missing mandatory physical prerequisite is a blocker, not a skip or inferred
  pass. Flaky retry-passes require root-cause disposition.

## Whole-Plan Success Criteria

- [ ] One tag, version, changelog, lock state, source SHA, artifact lineage, and evidence subject agree.
- [ ] Full tests complete inside documented CI budgets without losing test IDs or reducing coverage floors.
- [ ] Single-user deployment is bounded, recoverable, non-root, health-checked, and backed up with uploads.
- [ ] Compatibility dead letters and imported media recover from restart without hiding package authority.
- [ ] G0 and G1 pass with exact current authority and direct local OfficeCLI evidence.
- [ ] A physical R1 closes G2 without mutating Original or prior valid heads.
- [ ] Promoted primitive/chart rows close G4 only after complete client/server mutation-surface evidence.
- [ ] Browser and server reconstructed exporters consume one semantic export plan.
- [ ] NSIS/portable artifacts close G3 and exact local PowerPoint evidence closes G5.
- [ ] Release rehearsal has no mandatory skip, stale receipt, docs drift, or unresolved contradiction.

## Red Team Review

### Session — 2026-09-25

**Findings:** 15 accepted, 3 rejected after deduplication and evidence review.  
**Severity:** 2 Critical, 11 High, 2 Medium.  
**User decision:** Apply all accepted findings.

|   # | Finding                                                                                                                   | Severity | Disposition | Applied To          |
| --: | ------------------------------------------------------------------------------------------------------------------------- | -------: | ----------- | ------------------- |
|   1 | Current version/tag contract made a new RC impossible                                                                     | Critical | Accept      | Phases 2, 4, 16     |
|   2 | Local PowerPoint evidence conflicted with protected-provider claim policy                                                 | Critical | Accept      | Phases 14, 16       |
|   3 | Project import media commit was not atomic with presentation publication                                                  |     High | Accept      | Phase 5             |
|   4 | PowerPoint/artifact evidence ran before source decomposition and became stale                                             |     High | Accept      | Phases 14, 15       |
|   5 | Build-once lineage and immutable-RC rules were not enforced end to end                                                    |     High | Accept      | Phases 4, 16        |
|   6 | Vitest baseline and optimized topology did not share one inventory                                                        |     High | Accept      | Phase 3             |
|   7 | Mutation gating missed real rich-text, history, AI, modal, and persistence callers                                        |     High | Accept      | Phase 11            |
|   8 | OfficeCLI feasibility, isolation, and process cleanup were too late or too weak                                           |     High | Accept      | Phases 1, 8         |
|   9 | Lifecycle/matrix migration could invent authority for ambiguous legacy heads                                              |     High | Accept      | Phase 7             |
|  10 | G4 rows lacked a physical fixture/evidence manifest                                                                       |     High | Accept      | Phases 10–12        |
|  11 | PowerPoint golden provenance allowed candidate-as-golden and raw-PNG false failures                                       |     High | Accept      | Phase 15            |
|  12 | Release rehearsal assumed one host could run every physical lane                                                          |     High | Accept      | Phases 4, 16        |
|  13 | Artifact signing and OS/browser/container supply-chain evidence were incomplete                                           |     High | Accept      | Phases 4, 5, 15, 16 |
|  14 | Cancellation did not propagate through OfficeCLI/native validation to proven drain                                        |   Medium | Accept      | Phase 9             |
|  15 | Media ownership, backup recovery, Electron single-instance, and element registry ownership needed one consistent contract |   Medium | Accept      | Phases 5, 6, 14     |

Rejected expansions:

- Do not add built-in multi-user authentication or tenant isolation.
- Do not blanket-sanitize trusted-author HTML; require explicit project-import
  trust acknowledgement and preserve route/origin isolation.
- Do not treat every historical pending UI plan as implementation scope for this
  native-fidelity/release plan.

### Whole-Plan Consistency Sweep

- Decision deltas checked: version/tag, multi-host receipts, build-once artifact,
  phase 14/15 ordering, local PowerPoint claim kind, media ownership, lifecycle
  migration, fixture governance, and immutable RC.
- Files reread: `plan.md` and all 16 phase files.
- Reconciled stale references: phase ordering and PowerPoint/module phase numbers.
- Unresolved contradictions: 0.

## Execution Handoff

Run each phase through `/ak:cook` only after a fresh phase-specific scout pass.
The plan files are authoritative when runtime task state differs.
