---
phase: 3
title: "Live Room Presenter Hardening"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 3: Live Room Presenter Hardening

## Context Links
- [Plan](./plan.md)
- `server/routes/live.js`
- `server/services/live-rooms.js`
- `server/services/socket-handler.js`
- `client/src/hooks/use-live-presentation.js`
- `client/src/components/LivePresentationModal.jsx`
- `client/src/pages/LiveViewPage.jsx`
- `client/src/pages/RemoteControlPage.jsx`
- `client/src/pages/SpeakerViewPage.jsx`

## Overview
Prevent presenter takeover while keeping live viewer, remote controller, and speaker workflows simple.

## Key Insights
- Current `joinRoom(role='presenter')` replaces `presenterId`.
- Room code is shared with viewers/controllers; it cannot also be presenter secret.
- Need a separate presenter token generated when room is created.

## Requirements
- Functional: room creation returns `roomCode` and `presenterToken`.
- Functional: presenter socket join requires correct presenter token.
- Functional: viewers/controllers use room code only.
- Functional: existing public URLs remain `/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`.
- Non-functional: no persistent database; tokens live in current in-memory room state.

## Architecture
Room state:
```js
{
  presenterId,
  presenterTokenHashOrValue,
  controllers: [],
  viewers: [],
  presentationId,
  state
}
```

Flow:
1. Editor `POST /api/live/room` receives `roomCode + presenterToken`.
2. Presenter URL uses server present route with token parameter or in-memory hook state.
3. Socket `join-room` with role `presenter` must include token.
4. If presenter already exists and token invalid: emit `join-error`.
5. Controller and viewer remain token-free.

## Related Code Files
- Modify: `server/routes/live.js`
- Modify: `server/services/live-rooms.js`
- Modify: `server/services/socket-handler.js`
- Modify: `client/src/hooks/use-live-presentation.js`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/components/LivePresentationModal.jsx`
- Modify tests:
  - `server/services/live-rooms.test.js`
  - `server/services/socket-handler.test.js`
  - `tests/e2e/live.spec.js`

## Implementation Steps
1. Extend `createRoom()` and `registerRoom()` to store presenter token.
2. Generate token with `crypto.randomBytes`, not `Math.random`.
3. Return token only from `POST /api/live/room`.
4. Update presenter join contract:
   - `join-room({ roomId, role, presentationId, presenterToken })`.
5. Reject presenter takeover with wrong/missing token.
6. Preserve controller remote navigation path.
7. Add client error handling for join failure.
8. Update modal link handling:
   - viewer/remote/speaker links remain clean.
   - presenter token not exposed in viewer fields.

## Todo List
- [x] Add presenter token to room model.
- [x] Use crypto-safe room code/token generation.
- [x] Update Socket.IO join validation.
- [x] Update presenter client join payload.
- [x] Add user-facing error for join rejection.
- [x] Preserve remote/speaker links.

## Tests / Verification
- Unit:
  - presenter can join with token.
  - presenter cannot join existing room without token.
  - wrong token does not replace current presenter.
  - controller can still join and control.
  - presenter leaving cleans room as before.
- Socket integration:
  - `join-room` emits `room-not-found`/`join-error` for invalid presenter.
  - controller `control-navigate` still reaches presenter.
- E2E:
  - live modal opens.
  - viewer URL works.
  - remote controller navigates viewer.
  - malicious second presenter cannot hijack room.
- Commands:
  - `npm run test -- server/services/live-rooms.test.js server/services/socket-handler.test.js`
  - `npm run test:e2e -- tests/e2e/live.spec.js`
  - `npm run build`

## Success Criteria
- [x] Room code alone cannot create/replace presenter.
- [x] Viewer/remote/speaker URLs unchanged.
- [x] Live E2E still passes.

## Risk Assessment
- Risk: token disappears on reload.
- Mitigation: create new live room on new presenter session; document current behavior.
- Risk: present route needs token propagation.
- Mitigation: pass token only through presenter-side client state or non-shared URL.

## Security Considerations
- Room code remains shareable.
- Presenter token is capability credential; never show in viewer link fields.

## Next Steps
- Phase 8 validates live flow after all fixes.
