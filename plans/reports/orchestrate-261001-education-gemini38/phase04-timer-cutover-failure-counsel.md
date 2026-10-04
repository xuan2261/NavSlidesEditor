## TL;DR

**The three observed failures are stale delivery expectations, not evidence that presentation payloads stopped reaching clients. The checkpoint nevertheless exposes a production stale-delivery defect: fanout emits `sync-state` even when its payload fence rejects delivery.** GO for a focused delivery repair and behavioral-test migration; **NO-GO for test-only GREEN or Phase04 acceptance.**

Same-model, separate-context counsel on `local52186/gpt-6.1-sol`; no model-family independence claimed. Read-only inspection only. The supplied log—not my execution—reports 52 passing tests and three failures.

## Reframed problem

Preserve authenticated, role-specific delivery while retaining room-object, presenter, and presentation-generation fences. Do not restore room-wide private broadcasts merely to satisfy assertions written for the previous delivery mechanism.

### Why the three assertions fail

- `FakeSocket.emit` records direct deliveries in `socket.emitted`; `FakeIO.to(...).emit` records targeted/broadcast deliveries in `io.emitted` (`server/services/socket-handler.test.js:21-23,52-57`).
- Production now enumerates recipients and calls `emitPresentationPayload` on each connected socket (`server/services/socket-handler.js:111-133`). That helper emits `presentation-data` and `presentation-meta` directly (`:80-92`).
- The failing assertions still inspect `io.emitted`: presenter payload presence at test line 121, replacement metadata count at line 372, and A→B→A metadata count at line 484.

**Classification:** all three reported failures are obsolete observation points. Their intended consumer behaviors remain valid and must be tested; mechanically changing the recorder or re-pinning counts is insufficient.

### Production defect exposed by inspection

`emitRoomPresentation` awaits a fenced payload delivery, ignores its Boolean result, then unconditionally emits `sync-state` (`socket-handler.js:122-131`). `emitPresentationPayload` returns `false` when the asynchronous lookup finishes after its fence becomes invalid (`:80-83`).

**[INFERENCE—source-derived, not runtime-observed]** An obsolete fanout can therefore send navigation state after replacement or room removal/recreation, despite correctly suppressing obsolete HTML and metadata.

The asynchronous payload predicates also validate room lineage, but not the recipient’s current membership/role (`:123-129,235-241`). A captured socket reference can outlive its admission. The final join guard runs too late to protect emissions already made (`:251-263`). Membership and role are available through `live-rooms.js:263-267`.

## What to do

1. **Deliver presenter fanout from the presentation already loaded and accepted.** The presenter branch resolves `pres` and validates room identity, presenter ID, and generation before committing `presentationId` (`socket-handler.js:178-198`). Pass that accepted presentation into fanout instead of performing another asynchronous lookup per recipient. Reuse the existing role serializer; no parallel serialization convention.

2. **Fence the complete delivery, including `sync-state`.** Before emitting to each recipient, require:
   - the same room object, generation, presentation ID, and presenter ID;
   - the same connected socket;
   - current room membership and an authorized current role.

   Emit HTML/meta/sync without an intervening asynchronous lookup. For late-joining recipients, retain the asynchronous lookup but validate both lineage and recipient admission afterward. A rejected delivery must emit no subsequent state from that obsolete operation.

3. **Replace implementation expectations with consumer-visible assertions.**
   - Presenter and admitted speaker receive the intended speaker notes.
   - Viewer HTML and metadata exclude notes; remote/controller receive metadata without notes and no HTML.
   - Replacement delivers deck B to current recipients; deferred deck A delivers neither stale content nor stale navigation.
   - A→B→A preserves distinct generations: the first A completion cannot act as the final A.
   - Removed/recreated rooms and revoked/disconnected recipients receive no deferred obsolete delivery.

   Use actual received deck IDs, generations, parsed configurations, and navigation states—not merely event existence or metadata counts. Strengthen the existing stale-viewer test, whose current checks establish only one truthy payload (`socket-handler.test.js:404-407`).

## Invariants to retain

- **Public education serialization:** all socket HTML continues using server-selected `educationView: 'audience'`; speaker-note authorization remains separate (`socket-handler.js:85-91`). Do not serialize private game configuration just because the recipient is presenter or speaker.
- **Role boundaries:** only presenter/speaker receive notes; remote receives no HTML (`:85-92`).
- **Generation fencing:** presenter joins increment generation (`live-rooms.js:133-138`). Preserve room-object identity and presenter ownership checks, including A→B→A.
- **Pending replacement isolation:** keep clearing `presentationId` before replacement loading; a failed load must not expose the previous deck (`socket-handler.js:166-168`; test `:410-440`).
- **Timer cutover:** leave tuple identity, `canControlTimer`, duration/delta bounds, reconnect rearming, and immutable timeout ownership intact (`live-timer-handlers.js:14-29,37-81`; `socket-handler.js:205-228`). These failures do not justify timer changes.

## What to avoid / alternatives

- Do not restore room-wide `presentation-data` or notes broadcasts.
- Do not merge direct deliveries into `FakeIO.emitted` to make obsolete assertions pass.
- Do not weaken generation fences or add raw-element-ID timer fallbacks.
- Keeping asynchronous per-recipient lookups is possible, but requires guarding their results, membership, role, and subsequent sync individually. **Using the accepted presentation is simpler and avoids repeated reads during one fanout.**

## Necessary verification

The caller should:

1. Exercise deterministic deferred-load regressions for replacement, A→B→A, room recreation, and recipient revocation, asserting both content and navigation.
2. Exercise the role/privacy matrix with a private-answer sentinel and parent/vertical speaker notes; parse delivered game configuration and verify public-schema validity.
3. After repair—not merely to reconfirm the supplied failures—run the exact six-file focused command.
4. Smoke the real Socket.IO/generated-document path: presenter plus viewer and authorized speaker/remote, deck replacement, navigation, reconnect, and inherited timer isolation.

**Success:** current recipients receive the correct deck and navigation; obsolete operations deliver nothing; private education data remains absent from socket HTML; authorized notes and timer behavior survive.

## Assumptions

**High confidence:** role-specific direct delivery is the accepted contract, supported by the implementation and Phase04’s public-serialization requirement. **No runtime proof claimed** for the newly identified stale-sync and recipient-admission paths; those require the verification above.