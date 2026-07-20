# Phase 04 gateway containment evidence

- Date: 2026-07-15
- Scope: typed launcher boundary, receipt verification, bounded process cleanup
- Status: partial; G1 remains open

## Red/green log

1. `npx vitest run server/services/pptx-import/officecli/gateway.test.js -t "candidate identity without"`
   - Red: candidate-only state reached process result handling.
   - Green after `assertQualifiedExecution()` before revision reads/workspace creation: pass.
2. `npx vitest run server/services/pptx-import/officecli/gateway.test.js -t "receipt-bound execution copy"`
   - Red: receipt-only qualification attempted to stage from the mutable candidate path.
   - Green after using the receipt-bound copy: pass.
3. `npx vitest run server/services/pptx-import/officecli/gateway.test.js -t "invalid workspace"`
   - Red: invalid workspace produced an untyped filesystem error.
   - Green after `WORKSPACE_INVALID` preflight: pass.
4. `npx vitest run server/services/pptx-import/officecli/gateway.test.js -t "revoked tuple"`
   - Red: memoized qualification allowed a revoked tuple on the next request.
   - Green after per-request qualification: pass.
5. `npx vitest run server/services/pptx-import/officecli/execution.test.js -t "waits for launcher close"`
   - Red: timeout rejection preceded launcher close/tree-drain observation.
   - Green after bounded failure waits for close or termination grace: pass.
6. `npx vitest run server/services/pptx-import/officecli/native-launcher-contract.test.js`
   - Green: 6 source-contract tests passed, including assignment-before-resume, receipt hashes, and target no-resident/no-update flags.
7. `npx vitest run server/services/pptx-import/officecli server/services/validated-edited-export.test.js`
   - Green: OfficeCLI suite now 10 files / 73 tests; combined OfficeCLI/export run remains green after lifecycle and receipt-coherence coverage.

## Implemented controls

- Only typed `validate` requests reach the first-party launcher client.
- Candidate-only, non-Windows, invalid workspace, unguarded revision, and missing receipt states fail closed before package reads or workspace creation.
- Receipt copy, launcher identity, policy digest, candidate identity, and input hash are checked before a successful validation result.
- Node-side bounded process failures retain admission/cleanup until launcher close or a bounded termination grace expires.
- Native launcher source passes the one-shot/no-update environment flags to OfficeCLI.

## Open evidence

- C++/Win32 launcher has not been built or run on the pinned Windows/MSVC physical lane.
- Job Object descendant termination, restricted identity, app-data/profile isolation, egress denial, resource limits, and native pre-launch TOCTOU remain unproven.
- No real OfficeCLI validation receipt exists in this repository; production composition remains fail-closed.

## Unresolved questions

- Complete the physical Windows containment matrix before enabling G1 or edited-export qualification.
