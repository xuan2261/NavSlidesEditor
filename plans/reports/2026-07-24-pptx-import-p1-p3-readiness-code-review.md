# Code Review: PPTX Import P1–P3 Readiness Remediation

**Date:** 2026-07-24  
**Plan:** `plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd/plan.md`  
**Score:** **7/10**  
**Verdict:** **CONDITIONAL PASS** — core reliability contracts land; fix warning-evidence honesty before claiming “evidence-honest production-ready.”

---

## Code Review Summary

### Scope
- **Files (primary):**  
  `client/src/utils/pptx-job-wait.js`, `api.js`, `HomePage.jsx` import slice, `pptx-import-summary.js`  
  `server/routes/pptx-import.js`, `pptx-import-crash-points.test.js`  
  `create-imported-presentation.js`, `import-report.js`, `warning-budget.js`, `worker-runner.js`, `pptx-guards.js`  
  `authority-sanitizer.js`, `compatibility-view.js`, `package-store/dto.js`  
  `docs/export-fidelity-and-limits.md`, phase-8 reports, perf/adversarial harnesses
- **LOC delta (touched production surface):** ~515 insertions / ~118 deletions (core 13-file stat) + large new test/report surface
- **Focus:** plan global success criteria + HARD-GATE side effects
- **Scout findings:** post-publish pre-drain recovery depends on startup drain; warning budget dropped counts not wired into report; EMF env residual documented but live; durable `jobs[]` lacks native `reportSummary` field (recovered via presentation when listable)

### Overall Assessment
Implementation is substantially aligned with Architecture Decisions AD1–AD11 and the global checklist. Client lifecycle (single AbortController, 150s wait budget, ownership guard, silent cancel), package sole-writer + await drain, Contract B `pending-visibility`, bounded report allowlists, real-store crash CP suite, worker env allowlist, CRC fail-closed, adversarial lane isolation, perf structured skip, and P3 docs-only coordination all have code/test evidence.

Residual honesty gap on accumulate-time warning `omittedCount` undercuts the plan’s “evidence-honest” claim. File-size and phase-status hygiene lag. Not a rubber-stamp ship.

### Verification run (this review)
| Command | Result |
| --- | --- |
| Focused client + helper unit tests (9 files) | **80 passed**, 1 skipped |
| Crash + route + durable + adversarial + sanitizer (6 files) | **54 passed** |
| ESLint on listed production files | **clean** (exit 0) |
| Full `npm run build` / e2e | **not re-run** in this pass |

---

## Mandatory checks

| Check | Result | Notes |
| --- | --- | --- |
| (a) Plan acceptance criteria | **Mostly met** | See matrix; warning accumulate→report omittedCount incomplete |
| (b) No business-logic regression | **Pass w/ intentional policy shifts** | Dual-writer closed on package path; CRC fail-closed; post-vis cancel→done |
| (c) No silent public-contract breaks | **Pass w/ documented breaks** | Contract B + CRC are intentional; clients must not treat durable `completed` as openable without listability |
| (d) Existing patterns | **Pass** | DI seams, package-store, OfficeCLI-style env allowlist, outbox drain on init |
| (e) Lint/type/build errors | **Pass (scoped)** | Unit surface green; full monorepo build not re-proven here |

### Global success criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Unmount never `onOpen`; intentional abort silent | **Met** | HomePage ownership checks + AbortError/cancelled swallow; lifecycle tests |
| Wait budget = 120s+30s | **Met** | `DEFAULT_PPTX_JOB_MAX_WAIT_MS = 150_000` + test |
| Leave/cancel matrix server+client | **Mostly met** | CP5/6/7 + client silent cancel; HomePage unmount cancel best-effort |
| Poll-only `onConnection({ jobId })` | **Met** | wait path + test |
| Outbox sole writer + stamp + await drain | **Met** | package path stamps + `drainCompatibility`; hard-gate test |
| Contract B openable ⇒ listable | **Met** | `serializeDurableImportJob` pending-visibility; crash CP1/CP3/CP8 |
| Bounded `_pptxImportReport` allowlisted; client cannot inject | **Met** | sanitizer strip + dto sanitize + merge key |
| Durable GET visibility-safe + reportSummary | **Met (via presentation)** | Map miss → load report from listable presentation; durable job record itself has **no** `reportSummary` field |
| Crash CP suite real store | **Met** | `pptx-import-crash-points.test.js` CP1–CP10 |
| Worker env no secrets; timeout uses timeoutMs | **Met** | allowlist + tests; EMF residual explicit |
| Warning accumulate budget + omittedCount | **Partial** | Budget exists; **report does not consume `warnings.omittedCount`**; spread in importer drops it |
| CRC fail-closed + adversarial isolated | **Met** | guards + scripts + docs |
| Perf structured skip; sandbox eval | **Met** | full JSON `SKIPPED_ENV`; sandbox eval written |
| P3 docs only, no L4/chart unlock | **Met** | coordination/eval/decision reports only |

---

## Critical Issues

*None that break openability fencing or inject client-owned authority under tested paths.*

**Near-critical (treat as ship-blocker for “evidence-honest” claim):**

### H1 — Accumulate-time warning budget does not feed report honesty
- **Where:** `warning-budget.js` (`omittedCount` non-enumerable), `mapper/map-presentation.js` (`createBoundedWarnings()`), `importer.js` `warnings: [...mapped.warnings, ...sceneWarnings]`, `import-report.js` `buildBoundedImportReport`
- **Problem:** Cap drops mid-map pushes, but report `warningCount`/`byType`/`omittedCount` only see the **kept array**. Spread rebuilds a plain array and **discards** accumulate `omittedCount`. Scene warnings append unbounded after the budget proxy.
- **Impact:** Diagnostics undercount true warning pressure; contradicts plan AD9 + global criterion “accumulate-time … with omittedCount.”
- **Fix:**  
  1. Preserve `omittedCount` through importer (or fold into report builder).  
  2. `buildBoundedImportReport(warnings, stats, { accumulateOmitted })` with `warningCount = list.length + accumulateOmitted`.  
  3. Keep scene pushes on the same bounded proxy (or re-apply budget after merge).

---

## High Priority

### H2 — SSE budget path skips final reconcile (poll path does not)
- **Where:** `pptx-job-wait.js` `rejectBudgetUnknown`
- **Problem:** On SSE `maxWaitMs`, cancel fire-and-forget + `PPTX_JOB_OUTCOME_UNKNOWN` without final poll. Poll path cancels then reconciles (can recover late `done`).
- **Impact:** False “unknown” / missed open when job completes at deadline race on SSE-only path.
- **Fix:** Share poll’s `reconcileAfterDeadline` after cancel (or remaining-budget final poll) before rejecting.

### H3 — EMF converter still inherits full `process.env` when enabled
- **Where:** `emf-wmf-sandbox.js` `env: { ...process.env }`
- **Status:** Plan residual + sandbox eval document it honestly.
- **HARD-GATE side effect:** Enabling `PPTX_EMF_CONVERT=1` reopens secret inheritance into converter child. Default-off mitigates; do not claim full env isolation.

### H4 — Durable package `jobs[]` never stores `reportSummary`
- **Where:** `package-store/import-commit.js` job push (presentationId only)
- **Recovery:** GET loads summary from presentation when listable — works for CP4/CP8.
- **Residual:** If presentation row missing/stripped but durable completed remains, openable path withheld (good) but summary never available from job alone.
- **Suggestion:** Optional thin `reportSummary` on durable job at publish for Map-TTL independence (not blocking if presentation is SSOT).

---

## Medium Priority

### M1 — `pptx-job-wait.js` ~254 LOC (project ≤200 LOC guideline)
Split sleep/poll/SSE helpers if further churn expected.

### M2 — `pptx-import.js` remains ~570+ LOC; plan mentioned extract
Seams (`afterPackagePublish`, `afterPackageVisibility`) are good; file still dense for review/merge risk.

### M3 — `createBoundedWarnings.push` breaks `Array#push` return contract
Returns per-call accepted count, not new length. Low practical risk today; restore `return this.length` for safety.

### M4 — Authority sanitizer footgun
`_pptxImportReport` is in `SAFE_PPTX_METADATA_KEYS` **and** explicitly `continue`-stripped. If strip removed, SAFE membership would pass unsanitized. Prefer: not SAFE + explicit strip, or SAFE only in DTO path.

### M5 — Plan/phase status drift
Code largely landed; `plan.md` + phases 1/2/5/8 still `pending` while 3/4/6/7 say completed. Ops risk for cook/ship automation.

### M6 — Warning toast can still fire after leave (not failure toast)
Ownership re-checked before `onOpen` but `showNotice` for warnings can race unmount. Acceptable vs plan (“no failure toast”); tighten if product wants zero UI after leave.

---

## Low Priority

- Duplicate cancel on unmount (abort path + cleanup cancel) — benign.
- Client does not special-case `pending-visibility` string (treated non-terminal) — correct while Map job alive; after Map miss + undrained outbox, wait budget → unknown until process restart drain (startup drain covers restart).
- Phase reports claim some phases “in flight” while tests exist — doc hygiene only.

---

## HARD-GATE side effects (explicit)

| Side effect | Severity | Notes |
| --- | --- | --- |
| **Contract B:** durable `completed` ≠ openable until listable | **Intentional breaking semantic** | GET returns `pending-visibility` without `presentationId`. Any client assuming “durable completed ⇒ open” **must** update. |
| **CRC fail-closed** | **Intentional reject expansion** | Previously `checkCRC32: false`. Corrupt/odd ZIPs now `zip-crc-mismatch`. Corpus probe 0/11 FP; real decks may increase rejects. |
| **Sole outbox writer on package path** | **Intentional** | `createPresentation` not used when `packageCommit` set; dual-push closed. |
| **Post-visibility cancel → complete done** | **Intentional AD7** | Leave after listable keeps presentation; never `onOpen`. Library can gain “orphan” deck user never opened. |
| **Unmount always best-effort cancel** | **Intentional** | Pre-vis rollback; post-vis no-op delete. |
| **Startup outbox drain** | **Recovery dependency** | Crash mid drain relies on `initializePackageStore` drain. Without process restart, undrained outbox can leave pending-visibility until next drain trigger. |
| **Worker env allowlist** | **Deploy break risk** | Non-allowlisted vars no longer reach parser worker (secrets blocked; also custom NODE_OPTIONS blocked). |
| **EMF full env when enabled** | **Residual security** | Documented; not closed. |
| **Warning undercount under flood** | **Evidence honesty** | See H1 — do not market perfect diagnostic fidelity under cap pressure. |
| **P3 no capability unlock** | **Confirmed** | No L4/chart/1:1 code path in this remediation. |

---

## Edge Cases Found by Scout

1. Map TTL expiry during drain window: Map still “running” until completeJob; durable already completed — client prefers Map first (OK).
2. After publish, cancel before drain: rollback + cancelled; drain not called (CP6) — good.
3. Cancel after drain: completeJob wins over cancelling state (finishJob allows non-terminal) — CP7.
4. SSE hang until budget: no final poll reconcile (H2).
5. `importer` spread drops budget metadata (H1).
6. Restart: init drains outbox → listable recovery path (CP8) — good.
7. Client inject `_pptxImportReport` on PUT: stripped (sanitizer test) — good.
8. Adversarial fixtures excluded from corpus averages — package.json script isolation — good.

---

## Positive Observations (risk calibration only)

- Crash suite uses **real** package store + presentations + outbox; fault injection is single-point — matches AD11 anti-theater requirement.
- Contract B serialization carefully withholds `presentationId` when not listable.
- Stamp helper centralizes ID/notes/title/`_pptxImportReport` parity for outbox payload.
- Worker secret denial has direct unit coverage (`API_KEY`, `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, `NODE_OPTIONS`).
- Docs updated as sole-writer + CRC + report authority surface (matches code claims).

---

## Recommended Actions (priority)

1. **Fix H1** — plumb accumulate `omittedCount` into `buildBoundedImportReport`; keep post-map warnings on same budget. Add regression test with >500 pushes.
2. **Fix H2** — SSE budget uses same cancel+reconcile as poll.
3. **Accept/document H3** already in sandbox eval; optional follow-up allowlist for EMF spawn.
4. Align phase/plan status flags with landed code.
5. Optional: persist thin `reportSummary` on durable job; split `pptx-job-wait.js` under 200 LOC.

---

## Metrics

| Metric | Value |
| --- | --- |
| Score | **7/10** |
| Focused unit tests (this review) | 80 pass / 1 skip |
| Integration/crash/adversarial (this review) | 54 pass |
| Lint (scoped files) | 0 issues |
| Type coverage | N/A (JS monorepo; no new TS surface) |
| Test coverage % | Not remeasured globally |
| Critical findings | 0 hard security blockers |
| High findings | 4 (H1–H4) |
| Medium | 6 |

---

## Unresolved Questions

1. Should product toast **warning** summaries after unmount (currently possible) or require absolute UI silence?
2. Is presentation-owned report SSOT enough, or must durable `jobs[]` carry `reportSummary` for ops tooling without opening presentation?
3. Full monorepo `npm run build` + Playwright critical PPTX journey not re-executed in this review pass — recommend before merge if not already green on CI.

---

## Plan task status recommendation (for lead)

| Phase | Code/evidence | Recommend plan status |
| --- | --- | --- |
| 1 Client lifecycle | Landed + tests | → completed after H2 optional |
| 2 Sole writer + drain | Landed + tests | → completed |
| 3 Durable report | Landed; H4 residual | → completed with residual note |
| 4 Crash suite | Landed + green | → completed |
| 5 Worker/warnings | Landed; **H1 open** | → completed only after H1 or explicit residual accept |
| 6 CRC + adversarial | Landed | → completed |
| 7 Perf + sandbox | Landed | → completed |
| 8 P3 coordination | Reports only; no unlock | → completed |

**Do not** mark plan global success criteria fully checked until H1 disposition recorded.
