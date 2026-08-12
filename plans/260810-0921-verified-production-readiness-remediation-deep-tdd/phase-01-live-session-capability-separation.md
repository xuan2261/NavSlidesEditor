---
phase: 1
title: "Live Session Capability Separation"
status: completed
priority: P1
effort: "4-5 engineer-days"
dependencies: []
---

# Phase 1: Live Session Capability Separation

<!-- Updated: Validation Session 1 - privileged fragments scrub immediately into memory -->

## Context Links

- [Plan overview](./plan.md)
- [Live/deployment/SVG research](./research/live-deployment-svg-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- `C:\Work\NavSlidesEditor\README.md`
- `C:\Work\NavSlidesEditor\docs\system-architecture.md`

## Overview

Separate viewer, remote, speaker, and presenter authority. Remove speaker notes
from every viewer/remote payload while preserving valid presenter, speaker,
remote navigation, reconnect, annotation, and timer behavior.

## Requirements

### Functional

- Viewer joins with room code only and remains receive-only.
- Presenter, remote, and speaker use distinct 192-bit-or-better random capabilities.
- Server stores only capability hashes and compares bounded values without exposing
  raw capability in room state, broadcasts, status routes, errors, or logs.
- Unknown roles, absent capabilities, wrong-role capabilities, and cross-room
  replay fail before socket membership/state is written.
- Viewer receives notes-free presentation HTML. Remote receives notes-free minimal
  metadata. Speaker/presenter receive notes-bearing metadata required by their UI.
- Canonical `notes`, legacy `speakerNotes`, and vertical-child notes are all removed
  from public output.
- Viewer URL remains `/live/:roomCode`. Privileged links become
  `/remote/:roomCode#cap=...` and `/speaker/:roomCode#cap=...`.
- Bare legacy remote/speaker URLs fail closed with a recoverable invalid-link UI.
- Existing presenter capability query-string fallbacks are removed. Capability-bearing
  REST calls use an authorization header only.
- Every capability-bearing HTTP response sets `Cache-Control: no-store, private`,
  `Pragma: no-cache`, and an expired `Expires` value.
- Remote/speaker pages parse the fragment into component memory and immediately
  scrub `location.hash` with `history.replaceState` before joining Socket.IO.

### Non-functional

- Preserve room creation, presenter popup, reconnect identity/generation fencing,
  room cleanup, viewer count, and annotation/timer synchronization. Add the
  capability-response no-store policy without changing unrelated responses.
- Do not add accounts, cookies, persistent room tokens, or multi-user auth.
- Capability parsing must be strict and must not place fragments in HTTP requests.
- No note-bearing payload may be emitted through a room-wide broadcast.

## Architecture

### Room state

```js
{
  presenterTokenHash,
  remoteTokenHash,
  speakerTokenHash,
  presenterId,
  remotes: [],
  speakers: [],
  viewers: []
}
```

`POST /api/live/room` returns plaintext capabilities once:

```js
{ roomCode, presenterToken, remoteToken, speakerToken }
```

`joinRoom(roomId, socketId, role, { capability, presenterToken })` accepts only:

| Role | Join credential | Allowed mutations | Payload |
|---|---|---|---|
| presenter | `presenterToken` | all presenter/live mutations | full HTML + notes metadata |
| speaker | `speakerToken` | navigate, laser, annotation, timer | full HTML + notes metadata |
| remote | `remoteToken` | navigate, laser | notes-free metadata only |
| viewer | room code | none | notes-free HTML only |

Add explicit role predicates (`canNavigateRoom`, `canAnnotateRoom`,
`canControlTimer`) rather than keeping one broad `canControlRoom` predicate.
Generate role payloads under the existing room-object/deck-generation fences.

### Notes rendering

```js
generateRevealHTML(presentation, {
  includeSpeakerNotes: true // default
})
```

Only live viewer output passes `false`. Same-origin Present, HTML export, Offline
HTML, speaker preview, and author-owned output preserve notes by default.

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Modify | `C:\Work\NavSlidesEditor\server\routes\live.js` | Return distinct role capabilities | REST contract tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\live-rooms.js` | Role enum, hashes, membership and predicates | Live-room unit tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\socket-handler.js` | Per-role authorization and payload delivery | FakeIO unit tests |
| Modify | `C:\Work\NavSlidesEditor\shared\src\htmlGenerator.js` | Optional notes emission | Shared generator tests |
| Create | `C:\Work\NavSlidesEditor\client\src\utils\live-capability-url.js` | Strict fragment build/parse | New utility tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-live-session-controller.js` | Retain returned capabilities | Controller tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\pages\EditorPage.jsx` | Thread role capabilities through editor composition | Composition tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\editor\editor-page-chrome.jsx` | Forward role capabilities | Shell tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\EditorModals.jsx` | Forward role capabilities | Modal contract tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\editor-modals-secondary.jsx` | Deliver capabilities to live modal | Modal contract tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\components\LivePresentationModal.jsx` | Generate privileged fragment links | Modal tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\pages\RemoteControlPage.jsx` | Parse remote capability and role | Page/E2E tests |
| Modify | `C:\Work\NavSlidesEditor\client\src\pages\SpeakerViewPage.jsx` | Parse speaker capability and role | Page/E2E tests |
| Verify | `C:\Work\NavSlidesEditor\client\src\pages\LiveViewPage.jsx` | Preserve current dirty work; viewer remains room-code-only | Existing live E2E |
| Modify/retire | `C:\Work\NavSlidesEditor\client\src\hooks\use-live-presentation.js` | Align dormant creator or remove after caller proof | Hook tests/audit |
| Modify | `C:\Work\NavSlidesEditor\server\services\live-rooms.test.js` | Capability/role matrix | Focused unit gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\socket-handler.test.js` | Recipient and mutation matrix | Focused unit gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\live-rest-api-routes.test.js` | Real router response contract | REST gate |
| Modify | `C:\Work\NavSlidesEditor\shared\tests\htmlGenerator.test.js` | Root/child/legacy note opt-out | Shared gate |
| Modify | `C:\Work\NavSlidesEditor\tests\e2e\live-remote-controller.spec.js` | Valid remote capability flow | Browser gate |
| Modify | `C:\Work\NavSlidesEditor\tests\e2e\security\presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js` | Role escalation/replay | Security gate |

## Function and Interface Checklist

- [x] Enumerate every `POST /api/live/room` consumer before changing response.
- [x] Enumerate every `join-room` sender and every `role === 'controller'` branch.
- [x] Replace controller membership without retaining an alias that accepts no token.
- [x] Preserve presenter token/window-name behavior.
- [x] Keep role capabilities out of query strings and server-side navigation.
- [x] Remove and test rejection of existing `req.query.presenterToken` and
  `req.query.token` REST fallbacks.
- [x] Thread remote/speaker capabilities through EditorPage, chrome, modal
  composition and modal props without exposing presenter authority.
- [x] Scrub privileged fragments before socket join and prove reload without the
  original link fails closed.
- [x] Apply no-store headers to room creation and all capability-bearing responses.
- [x] Check all room-wide emissions for role-sensitive content.
- [x] Preserve async deck generation and room recreation fences.
- [x] Prove `includeSpeakerNotes` defaults to current behavior for every non-viewer
  caller.

## Dependency Map

```text
Live REST create
  -> editor live controller
  -> modal link/presenter popup
  -> role page fragment parser
  -> Socket.IO join
  -> live-room authorization
  -> role-specific presentation payload
```

No phase dependency. `htmlGenerator.js` also changes in Phase 2, so implementation
must land Phase 1 first or rebase Phase 2 before editing that file.

## Tests Before (RED)

| Scenario | Layer | Expected failure before implementation |
|---|---|---|
| Viewer code joins as remote/speaker without capability | Unit/socket | `join-error`; no membership |
| Remote token used as speaker or in another room | Unit/socket | fail closed |
| Unknown role | Unit | explicit rejection, not viewer fallback |
| Viewer note canary in root/child/legacy fields | Shared/socket | absent from emitted HTML |
| Remote note canary | Socket/client | absent from metadata/UI |
| Viewer emits navigate/laser/annotation/timer | Socket | no state change/emission |
| Remote emits annotation/timer | Socket | denied |
| Valid speaker reconnect | Integration | notes/control restored |
| Bare/malformed privileged URL | Client | invalid-link UI, no socket join |
| Presenter token supplied only by query string | REST | rejected |
| Room-create response | REST | distinct tokens plus no-store/private headers |
| Valid fragment after parse | Client | hash scrubbed before socket join |

Add failing tests first. Update existing tests that currently encode tokenless
controller behavior only after the new assertions fail for the expected reason.

## Implementation Steps

1. Add role/capability characterization tests and note canaries.
2. Extend room creation and hashed state with independent capabilities.
3. Replace implicit controller/viewer fallback with strict role joins/predicates.
4. Split socket payload generation and target current role memberships.
5. Add `includeSpeakerNotes` and test all slide note representations.
6. Add strict fragment utility; update controller/modal/remote/speaker consumers.
7. Thread role capabilities through every EditorPage/modal composition layer.
8. Remove presenter query-token fallbacks and add capability-response cache headers.
9. Update valid-flow E2E helpers to consume server-issued capabilities.
10. Add denial/replay/notes/browser-history tests without sleeps.
11. Update live protocol and security documentation.

## Refactor

- Extract only small policy/helpers needed to keep authorization auditable.
- Do not redesign Socket.IO, room persistence, or all presenter runtime code.
- Delete the obsolete `controller` path after all consumers migrate.

## Tests After (GREEN)

- Existing presenter/viewer reconnect and black/white screen behavior still pass.
- Authorized remote navigation/laser pass.
- Authorized speaker navigation/annotation/notes pass.
- Viewer count excludes remote/speaker.
- Room teardown/reuse invalidates all old capabilities.
- No capability appears in serialized room/status/event payloads.
- Capability-bearing responses are non-cacheable and query-only credentials fail.
- Remote/speaker fragments are absent from the address bar/history after parsing.

## Regression Gate

```powershell
npx vitest run server/services/live-rooms.test.js server/services/socket-handler.test.js server/routes/live-rest-api-routes.test.js shared/tests/htmlGenerator.test.js client/src/components/LivePresentationModal.test.jsx
npx playwright test --workers=1 tests/e2e/live-remote-controller.spec.js tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js
npm run lint
npm run build
```

## Success Criteria

- [x] Public viewer credential cannot become a privileged role.
- [x] Viewer/remote payloads contain no speaker-note canary.
- [x] Valid speaker and remote journeys remain functional.
- [x] Unknown, missing, wrong-role, and replayed capabilities fail closed.
- [x] No raw privileged capability is persisted or broadcast.
- [x] Query-only presenter credentials fail and privileged fragments are scrubbed
  into memory before join.
- [x] Capability-bearing HTTP responses are non-cacheable.
- [x] Focused unit, browser, lint, and build gates pass.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Existing clients rely on bare privileged links | E2E/manual link opens without fragment | Intentional break; show invalid-link UX and require new link |
| Role split drops needed events | Valid remote/speaker E2E loses a control | Update explicit matrix only; do not restore broad controller |
| Notes leak through another representation | Canary appears in HTML/meta/srcdoc | Stop phase; trace all normalizers before release |
| Shared generator option changes exports | Non-live generator snapshots lose notes | Restore default behavior and keep opt-out call-site-specific |

## Security Considerations

- Treat remote/speaker fragments as bearer secrets in history, clipboard, and screenshots.
- Ending/recreating a room is capability revocation.
- External auth remains mandatory when the editor/API is network-exposed.

## Todo

- [x] Write RED role/capability and note-canary tests.
- [x] Implement independent capability issuance and hashing.
- [x] Implement explicit role authorization and payload targeting.
- [x] Migrate client URLs and joins.
- [x] Remove query-token fallbacks; add no-store and fragment-scrubbing contracts.
- [x] Run focused regression gate.
- [x] Update docs with legacy-link break and revocation behavior.
