# OfficeCLI Contract Work Did Not Deliver Containment

**Date**: 2026-07-15 02:15
**Severity**: High
**Component**: PPTX import OfficeCLI gateway
**Status**: Ongoing

## What Happened

We implemented fail-closed, non-executing candidate verification and a receipt-bound launcher seam for the OfficeCLI gateway. Candidate bytes can be pinned and staged as a reverified content-addressed execution copy without running a version probe. `runBoundedProcess()` now rejects every direct target launch with `DIRECT_PROCESS_DISABLED`; `launcher-client.js` permits only typed `validate` requests and requires a receipt binding the candidate hash/version, execution-copy identity, launcher identity, and policy digest.

The follow-up cleanup work fixed lifecycle gaps: `gateway.js` releases the shared weighted-admission reservation even when workspace cleanup throws, and a shutdown path cooperatively aborts active launcher requests through `AbortController` and `ChildRegistry`.

## The Brutal Truth

This is not a sandbox and not a product capability. It is a Node-side refusal layer wrapped around fake launcher tests. Calling it “contained OfficeCLI” today would be dishonest and dangerous. The frustrating part is that the most reassuring test names are still incapable of proving the Windows behavior we actually need: a real descendant process, a real Job Object, and real network denial.

## Technical Details

Focused validation passed: `npx vitest run server/services/pptx-import/officecli/` — **7 files, 44 tests passed** in 10.48 s. The suite verifies candidate-only qualification returns `candidate-verified-awaiting-containment`, receipt mismatch returns `RECEIPT_IDENTITY_MISMATCH`, direct spawning returns `DIRECT_PROCESS_DISABLED`, and non-Windows fails before revision read, workspace creation, or launcher invocation with `CAPABILITY_UNAVAILABLE`.

`gateway.test.js` also proves admission release after cleanup failure and shutdown-triggered abort propagation. These are contract assertions, not physical containment evidence.

## What We Tried

We deliberately rejected direct Node `spawn` as the production boundary. It cannot guarantee assignment-before-execution or terminate a hostile child/grandchild tree. A permissive candidate-only path was also rejected: missing receipts fail before workspace creation.

## Root Cause Analysis

The native boundary has not been built. There is no repository-owned C++/Win32 launcher, no Job Object assignment-before-resume evidence, no `ACTIVE_PROCESS_ZERO` drain proof, no restricted/AppContainer worker identity, no ACL/profile isolation proof, and no DNS/loopback/LAN/public egress-denial evidence. JavaScript mocks cannot substitute for any of that.

## Lessons Learned

A receipt schema and abort signal are useful seams, not security controls. Do not unlock a native parser based on green unit tests that never create the target process. Keep direct-spawn prohibition architectural and test it continuously.

## Next Steps

- **Phase 4 owner, before any capability enablement**: build the C++/Win32 launcher with Job Object process-at-creation or suspended assignment, bounded I/O, kill-on-close, and terminal tree-zero receipt.
- **Phase 4 owner, before release**: run physical Windows fixtures for child/grandchild termination, resource flooding, cancellation, shutdown, ACL/profile denial, and DNS/loopback/LAN/public egress denial.
- **Release owner, immediately**: retain capability-disabled behavior and original-package recovery until physical evidence is reviewed.

## Unresolved Questions

G0–G5, including G1, remain open. G1 cannot close without the missing native launcher, Job Object, restricted identity, egress enforcement, and physical Windows evidence.
