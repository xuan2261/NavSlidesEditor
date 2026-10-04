## Summary

Current code uses **effective layout IDs for rendering, but raw owned element IDs for live bootstrap and transport lookup**. No effective-tuple descriptor collector, opaque transport mapping, standalone education mount, or native Try adapter was found in the inspected implementation.

Phase04 remains `pending` in `plans/261001-0639-interactive-html-education-deep-tdd/phase-04-standalone-runtime.md:1-7`. Historical line references in that plan have drifted during Phase03. Findings below describe current source, not implementation or acceptance.

**Evidence:** read/glob/grep only; no commands, edits, test execution, or browser verification.

## Architecture

```text
Saved parent / vertical child + layoutMasters
  → resolveEffectiveSlide
  → generated inert game snapshot

Authenticated live presenter
  → /present/game-bootstrap
  → raw-element-ID descriptors
  → GameEngine room + host capability
  → generated bootstrap-owned /games socket per room

Editor selected/first owned game
  → raw-element-ID shortcut / leaderboard lookup
  → presenter popup bridge

Reveal
  → navigation / ready / slidechanged
  → no education root lifecycle integration yet
```

## Files / caller and invariant maps

### 1. Effective layout, ordering, identity, and hidden behavior

| Path:line | Observed invariant / caller |
|---|---|
| `shared/src/slide-layout-normalization.js:1-14,25-54` | Masters support `game` fixed elements and placeholders. IDs allow nonempty strings up to 200 characters. Fixed/placeholder IDs must be unique within a master; master IDs must be unique. |
| `shared/src/slide-layouts.js:4-11` | Effective fixed ID is `layout-fixed:<layoutId>:<elementId>`. Layout lookup normalizes existing masters; IDs are not derived from the consuming slide. |
| `shared/src/slide-layouts.js:31-35` | Missing/malformed layout falls back to cloned owned elements with a warning. Overrides are not applied in that branch. |
| `shared/src/slide-layouts.js:36-40` | Fixed elements are excluded by either raw master ID or namespaced fixed ID. Raw-key patch takes precedence over namespaced-key patch. Patch cannot change `id`/`type`; effective fixed element is always namespaced and locked. Patch merge is shallow. |
| `shared/src/slide-layouts.js:41-47` | Bound placeholder retains the owned binding ID/content, but placeholder supplies type and geometry. Binding is skipped when placeholder ID or owned binding ID is hidden. Only successfully emitted bindings enter `boundIds`. |
| `shared/src/slide-layouts.js:48-51` | Remaining owned elements exclude emitted bindings and hidden owned IDs. Resolution orders fixed → placeholders → remaining as tie order, then sorts by finite `zIndex` or fallback order. |
| `shared/src/slide-layouts.js:56-59` | `resolveEffectiveSlide` preserves slide ID and merges master/slide tokens. It does **not** resolve child layouts recursively. |
| `shared/src/slide-layouts.js:84-91` | Detach is an explicit authoring operation: materializes effective elements and assigns new IDs to inherited fixed copies. Runtime identity must not perform this operation. |
| `shared/src/htmlGenerator.js:35-45,269-285,327-353` | Generator resolves each parent and direct child separately. Parent is vertical leaf `v=0`; children follow at `v=childIndex+1`. Outer stack is a structural section. No stable effective-slide ID attribute is emitted on these sections. |
| `shared/src/element-renderers.js:970-988` | Render removes truthy `el.hidden`, then performs another stable z-order sort using `(zIndex || 0)`. Collector must match the **rendered effective roots**, not raw storage or merely the first resolution sort. |
| `shared/src/education/normalize-game-config.js:17-31` | Configuration precedence: catalog flat fields → nested authored block → defaults for missing values; collections migrate and transients strip. |
| `shared/src/education/presentation-game-normalization.js:14-31,34-51` | Master game patches normalize against the target; comment explicitly documents nested-block replacement, not deep inheritance. Persistence traversal recursively handles children and master fixed elements. |
| `client/src/hooks/slide-operation-helpers.js:12-53` | Slide duplication creates new slide/owned-element IDs recursively, remaps placeholder bindings, but retains layout references/master IDs. Therefore inherited fixed copies still have the same effective element ID on different slides. |
| `client/src/components/editor/editor-canvas-workspace.jsx:12-17,25-28` | Canvas resolves the active owned slide against masters; master-edit uses fixed elements directly. |
| `client/src/hooks/editor-controller/use-editor-active-slide-controller.js:26-35`; `client/src/utils/active-slide-mapper.js:24-34` | Editor active parent/child selection returns the owned leaf, before layout resolution. |

**Hidden edge:** hiding only a placeholder ID skips its binding, but the bound owned element can reappear in `remaining`, because its owned ID is not hidden and never entered `boundIds` (`slide-layouts.js:41-48`). **[INFERENCE]** A collector that independently interprets “hidden placeholder” as “hidden owned game” would disagree with existing rendering. Reuse resolution; do not invent a second hidden rule.

**Identity consequence:** one master game inherited by two parents and a child has three distinct consuming slide IDs but the same namespaced element ID. Existing resolution already establishes the element side of the required tuple; saved master IDs need no rewrite.

### 2. Bootstrap, ownership, conflicts, reconnect, and cleanup

| Path:line | Observed invariant / integration seam |
|---|---|
| `server/services/presenter-game-bootstrap.js:9-33` | Current collector traverses raw parent/direct-child `elements`, filters implemented live types, trims `element.id`, and deck-globally deduplicates it. Ignores masters, patches, and `hidden`. Returns `{gameId,gameType,options}`, not effective descriptors. |
| `server/services/presenter-game-bootstrap.js:21-24,48-54` | Config validation precedes allocation; live HotPotato rejects non-single-choice authored questions explicitly. Preserve this admission behavior after descriptor cutover. |
| `server/services/presenter-game-bootstrap.js:36-57` | Owner requires presentation ID, live-room code, integer-convertible generation; no supported games returns success without owner validation. |
| `server/services/presenter-game-bootstrap.js:59-89` | Preflights every raw-ID room before creation. Conflicting type/owner rejects; same-presentation, different-live-owner, claimed/unoccupied room can be cleaned up and replaced. |
| `server/services/presenter-game-bootstrap.js:94-137` | Existing rooms update owner but not configuration. Pending capability or matching known capability authorizes response. Response is `{gameId,gameType,hostCapability}`. No tuple mapping is retained. |
| `server/routes/presentations-extras.js:39-79` | Trusted bootstrap boundary validates presenter token, connected presenter, and deck readiness; reads authoritative presentation and rechecks room/presenter/generation after the await. |
| `server/routes/presentations-helpers.js:34-43` | Staleness guard requires same room object, presenter ID, connected state, presentation ID, generation, and valid token. |
| `server/services/game-room-manager-singleton-service.js:15-21,23-51` | Rooms and pending capabilities are keyed by public `gameId`. Owner stores generation, but `roomOwnerMatches` compares **only presentation ID and live-room code**; `updateRoomOwner` replaces generation afterward. |
| `server/services/game-room-manager-singleton-service.js:54-79` | “Unoccupied” means no player has a socket ID. Replacement requires same presentation, different live owner, and no pending capability. |
| `server/services/game-room-manager-singleton-service.js:90-97,150-191` | Each room gets a randomized Socket.IO channel independent of public `gameId`; cleanup subscription already exists. |
| `server/services/game-room-manager-singleton-service.js:199-215,479-562` | Pending capability remains recoverable until host claim/cleanup. Host reconnect can recover its session using valid capability and known host identity; session token rotates. |
| `server/services/game-room-manager-singleton-service.js:689-707,736-812` | End: five-minute cleanup. Explicit leave removes player; disconnect retains player/score but clears its socket. Empty cleanup defaults to 30 seconds; unclaimed cleanup defaults to five minutes. Rejoin cancels empty cleanup, not unclaimed cleanup unless host claims. |
| `server/services/game-room-manager-singleton-service.js:791-812` | Cleanup deletes room and pending capability, then calls listeners with `(gameId,room)`. This is the existing mapping-release seam. |
| `server/services/game-socket-handler.js:25-80,165-216,552-590` | Cleanup invalidates memberships and emits `game-room-expired`; joins use randomized room channel. One socket cannot join a different game while already joined. Disconnect/leave schedules empty cleanup when no connected players remain. |
| `server/services/live-rooms.js:119-145` | Every presenter join increments `presentationGeneration`, including reconnect/repeated presenter intent. |
| `server/services/live-rooms.js:148-175,196-258` | Presenter disconnect keeps live room during five-second grace; timer timeout handles clear, timer deadline state stays. Reconnect cancels termination. Unused room TTL is 60 seconds. Live-room removal clears live state/socket mappings; it does not call GameEngine cleanup. |

**Generation contradiction requiring an explicit interpretation:** the locked contract requires mapping per owner/presentation-generation/tuple **and** reconnect reuse until room cleanup. Current live generation increments on reconnect; current GameEngine deliberately reuses the same room across that increment. Evidence: `live-rooms.js:135-136`, `game-room-manager-singleton-service.js:38-51`, and `presenter-game-bootstrap.test.js:301-313`. Using current generation literally as a fresh mapping key would break reconnect reuse.

### 3. Every inspected raw-ID transport producer / lookup requiring cutover

Keep existing event names and `gameId` payload field. The cutover is the **value supplied and its lookup**, not a new protocol.

| Caller | Current raw-ID coupling |
|---|---|
| `presenter-game-bootstrap.js:18-20,65-126` | Dedup, room preflight/create/update, capability lookup, error IDs, and response all use raw element ID. |
| `shared/src/live-presenter-game-runtime.js:22-23,41-82,106-115` | Host-state/sessionStorage/capability maps and pre-bootstrap queues keyed by returned `gameId`, currently raw element ID. |
| `shared/src/live-presenter-game-runtime.js:87-95,201-205` | `game-join` and mapped host commands emit `state.gameId`. |
| `shared/src/live-presenter-game-runtime.js:265-282` | Popup message resolves `gameHostStates[detail.elementId]`; pending queue also uses raw element ID. |
| `client/src/hooks/editor-controller/use-editor-live-session-controller.js:107-118` | Shortcut emits only `{action,elementId,gameType,...payload}`; no effective slide identity. |
| `client/src/pages/EditorPage.jsx:576-598`; `client/src/pages/editor-page-helpers.js:7-13` | Selected/first game comes from owned active leaf, not effective master view; hidden games are not excluded. That selection feeds shortcut and leaderboard consumers. |
| `client/src/hooks/use-editor-game-leaderboard.js:10-20` | Observer joins element `.id`; cannot select the right inherited copy or future opaque room. |
| `client/src/hooks/use-game-socket.js:26-51,56-95,141-185` | Session/capability storage, in-flight `/api/games` creation, and socket joins use caller’s ID. Hook creates its own `/games` socket. DOM runtime must not reuse this hook as a second socket owner. |
| `client/src/components/canvas/element-renderers/game-interactive/name-picker-interactive-game-renderer.jsx:404-420` | Host hook receives `element.id`; random command emits `element.id`. |
| `client/src/components/canvas/element-renderers/game-renderers/poll.jsx:17-21,52,59` | Hook and start/reveal emit element ID or shared fallback `'poll'`. |
| `…/game-renderers/word-cloud.jsx:20-24,61,68,75` | Hook and start/reveal/clear emit element ID or `'word-cloud'`. |
| `…/game-renderers/matching.jsx:17-21,63,70` | Hook and start/reveal emit element ID or `'matching'`. |
| `…/game-renderers/jeopardy-interactive-board.jsx:20-21` | Hook receives element ID or `'jeopardy'`; role is `'presenter'`, not `'host'`. Current catalog does not admit live Jeopardy. |
| `client/src/App.jsx:68`; `client/src/pages/game-player-join-page.jsx:416,447` | Player route has slide/element params, but `gameId = elementId`; slide identity does not participate in room selection. |
| `client/src/hooks/use-game-player.js:26-37,112-136,166-178` | Player session, join, answer, poll, cloud, and matching commands consume that raw-derived ID. |

Server transport handlers already operate on supplied room IDs rather than reading saved element IDs: `game-socket-handler.js:165-216,220-293,442-552`; REST `games-rest-api-handler.js:35-64,68-98,115-136,158-216`. Their callers must supply allocated transport IDs; no event-field rename is necessary.

**Deck timers are a separate address space:**

- `live-presenter-game-runtime.js:191-216` currently constructs timer payload as `{elementId: state.gameId}`. **This must not become `{elementId: transportGameId}` by accidental substitution.**
- Server timer addresses are `room.timers[elementId]`, emitted through the default namespace: `socket-handler.js:475-595`.
- Existing React timer consumers use authored `element.id`: Four Corners `:79-115`, Relay Race `:78-95,143-154`, Scattergories `:141-171` in `client/src/components/canvas/element-renderers/game-interactive/`.
- Timer ingress only accepts `[a-zA-Z0-9-]+`, maximum 64 characters (`socket-handler.js:13-14`). Namespaced master IDs contain colons; some saved IDs are longer or contain underscores. **[INFERENCE]** Existing effective master IDs cannot be passed directly through this timer validator. This is an existing addressing limitation, not justification to conflate timers with `/games` IDs.

### 4. Socket ownership and exact generated-document seams

- `shared/src/htmlGenerator.js:263,465-496`: game detection uses a hardcoded ten-type set on **raw** slides. It misses master-only games and newer catalog types; does not exclude hidden roots.
- `shared/src/element-renderers.js:891-910`: current non-print game output is an inert `data-game-fallback` public snapshot. No `data-ns-element-id`, playable root, JSON config association, or transport metadata.
- `shared/src/htmlGenerator.js:434-446`: Reveal initializes, then ready callback initializes plugins, existing live presenter bootstrap, and authored actions. This is the current document integration seam.
- `shared/src/live-presenter-runtime.js:22-35`: only `?live=` selects existing live bootstrap; presenter capability comes from `window.name`, not authored config.
- `shared/src/live-presenter-runtime.js:35-55,120-138`: default-namespace socket owns live navigation; listeners/polling are registered after Socket.IO loads.
- `shared/src/live-presenter-game-runtime.js:106-147`: bootstrap owns one existing `/games` socket per game, host capability/session, join and room-expiry recovery. DOM controls must subscribe/dispatch through this owner.
- `shared/src/live-presenter-game-runtime.js:294-354`: authenticated fetch returns host games; unload clears bootstrap timeout and disconnects game sockets. No narrow runtime subscription/command bridge currently exists.
- `client/src/utils/presenter-popup-bridge.js:45-129`: popup bridge binds origin, source, presentation, and room; queues at most 20 messages. “Active” means registered/open popup, not joined game.
- `live-presenter-game-runtime.js:285`: presenter-ready notice precedes actual bootstrap success. Preserve the distinction between popup readiness and authoritative game readiness.

### 5. Reveal input/lifecycle ownership

Installed version and vendor receipt both say **6.0.2**: `node_modules/reveal.js/package.json:3`; `server/vendor/vendor-manifest.json:3-4`. Loaded browser bytes/hashes were not exercised.

| Path:line | Exact behavior / seam |
|---|---|
| `node_modules/reveal.js/js/controllers/keyboard.js:54-64` | Reveal owns a bubbling document `keydown` listener. |
| `…/keyboard.js:145-161` | Function `keyboardCondition(event) === false` returns early. String `'focused'` separately checks `Reveal.isFocused()`. Replacing it with a function must preserve that string behavior explicitly. |
| `…/keyboard.js:170-186` | Built-in focus protection covers contenteditable, input, textarea, notes—not button/select. |
| `…/keyboard.js:210-265,339-356` | Configured bindings → registered bindings → default navigation. Space navigates next/previous. Merely `preventDefault` in another listener is not an early gate here. |
| `node_modules/reveal.js/js/reveal.js:199-245` | Ready flag sets before startup/hash navigation; ready event is dispatched asynchronously with current slide. |
| `…/reveal.js:1335-1336,768-780,2822` | `currentSlide` is vertical leaf when present; `slidechanged` supplies previous/current leaves; `isReady()` exposes readiness. |
| `…/reveal.js:704-716` | `on/off` are available for lifecycle attachment/removal. |
| `shared/src/htmlGenerator.js:197-222` | Authored-action runtime delegates click and Enter/Space by nearest `[data-ns-action]`; no child-control exclusion. Slide action map already uses stable parent/child IDs. |
| `shared/src/element-renderers.js:179-185,963` | Actual action surface is currently a **separate absolute transparent button appended after element markup**, not an enclosing action wrapper. **[INFERENCE]** Future interactive games can be covered by this sibling overlay; delegated descendant exclusion alone would not fix that geometry. |
| `client/src/hooks/use-keyboard.js:68-75,108-118,142-160,199-218` | Editor owns a separate document shortcut listener; honors `defaultPrevented`, interactive focus, repeats, catalog configuration, and popup-active gate. |
| `client/src/utils/interactive-keyboard-target.js:1-39,47-55` | Editor protection includes button/select/media/links/roles and ancestors. This behavior is broader than Reveal’s built-in focus protection. |
| `client/src/hooks/editor-controller/use-editor-keyboard-controller.js:84-111,123-136` | Editor maps configured game keys to popup shortcut actions; timer duration still reads flat `el.timerDuration`. |
| `client/src/hooks/use-reveal-preview-frame.js:46-64` | Audience/speaker/preview frame owner intentionally configures Reveal keyboard/touch/controls off after `isReady`, then applies live position. Education integration must preserve this surface-specific policy. |
| `server/routes/presentations-extras.js:107-115` | Endpoint preview also intentionally disables Reveal keyboard/controls. |

Initial root activation needs the existing `ready`/`isReady` distinction; subsequent activation must follow leaf `currentSlide`, not the outer vertical-stack section. No education pause/resume/destroy lifecycle currently owns these events.

### 6. Native Try, canvas, and presentation producers

- **Canvas:** `canvas/element-renderers/registry.js:13,28` → `canvas-element-wrapper.jsx:599,698` → `GameElementRenderer` **without `isPresenting`**. Existing React live branches (`game-element-renderer.jsx:35-67,142-143`) are not the normal generated Present path.
- **Properties:** `PropertiesPanel.jsx:53-56` → `properties/misc-properties.jsx:78-79` → `game-properties.jsx:11-60`. Current UI has Content/Display, validation, and question editor; no Try entry. No `client/src/components/education/` directory was found.
- **Saved Present/Preview:** `presentations-extras.js:98-118`.
- **Popup/template fallback:** `htmlGenerator.js:793-803`; client wrapper `client/src/utils/generateHTML.js`.
- **Share:** `server/index.js:306`.
- **Live initial fanout:** `socket-handler.js:130-141,161-190`.
- **Live late viewer/speaker:** `socket-handler.js:289-306`.
- **Download/export:** `client/src/hooks/use-export-actions.js:203-204`, `client/src/utils/export-project.js:114-115`, `server/routes/presentations-pptx.js:239`, `htmlGenerator.js:519-520`.
- Additional generated HTML consumers found: `server/routes/github.js:96`, `server/routes/sync.js:252,300`, `client/src/components/AnimationPreviewModal.jsx:101`, `client/src/components/transition-preview-helpers.js:105`, `server/services/pptx-import/oracle/capture-present.js:98`.

## Contract mismatches / handoff risks

1. **No shared effective collector/mapping yet.** Current bootstrap/detection/wrappers disagree about masters and hidden games.
2. **Reconnect generation tension.** Current join-generation increments conflict with literal per-generation allocation plus required reconnect reuse.
3. **Catalog differs from old live branches.** `game-registry.js:22-26` implements live only for HotPotato, poll, word-cloud, matching; name-picker is local-only in the locked catalog. The effective collector cannot be limited to live games merely because current bootstrap collector is.
4. **Public view seam is not installed.** No `educationView` selection exists. Current socket producers pass only note visibility. Single-recipient fallback broadcasts presenter-produced payloads at `socket-handler.js:182-190`; it requires its own server-derived audience treatment, not just the main recipient loop.
5. **Whole-game public schema prerequisite was not found in the inspected Phase03 snapshot.** `game-schema.js:39` exports private `validateGameConfig`; `game-config-projection.js:31-65` strips transients, not answer authority. Static game content and public-question projection exist; they are not a validated whole-game audience serializer. No claim that Phase03 has finished this prerequisite.
6. **Current action implementation differs from the accepted “wrapper” description.** Sibling overlay geometry needs attention at the existing renderer seam.
7. **Live-room and game-room cleanup are independent.** Mapping release should track actual GameEngine cleanup; live-room removal alone currently does not delete game rooms.

## Smallest behavioral regression scenarios

Existing tests below were read, **not run**.

| Scenario | Existing evidence / regression seam |
|---|---|
| One master poll inherited by two parents and one vertical child; raw-ID and namespaced hidden overrides; one `hidden:true` patch | `slide-layouts.test.js:13-27`; `education-persistence-boundaries.test.js:76-95`. Check rendered tuples/configs agree with descriptors, visible copies have distinct transport IDs, saved IDs unchanged. |
| Two owned games with the same element ID on different effective slides | Current collapse point `presenter-game-bootstrap.js:18-20`; current traversal test `presenter-game-bootstrap.test.js:24-37`. Check neither copy is silently dropped. |
| Claimed host reconnect inside grace, generation advances | `presenter-game-bootstrap.test.js:117-153,301-313`; `live-rooms.test.js:29-38`; `live-room-cleanup.test.js:113-128`. Check same mapping/capability-backed room, preserved state, no extra DOM-owned socket. |
| Clone/second live owner shares saved IDs; old room occupied or disconnected; eventual cleanup | Existing raw-ID conflict/replacement expectations: `presenter-game-bootstrap.test.js:177-278`; route tests `presentations-game-bootstrap.test.js:125-244`. Acceptance must check isolation rather than retain old raw-ID collision semantics. |
| Transport ID deliberately differs from element ID; popup start/reveal plus deck timer | `live-presenter-runtime.test.js:261-282` currently asserts both spaces using the same ID. Check `/games` gets transport ID, timer keeps its separate element address, selected effective copy receives command. |
| Initial parent/child hash, then leave/return; replay/destroy during pending callback | Reveal seams above; no standalone runtime lifecycle test file found. Check initial effective leaf, retained local progress, local timer pause, unchanged live deadline, stale callback suppression. |
| Button Enter/Space; select arrows; game with authored action; Tab out then deck navigation | `action-runtime.test.js:7-12` is generated-source assertion, not actual control behavior. Existing game E2E `keyboard-shortcuts.spec.js:30` checks stubs, not Reveal/native ownership. Check one activation, unchanged slide/fragment inside widget, outside navigation retained, prior function/`'focused'` condition preserved. |
| Local name-picker / audience disconnect / unsupported live subtype | Catalog regression `presenter-game-bootstrap.test.js:56-60`; admission behavior `live-game-bootstrap-admission.test.js:7`; inert canvas checks `canvas-game-element-renderer-phase-03.contract.test.jsx:16-33`. Check real local play has no socket, audience remains waiting/read-only, unsupported types allocate no live room. |
| Cleanup and server deadlines during presenter disconnect | `game-engine-singleton-room-management-join-leave-answer-scoring-random-picker-leaderboard-cleanup.test.js:46-76`; `live-room-cleanup.test.js:130-179`. Check mapping releases on actual room cleanup; live deadline continues and expiry is hydrated on reconnect. |
