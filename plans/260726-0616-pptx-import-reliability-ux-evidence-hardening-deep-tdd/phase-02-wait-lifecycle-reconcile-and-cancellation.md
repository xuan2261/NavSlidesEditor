---
phase: 2
title: "Wait Lifecycle Reconcile And Cancellation"
status: completed
priority: P1
effort: "4-6d"
dependencies: [1, 3]
---

# Phase 2: Wait Lifecycle Reconcile And Cancellation

## Overview

Complete the core client wait safety contract across admission, busy retry, SSE, polling, timeout, unmount, and unknown outcome. Admission has its own bounded clock; once admitted, the job has a separate bounded terminal-wait clock. This phase never treats destructive repair as automatic status recovery. Explicit Cancel UI/control remains a documented residual rather than a completed claim.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: an admission `deadlineAt` starts before POST and bounds busy retry plus `Retry-After` delay.
- Functional: after admission succeeds, a distinct terminal-wait `deadlineAt` governs SSE, poll fallback, and the reserved final status read; queued admission time cannot consume it.
- Functional: outer ownership and child transport signals have distinct responsibilities and cleanup. A future explicit cancel control must use its own bounded signal.
- Functional: timeout/final-poll failure performs one bounded durable status GET only; it never invokes POST `/jobs/:jobId/reconcile` automatically.
- Functional: typed server cancellation responses distinguish pre-publication cancellation from post-visibility `too-late/done`; an explicit dashboard Cancel action using a separate bounded DELETE control request remains deferred.
- Functional: final `cancelled`, `done`, `failed`, `pending-visibility`, and `reconcile-required` results are not collapsed into `outcome-unknown`.
- Functional: busy retry honors `Retry-After` and cannot outlive the admission deadline; a visible countdown remains deferred.
- Functional: no `onOpen`, warning toast, report update, or navigation occurs after ownership loss.
- Non-functional: preserve existing 202 admission and 150s-class wait compatibility unless an additive timeout field is introduced.

## Architecture

```text
create admissionDeadlineAt before POST
  -> admission/busy retry (outer ownership signal)
  -> job ID
     -> create terminalWaitDeadlineAt
     -> SSE child controller OR poll child controller
     -> terminal event/status
     -> bounded final GET child controller
  -> done / cancelled / pending-visibility / unknown / failed

automatic timeout: GET-only status inspection; no destructive repair
future explicit Cancel: dedicated bounded DELETE control-plane request
```

The utility owns timers and child controllers. HomePage owns user-visible ownership guards. Admission and terminal waiting deliberately have separate clocks so queueing does not starve an admitted job. Current ownership-loss cleanup may make a best-effort cancellation request, but no automatic timeout path does so. The destructive repair endpoint remains an explicit authority-repair action for a later classified state, not a client timeout primitive.

## Related Code Files

| Action | File | Change |
|---|---|---|
| Modify | `client/src/utils/pptx-job-wait.js` | Admission deadline, child transport controllers, bounded final GET, typed outcomes, cleanup |
| Modify | `client/src/utils/api.js` | Deadline/retry metadata, status DTO, separate cancel control signal; no automatic destructive reconcile |
| Modify | `client/src/pages/HomePage.jsx` | Import status, admission ambiguity, and ownership guards; explicit Cancel/countdown UI remains deferred |
| Modify | `client/src/utils/pptx-job-wait.test.js` | Timing, exact-boundary, hanging-final-GET, child-abort and outcome tests |
| Modify | `client/src/pages/HomePage.pptx-import-lifecycle.test.jsx` | Admission/unmount/cancel/late-open tests |
| Modify | `client/src/utils/api.test.js` | Retry-After/deadline/status/cancel signal tests |
| Optional create | `client/src/components/pptx-import-status.jsx` | Small status control only if needed for HomePage size/accessibility |

## Implementation Steps

1. Write green characterization tests for current destructive reconcile and shared-signal behavior; add desired cases as phase-owned activation tests.
2. Create an admission `deadlineAt` before admission and compute remaining time for each busy retry.
3. Create a distinct terminal-wait `deadlineAt` only after admission; use outer ownership and child SSE/poll/final-GET controllers, aborting transport children on settle or ownership loss.
4. Give the final status GET its reserved bounded remaining-time window. Do not call the destructive POST reconcile endpoint from timeout or final-poll failure.
5. Define typed state transitions for `done`, `cancelled`, `pending-visibility`, `reconcile-required`, `outcome-unknown`, and `failed`.
6. Preserve typed server cancellation responses. Defer dashboard explicit Cancel UI/control wiring until it can use a separate bounded request without reusing an aborted ownership signal.
7. Keep concise recovery copy for unknown or pending-visibility states; defer busy countdown and explicit Cancel controls rather than claiming them complete.
8. Re-check ownership immediately before every warning/report/open callback; clear timers/listeners on every terminal path.
9. Verify direct utility callers cannot leave fallback work alive after rejection, even if they do not abort the outer signal.

## Tests Before

- SSE deadline currently rejects without final durable GET.
- Fallback can start a fresh full budget under current code.
- Current timeout/reconcile path can invoke destructive repair.
- Current cancel signal behavior and post-visibility server policy are characterized.
- Busy admission has no absolute deadline.

## Tests After

- Admission busy retry obeys its own bounded deadline; once admitted, SSE, poll, and final GET obey the distinct terminal-wait deadline.
- Final GET remains possible within its reserved bounded window after transport child cancellation.
- Hanging final GET times out deterministically and yields `outcome-unknown` without destructive repair or late progress.
- Final durable `cancelled` receipt remains `cancelled`, not unknown.
- Pending visibility never opens an ID before the current server visibility result says openable.
- Unmount/ownership loss produces no late open, toast, report update, or transport continuation.
- Explicit Cancel UI/control and a visible Retry-After countdown remain deferred; their server response contract is not claimed as a completed dashboard interaction.

## Completion Checklist — reconciled 2026-07-28

- [x] Admission creates a bounded deadline before POST and applies it only to admission/busy retry.
- [x] A separate post-admission terminal-wait deadline governs transport and the reserved final status GET.
- [x] Wait transport owns its child cleanup while preserving the outer ownership signal.
- [x] Final status recovery is bounded, GET-only, and cannot emit late progress after settlement.
- [x] No automatic timeout path calls destructive repair.
- [x] Unknown-outcome copy matches GET-only timeout behavior and directs users to check existing presentations before retrying.
- [x] An admission response-body timeout is treated as unconfirmed and directs users to check existing presentations before retrying.
- [x] A non-timeout poll transport failure uses the bounded final status read; caller abort and typed terminal outcomes remain distinct.
- [x] Queued SSE progress is fenced after handoff; retained terminal outcomes remain deliverable and settlement aborts wait-owned recovery transport before public completion.
- [x] Home ownership guards prevent late open, warning, or report effects after abandonment.
- [ ] Dashboard explicit Cancel control and a visible Retry-After countdown are not implemented in this scoped closeout.
- [ ] A stronger identity/provenance visibility resolver remains outside this client phase; the client honors the current server visibility result.

## Test Scenario Matrix

| Scenario | Expected result |
|---|---|
| SSE success before deadline | Open once; no cancel or duplicate poll |
| SSE error with remaining time | Poll only within remaining budget |
| SSE deadline | Child transport stops; bounded final GET runs; no destructive repair |
| Hanging final GET | Unknown/manual recovery; no orphan client request after settle |
| Completed durable job | Open only when authoritative resolver says listable/openable |
| Pending visibility | No openable ID; show pending/recovery state |
| Explicit cancel before publication | Cancelled state; server cleanup result shown |
| Cancel after visibility | `too-late/done`; preserve deck and finish server finalization |
| Unmount/admission expiry | No late navigation/toast/report |
| Busy admission | Retry-After delay cannot exceed deadline; visible countdown remains deferred |

## Regression Gate

```bash
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js
```

All targeted tests must pass. Timeout tests may produce structured unknown only when the bounded GET cannot establish status; unknown is not reported as success.

## Success Criteria — reconciled 2026-07-28

- [x] Separate bounded admission and post-admission terminal-wait budgets prevent queueing from starving admitted jobs.
- [x] No fallback or final GET survives settlement/ownership loss, including queued-SSE progress fencing and retained-terminal handoff handling.
- [x] Admission ambiguity and non-timeout poll failure preserve the bounded typed recovery contract.
- [x] Timeout recovery is non-destructive GET-only.
- [x] Pending visibility and unknown results do not open a presentation or fabricate success.
- [ ] Explicit Cancel UI/control and a visible retry countdown remain deferred; server-side cancellation semantics are not promoted to a completed UI claim.

## Risk Assessment

- Risk: final-read budget is starved by transport work. Mitigation: reserve it from the post-admission terminal-wait deadline and test exact boundaries.
- Risk: explicit cancel races late publication. Mitigation: separate control signal and server-owned pre/post-visibility terminal policy.
- Risk: user interprets unknown as failure. Mitigation: bounded recovery action and typed copy; never fabricate success.

## Security Considerations

Do not expose job capabilities or authority identifiers in UI/report text. If Phase 3 selects per-job capabilities, pass them only through memory-held request headers and never persist/export them. Trusted-proxy deployment does not turn a leaked UUID into authorization.

## Next Steps

Phase 3 supplies the authoritative visibility, durable status, capability, and too-late cancellation contracts. Phase 5 consumes the final status/report states.
