**GO for A/B’s design contracts only—not implementation or acceptance.** Counsel uses `local52186/gpt-6.1-sol` in separate context; no model-family independence. The prior aborted attempt remains failed, without a verdict.

### Evidence

**Direct source:**
- `server/services/live-rooms.js:119–139` increments generation on presenter join. `server/services/game-room-manager-singleton-service.js:23–52` matches ownership by deck/room code and refreshes generation; `:791–812` notifies listeners after actual removal.
- `server/routes/presentations-extras.js:39–92` authenticates bootstrap, captures presenter/deck/generation, and invokes a freshness check after reading. GET at `:99–122` generates HTML without an authenticated role selection.
- `server/services/socket-handler.js:130–139` differentiates HTML only by speaker-note inclusion. `:180–192` replays presenter payloads room-wide.

**Supplied, not exercised:** reconnect-room preservation test; effective layout identity rules; existing question projection; `window.name` token handoff. No commands, checks, implementation, or runtime proof.

### A — Separate allocation lineage from admission freshness

**Recommendation [INFERENCE]:** keep existing live `presentationGeneration` as the admission/freshness epoch. Introduce a separate server-owned `allocationGeneration`: the retained presentation-content lineage used for allocation. Every admitted freshness generation publishes its tuple mapping into that lineage.

The server bootstrap registry owns:
- Scope bound to the **live-room instance and deck**, not reusable room code alone.
- Canonical effective descriptor/config snapshot.
- `(scope, allocationGeneration, effectiveSlideId, elementId) → transportGameId → actual game-room reference`.

Allocate opaque IDs of at most 128 characters. Unchanged reconnects inherit the lineage and existing rooms, scores, and capabilities. Manager ownership refresh records latest admitted freshness; it must not redefine allocation identity. Reuse never bypasses current presenter/epoch admission checks.

Fork lineage only when authoritative effective game tuples/configurations actually change—not reconnects, timestamps, notes, or styling. Explicitly report the new session; retain old rooms/scores untouched until cleanup.

Only the game manager’s actual-cleanup callback retires the matching room’s allocation record. Live-room cleanup revokes admission but does not prematurely erase surviving game allocations. Saved element/slide IDs remain unchanged.

### B — Authenticate private-config hydration through bootstrap

**Recommendation [INFERENCE]: choose bootstrap JSON hydration**, not private presenter-socket HTML replacement. It uses the existing validated POST and preserves generated tuple roots.

Unauthenticated live GET always selects `educationView: audience`; role queries cannot grant host mode. Ordinary non-live GET remains `local`.

Successful bootstrap returns the mapping, generation/lineage binding, and private host configurations for the same authoritative descriptor snapshot. Only this trusted response selects host hydration. Keep capabilities separate, in runtime memory—not URLs, serialized game configs, or DOM attributes.

Mount atomically into matching tuple roots only while document/deck, admission generation, and descriptor snapshot remain current. Invalid authority returns the existing denial/not-ready response; stale or mismatched arrivals are discarded without host controls, room mutation, or local/raw-ID fallback.

All live socket HTML—including the presenter’s initial shell—uses validated, explicit public subtype projections. Audience runtime is observer-only: no private normalization or local grading. Speaker-note permission remains independent. Remove presenter-payload replay; any retained fallback must regenerate audience-safe content. No additional socket or iframe/CSP relaxation.

**Cutover order:** shared effective resolver/public schemas → retained allocator/cleanup → bootstrap hydration → every host lookup, command, socket recipient, and fallback. Release coherently; no raw-ID route. Timer addressing remains separate.

### Observable regression scenarios — proposed, not run

1. Identical inherited master elements on different consuming slides receive distinct transports; hidden/vertical rules agree.
2. Reconnect increments freshness but preserves transport IDs, rooms, and scores; stale bootstrap loses admission.
3. Actual game-content changes explicitly fork lineage; cosmetic edits do not; old scores remain intact.
4. Live cleanup preserves surviving allocations; actual game cleanup permits a new ID without stale-callback deletion.
5. Forged host queries, viewer/speaker delivery, and fallback payloads disclose no forbidden private fields.
6. Valid bootstrap hydrates host roots; denied or mismatched bootstrap leaves observer-only roots.
7. Presenter/deck replacement or disconnect during read/delivery prevents stale allocation publication or mounting.
8. Host commands use mapped opaque IDs only; timers retain element addressing; ordinary local surfaces remain intentionally private-config-inclusive.
