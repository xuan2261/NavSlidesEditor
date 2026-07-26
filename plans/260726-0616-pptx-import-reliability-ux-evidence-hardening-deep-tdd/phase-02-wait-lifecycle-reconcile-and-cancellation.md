---
phase: 2
title: "Wait Lifecycle Reconcile And Cancellation"
status: pending
priority: P1
effort: "4-6d"
dependencies: [1, 3]
---

# Phase 2: Wait Lifecycle Reconcile And Cancellation

## Overview

Make client import waiting deterministic across admission, busy retry, SSE, polling, timeout, unmount, explicit cancel, and unknown outcome. This phase consumes Phase 3's authoritative visibility contract; it never treats the existing destructive repair endpoint as automatic status recovery.

## Requirements

- Functional: one `deadlineAt` starts before POST admission and governs busy retry, SSE, poll fallback, cancel control, and final status read.
- Functional: outer ownership, child transport, and cancel control signals have distinct responsibilities and cleanup.
- Functional: timeout/final-poll failure performs one bounded durable status GET only; it never invokes POST `/jobs/:jobId/reconcile` automatically.
- Functional: explicit Cancel uses a separate bounded DELETE control request and distinguishes pre-publication cancellation from post-visibility `too-late/done`.
- Functional: final `cancelled`, `done`, `failed`, `pending-visibility`, and `reconcile-required` results are not collapsed into `outcome-unknown`.
- Functional: busy retry honors `Retry-After`, shows a countdown, and cannot outlive the admission deadline.
- Functional: no `onOpen`, warning toast, report update, or navigation occurs after ownership loss.
- Non-functional: preserve existing 202 admission and 150s-class wait compatibility unless an additive timeout field is introduced.

## Architecture

```text
create deadlineAt before POST
  -> admission/busy retry (outer ownership signal)
  -> job ID
     -> SSE child controller OR poll child controller
     -> terminal event/status
     -> bounded final GET child controller
  -> done / cancelled / too-late-done / pending-visibility / unknown / failed

explicit Cancel: separate bounded DELETE control-plane request
automatic timeout: GET-only status inspection; no destructive repair
```

The utility owns timers and child controllers. HomePage owns user-visible ownership guards. A cancel request is not made with a signal that was already aborted by the wait promise. The current POST reconcile endpoint remains an explicit authority-repair action for a later classified state, not a client timeout primitive.

## Related Code Files

| Action | File | Change |
|---|---|---|
| Modify | `client/src/utils/pptx-job-wait.js` | Admission deadline, child transport controllers, bounded final GET, typed outcomes, cleanup |
| Modify | `client/src/utils/api.js` | Deadline/retry metadata, status DTO, separate cancel control signal; no automatic destructive reconcile |
| Modify | `client/src/pages/HomePage.jsx` | Explicit cancel/countdown/status UI and ownership guards |
| Modify | `client/src/utils/pptx-job-wait.test.js` | Timing, exact-boundary, hanging-final-GET, child-abort and outcome tests |
| Modify | `client/src/pages/HomePage.pptx-import-lifecycle.test.jsx` | Admission/unmount/cancel/late-open tests |
| Modify | `client/src/utils/api.test.js` | Retry-After/deadline/status/cancel signal tests |
| Optional create | `client/src/components/pptx-import-status.jsx` | Small status control only if needed for HomePage size/accessibility |

## Implementation Steps

1. Write green characterization tests for current destructive reconcile and shared-signal behavior; add desired cases as phase-owned activation tests.
2. Create `deadlineAt` before admission and compute remaining time for every retry/transport operation.
3. Use an outer ownership signal, child SSE/poll controllers, and a separate cancel controller. Abort transport children on settle or ownership loss.
4. Give the final status GET a bounded remaining-time window. Do not call the destructive POST reconcile endpoint from timeout or final-poll failure.
5. Define typed state transitions for `done`, `cancelled`, `too-late-done`, `pending-visibility`, `reconcile-required`, `outcome-unknown`, and `failed`.
6. Send DELETE cancel through a separate control-plane signal, await its typed result, then settle local wait state. A late server completion must be surfaced as `too-late/done`, not rolled back after visibility.
7. Add Cancel UI, busy countdown, accessible labels/disabled states, and manual recovery link/action for unknown or pending-visibility states.
8. Re-check ownership immediately before every warning/report/open callback; clear timers/listeners on every terminal path.
9. Verify direct utility callers cannot leave fallback work alive after rejection, even if they do not abort the outer signal.

## Tests Before

- SSE deadline currently rejects without final durable GET.
- Fallback can start a fresh full budget under current code.
- Current timeout/reconcile path can invoke destructive repair.
- Current cancel signal behavior and post-visibility server policy are characterized.
- Busy admission has no absolute deadline.

## Tests After

- Admission, SSE, poll, and final GET obey one absolute deadline.
- Final GET remains possible within its own bounded window after transport child cancellation.
- Hanging final GET times out deterministically and yields `outcome-unknown` without destructive repair.
- Explicit Cancel sends exactly one bounded DELETE and distinguishes pre-publication `cancelled` from post-visibility `too-late/done`.
- Final durable `cancelled` receipt remains `cancelled`, not unknown.
- Pending visibility never opens an ID before Phase 3's authoritative resolver says openable.
- Unmount/ownership loss produces no late open, toast, or report update.
- Retry-After countdown stops at admission deadline and responds to cancel/unmount.

## Function / Interface Checklist

- [ ] `deadlineAt` is created before POST and passed through admission/wait APIs.
- [ ] `waitForPptxJob` owns child transport cleanup without aborting the caller's outer ownership signal.
- [ ] Final status recovery is GET-only and has a bounded child controller.
- [ ] `api.cancelPptxJob` accepts a separate control signal and returns typed too-late/cancelled status.
- [ ] No client path automatically calls destructive POST `/reconcile`.
- [ ] HomePage distinguishes explicit cancel, unmount, timeout, pending visibility, reconcile-required, and server failure.
- [ ] `onOpen` requires the Phase 3 authoritative visibility result and current ownership.

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
| Busy admission | Countdown follows Retry-After but cannot exceed deadline |

## Regression Gate

```bash
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js
```

All targeted tests must pass. Timeout tests may produce structured unknown only when the bounded GET cannot establish status; unknown is not reported as success.

## Success Criteria

- [ ] One admission-to-terminal budget governs all client wait work.
- [ ] No fallback or final GET survives settlement/ownership loss.
- [ ] Timeout recovery is non-destructive GET-only.
- [ ] Cancel semantics match server publication boundaries.
- [ ] Home UI exposes Cancel, countdown, pending/unknown/reconcile states.
- [ ] No late open or success indication occurs after ownership loss or pending visibility.

## Risk Assessment

- Risk: final-read budget is starved by transport work. Mitigation: reserve it from the absolute deadline and test exact boundaries.
- Risk: explicit cancel races late publication. Mitigation: separate control signal and server-owned pre/post-visibility terminal policy.
- Risk: user interprets unknown as failure. Mitigation: bounded recovery action and typed copy; never fabricate success.

## Security Considerations

Do not expose job capabilities or authority identifiers in UI/report text. If Phase 3 selects per-job capabilities, pass them only through memory-held request headers and never persist/export them. Trusted-proxy deployment does not turn a leaked UUID into authorization.

## Next Steps

Phase 3 supplies the authoritative visibility, durable status, capability, and too-late cancellation contracts. Phase 5 consumes the final status/report states.
