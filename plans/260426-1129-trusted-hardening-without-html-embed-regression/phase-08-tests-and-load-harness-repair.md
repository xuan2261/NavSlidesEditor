---
phase: 8
title: "Tests And Load Harness Repair"
status: completed
priority: P1
effort: "5h"
dependencies: [2, 3, 4, 5, 6, 7]
---

# Phase 8: Tests And Load Harness Repair

## Context Links
- [Plan](./plan.md)
- `tests/load/api-load.js`
- `tests/load/websocket-load.js`
- `tests/e2e/explore.spec.js`
- `tests/e2e/sharing.spec.js`
- `tests/e2e/live.spec.js`
- `tests/e2e/fixtures/test-fixtures.js`
- `playwright.config.cjs`
- `client/vite.config.js`

## Overview
Repair tests that currently pass falsely or hit wrong endpoints. Add cross-phase regression gates.

## Key Insights
- k6 tests use port/path/protocol not matching current server.
- Some E2E assertions are tautological or cleanup-swallowing.
- Test repair should happen after implementation phases so tests reflect final contracts.

## Requirements
- Functional: load tests hit current server port/path.
- Functional: websocket load test uses `/ws` and current `join-room` protocol.
- Functional: E2E assertions verify real behavior.
- Functional: API helper failures are clear.
- Non-functional: no fake data that masks failures.

## Architecture
Test config:
- API load base URL from env, default `http://localhost:3002/api`.
- WS load URL from env, default `ws://localhost:3002/ws/?EIO=4&transport=websocket`.
- Use current Socket.IO events: `join-room`, `navigate`, etc.

E2E:
- Replace `cardCount >= 0` tautology with real empty/shared state checks.
- Improve cleanup error reporting but allow best-effort cleanup.
- Add regression specs for share/live/security policies from phases 2-7.

## Related Code Files
- Modify: `tests/load/api-load.js`
- Modify: `tests/load/websocket-load.js`
- Modify: `tests/e2e/explore.spec.js`
- Modify: `tests/e2e/fixtures/test-fixtures.js`
- Modify: `tests/e2e/live.spec.js`
- Modify: `tests/e2e/sharing.spec.js`
- Create: `tests/e2e/html-embed-regression.spec.js`
- Create/modify server/client unit tests from previous phases.

## Implementation Steps
1. Make load test base URLs configurable by env.
2. Fix API load default port.
3. Fix WS load path and join event format.
4. Replace tautological Explore assertion.
5. Update API helpers:
   - check `res.ok()` before `res.json()`.
   - `apiDeletePresentation` should not swallow non-cleanup failures silently.
6. Add targeted E2E:
   - analytics access rule.
   - live presenter hijack rejection.
   - HTML embed regression.
   - numeric input NaN guard.
7. Keep tests stable under Playwright proxy config.

## Todo List
- [x] Fix k6 API load URL.
- [x] Fix k6 WS path/event protocol.
- [x] Replace false-positive Explore test.
- [x] Harden E2E API fixtures.
- [x] Add cross-phase regression specs.
- [x] Document how to run load tests.

## Tests / Verification
- Commands:
  - `npm run test`
  - `npm run test:e2e -- tests/e2e/explore.spec.js tests/e2e/live.spec.js tests/e2e/sharing.spec.js`
  - `npm run test:e2e -- tests/e2e/html-embed-regression.spec.js`
  - `npm run build`
  - `npm run test:load:api` if k6 installed and server running.
  - `npm run test:load:ws` if k6 installed and server running.
- Expected:
  - load tests target `3002` or env override.
  - websocket connects through `/ws`.
  - E2E failures produce clear server response text.

## Success Criteria
- [x] No known tautological assertions remain in touched tests.
- [x] Load scripts match current server.
- [x] Cross-phase regression tests pass.

## Risk Assessment
- Risk: k6 unavailable locally.
- Mitigation: document as optional external tool; unit/E2E remain mandatory.
- Risk: E2E runtime grows.
- Mitigation: keep high-risk specs focused.

## Security Considerations
- Tests enforce chosen trusted-content model.

## Next Steps
- Phase 9 final cleanup/docs/verification.
