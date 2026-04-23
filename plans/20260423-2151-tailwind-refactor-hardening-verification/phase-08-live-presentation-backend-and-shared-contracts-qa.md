---
phase: 8
title: "Live Presentation Backend And Shared Contracts QA"
status: completed
priority: P1
effort: "1.5 days"
dependencies: [1, 2, 5, 7]
---

# Phase 8: Live Presentation Backend And Shared Contracts QA

## Overview

Verify live presentation flows and shared contracts after refactor. This covers live view, remote control, speaker view, room state, socket handling, slide notes, and shared HTML generation.

## Requirements

- Presenter, audience, remote, and speaker views must agree on room/session state.
- Shared slide notes contract must work in both client and server bundles.
- Live room cleanup and reconnect behavior must remain stable.
- Tailwind/UI changes must not break live controls on mobile.
- Server routes and socket handlers must keep validation and error handling.

## Architecture

Live flow:

Editor/live modal -> server live route -> room service -> socket handler -> live view/speaker/remote clients -> shared slide/html utilities.

Shared contracts:

`shared/src/types/presentation.js`, `shared/src/slideNotes.js`, `shared/src/htmlGenerator.js`, and `shared/src/index.js` must export stable APIs consumed by client and server.

## Related Code Files

- `client/src/pages/LiveViewPage.jsx`
- `client/src/pages/RemoteControlPage.jsx`
- `client/src/pages/SpeakerViewPage.jsx`
- `client/src/hooks/use-live-presentation.js`
- `client/src/components/LivePresentationModal.jsx`
- `server/index.js`
- `server/routes/live.js`
- `server/services/live-rooms.js`
- `server/services/socket-handler.js`
- `server/services/live-rooms.test.js`
- `shared/src/htmlGenerator.js`
- `shared/src/index.js`
- `shared/src/types/presentation.js`
- `shared/src/slideNotes.js`
- `shared/tests/htmlGenerator.test.js`
- `client/src/utils/slide-notes.js`
- `client/src/utils/slide-notes.test.js`
- `tests/e2e/live.spec.js`

## Implementation Steps

1. Review shared exports:
   - `slideNotes` exported from shared package.
   - Client fallback utilities remain compatible.
   - Server imports do not depend on client-only code.
2. Verify live room service:
   - Create room.
   - Join/leave.
   - Presenter control.
   - Audience state.
   - Cleanup timers.
   - Reconnect behavior.
3. Verify socket handler:
   - Valid event payloads.
   - Invalid event payloads.
   - Room not found.
   - Duplicate connections.
   - Role permissions.
4. Verify UI pages:
   - Live view renders current slide.
   - Remote control can next/previous.
   - Speaker view shows current/next slide and notes.
   - QR/link/share controls fit mobile.
5. Verify notes:
   - Notes imported from old and new presentation shapes.
   - Notes remain available in speaker view/export.
   - Missing notes do not crash.
6. Run live E2E with clean server/client startup.

## Verification & Tests

- `npx vitest run server/services/live-rooms.test.js`
- `npx vitest run shared/tests/htmlGenerator.test.js`
- `npx vitest run client/src/utils/slide-notes.test.js`
- `npx playwright test tests/e2e/live.spec.js`
- Optional load:
  - `npm run test:load:ws`
- Manual live matrix:
  - Start live session from editor.
  - Open live audience view in second browser context.
  - Open remote control on mobile viewport.
  - Open speaker view and verify notes.
  - Disconnect/reconnect presenter.
  - End session and verify stale URLs show proper error state.
- Runtime checks:
  - No unhandled socket errors.
  - No server console stack trace on invalid room.
  - No client blank page on room not found.

## Success Criteria

- [ ] Shared exports work in client, server, and tests.
- [ ] Live room unit tests and live E2E pass.
- [ ] Speaker notes render correctly across editor/live/export paths.
- [ ] Live controls are usable on mobile remote viewport.

## Risk Assessment

- Risk: shared package export cache causes client build mismatch. Mitigation: clean build and test client/server consumers.
- Risk: live E2E flakes on timing. Mitigation: wait for socket-ready UI state, not arbitrary timeouts.
- Risk: role permissions regress. Mitigation: explicit invalid/unauthorized event tests.

## Security Considerations

- Validate live route payloads with schemas.
- Do not leak private presentation data across room IDs.
- Socket events must reject unauthorized presenter actions.

## Todo List

- [ ] Shared export audit complete.
- [ ] Live room service tests pass.
- [ ] Live E2E passes.
- [ ] Mobile remote/speaker screenshots captured.

## Next Steps

Proceed to Phase 9 when live/shared contracts are proven stable.
