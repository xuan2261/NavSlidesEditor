## TL;DR — NO-GO for a test-only GREEN repair

The 18 failures predominantly reflect obsolete contracts, but source inspection also exposes unfinished consumers and authority recovery. **GO for the opaque effective-tuple cutover; NO-GO for declaring Phase04 complete by changing expectations alone.** Advisory only: no edits, tests, builds, or agents executed; runtime consequences below are explicitly identified as source deductions.

## Reframed problem

Preserve consumer behavior and security while replacing saved-element room identity with authenticated `(effectiveSlideId, elementId) → transportGameId` bindings. A different deck or live-room instance should receive an independent room—not conflict merely because an authored ID matches.

### Obsolete assumptions

- `server/services/presenter-game-bootstrap.test.js:6-19` imports removed `collectGameDescriptors` and supplies no `allocationScope`. The canonical traversal is `shared/src/education/effective-game-descriptors.js:6`; bootstrap requires scope at `server/services/presenter-game-bootstrap.js:19`.
- Service and route tests join/read rooms by saved element ID. Bootstrap now returns `effectiveSlideId`, `elementId`, `transportGameId`, private config, and capability (`presenter-game-bootstrap.js:42-43`).
- Clone-conflict, cross-presentation-conflict, and disconnected-room-reclamation expectations encode the obsolete shared namespace. `prepareAllocations` scopes mappings by live-room object and presentation (`server/services/presenter-game-allocations.js:19-24`). Replace those expectations with successful independent allocation **and unchanged original room state/authority**.
- The two failing VM tests execute only `buildGameBootstrapRuntime`, which now delegates to `window.__navslidesEducationTransport` (`shared/src/live-presenter-game-runtime.js:12-18`). They do not load the implementation owning listeners or sockets.

## What to do

### 1. Repair the actual shortcut caller

**Verified contract mismatch:** `emitGameShortcutAction` constructs no `effectiveSlideId` (`client/src/hooks/editor-controller/use-editor-live-session-controller.js:108-118`), while `createLiveHostTransport.message` rejects commands without it (`shared/src/education/browser/live-host-transport.js:35-42`). The popup bridge adds room/presentation context, not slide identity (`client/src/utils/presenter-popup-bridge.js:77-81`).

**[INFERENCE] All current editor-originated popup game shortcuts are discarded.**

Pass the canonical active-slide identity through `EditorPage.jsx:576-597` into the controller. Resolve inherited active games consistently: `getGameElementForActiveSlide` currently searches only the supplied slide’s `elements` (`client/src/pages/editor-page-helpers.js:7-13`). Use the existing effective-slide resolver and identity helper; never infer a tuple from element ID alone.

### 2. Preserve private capability recovery

**Strongest uncovered regression risk:** refreshed presenters lose authority for surviving claimed rooms.

- Capabilities exist only in the transport’s in-memory object (`live-host-transport.js:10,63,75`).
- Persisted host state contains only player identity/session token (`live-host-session.js:2-10`).
- Successful host admission removes the pending capability (`server/services/game-room-manager-singleton-service.js:552-553`).
- Reused claimed allocations require the matching capability (`presenter-game-bootstrap.js:24-31`).

**[INFERENCE] Reloading the popup while the live-room/allocation survives produces `host-capability-required`; the persisted player session cannot repair bootstrap admission.**

Restore private, session-scoped capability persistence keyed by the canonical transport identity and live context. Keep null-prototype/own-key handling. Do not expose capabilities through DOM, bindings messages, or public HTML; do not weaken server admission or allocate replacement rooms merely to bypass it.

### 3. Fix queue semantics before migrating its regression test

`drain` stops at any undispatchable queue head (`live-host-transport.js:28-33`). Unsupported actions are queued, and pre-binding `gameType` checks are not repeated during draining (`:40-46`; `live-host-commands.js:7-18`).

**[INFERENCE] An unsupported early shortcut can block valid queued commands; a pre-binding type mismatch can later dispatch against the wrong subtype.**

Distinguish invalid commands from valid-but-not-ready commands. Drop invalid entries and continue draining; retain valid entries until host admission. Recheck subtype against the admitted binding. Explicitly test revocation/remapping so queued commands cannot unintentionally cross allocation lineages.

### 4. Complete timer identity cutover

Host timer commands include `effectiveSlideId` (`live-host-commands.js:12-15`), but server handlers ignore it and index timers by `elementId` (`server/services/socket-handler.js:462-485,498,542`). `useLiveTimerSync` also keys by raw ID (`client/src/hooks/use-live-timer-sync.js:25-35`).

**[INFERENCE] Inherited copies still share timer state despite independent game rooms.**

Carry one canonical tuple identity through start/pause/resume/adjust/stop, timeout completion, synchronization, and timer consumers. Preserve presenter authorization and numeric bounds.

## What to avoid

- No `collectGameDescriptors` compatibility export, `gameId` alias, raw-ID fallback, or capability bypass.
- Do not mechanically replace raw IDs in conflict/reclamation tests: their expected behavior is obsolete.
- Do not keep atomicity assertions that merely check `getRoom(savedElementId)` is absent. Under opaque allocation, that assertion can pass even after unintended creation.
- Do not change authored config between capability-reuse calls: descriptor fingerprint changes intentionally fork the lineage.
- Delete generated-source substring checks in `shared/tests/live-presenter-runtime.test.js`; replace them with observable public-projection/privacy behavior.

## Alternatives & trade-offs

**Recommended:** finish consumers and private recovery, then migrate behavior tests. This retains accepted isolation semantics and avoids reintroducing obsolete namespaces.

**Test-only migration:** smaller diff, but knowingly leaves shortcut rejection, reload authority loss, and timer collisions. Reject.

**Restore raw-ID behavior:** undermines inherited-instance isolation. Reject.

## Work checklist

1. Update the three original suites; remove their obsolete representation assertions.
2. Use a fresh allocation scope per service fixture; reuse it only for intentional reconnect scenarios.
3. Preserve authoritative settings, claimed-capability rejection, legacy-player preclaim rejection, and capability non-disclosure assertions using returned transport IDs.
4. Replace the old preflight conflict scenario with valid-earlier/invalid-later configuration and unchanged room/allocation state. Exercise creation-failure rollback separately.
5. Extend `shared/tests/education-live-hydration.test.js` through `actualEducationDocument`: hostile authored IDs, queued shortcuts, origin/source/context rejection, legacy identity rotation, refreshed authority recovery, and inherited timer isolation.
6. Include `server/services/presenter-game-allocations.test.js` in the caller’s verification command; the supplied broadened GREEN command omits it.
7. After repairs, run the affected suites and exercise the real editor→popup→server path.

## Success metrics

Independent inherited rooms and timers; unchanged old-owner state; claimed reconnect requires matching capability; popup refresh recovers existing authority; queued valid shortcuts execute once after admission; invalid shortcuts neither dispatch nor block; public output contains no private authority or answers.

## Assumptions

- **High confidence:** independent allocation replaces raw-ID conflict/reclamation semantics, supported by `presenter-game-allocations.test.js:30-57`.
- **Medium confidence:** popup refresh must preserve an admitted live session. If explicitly excluded, capability persistence changes scope—but shortcut rejection and timer collisions still block completion.