# Red-Team — TDD / Evidence Honesty Plan Review

**Plan:** `plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd`  
**Role:** Hostile TDD/evidence-honesty reviewer (not collaborator)  
**Date:** 2026-07-24  
**Verdict:** **FAIL — do not cook as written**  
**Scope verified against:** `plan.md` + all 8 `phase-*.md` + P0 `plan.md` non-goals + live `client/src/utils/api.js`, `pptx-job-wait.js`, `HomePage.jsx`, `server/routes/pptx-import.js`, `worker-runner.js`, `pptx-guards.js`, `package-store/import-commit.js`, `docs/export-fidelity-and-limits.md`

## Spot-checks that did NOT become findings

| Claim | Result |
| --- | --- |
| P0 Retry-After still open | **False.** `api.js:10-36,44-65,153-176` implements grammar/cap/abortable sleep. P0 non-goals (`260722-1630.../plan.md:35`) deferred full lifecycle only. This plan correctly treats Retry-After as regression (phase-01 T6), not new work. |
| Dual-writer already fixed | **False.** `pptx-import.js:254-266` still `createPresentation` after `packageCommit`; drain only on reconcile (`:99-109`, `:362`). Phase 2 work still real. |
| Worker env already allowlisted | **False.** `worker-runner.js:24-27` still `...baseEnv`; timeout message hardcodes `60s` (`:115`) while timer uses `timeoutMs` (`:67,110-119`). Phase 5 still real. |

---

## F-1

- **Severity:** Critical
- **Title:** Phase 4 “Tests Before (TDD)” has zero concrete failing assertions
- **Evidence:**
  - `phase-04-crash-point-and-restart-interleaving-suite.md:73-75` — entire Tests Before body: “Write failing tests for CP1–CP5 first… then CP6–CP10.”
  - `phase-04-...md:28-40` — CP table states recovery prose only; no `expect(...)` shapes, no status codes, no job/presentation invariants as assertable objects.
  - `phase-04-...md:130` — Todo still “Tests Before CP1–CP5” with no red fixture list.
  - Contrast: phase-03 at least states numeric bounds (`phase-03-...md:85-90`); phase-04 is the highest-risk reliability phase and the weakest TDD contract.
- **Failure mode:** Cook marks “tests written” with suite scaffolding that always passes (DI seams present, no throw) without proving CP1–CP5 recovery. Deep-TDD label becomes theater.
- **Required fix before cook:**
  For each CP1–CP5, specify: injected fault site, preconditions, exact postconditions (`job.status`, `transactionState`, listability of `presentationId`, whether `completeJob`/`failJob` fired, reportSummary presence for CP4). Example CP1: after publish throw-before-drain → durable job `completed` + pending outbox + list GET 404 until drain OR reconcile cleanup; no `completeJob` success path.

---

## F-2

- **Severity:** High
- **Title:** Parallel cook `Phase 1 || Phase 2` ownership is false once phase 1 optional server deadline lands
- **Evidence:**
  - `plan.md:80-81` — `Phase 1 || Phase 2 || Phase 6` independent owners
  - `plan.md:94-95` — Phase 1 exclusive: client wait/api/HomePage; Phase 2 exclusive: `server/routes/pptx-import.js` (runImport path)
  - `phase-01-...md:65-66` — File inventory: `server/routes/pptx-import.js` **Optional** deadline metadata
  - `phase-01-...md:54` — Architecture: optional server `deadlineMs` / `expiresAt` on `202` and job serialize
  - `phase-02-...md:60` — Phase 2 modifies same `pptx-import.js` for dual-write removal + drain
- **Failure mode:** Parallel cooks collide on `pptx-import.js` (519 LOC hub). Merge reorders drain vs deadline fields; tests flake; “exclusive ownership” claim in plan is dishonest if optional path is taken.
- **Required fix:** Either (a) delete phase-01 optional server deadline entirely (client hardcode slack only — already allowed at `phase-01-...md:54` / `plan.md:57`), or (b) move deadline metadata into phase 2/3 sequential ownership and remove `Phase 1 || Phase 2` independence claim.

---

## F-3

- **Severity:** High
- **Title:** Phase 7 regression gate is intentionally non-executable / skippable
- **Evidence:**
  - `phase-07-...md:108-115` — gate uses `**/*inventory*` / `**/*perf*` globs, `2>$null` error swallow, comment “Exact paths finalized at implement time”
  - `plan.md:137-138` — plan-level validation: “exact script named in phase file” (still not named)
  - `phase-07-...md:37,59` — heavy ladder behind `PPTX_PERF=1`; success allows “skip reason recorded” (`phase-07-...md:136`)
  - `phase-07-...md:88-92` — Tests Before only “durations ≥ 0”, optional cache, “unit-sized” near-limit — no schema golden for p50/p95/RSS artifact
- **Failure mode:** Phase 7 closes green with a markdown sandbox note + trivial timer ≥ 0. Audit P2.1/P2.2 “perf matrix evidence” never becomes a hard gate. `2>$null` hides missing tests.
- **Required fix:** Name always-on files now (`pptx-import-stage-timer.test.js`, report schema fixture). Forbid `2>$null`. Require opt-in ladder either produces schema-valid JSON under `plans/reports/` **or** fails with structured `SKIPPED_RESOURCE` object checked by a unit test (not free-form prose).

---

## F-4

- **Severity:** High
- **Title:** Plan schedules 200-LOC violations on hot files without a split step
- **Evidence:**
  - `phase-01-...md:60` — `pptx-job-wait.js` “~158→~220”
  - Live `client/src/utils/pptx-job-wait.js` is **158** lines today (matches estimate)
  - Project rule: `Claude.md` “Keep individual code files under 200 LOC”
  - `plan.md:41` softens to “files under 200 LOC **where new**” — loophole vs project rule
  - `server/routes/pptx-import.js` already **519** lines; phases 2–4 all modify it (`phase-02-...md:60`, `phase-03-...md:70`, `phase-04-...md:62`) with no extract-runImport step
  - `HomePage.jsx` **1904** lines; phase 1 + phase 3 both edit import slice (`plan.md:94`, `phase-03-...md:74`)
- **Failure mode:** Cook piles signal/budget/SSE into `pptx-job-wait.js` past 200; `runImport` gains drain + report + DI crash seams without split → unreviewable diffs, dirty-worktree merge pain (`.tmp/*` + modified sibling plans already present).
- **Required fix:** Phase 1 must split before grow (e.g. `pptx-job-poll.js` / `pptx-job-sse-wait.js` / shared abort sleep). Phase 2+ must extract `run-import.js` (<200) before drain/report/crash seams. HomePage import flow → dedicated hook/module owned by phase 1; phase 3 only consumes summary helper.

---

## F-5

- **Severity:** High
- **Title:** Phase 1 Tests Before are scenario labels, not red assertions (except weak prose)
- **Evidence:**
  - `phase-01-...md:72-78` — bullets: “rejects AbortError”, “cancel + reconcile path **still works**”, “onConnection called…”, “does not call onOpen”, “share same signal instance” — no expected error `code`, no call-count on `cancelPptxJob`, no fake-timer advance contract, no `maxWaitMs` numeric fixture.
  - `phase-01-...md:100-109` — matrix T1–T6; T3 “maxWaitMs fires; cancel + unknown outcome **if needed**” is optionalized; T6 Retry-After is regression-only with **no** Tests Before bullet.
  - Live gap the phase claims to close is real: `pptx-job-wait.js:24-36` poll sleep is non-abortable `sleep`; `:88-95` poll-only never calls `onConnection`; SSE path has no absolute budget (`:98-157`); `HomePage.jsx:702` `onOpen` has no ownership re-check (unmount nulls ref at `:300-306` but late resolve still opens).
  - Existing concrete tests (`pptx-job-wait.test.js:39-85`) already show the assertion style the plan should mandate and extend — plan does not reference those shapes.
- **Failure mode:** Implementer writes “abort test” that rejects any Error; wait-budget test that only shortens `maxPollAttempts` (already covered) without absolute SSE timer; HomePage test never resolves job after unmount. Lifecycle bugs ship under green “T1–T6”.
- **Required fix:** Replace Tests Before with assertable contracts, e.g.:
  1. `pollPptxJobUntilTerminal({ signal })` mid-sleep → `AbortError`; `pollPptxJob` call count frozen.
  2. `waitForPptxJob` with FakeEventSource that never terminals + `maxWaitMs: 50` (fake timers) → `cancelPptxJob` once + `PPTX_JOB_OUTCOME_UNKNOWN` (or documented done race).
  3. `EventSourceImpl: null` → `onConnection({ jobId })` then `onConnection(null)` on settle.
  4. HomePage: after jobId, unmount, then resolve wait mock → `onOpen` **0** calls; `cancelPptxJob` **≥1**.
  5. Same `AbortSignal` instance from admission into wait (identity equality).

---

## F-6

- **Severity:** High
- **Title:** Phase 6 CRC path allows green-first baseline; defeats fail-closed TDD for the actual policy change
- **Evidence:**
  - `phase-06-...md:88-90` — Tests Before #1: “assert reject **(or current behavior baseline first, then fail-closed)**”
  - `phase-06-...md:29-34` — policy is fail-closed only “if” JSZip allows; soften to warn-only is a product override escape
  - Live import CRC off: `pptx-guards.js:101` `checkCRC32: false`; `opc-inventory.js` also false (research baseline `plan.md:150`)
  - `phase-06-...md:109-115` — regression gate can pass on existing guards tests + metrics without adversarial command (“when added”)
- **Failure mode:** Cook lands “baseline documents current accept-bad-CRC” test (green), defers fail-closed, marks phase complete under “probe inconclusive”. Audit P2.4 stays open while plan checkbox closes.
- **Required fix:** Split into two explicit red tests now:
  1. **Policy intent (must fail today):** bad-CRC fixture → expect stable reject code (RED until implementation).
  2. **Corpus safety (optional probe):** real 11-deck load with CRC-on; if false positive, open product decision — **phase stays blocked**, not warn-only by default.
  Adversarial suite command name required in gate before phase exit (`npm run test:pptx:adversarial` or equivalent must exist in package.json as part of phase, not “when added”).

---

## Plan.md vs phase contradictions (rolled into above)

| Topic | plan.md | phase file | Disposition |
| --- | --- | --- | --- |
| Parallel 1\|\|2 | Independent owners (`:80-81`) | Phase 1 optional `pptx-import.js` | **F-2** |
| 200 LOC | “where new” (`:41`) | phase-01 grows wait to ~220 | **F-4** |
| Phase 7 gate | “exact script in phase file” (`:137-138`) | paths deferred + `2>$null` | **F-3** |
| TDD-first | Delivery contract (`:41`) | phase-04 empty Tests Before | **F-1** |

## HomePage multi-phase touch (informational, not separate F)

- Phase 1 exclusive HomePage (`plan.md:94`) vs phase 3 inventory `HomePage.jsx` summary fallback (`phase-03-...md:74`). Sequential default avoids parallel clash; still violates exclusive-owner table. Fix with F-4 hook extraction.

---

## Verdict summary

| ID | Severity | One-liner |
| --- | --- | --- |
| F-1 | Critical | Phase 4 TDD section is empty prose |
| F-2 | High | Phase 1\|\|2 ownership broken by optional server file |
| F-3 | High | Phase 7 gate is phantom/skippable |
| F-4 | High | Planned >200 LOC growth on wait + 519-LOC runImport hub |
| F-5 | High | Phase 1 red tests lack assertable contracts |
| F-6 | High | Phase 6 green-first CRC escape |

**Do not cook** until F-1, F-2, F-5 rewritten into concrete RED contracts and F-3/F-4/F-6 gates/splits are bound.

```
Status: DONE_WITH_CONCERNS
Summary: 6 findings (1 critical, 5 high). P0 Retry-After correctly not reopened; dual-writer/worker-env gaps still real. Plan fails deep-TDD honesty mainly on phase 4 empty Tests Before, parallel ownership lie, and soft phase 6/7 gates.
Concerns/Blockers: Block cook until F-1/F-2/F-5 fixed in plan text; F-3/F-4/F-6 must be bound before those phases start.
```
