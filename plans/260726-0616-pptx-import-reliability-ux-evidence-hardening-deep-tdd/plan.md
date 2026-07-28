---
title: "PPTX Import Reliability UX Evidence Hardening Deep TDD"
description: "Close core PPTX import reliability gaps while preserving the self-hosted best-effort claim ceiling; release closeout records a bounded best-effort software-lane decision with optional evidence lanes kept separate."
status: completed
priority: P1
effort: "22-32 engineer-days core remediation/evidence plus policy and external evidence time"
branch: feature/pptx-import-reliability-ux-evidence-hardening
tags: [bugfix, pptx, import, reliability, security, frontend, testing, docs, package-first, tdd]
blockedBy: []
blocks: []
related: [260722-1630-pptx-import-p0-readiness-remediation-deep-tdd, 260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd, 260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd]
created: 2026-07-26
mode: "--deep --tdd"
scopeDecision: hold
---

# PPTX Import Reliability UX Evidence Hardening Deep TDD

## Overview

This plan converts the completed read-only audit and red-team review into a staged, test-first remediation program. It makes the self-hosted best-effort importer truthful at client lifecycle, package-consistency, authority, resource/security, diagnostics, retention, and evidence boundaries. It does not become a second owner of the existing package-first G0-G5 plan and does not infer PowerPoint 1:1 or universal native capability.

## Closeout Status — 2026-07-28

Core remediation phases and the final release closeout are complete at the documented best-effort claim ceiling. The fresh final-source full-unit gate passed: 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s. The best-effort software-lane decision is PASS WITH RESIDUALS, not a release authorization. Strict/native, full browser heuristic, performance, package-first G0-G4, and G5 evidence remain separate blocked/open/skipped lanes. The current decision record and rollback procedure are [release readiness](../reports/pptx-import-release-readiness-260728-1756.md) and [rollback runbook](../reports/pptx-import-rollback-runbook-260728-1756.md).

The current focused client lifecycle evidence is 69 passed tests across the wait/API/HomePage suites; full lint has 0 errors and 27 existing warnings; production build passed; and the critical browser journey passed 1/1 in 38.7s. Strict/native qualification, full browser heuristic qualification, performance qualification, package-first G0-G4, and G5 oracle evidence remain separate rows; none is promoted by this plan.

## Product and Delivery Contract

### Outcome

- Best-effort PPTX import remains usable and clearly bounded.
- Admission and admitted-job terminal waiting use separate bounded clocks; SSE, polling, timeout, visibility, and repair behavior retain their explicit safety boundaries. Queued progress is fenced after handoff, terminal SSE outcomes remain deliverable, and settlement aborts the wait-owned recovery transport.
- Automatic timeout recovery is non-destructive: it performs bounded durable status GET only; the existing destructive repair endpoint is never called automatically.
- Durable completion remains pending visibility until the current server listability result permits opening; a fuller identity/provenance resolver remains an explicit residual.
- A known orphan/missing-head row cannot make healthy `/api/presentations` rows unavailable. Current missing-head behavior is a list-wide HTTP 422, not a proven literal 500; the repaired contract is list isolation plus observable repair metadata.
- Core rollback fencing and poisoned-outbox isolation protect delivered repair paths; a fully expanded persisted multi-state repair saga is not claimed.
- Resource, converter, external-media, report, and terminal-error boundaries are explicit. Parser heap limits are not presented as whole-server RSS isolation.
- Import reports survive navigation/reload in an editor-only bounded DTO and do not leak raw diagnostics, source names, job IDs, authority IDs, or child stderr through GitHub/sync/export DTOs.
- Durable lifecycle and retention preserve rollback/idempotency/reconcile authority while retention remains dry-run/default-off; physical StateStore history compaction is not enabled or claimed.
- Corpus, strict, browser, performance, package-first, and PowerPoint evidence remain separate claim lanes with run provenance.
- Best-effort release has an executable terminal gate even if package-first or external PowerPoint evidence remains unavailable.

### Constraints

- Preserve immutable original recovery, package authority, generation fencing, idempotency, outbox ownership, and the current single-user self-hosted model.
- TDD first: green characterization tests for current behavior; future behavior is activated only by its owning implementation phase.
- Reuse existing job manager, AbortController patterns, package-store/StateStore WAL, outbox, report DTO, evidence manifests, and test harnesses.
- Keep new code modules under 200 LOC unless an existing boundary clearly requires otherwise.
- Never overwrite unrelated dirty work. Existing modified plans/tests and `.tmp` artifacts are user-owned until explicitly reviewed.
- Do not create multi-tenant auth. Sensitive job control still needs either a per-job capability or a verified proxy-principal binding; UUID secrecy alone is not authorization.
- Keep package lock ordering intact: do not hold package-store serialization while performing presentation-store writes.

### Non-goals

- No second production parser or parser fallback.
- No universal native import, editable chart promotion, L4/L5 promotion, pixel-perfect PowerPoint claim, or OfficeCLI containment claim without its exact evidence gate.
- No full PowerPoint oracle implementation or fabricated goldens in the absence of a trusted evidence bundle.
- No duplicate implementation or gate-state authority for package-first G0-G5; the existing package-first plan remains owner.
- No multi-tenant identity/auth productization.
- No broad HomePage/EditorPage redesign unrelated to import status/report UX.
- No default external imported-media fetching; opt-in requires a fully pinned origin policy.
- No destructive retention or evidence publication before the relevant policy/trust decision is recorded.

## Current Evidence Baseline

- P1-P3 predecessor plan: formally completed with accepted residuals; product ceiling remains best-effort.
- Dated audit baseline (`plans/reports/2026-07-22-pptx-import-readiness-audit.md:160-172`): 11/11 decks pass; average semantic metric 100.0%; average **reconstructed round-trip stability** 63.0%. This is parser-relative regression evidence, not native or PowerPoint visual fidelity.
- Strict qualification baseline: inherited wording says 5/11 pass, 6 blocked, 378 aggregate unmapped scene leaves, and 13 permanent placeholders; repository reports/manifests currently found no artifact that substantiates those aggregate numbers. Treat them as unverified inherited claims, not current evidence; Phase 7 must either produce a manifest-bound source or remove/update the numbers. The source-backed `STTre_Duc` fact is 174 unmapped native leaf nodes; the `174 total / 138 mapped / 36 unmapped` split is unverified until a fresh manifest supports it.
- Oracle integrity: blocked by missing trusted evidence manifest/bundle and unavailable visual comparison. Historical placeholder artifacts remain historical until revalidated from a retained bundle.
- Browser audit: historical local structural/heuristic evidence only; not a PowerPoint visual release gate.
- Package-first plan: 77/244 checklist items, 31.6%, and 0/6 G0-G5 claim gates closed. G0-G5 work remains owned by the sibling package-first plan.
- Performance scripts exist as `npm run test:pptx:perf` and `npm run test:pptx:perf:full`; full runs may produce structured environment/resource skips.

## Scope Challenge

- **Existing code reused:** `pptx-job-wait`, `HomePage` import lifecycle, `api.js` retry/status/cancel, `pptx-import.js` orchestration, job manager, package-store/StateStore, outbox, compatibility view, authoritative reader, bounded report, worker env builder, guards/media budgets, evidence CLIs, and existing Vitest/Playwright fixtures.
- **Minimum safe change set:** Phases 1-7 and the final release phase are the core remediation/evidence lane. Phase 8-10 are non-mutating handoff/status intake only; the sibling package-first plan owns all implementation and G0-G5 state.
- **Required durability boundary:** If a durable media manifest/replay ledger is not implemented, the release matrix must explicitly exclude a crash-safe media-consistency claim. It must not be silently assumed.
- **Selected scope:** HOLD. Implement deterministic safety/reliability contracts; keep product/policy-dependent destructive actions behind decision gates.

## Cross-Plan Dependencies

| Relationship | Plan | Treatment |
|---|---|---|
| Completed predecessor | `260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd` | Reuse implemented contracts; do not reopen completed phases wholesale. |
| Blocked evidence predecessor | `260722-1630-pptx-import-p0-readiness-remediation-deep-tdd` | Phase 7 corrects stale wording; Phase 10 never fabricates a missing candidate evidence bundle. |
| Existing owner / sibling | `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd` | Sole owner of package-first implementation, receipts, G0-G5 gate state, and promotion mechanics. This plan supplies prerequisites/status links only. |
| UI overlap | Existing editor UI plans | PPTX status/report changes stay within import status/report surfaces; no broad editor refactor. |

## Architecture Decisions

1. **Separate bounded admission and terminal-wait clocks:** an admission deadline begins before POST and bounds busy retry plus `Retry-After`. Once the server admits a job, a distinct terminal-wait deadline begins for SSE/poll transport and its reserved bounded final status GET. Queue time cannot consume the admitted job's terminal-wait budget, and neither phase can wait indefinitely.
2. **Separate signal responsibilities:** the outer ownership signal controls unmount/ownership; child controllers own SSE/poll and bounded final-status transport. Automatic deadline recovery is read-only. Current ownership-loss cleanup may request best-effort cancellation; the explicit Cancel UI/control-plane interaction remains a residual and must use a dedicated bounded controller if added. No transport child survives settlement or ownership loss.
3. **Status is not repair:** timeout/unknown recovery performs GET-only status/visibility inspection. The current POST `/jobs/:jobId/reconcile` is destructive authority repair and requires classified state plus authority binding; it is never automatic.
4. **Contract B remains explicit:** durable package publication may precede compatibility visibility, and the current server listability result withholds openable identity until visibility is ready. The planned full identity/provenance resolver remains residual.
5. **Delivered repair scope is bounded:** existing rollback fencing and poisoned-outbox isolation protect current repair paths. The proposed persisted `apply-pending` through `resolved` saga is not implemented or claimed.
6. **Compatibility provenance remains server-owned where delivered:** the selected job-control authority is propagated to direct status/SSE/DELETE/repair callers without persistence/logging. Full projection-provenance fencing and equal-generation compensation coverage remain residual.
7. **List isolation is backward-compatible:** bulk readers classify known missing-head rows and return healthy rows. `/api/presentations` remains a bare array; bounded quarantine metadata uses headers or a separate health/repair surface. Explore and sync callers receive explicit policies/tests.
8. **Async errors are terminal DTO data:** POST admission statuses cover synchronous upload/admission failures. Parser/resource/snapshot failures after 202 preserve bounded `failureStatus`, `code`, `type`, `reasonCode`, and `stage` in GET/SSE job DTOs; the plan does not promise later HTTP 413/422 responses without an intentional API redesign.
9. **Layered resource security:** converter path/env, external URL policy, archive/OOXML/media allocation, background data URLs, snapshots, and host-memory telemetry are separate controls. No OS/network sandbox or whole-server RSS claim is made without implementation evidence.
10. **Reports have trust-boundary DTOs:** editor diagnostics are server-owned and bounded; external/export DTOs omit job/authority identifiers, source entry names, paths, raw stderr, and token-like data.
11. **Retention protects authority:** expirable history is separate from non-expiring rollback/idempotency/reconcile tombstones. Physical StateStore/index/WAL compaction uses existing writer/WAL mechanisms and only starts after policy approval and dry-run evidence.
12. **Evidence is claim-specific and authority-bound:** candidate bundles are bounded/quarantined inputs. The active sibling package-first/local oracle contract remains authoritative unless its owner explicitly supersedes it; self-hashed receipts do not become independent provider attestation. Any future external/provider-authoritative model is a separate decision. Private/public report separation is mandatory.
13. **Package-first gate ownership is preserved:** Phase 8-10 only prepare/read/link status; the sibling plan owns G0-G5 implementation and promotion.
14. **Release lanes are independent:** best-effort release depends on the core software/evidence lane, not on optional package-first or external PowerPoint completion.

## Dependency Graph and Execution Strategy

```text
Phase 1 green baseline/ledger
  ├─> Phase 3 consistency + durable job/repair authority
  ├─> Phase 4 resource/error/security producers (integration after Phase 3 DTO contract)
  └─> Phase 7 only after software phases

Phase 3 ─> Phase 2 client wait integration
Phase 3 + 4 ─> Phase 5 report UX
Phase 3 + 4 ─> Phase 6 durable lifecycle/retention
Phases 1-6 ─> Phase 7 fresh evidence
Phase 7 ─> Phase 8 non-mutating G0/G1 handoff/status
Phase 7 + 8 ─> Phase 9 non-mutating G2/G4 status intake
Phase 7 + 8 + 9 + active owner G5 contract ─> Phase 10 candidate evidence/status intake
Phase 7 ─> Phase 11 best-effort release gate
Phase 8-10 are optional status inputs to Phase 11, never mandatory completion dependencies.
```

Implementation scouting for Phase 2 and Phase 4 may run while Phase 3 is under construction, but their integration/close gates depend on the Phase 3 visibility/error contracts. No phase may claim exclusive ownership of a file owned by another phase.

## File Ownership Matrix

| Phase | Exclusive primary files/areas | Test/evidence ownership |
|---|---|---|
| 1 | Plan-local fixtures/ledger only; no production source | Green characterization inventory and claim ledger |
| 2 | `client/src/utils/pptx-job-wait.js`, wait/retry portions of `client/src/utils/api.js`, Home import status slice | Client wait/lifecycle/RTL/E2E tests |
| 3 | `server/routes/pptx-import.js`, `server/routes/presentations.js`, `server/routes/explore.js`, `server/routes/sync.js`, `server/services/pptx-import-job-manager.js`, `server/services/pptx-import/package-store/schemas.js`, `server/services/pptx-import/package-store/index.js`, `server/services/pptx-import/package-store/state-store.js` lifecycle persistence/DTO surfaces, package-store runtime/outbox/view/reader/import-commit/create-imported-presentation consistency seams | Crash/outbox/list/Contract-B/multipart/progress/authority/serialization tests |
| 4 | Worker/importer/scene graph/media/mapper/snapshot/guards/diagnostics/report producer/converter and external URL/resource seams; no `import-commit.js` edits | Security/resource/error/abort tests |
| 5 | Client summary/report panel/editor attachment and external DTO consumer tests | UX/report/accessibility/E2E tests |
| 6 | New retention maintenance module, collector, `state-store.js`/`index.js` retention-only maintenance seams (Phase 3 lifecycle fields remain owned by Phase 3), legacy original helper; consumes Phase 3 lifecycle | Retention/WAL/restart/fsync/compaction tests |
| 7 | `plans/reports`, qualification/browser/perf/oracle scripts/manifests; narrow stale-plan references | Fresh evidence artifacts and provenance scans |
| 8 | Read/link-only package-first G0/G1 handoff record | Handoff digest/status checks; no package-first source edits |
| 9 | Read/link-only package-first G2/G3/G4 status record | Existing owner-plan qualification evidence only |
| 10 | Read/link-only G5 evidence intake/status and redacted report | Integrity/trust/quarantine checks; no claim bypass |
| 11 | README/docs/release matrix/rollback runbook; no feature source | Full release/rollback verification |

`server/services/pptx-import/package-store/import-commit.js` is modified only in Phase 3. Phase 4 and Phase 6 consume its contracts.

## Phases

| # | Phase | Priority | Dependencies | Status |
|---|---|---|---|---|
| 1 | [Baseline Contracts And Evidence Inventory](./phase-01-start.md) | P1 | — | Completed |
| 2 | [Wait Lifecycle Reconcile And Cancellation](./phase-02-wait-lifecycle-reconcile-and-cancellation.md) | P1 | 1, 3 | Completed core contract (separate admission and terminal-wait clocks; explicit Cancel UI residual) |
| 3 | [Package Consistency And Ghost Row Recovery](./phase-03-package-consistency-and-ghost-row-recovery.md) | P1 | 1 | Completed core contracts (full multi-state durable saga and media manifest intentionally not claimed) |
| 4 | [Resource Security And Error Boundary Hardening](./phase-04-resource-security-and-error-boundary-hardening.md) | P1 | 1, 3 | Completed core bounds (host RSS, OS, and network isolation not claimed) |
| 5 | [Import Diagnostics And User Experience](./phase-05-import-diagnostics-and-user-experience.md) | P1/P2 | 2, 3, 4 | Completed core report/status surface (no broad editor redesign) |
| 6 | [Durable Operations Retention And Legacy Durability](./phase-06-durable-operations-retention-and-legacy-durability.md) | P2 | 3, 4 | Completed dry-run safety scope (physical compaction remains disabled) |
| 7 | [Qualification Evidence And Provenance Refresh](./phase-07-qualification-evidence-and-provenance-refresh.md) | P1 | 1-6 | Completed evidence reconciliation (strict/native, full performance, and oracle remain separate blockers) |
| 8 | [Package-First G0/G1 Feasibility Handoff](./phase-08-package-first-g0-g1-feasibility-handoff.md) | P1 | 7 | Completed handoff only (no G0/G1 promotion) |
| 9 | [Package-First G2/G3/G4 Capability Qualification](./phase-09-package-first-g2-g3-g4-capability-qualification.md) | P1 | 7, 8 | Completed handoff only (no G2/G3/G4 promotion) |
| 10 | [PowerPoint Oracle G5 Candidate Evidence Intake](./phase-10-powerpoint-oracle-g5-external-gate.md) | P1 | 7, 8, 9 + active owner G5 contract | Completed blocked-status intake only (G5 remains blocked) |
| 11 | [Final Release Documentation And Rollback Gate](./phase-11-final-release-documentation-and-rollback-gate.md) | P1 | 7 | Completed bounded best-effort closeout; optional lanes remain blocked/open/skipped |

## Global Completion and Release Criteria — reconciled 2026-07-28

- [x] Admission retry uses its own bounded deadline; post-admission SSE/poll terminal wait uses a separate bounded deadline with a reserved final status GET.
- [x] Automatic timeout recovery is GET-only and never invokes destructive repair. Ownership loss can request best-effort cancellation; explicit Cancel UI/control remains a residual.
- [x] Unknown-outcome copy now matches GET-only timeout recovery and directs the user to check existing presentations before retrying; admission body-timeout ambiguity receives the same check-existing guidance.
- [x] Non-timeout poll failures use the bounded final status read before exposing a typed unknown outcome.
- [x] In-memory and durable job responses withhold an openable presentation identifier until the current server visibility result is listable. A fuller identity/provenance resolver remains a residual.
- [x] Core rollback fencing and poisoned-outbox isolation protect known failure paths. A fully expanded persisted multi-state repair saga is not implemented or claimed.
- [x] Known missing-head rows are isolated so healthy list rows remain available, without changing the list response shape.
- [x] Shared presentation, explore, and sync reader policies have focused coverage.
- [x] Asynchronous parser/resource/snapshot failures retain bounded terminal error information while synchronous admission responses remain compatible.
- [x] External imported media is blocked by default; the converter remains opt-in and path-pinned with a narrow child environment. No OS, network, or host-wide RSS isolation claim is made.
- [x] Background-data media budgeting, snapshot limits, cleanup settlement, and bounded report handling are in the software contract. Crash-safe media consistency remains unclaimed.
- [x] Editor-only import reporting and external/export redaction retain the documented trust boundary.
- [x] Retention remains dry-run/default-off; physical StateStore/WAL compaction is not enabled or claimed.
- [x] Current focused client, adversarial, corpus, lint, build, and critical browser-journey evidence is recorded without cross-lane promotion; the critical journey passed 1/1 in 38.7s and lint has 0 errors with 27 existing warnings.
- [x] Package-first G0-G5 remains owned by the sibling plan; this plan's handoffs do not close any of those gates.
- [x] Fresh final-source full-unit verification passed: 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s. Strict/native is intentionally non-zero, full performance is explicitly skipped without its opt-in, and oracle integrity is blocked; none is promoted by this result.
- [x] Final best-effort software-lane decision is PASS WITH RESIDUALS, not a release authorization. Strict/native, browser heuristic, performance, package-first, and G5 rows remain separately labelled in the readiness record.

## Validation Commands

Focused commands are phase-owned and must run before broad gates:

```bash
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx
npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import-crash-points.test.js server/routes/presentations.test.js server/services/package-backed-presentation-read.test.js server/routes/explore-reader-policy.test.js server/routes/sync.test.js
npx vitest run server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/package-store/blob-store.test.js
npx vitest run server/services/pptx-import/worker-runner.test.js server/services/pptx-import/output-usability.test.js server/services/pptx-import/pptx-guards.test.js server/services/pptx-import/import-report.test.js server/services/pptx-import/emf-wmf-sandbox.test.js server/services/pptx-import/media.test.js
npm run test:pptx:adversarial
npm run test:pptx:perf
npm run test:pptx:perf:full
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:integrity
npm run lint
npm run build
npm run test -- --exclude client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
```

The full-unit command excludes only the documented unrelated baseline failure; record that baseline separately and do not call the exclusion a fix. The fresh final-source full-unit outcome is **PASS**: 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s. The focused client lifecycle command passed 69 tests, full lint passed with 0 errors and 27 existing warnings, production build passed, and the critical browser journey passed 1/1 in 38.7s. Use existing focused suites where a named route suite does not exist. Heavy/performance/oracle truth gates may intentionally be non-zero or structured-skipped; retain the exact reason and never report a skip as qualification success.

## Rollback and Safety

- This closeout task modifies only plan artifacts and redacted reports. It does not authorize application-source, test, configuration, secret, commit, or user-owned temporary-file changes.
- Implementation phases begin from a clean checkpoint that preserves unrelated dirty work.
- Server consistency changes require persisted identity/provenance fences, durable repair states, injected crash/interleave tests, and no package/presentation lock inversion.
- Media crash-consistency claim is enabled only if its durable manifest/replay gate passes; otherwise release wording narrows explicitly.
- Evidence/report edits preserve historical artifacts, use actual run IDs, redact private identifiers, and never overwrite `xuatN26th7` without explicit approval.
- Retention remains dry-run/default-off until policy, tombstone lifetime, physical compaction, and restore tests pass.
- If a phase cannot prove its acceptance criteria, stop at that phase; do not weaken tests or relabel the capability.

## Recommended Defaults Pending Validation

- Prefer the existing package-first hashed per-job capability contract for status/SSE/DELETE/repair; accept trusted-proxy principal binding only when the deployment records that boundary explicitly. Propagate the selected authority through Home, E2E, direct API, and oracle callers; never fall back to UUID secrecy. Neither option is multi-tenant authentication.
- Keep missing-head bulk handling read-only and additive; any writer-locked repair action remains separately authorized and never automatic.
- Narrow the best-effort media crash-consistency claim unless a durable job-owned media manifest/replay mechanism is approved and passes recovery tests.
- Keep retention dry-run/default-off, preserve authority tombstones, and defer physical StateStore/index/WAL compaction until policy and restore evidence are approved.
- Block imported external URLs by default; an administrator allowlist must be full-origin and private-network safe if later approved.
- Preserve the active sibling plan's local G5 authority by default. Candidate evidence is only an input/status observation; an external/provider-authoritative signer or manual-approval model requires an explicit owner/user decision and cannot be introduced by this plan.

## Open Questions for Validation

1. Should sensitive job routes use a per-job capability or a verified proxy principal binding in the single-user deployment contract?
2. Should missing-head GET behavior remain read-only classification plus scheduled repair, or expose a separately authorized writer-locked repair action?
3. Is durable job-owned media manifest/replay required for the intended crash-consistency claim, or should media recovery remain explicitly best-effort?
4. What retention age/count/byte policy and tombstone lifetime preserve rollback/idempotency/reconcile authority, and when may StateStore/WAL history be physically compacted?
5. Are external imported URLs always blocked, or is a fully pinned administrator origin allowlist required?
6. Does the active sibling local G5 authority remain in force, or does the owner/user explicitly supersede it with an external/provider-authoritative trust model?

## Plan Handoff Boundary

This document is the implementation and closeout record for the scoped best-effort lane. It does not authorize commits, pushes, releases, destructive retention, or changes to the sibling package-first/G5 authority. Remaining residual implementation and policy decisions require separate scope, evidence, and user authorization.

## Unresolved Questions

See `## Open Questions for Validation`. No external PowerPoint evidence or trust signer is assumed to exist.
