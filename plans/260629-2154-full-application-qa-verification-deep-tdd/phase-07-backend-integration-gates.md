---
phase: 7
title: "Backend Integration Gates"
status: completed
priority: P1
dependencies: [2, 3]
---

# Phase 7: Backend Integration Gates

## Overview
Verify server routes, storage, sockets, security boundaries, import/export services, AI guards, sync mocks, and load-test smoke profiles.

## Requirements
- Functional: cover API CRUD, templates, share, upload, history, settings, media, live, games, AI, GitHub push, sync, plugins, explore, marketplace, analytics, PPTX import/export, storage recovery, and Socket.IO events.
- Non-functional: deterministic filesystem isolation, no real credentials, no real external sync/AI/GitHub calls, and clear trust-boundary assertions.

## Architecture
Keep route/service contracts in Vitest where possible, browser integration for UI path, k6 smoke for load path, and corpus/browser audit for PPTX path.

## Related Code Files
- Modify: `server/routes/*.test.js`
- Modify: `server/services/*.test.js`
- Modify: `server/services/pptx-import/*.test.js`
- Modify: `tests/load/*.js`
- Modify: `tests/e2e/security/*.spec.js`
- Modify: `tests/e2e/share/*.spec.js`
- Modify: `tests/e2e/sync/*.spec.js`

## Implementation Steps
1. Map every route and socket event to route/service tests plus at least one integration path where user-visible, including plugins, explore, marketplace, analytics, and plugin sandbox routes.
2. Add boundary tests for auth-like presenter/share tokens, password handling, path traversal, SSRF, upload limits, zip bombs, dependency audit floors, and token leakage.
3. Ensure storage tests cover atomic mutation, history restore, soft delete, corruption handling, and concurrent writes.
4. Add mocked GitHub, rclone, AI, Unsplash/Giphy flows without network secrets.
5. Run and wire smoke load tests for REST and WebSocket flows.

## TDD Gate
- Red: route/socket inventory rows without tests must fail matrix gate.
- Green: add service/route tests or justified manual gates until all P1 backend rows pass.

## Success Criteria
- [x] Public API route smoke/failure coverage validated for selected backend contract suite.
- [x] Live socket lifecycle coverage validated through `socket-handler.test.js`.
- [x] Security gates reflect README trust model and block only real trust-boundary issues.

## Risk Assessment
Risk: external integrations force flaky network tests. Mitigation: contract mocks locally, and keep real-provider checks manual/nightly only if explicitly configured.
