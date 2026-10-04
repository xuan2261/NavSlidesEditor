# Phase04 public-HTML scout report

## Summary

**The locked privacy boundary is not implemented in the inspected source.** `generateRevealHTML` has no `educationView` handling; socket HTML generation distinguishes speaker notes, not public/private game configuration.

Two immediate cutover hazards:

1. **Matching already renders the solution association:** `staticGameContent` formats authored pairs as `prompt → target`, and the same renderer feeds live viewer HTML.
2. **The presenter-only fallback replays presenter payloads room-wide:** adding private host configuration without changing that fallback would create a private-payload broadcast path.

Normal local Present, Share, downloads, backups, GitHub output and sync output must remain intentionally inspectable. They are not audience-redaction surfaces.

**Evidence:** source reads and cross-workspace searches only. No commands, edits, tests, browser execution, delegation, commit, push or deploy. Phase04 remains pending; no implementation or acceptance claim.

## Architecture and contract authority

- Locked view selection and same-checkpoint caller cutover: `plans/261001-0639-interactive-html-education-deep-tdd/phase-04-standalone-runtime.md:43-45,75-78`.
- Current/future/hidden-slide public projection; private host configuration requires server-validated host authority; audience roots are observers: `plans/261001-0639-interactive-html-education-deep-tdd/reports/execution-contracts.md:48-50`.
- Local Present/Share/file intentionally inspectable: execution contracts, line 50.
- Static PDF/PPTX snapshots omit matching/question keys unless an explicit teacher-reveal view exists: execution contracts, line 27.

Current flow:

`deck → effective parent/child layout resolution → renderSlideElements → renderGame → generated Reveal document`

Socket delivery reuses that document generator. Browser-side live activation subsequently reads the live query and obtains credentials from `window.name`; this does **not** authorize the earlier HTTP response.

## 1. Complete direct producer/caller table

All paths are worktree-relative. “Required cutover” describes Phase04 work, not changes made by this scout.

| Caller / actual reference | Current arguments and view ownership | Trust source | Required cutover / plausible consumer-visible regression |
|---|---|---|---|
| `shared/src/htmlGenerator.js:226-227` — generator entry | `generateRevealHTML(presentation, options={})`; notes enabled unless explicitly false. No education view. | Calling code; presentation data is not authority. | Validate `local/host/audience`; keep local default, but every live caller must select explicitly. Invalid supplied views must not become local/private. |
| `shared/src/htmlGenerator.js:268-285,327-348` — parent and vertical-child element production | Both pass only `forPrint:false` and chart background. Layouts resolve before rendering. | Generator’s selected view. | Pass the same view, effective identity and public/private serialization policy through **both** branches. Child/master-only keys must not bypass projection. |
| `shared/src/element-renderers.js:893-911,944-958,964-979` — game renderer/dispatch | `renderGame` merges the element and active nested subtype; it does not consume renderer options. Produces inert static content, not serialized playable configuration. | No privacy authorization here. | Consume view-specific configuration at this boundary; never serialize the full element, inactive subtype blocks or arbitrary extension data. Public fallback text must also obey the view. |
| `server/routes/presentations-extras.js:99-106` — saved Present and endpoint Preview | `generateRevealHTML(normalizePresentationNotes(presentation))`; no options. Preview changes navigation afterward at `107-115`. | Authoritative deck/template lookup, **not host authorization**. | Ordinary Present/Preview stays local. A live request must not gain host config from `live`/`role` query alone. Missing HTTP host-authority binding is discussed below. |
| `server/index.js:289-306` — `renderShareView` | `generateRevealHTML(sanitized)`; sanitization concerns custom CSS, not game secrets. | Authoritative deck read plus share admission. | Explicit local view. Do not redact normal Share or treat share/password admission as live host authority. |
| `server/index.js:358-396,403-431` — Share GET and password POST | Both call `renderShareView`; no view/role forwarded. | Token, expiry and applicable password check. | Preserve local/inspectable sharing. Appending role/live queries must not authorize host output. |
| `server/services/socket-handler.js:130-141` — `emitPresentationPayload` | `generateRevealHTML(normalized,{includeSpeakerNotes:includeNotes})`; presenter/speaker receive notes; remote gets no HTML. No game view. | Successful room admission and freshness predicate supplied by caller. | Presenter private view only under current validated presenter authority; viewer audience; speaker must not inherit answer access merely because it receives notes. Remote remains metadata-only. |
| `server/routes/presentations-pptx.js:234-243` — HTML download endpoint | `generateRevealHTML(normalizePresentationNotes(resolved.presentation))`. | Authoritative deck read; ordinary file export. | Explicit local. Redacting this path would break offline grading/play, not improve live privacy. |
| `server/routes/github.js:71-74,96-97` — GitHub HTML producer | `generateRevealHTML(presentation)`; adjacent editable JSON also exported. | Authoritative deck and configured publishing operation. | Explicit local. HTML-only redaction cannot make the adjacent JSON secret; preserve the authorized inspectable export contract. |
| `server/routes/sync.js:232-254` — bulk sync | `generateRevealHTML(presentation)` after authoritative read, normalization and external DTO conversion. | Server-owned healthy-deck selection. | Explicit local; keep authored grading data in backup output. DTO conversion is not public-game projection. |
| `server/routes/sync.js:270-302` — single sync | Same one-argument call; package quarantine is fail-closed. | Authoritative selected deck. | Same local cutover; do not miss this second sync producer. |
| `server/services/pptx-import/oracle/capture-present.js:96-103,209-239` — visual oracle | `generatePresentHtml` calls `generateRevealHTML(presentation)`; file writing and browser capture reuse it. | Internal supplied presentation, no live recipient authority. | Explicit local. Preserve capture behavior; it must not accidentally become audience/live scoring. |
| `shared/src/htmlGenerator.js:519-520` — browser HTML download | `generateRevealHTML(presentation)`. | Local author/export action. | Explicit local at generation. Normal download remains inspectable. |
| `shared/src/htmlGenerator.js:792-802` — Present popup / no-ID blob fallback | Saved IDs open the server endpoint; no-ID decks generate HTML with no options. | Local UI action; endpoint owns saved-document view. | Blob fallback explicitly local; saved live host authorization remains server-owned, not a popup option. |
| `client/src/utils/generateHTML.js:4,16-25` — client facade | Generator re-exported directly; download/Present forward to shared functions. | No independent authority. | Preserve generator options rather than introducing a second view-selection policy. Local helper behavior stays local. |
| `client/src/hooks/use-export-actions.js:192-215` — HTML and portable downloads | HTML calls `downloadHTML(presentation)`; portable calls generator then `generateOfflineHTML(html,{strictRequiredAssets:true})`. | Local editor/export action. | Explicit local before inlining. Portable output must not attempt live reconnect or mount an audience evaluator. |
| `client/src/utils/export-project.js:69-87,113-118` — backup HTML | Generates from `exportPresentation`, then offline-inlines it. No-media branch exports JSON only. | Local backup action; `projectExportValue` removes package/editor authority, not grading data. | Explicit local. Do not confuse archive projection with audience projection. Existing catch can omit HTML on generation failure; preserve awareness of that consumer-visible behavior. |
| `client/src/components/AnimationPreviewModal.jsx:20-23,101-103` | One preview deck; generator receives no options; iframe hook consumes output. | Local author preview. | Explicit local. Preview must retain authored config without acquiring live host authority. |
| `client/src/components/transition-preview-helpers.js:76-105` | Two-slide preview preserves presentation fields/layout masters; generator receives no options. | Local author preview. | Explicit local. Inherited games on either preview slide must follow the same serializer. |
| `client/src/utils/offlineExport.js:260-262,570-581` — HTML transformer | Accepts **HTML**, not a presentation/view; strictness concerns assets. Removes `<base>`, not live bootstrap logic. | Upstream document producer. | View must be selected before this call. Inlining cannot repair leaked configuration. Preserve local-only portable runtime behavior. |
| `shared/src/index.js:106,138-145` — workspace exports | Exposes generator, private normalizers/schema and question public projection. | Shared package API. | Export the single public-game contract here; no client/server copies of the question allowlist. |
| `server/routes/share.js:6-7` | Generator import is explicitly unused. | None; not an HTML producer. | No runtime cutover at this import. Do not mistake token-management routes for Share rendering. |

### Rendering traversal implications

- Layout inheritance, patches and `hiddenElementIds` resolve in `shared/src/slide-layouts.js:31-58`.
- Editor-hidden elements are omitted by `renderSlideElements` at `shared/src/element-renderers.js:964-967`.
- All parent/vertical sections are generated eagerly, not only the currently visible slide: `shared/src/htmlGenerator.js:268-351`.
- Current game detection scans raw parent/child elements using a ten-type set: `shared/src/htmlGenerator.js:465-495`.
- Bootstrap also scans raw parent/child elements, deduplicates deck-global authored IDs, and does not exclude hidden elements: `server/services/presenter-game-bootstrap.js:9-32`.

**Required invariant:** use the locked effective-descriptor traversal for detection, wrappers and bootstrap. Public projection applies before any serialized descriptor/config is emitted, including future slides and initially invisible roots. Editor-hidden roots remain absent; their private source config must not appear in a deck-wide bootstrap blob.

## 2. Socket HTML fanout and authority

| Path / actual reference | Current behavior and authority | Required cutover / regression |
|---|---|---|
| `server/services/socket-handler.js:195-221` — join admission | Requested role enters `liveRooms.joinRoom`; only successful admission joins the Socket.IO room. | Derive privileges from admitted server membership, not a raw role string. |
| `server/services/live-rooms.js:92-97,121-146` | Distinct role capabilities; viewer needs no capability. Presenter admission updates presenter ID/generation. Legacy controller alias is restricted to legacy rooms. | Presenter authority is available here. Speaker/remote capabilities are separate privileges, not implicit answer-key grants. |
| `server/services/socket-handler.js:235-257` — presenter load/reconnect | Loads deck, checks room object, current presenter and generation, then calls `emitRoomPresentation`. | Preserve these freshness checks while selecting host/public output. A replaced presenter must not receive or fan out a stale deck. |
| `server/services/socket-handler.js:161-181` — per-recipient fanout | Builds recipients from server room arrays; invokes payload helper separately for presenter/speaker/remote/viewer. | Select view per authorized recipient. Do not generate one private document and reuse it for every role. |
| `server/services/socket-handler.js:182-191` — presenter-only fallback | Replays newly recorded presenter `presentation-data` **and** `presentation-meta` through `io.to(roomId)`. | Never replay private host HTML or notes room-wide. Any retained fallback must independently generate audience-safe HTML/meta. |
| `server/services/socket-handler.js:288-308` — viewer/speaker/remote/controller join/rejoin | Captures presentation ID/generation/presenter; invokes payload helper with mapped role and freshness checks. | Viewer/reconnecting viewer must always receive audience output. Keep controller→remote mapping and no-HTML behavior. |
| `server/services/socket-handler.js:89-118,135-141` — metadata | Explicit metadata structure; notes depend on role, not game config. | Preserve separate notes permission. Fallback metadata must not copy host notes into audience output. |

**Fallback uncertainty:** the replay branch reads `presenter.emitted`. The inspected `FakeSocket` creates that array at `server/services/socket-handler.test.js:6-21`; this code does not create it for production sockets. **[INFERENCE]** the branch is test-harness-oriented and may emit nothing on normal Socket.IO sockets. Its production reachability was not executed. It nevertheless remains an explicit unsafe host-payload reuse path for the locked cutover.

## 3. Additional indirect consumers

| Consumer / reference | View ownership and required treatment |
|---|---|
| `client/src/pages/EditorPage.jsx:431-443`; `client/src/components/editor/editor-page-chrome.jsx:57` | Ordinary/current-slide Present delegates to shared popup helper. Local; server endpoint selects saved-document view. |
| `client/src/components/SlideThumbnail.jsx:28`; `client/src/pages/ExplorePage.jsx:110` | Hosted Preview/Present URLs. Local; neither URL supplies host authority. |
| `client/src/components/LivePresentationModal.jsx:93-103` | Presenter token travels in `window.name`; URL contains only `live=roomCode`. Browser launch context is not available to the GET handler. |
| `shared/src/live-presenter-runtime.js:22-40`; `shared/src/live-presenter-game-runtime.js:303-311` | Query enables browser connection; token is used later in socket join and authenticated bootstrap POST. Must not determine what private config was already serialized. |
| `client/src/pages/LiveViewPage.jsx:54,160-166,234-237`; `client/src/hooks/use-reveal-preview-frame.js:77-78` | Viewer receives socket HTML and assigns it to `srcdoc`. Redaction must happen server-side; hiding controls or iframe content is insufficient. |
| `client/src/pages/SpeakerViewPage.jsx:29-43,210-211,363-382` | Same HTML reused for current and next-slide previews. Keep notes permission independent of host answer access. |
| `client/src/components/TransitionPreview.jsx:51-64` | Uses transition generator, then offline transformer. Local view must survive both steps. |
| `scripts/agent/file-export-tools.mjs:26-27`; `scripts/agent/file-preview.mjs:32` | Agent HTML export/PNG preview use existing export/Present endpoints. Endpoint cutover covers these callers; no separate public projection. |
| `scripts/agent/read-tools.mjs:13`; `scripts/agent/lifecycle-tools.mjs:17-18` | Returns Present/Share URLs, not generated HTML. Preserve normal local/Share semantics. |
| `server/services/pptx-import/oracle/package-backed-actuals.js:116-118` | Calls oracle capture with authoritative imported presentation. Covered by oracle’s explicit local generation. |

### HTTP host-authority gap

Observed:

- Present GET checks the deck’s availability, not presenter credentials: `server/routes/presentations-extras.js:99-106`.
- Existing bootstrap POST validates presenter token, active presenter, deck binding and generation, including a post-read recheck: `server/routes/presentations-extras.js:38-79`; `server/routes/presentations-helpers.js:34-44`.

**Decision required within the locked design:** bind any private live document to that existing validated authority. `?role=host`, `?live=...`, `preview=true`, share admission or a claimed browser mode cannot supply it. Until authority exists, a live document cannot be serialized as private host output. This report does not invent a new authentication mechanism.

## 4. Smallest explicit public-config contract

### Existing reusable pieces

| Existing source | What it establishes |
|---|---|
| `shared/src/education/question-public-projection.js:11-39` | `projectPublicQuestion` constructs public fields/nested media/options and validates the result; `validatePublicQuestion` validates without an answer key. |
| `shared/src/education/question-shape.js:7,13-22,24-80` | One question allowlist, strict unexpected-field rejection, nested safe-media/item validation and structured error paths. |
| `shared/src/education/game-schema.js:8-36` | Private subtype validation dispatch. It invokes **private** canonical-question validation. |
| `shared/src/education/game-validation-utils.js:4-54` | Existing bounded lists, identity checks, text/numeric validation and actionable errors. |
| `shared/src/education/normalize-game-config.js:17-31,33-48` | Private/default normalization; nested authored values win; inactive subtype configurations can survive. |
| `shared/src/education/game-config-projection.js:27-62` | Removes known runtime fields, not arbitrary private extensions. **Not a public projection.** |
| `shared/src/education/game-registry.js:1-28` | Canonical subtype dispatch and capabilities. `authoringFields` includes private collections/keys; it is not a public allowlist. |

### Proposed minimal API — not existing implementation

```text
projectPublicGameConfig(gameType, normalizedPrivateConfig) -> publicConfig
validatePublicGameConfig(gameType, publicConfig) -> {isValid, errors}
```

Required behavior:

1. Construct a **new, explicit subtype-specific public object**. No spread of private config, element, inactive subtype blocks or arbitrary extensions.
2. For every canonical question in `questions[]` or Jeopardy `categories[].questions[]`, call existing `projectPublicQuestion`; validation delegates to `validatePublicQuestion`. **Do not reproduce its allowlist.**
3. Reject unexpected fields at every admitted public-object depth. Reuse shared validation/error patterns and collection bounds.
4. Audience browser mount validates only the public schema. Never run private/default normalization on received public config: it can restore private defaults and requires grading keys.
5. Projector validates its output; malformed public output produces an actionable error, never a private/local fallback.
6. Only the active subtype is emitted. Credentials, capabilities and runtime state stay outside authored config.
7. Serialize after projection with context-safe escaping of `<`, U+2028/U+2029 and attribute quotes where applicable. Escaping is not redaction.
8. Audience mode remains read-only during missing transport/disconnect. Absence of a key must not trigger local matching/scoring.

### Minimal subtype payload boundary

This is the public **configuration** boundary, not Phase12 round-state/reveal design.

| Subtypes | Public authored content to admit explicitly | Must not pass through |
|---|---|---|
| Hot Potato, Four Corners, Relay Race, Trivia Championship, Quiz | Public questions; explicitly required title/policy/team/round metadata. Round references remain references. | Question keys/feedback; arbitrary team/round extensions; authored grading internals. |
| Jeopardy | Category identity/title and public questions; explicitly required board/team display metadata. | Private question keys/feedback or wholesale category/config objects. |
| Poll, Word Cloud, Scattergories | Public prompt/options/category labels and explicitly required display/timing policies. | Arbitrary nested extensions, submissions, scoring/runtime state. |
| Matching | Public prompt; separately described prompt/target sides only if needed for the observer display. | Authored pair associations, `prompt → target` solution text, relation-revealing paired order. Prefer the existing authoritative matching state for round ordering. |
| Name Picker, Lucky Wheel, Countdown, Scoreboard, Word Search | Explicit public labels/items/display settings appropriate to read-only rendering. | Raw element/config dumps, runtime state, arbitrary extensions or claims of unsupported live play. |
| Memory, Flashcards, Sorting, Crossword | Explicit non-solution display content: card fronts/clues/items/buckets as applicable. | Memory pairing, flashcard answer backs, sorting assignments, crossword answers or solved grids. No new live protocol implied. |

The last rows require explicit public shapes even though those modules are classroom-local: placing them inside an audience document is not permission to send their private source configuration.

## 5. Observed defects and plausible regressions

| Finding | Evidence / consequence |
|---|---|
| **Current matching solution disclosure in HTML** | `shared/src/education/static-game-content.js:26-29` emits pair associations; `element-renderers.js:905-911` renders them; socket payload generation uses that renderer. **[INFERENCE]** a viewer inspecting this generated HTML can recover matching solutions before a round reveal. |
| **Future wholesale-config leak** | Private normalization deliberately retains unrelated authored data: `normalize-game-config.js:26-29`; preservation is tested at `education-authoring-schema.test.js:51-77`. Serializing normalized config directly for viewers would expose keys/feedback/custom teacher data. |
| **Future-slide/vertical/master bypass** | Whole deck generated eagerly; layout resolution occurs before rendering. Redacting only the active raw slide leaves other effective sections exposed. |
| **Host fallback contamination** | Socket fallback replays host HTML/meta room-wide at `socket-handler.js:188-190`. New host serializer makes this a private-payload hazard unless changed simultaneously. |
| **Speaker privilege confusion** | Notes are granted to speaker at `socket-handler.js:135`; that must not automatically grant grading secrets. |
| **Audience becomes local evaluator** | Public config must not be normalized with private defaults or mounted locally on transport loss. Otherwise viewers can grade/match independently. |
| **Over-redaction breaks ordinary exports** | Local Share/file/backups intentionally need inspectable private config for local play. Applying audience projection globally breaks the locked local contract. |
| **Parser-context breakage during portable cutover** | `offlineExport.js:75-80` claims case-insensitive closing-script escaping but implements case-sensitive splitting. Mixed-case fixtures remain necessary; no CSP relaxation is justified. |

## 6. Relevant current tests and coverage limits

No listed test was run.

| Test / reference | Existing coverage; missing privacy proof |
|---|---|
| `shared/tests/question-public-projection.test.js:13-69` | Exact projection, nonmutation, public-only validation, nested leak rejection, matching/hotspot shape and unsafe media. Reuse this contract. |
| `shared/tests/education-authoring-schema.test.js:17-31,51-86` | Honest runtime capabilities, preserved extension/inactive config and transient removal. Confirms private normalization is not redaction. |
| `shared/tests/education-static-game-snapshot.test.js:10-39` | Inert Hot Potato snapshot excludes private feedback; printable board/picker content. No live audience or matching-solution test. |
| `shared/tests/education-persistence-boundaries.test.js:76-104` | Master overrides/inheritance and subtype retention. Persistence coverage, not audience HTML coverage. |
| `server/services/socket-handler.test.js:117-165,386-445,538-542` | Payload delivery, fallback-oriented fake harness, stale deck/read protection. No game-key/feedback assertion in this file’s searched payload paths. |
| `server/services/live-capability-separation.test.js:24-48` | Role capabilities and unknown-role rejection. Not document view selection. |
| `server/routes/presentations-game-bootstrap.test.js:28-52,81-123,252` | Generation/authenticated bootstrap checks. Does not authorize the earlier Present GET. |
| `server/services/game-canonical-question-socket.test.js:63-107` | Existing `/games` question redaction, stable grading and own-receipt reconnect behavior. **Not** live `presentation-data` HTML proof. |
| `shared/tests/live-presenter-runtime.test.js:294-303` | Capabilities absent from generated static source. Does not establish public game-config serialization. |
| `server/routes/presentations.test.js:143-145`; `client/src/hooks/use-export-actions.test.js:424-425` | Preview navigation and mocked export forwarding. Neither proves audience privacy or portable runtime behavior. |

Other direct generator test consumers are local fixtures: `shared/tests/action-runtime.test.js:8`, `fx-registry.test.js:54,80`, `html-generator-contract-fixtures.test.js:20`, `htmlGenerator-vertical-children.test.js:36,50,58`, `htmlGenerator.test.js:19`, `htmlgenerator-golden-baseline.test.js:43`, `htmlgenerator-token-injection.test.js:40,78,105`, `parallax-features-integration.test.js:180`, `present-mode-section-styles.test.js:23`, and `transition-settings.test.js:40,48`. Preserve their local semantics; do not re-pin obsolete placeholder/source-wording assertions.

### Required consumer-visible qualification

- Parse every emitted audience config and validate it publicly; seed private sentinels in parent, future slide, child, inherited master, override and inactive subtype.
- Exercise viewer-before-presenter, viewer-after-presenter, reconnect, presenter replacement/deck switch and the retained fallback.
- Verify invalid/spoofed role/live queries cannot produce private host output.
- Verify matching associations are absent from audience fallback text as well as JSON.
- Verify local Present/Share/file retain private authored configuration and local play.
- Verify actual audience roots cannot submit, match or score locally during disconnect.

## Next integration action

Cut over the generator, both element-render branches, socket recipient/fallback paths and public-config schema **together**. Preserve existing capability/generation checks, local export semantics and CSP. The unresolved HTTP host-view binding and public shapes for non-question solution-bearing games are explicit integration obligations—not grounds to defer initial audience secrecy to Phase12.
