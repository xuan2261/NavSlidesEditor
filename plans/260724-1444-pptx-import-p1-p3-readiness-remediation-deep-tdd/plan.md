---
title: "PPTX Import P1-P3 Readiness Remediation Deep TDD"
description: "Test-first delivery of every audit P1–P3 item after P0: client lifecycle abort/wait slack, single outbox writer, durable import report, crash/restart suites, worker env + warning budgets, CRC/corpus breadth, perf/archive reuse, and thin P3 coordination without re-planning package-first capability."
status: completed
priority: P1
effort: "18-28 engineer-days (P1 ~8-12d; P2 ~8-12d; P3 coordination ~2-4d)"
branch: master
tags: [bugfix, pptx, import, reliability, security, performance, testing, fidelity, critical, tdd]
blockedBy: []
blocks: [260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd]
related: [260722-1630-pptx-import-p0-readiness-remediation-deep-tdd]
created: 2026-07-24
mode: "--deep --tdd"
scopeDecision: hold
sourceReport: "../reports/2026-07-22-pptx-import-readiness-audit.md"
research:
  - "../reports/2026-07-24-pptx-p1plus-research-client-lifecycle.md"
  - "../reports/2026-07-24-pptx-p1plus-research-package-job-durability.md"
  - "../reports/2026-07-24-pptx-p1plus-research-p2p3-security-perf-capability.md"
  - "../reports/2026-07-24-pptx-p1plus-scout-inventory.md"
---

# PPTX Import P1-P3 Readiness Remediation Deep TDD

## Overview

Deliver **all audit items from P1 onward** for PPTX import readiness: reliability/lifecycle, security/perf/corpus ops, and thin P3 capability coordination. P0 software phases (transport, evidence, package-backed journey) are complete; this plan does **not** redo them. PowerPoint visual goldens remain owned by P0 phase 4 (blocked) and package-first G5.

**Product claim target for this plan:** self-hosted **best-effort import** becomes production-reliable and evidence-honest. It does **not** authorize PowerPoint 1:1 or level-4/5 editability claims.

## Scope Challenge

- **Existing code:** P0 fixed upload limiter scope, Retry-After + admission abort, strict lane split, scene stats, package-backed E2E authority. Package outbox/drain, durable job GET fallback, worker fork, fidelity preserve-only charts already exist.
- **Minimum set:** P1 lifecycle + single writer + durable report + crash suite + worker env. P2/P3 included under HOLD without silent cut.
- **Complexity:** 8 phases, multi-layer (client/server/package-store/tests/docs). No new frameworks; reuse outbox, OfficeCLI env pattern, existing job DI.
- **Selected scope:** **HOLD** — full audit P1–P3; P3 capability implementation stays package-first-owned except secondary-parser eval and multi-tenant decision spike.

## Delivery Contract

- **Outcome:** cancel/wait/deadline contracts are end-to-end; package visibility has one writer; import diagnostics survive restart within bounds; worker secrets not inherited; CRC/warning/perf/corpus evidence exist; P3 work is coordinated not duplicated.
- **Constraints:** preserve package authority, generation fencing, idempotency, single concurrent import, best-effort public behavior; TDD first; files under 200 LOC where new; never overwrite unrelated dirty work.
- **Non-goals:** re-do completed P0; implement OfficeCLI containment/G1; promote level-4 rows; unlock chart editing; build true secondary parser; multi-tenant auth productization; raise import concurrency; drop host revalidation without hash-bound inventory.
- **Acceptance:** phase regression gates green; crash/restart suite proves ordered recovery; docs match single-writer and claim language; no unavailable capability relabeled as qualified.

## Cross-Plan Dependencies

| Relationship | Plan | Notes |
| --- | --- | --- |
| Sibling / prerequisite software | `260722-1630-pptx-import-p0-readiness-remediation-deep-tdd` | Phases 1–3 done. Phase 4 visual oracle still blocked — **not** blocking P1–P2 software. |
| Blocks (partial) | `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd` | Package-first should not claim sole-writer/outbox or job lifecycle until phases 2–4 land. L4/charts/oracle stay package-first owned. |
| Soft overlap | UI remediation plans | HomePage import slice only; avoid EditorPage mass refactors. |

## Architecture Decisions

1. **One AbortController** from admission through wait (SSE + poll + cancel fetches); unmount aborts wait + cancels when pre-commit; success path re-checks ownership before warnings/`onOpen`. Intentional abort/cancelled must not toast as import failure.
2. **Wait budget** = server `IMPORT_TIMEOUT_MS` + fixed slack (default **+30s**). Prefer optional server `deadlineMs` on job payload; client may hardcode slack if YAGNI.
3. **Outbox is sole package-backed compatibility writer.** `runImport` injects and awaits `drainCompatibility` before treating import as client-openable. `stampImportedPresentationFields` is mandatory for outbox payload (parity with today’s create normalization: slide/element IDs, notes, title). Legacy non-package path may still push.
4. **Visibility/terminal contract (red-team F-1):** Durable `jobs[]` must **not** imply openable presentation while outbox undrained. Choose **one** (default **B**):
   - **A:** Delay durable `completed` until after successful drain; or
   - **B (default):** Durable receipt may exist post-publish but GET/client recovery returns non-openable state (`pending-visibility` / forces drain-verify) until presentation row exists; openable `done` only after drain ack (+ report summary).
   Never claim “durable done ⇒ listable” without tests.
5. **Bounded `_pptxImportReport`** is first-class **server-owned** metadata: must be allowlisted in `authority-sanitizer` / DTO / `compatibility-view` merge keys so GET and post-save preserve it. Durable job GET returns presentationId + visibility + reportSummary — not unbounded warnings.
6. **Keep two-tier jobs:** in-memory Map for live progress/SSE; package `jobs[]` for terminal recovery. No durable progress stream. SSE after Map miss remains 404; poll recovers.
7. **Leave/cancel policy matrix:**
   - Pre-publish: cancel + abort → no package head.
   - Post-publish pre-visibility: cancel → rollback package + strip outbox + no openable done (or completeCancellation).
   - Post-visibility (listable): cancel is no-op for delete; client unmount must **not** `onOpen`; presentation may remain (user left after success race) — document; optional reconcile only on explicit user cleanup.
8. **Parser worker env allowlist** mirrors OfficeCLI pattern; keep NODE_PATH/TEMP/locale. EMF spawn env residual explicit if not allowlisted same phase.
9. **Warning budget** enforced at **accumulate time** (shared push/proxy), not only final bind — caps peak RSS mid-map.
10. **CRC import policy:** fail-closed after corpus probe; dedicated adversarial lane; no default silent warn-only.
11. **Archive reuse only** with `(sha256, limits-digest)`; crash suite uses **real** temp package-store + presentations + outbox, not mock theater. Real seams: publish → drain → completeJob (+ rollback). Media commit is not a recovery barrier.
12. **P3:** coordination + secondary-parser eval + multi-tenant decision only.

## Phases

| Phase | Name | Priority | Dependencies | Status |
| --- | --- | --- | --- | --- |
| 1 | [Client Import Lifecycle Abort And Wait Budget](./phase-01-client-import-lifecycle-abort-and-wait-budget.md) | P1 | — | Completed |
| 2 | [Single Compatibility Writer And Drain Barrier](./phase-02-single-compatibility-writer-and-drain-barrier.md) | P1 | — | Completed |
| 3 | [Durable Import Report And Job Payload](./phase-03-durable-import-report-and-job-payload.md) | P1 | 2 | Completed |
| 4 | [Crash Point And Restart Interleaving Suite](./phase-04-crash-point-and-restart-interleaving-suite.md) | P1 | 2, 3 | Completed |
| 5 | [Worker Env Allowlist Warnings Budget Timeout Honesty](./phase-05-worker-env-allowlist-warnings-budget-timeout-honesty.md) | P1/P2 | 3 (warning budget shape) | Completed |
| 6 | [CRC Policy And Adversarial Corpus Breadth](./phase-06-crc-policy-and-adversarial-corpus-breadth.md) | P2 | — | Completed |
| 7 | [Perf Matrix Archive Reuse And Sandbox Eval](./phase-07-perf-matrix-archive-reuse-and-sandbox-eval.md) | P2 | 5 | Completed |
| 8 | [P3 Capability Coordination Secondary Parser Multi Tenant](./phase-08-p3-capability-coordination-secondary-parser-multi-tenant.md) | P3 | 1–7 preferred | Completed |

## Execution Strategy

```text
Phase 1 || Phase 6              (client-only || guards/corpus — no shared route file)
Phase 2 -> Phase 3 -> Phase 4   (server route + package authority sequential)
Phase 3 -> Phase 5
Phase 5 -> Phase 7
Phase 8 last
```

Default cook is sequential 1→8. **Do not parallel phase 1 with 2–4 on `pptx-import.js`** (phase 1 must not edit that file).

### File ownership (parallel-safe)

| Phase | Exclusive primary owners |
| --- | --- |
| 1 | `client/src/utils/pptx-job-wait*.js`, `api.js` poll/cancel signal only, HomePage import slice or `use-pptx-import` hook + client tests — **no server routes** |
| 2 | `server/routes/pptx-import.js` (extract `run-import.js` if needed for ≤200 LOC), stamp helper, import-commit/outbox, docs sole-writer |
| 3 | `import-report.js`, authority-sanitizer, dto, compatibility-view, durable serialize, client summary |
| 4 | `pptx-import-crash-points.test.js` + runImport DI seams only (after phase 2 extract) |
| 5 | `worker-runner.js`, warning-budget helper, constants; optional emf env |
| 6 | `pptx-guards.js` CRC, adversarial fixtures, adversarial script/package.json |
| 7 | `server/services/pptx-import/perf/*`, `scripts/pptx-import-perf-matrix.js` |
| 8 | plans/reports only |

## Global Success Criteria

- [x] Unmount during upload, busy wait, SSE, or poll aborts wait; never `onOpen` after leave; intentional cancel/abort does not toast as failure.
- [x] Leave/cancel policy matrix (pre-publish / post-publish / post-visibility) tested on server + client.
- [x] Client wait budget exceeds server import deadline by documented slack; SSE cannot hang forever.
- [x] Poll-only path emits `onConnection({ jobId })` (and clears on settle).
- [x] Package-backed import: outbox-only writer + stamp parity + await drain; docs match code.
- [x] Openable durable/client terminal implies presentation listable (contract B or A above) with tests.
- [x] Bounded `_pptxImportReport` survives GET DTO + package-backed save merge; client cannot inject; reload shows caps + omittedCount.
- [x] Durable GET after restart/TTL returns visibility-safe payload + reportSummary (not presentationId-only phantom).
- [x] Crash-point suite on real store+outbox+presentations covers publish → drain → completeJob (+ rollbacks); media commit not treated as barrier.
- [x] Parser worker env does not inherit secrets; timeout message uses actual `timeoutMs`; EMF residual documented if unfixed.
- [x] Warning accumulate-time count/byte budget with omittedCount.
- [x] CRC fail-closed after corpus probe + fixture; adversarial suite isolated from metrics averages.
- [x] Perf matrix artifact or structured skip; archive reuse hash-bound or deferred note.
- [x] Sandbox eval written; OS Job Object/OfficeCLI remain package-first.
- [x] P3 secondary-parser eval + multi-tenant decision recorded; no false L4/chart/1:1 claims.

## Red Team Review

### Session — 2026-07-24
**Findings:** 6 deduped Critical/High (3 reviewers; third TDD reviewer may add minor)
**Severity:** 2 Critical, 4 High
**Disposition:** All 6 **Accept** and applied to Architecture Decisions + phases 1–5

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Durable completed before drain ⇒ false openable done | Critical | Accept | plan AD4; phases 2–4 |
| 2 | `_pptxImportReport` stripped by authority/DTO/merge | Critical | Accept | plan AD5; phase 3 |
| 3 | Sole-writer drops stamp/normalization parity | High | Accept | plan AD3; phase 2 |
| 4 | Leave/cancel vs late completeJob + onOpen/toast | High | Accept | plan AD1/AD7; phases 1,4 |
| 5 | Crash suite phantom DI / media not a barrier | High | Accept | plan AD11; phase 4 |
| 6 | Warning final-bind only + EMF env residual | High | Accept | plan AD8/AD9; phases 5,7 |
| 7 | Phase 4 hollow TDD (no expect shapes) | Critical | Accept | phase 4 CP table |
| 8 | False parallel ownership on pptx-import.js | High | Accept | plan execution strategy |
| 9 | Phase 7 phantom regression gate | High | Accept | phase 7 named tests |
| 10 | 200 LOC / HomePage split risk | High | Accept | phase 1 split; phase 2 extract |
| 11 | Phase 1 soft test labels | High | Accept | phase 1 concrete reds |
| 12 | Phase 6 CRC green-first baseline | High | Accept | phase 6 RED reject |

### Whole-Plan Consistency Sweep — 2026-07-24

| Check | Result |
| --- | --- |
| Openable durable done language | Aligned to contract B (default) across plan + phases 2–4 |
| Report allowlists | Phase 3 lists sanitizer/DTO/merge; global criteria include save preserve |
| Cancel matrix | AD7 + phase 1/4; late cancel policies explicit |
| Crash seams | Media barrier removed; real store required |
| Parallel ownership | Phase 1 no server routes; 2→3→4 sequential |
| P0 Retry-After | Not reopened; T6 regression only |
| P3 non-goals | Phase 8 still no L4/chart/OfficeCLI |
| Unresolved contradictions | **None** remaining after apply |

## Validation Log

### Session 1 — 2026-07-24 (`--deep` validate)

| # | Question | Decision |
| --- | --- | --- |
| V1 | Visibility/terminal after publish | **Contract B pending-visibility** (locked) |
| V2 | Leave after listable | **Keep presentation; never onOpen** |
| V3 | CRC false positives on corpus | **Block phase 6; report counts** — no silent warn-only success |
| V4 | P3 secondary parser / multi-tenant | **Eval + decision docs only** — no implement |

### Verification Results
- Tier: Full (8 phases); red-team already verified primary claims with file:line
- Claims rechecked post-apply: dual-writer open, wait no signal, worker env spread, CRC false — VERIFIED open work
- Failed claim checks: 0 against post-red-team plan text
- CLI `ak plan validate`: **valid**

### Whole-Plan Consistency Sweep (validation)
- V1–V4 match Architecture Decisions AD4/AD7/AD10 and phase 6/8 text
- Unresolved contradictions: **None**
- Status: **conditional-pass** — ready for cook with `--tdd`

## Validation Commands (plan-level)

```bash
# Phase 1
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx

# Phase 2-4
npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store/import-commit*.test.js

# Phase 5
npx vitest run server/services/pptx-import/worker-runner.test.js

# Phase 6
npx vitest run server/services/pptx-import/pptx-guards.test.js
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification

# Phase 7
# (perf harness + optional inventory tests — exact script named in phase file)

# Broader
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js tests/e2e/critical-pptx-journey.spec.js
npm run lint
npm run build
```

## Research Baseline

- Client: P0 fixed Retry-After/admission; wait path still lacks `signal`, SSE max-wait, post-unmount `onOpen` guard.
- Package: dual writers open; durable GET partial (presentationId only); warnings in-memory TTL only.
- P2/P3: worker full env inherit; CRC false on import; no PPTX perf matrix; package-first owns L4/OfficeCLI/oracle.

## Dirty-Worktree Boundary

Respect existing dirty docs (`docs/export-fidelity-and-limits.md`, changelog) and unfinished plans. Patch narrowly. Do not reset user worktrees or overwrite `.tmp/` artifacts.

## Open Questions (plan defaults applied)

| # | Question | Plan default until product overrides |
| --- | --- | --- |
| 1 | Leave HomePage mid-import: always cancel? | **Yes — cancel server job** (best-effort self-hosted; avoid orphans). |
| 2 | Visual authority / 1:1 | Out of scope; P0 phase 4 + package-first G5. |
| 3 | Multi-tenant | Stay single-user; phase 8 records decision only. |
| 4 | Validated edited export as near release req | Not required for this plan’s best-effort milestone; preserve fail-closed contracts. |
| 5 | Business-critical decks/thresholds | Keep current 11-deck manifest; adversarial fixtures additive. |

## Post-Plan Gates

- Red-team adversarial review required (`--deep`).
- Validation interview required (`--deep`).
- Whole-plan consistency sweep after gate edits.
