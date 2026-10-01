# Red team — Security Adversary + Fact Checker

## Scope and verification accounting
Plan documents only: plan.md, all 16 phase files, reports/execution-contracts.md, reports/scope-ledger.md, six scout reports, and both research reports were read. No implementation, plan mutation, test, build, lint, formatter, or browser run was performed.
The tables below separate reading/review from verification. Proposed CREATE modules and future smoke results are not existing implementation evidence. Fixed vanilla DOM architecture, 19 canonical types/19 final subtypes, full requested scope, and phase10 dependencies [3,4,5,6] are unchanged.
- Plan-instruction samples: **240 checked**, 15 per phase, identified below; **3 confirmed missing integration instructions** reported. The remaining samples are not a claim that implementation is verified.
- Source-baseline fact probes: **32 checked / 32 verified / 0 failed / 0 unverified**, individually identified below. Verification means static source inspection, not execution.
- Implementation/runtime verification: **0 performed; future behavior remains unverified**. No security PASS or coverage percentage is asserted.
- Limits: no exhaustive inventory-path audit, external deployment/CORS inspection, CSP browser execution, penetration test, or independent physics assessment. No claim that all 240 samples were independently implemented/source-verified.

## High — F1: No owning cutover for role-specific live presentation HTML
**Missing instruction:** phase-04-standalone-runtime.md:37-47 emits saved nested configuration into application/json and normalizes it on mount; phase-06-native-quiz.md:35,57 and phase-12-live-server.md:34 require private-key redaction. Neither phase12 nor phase13 inventory includes the actual presentation-data producer. Phase16's prohibition at phase-16-release-gates.md:37 is not an executable instruction for that producer.
**Failure scenario:** after the planned serializer starts embedding native quiz configuration, a learner/viewer joins the presentation room and receives answerKey, accepted fill strings, hotspot correct-region geometry, and private feedback in the HTML, even when game-question is perfectly redacted. With the default local-mode mount, the viewer also receives an unintended local evaluator. Escaping JSON prevents injection, not disclosure.
**Repository evidence:** server/services/socket-handler.js:130-141 passes the whole normalized deck to generateRevealHTML; its only audience distinction is speaker-note inclusion. The role fanout is server/services/socket-handler.js:163-179. shared/src/htmlGenerator.js:225-226 receives options but currently defaults only note behavior; server/routes/presentations-extras.js:97-103 uses the same generator for the presenter document. These are different consumers of the same output contract.
**Exact proposed plan patch:** add server/services/socket-handler.js as MODIFY to phase12/13 inventory and add an explicit generation option/contract to phase04: local and authorized host documents retain private config, live participant documents serialize ONLY the shared public projection. Pass a recipient role/audience through every presentation-data producer/fallback and htmlGenerator/renderGame; live participant roots mount in non-local, server-authoritative mode and use a public-payload validator, not the full private-config normalizer. Preserve private config in ordinary local portable HTML. Add a real presentation-room join/reconnect/regeneration scenario asserting absence of answer keys, accepted strings, correct hotspot coordinates and private feedback in participant HTML/metadata, while the host remains playable; add this exact cell to phase16.

## High — F2: The local provisioning exception also exposes presenter-owned pending authority
**Missing instruction:** phase-12-live-server.md:31,40 promises trusted bootstrap and host capability/session ownership, but its REST inventory at :110 covers the answer cutover. The explicit local provisioning exception at :177 never separates ownerless local provisioning from presenter-owned live rooms.
**Failure scenario:** between trusted presenter bootstrap creating an owned room and the presenter claiming it, a generic POST /api/games with the public element/gameId returns that room's pending host capability. The caller can claim host first and deny the rightful presenter or control the live game. This is an authority crossover between two existing provisioning paths, not a request to make the deliberately local router internet-safe.
**Repository evidence:** server/routes/games-rest-api-handler.js:33-43 returns peekHostCapability for ANY existing room, without checking owner. server/services/presenter-game-bootstrap.js:135-140 creates live rooms with owner; server/services/game-room-manager-singleton-service.js:180,212 records owner and pending capability. The secret remains pending until host claim at server/services/game-room-manager-singleton-service.js:574-575; the protected bootstrap retrieves it at server/services/presenter-game-bootstrap.js:148-162.
**Exact proposed plan patch:** extend phase12's REST checkpoint to POST /api/games: reject generic provisioning/retrieval for rooms with a presenter owner before reading pendingHostCapabilities; do not return a capability or alter the owned room. Keep the existing explicitly local ownerless provisioning behavior, with no new deployment-wide auth scope. Only the existing presenter-authorized bootstrap may retrieve/hand off owned-room authority. Add an actual REST-vs-protected-bootstrap race scenario before host claim, including rightful-host success and an unchanged ownerless local-create case; phase13 must wait for this authority boundary.

## Medium — F3: Plugin nonce migration stops at the host, leaving the shipped iframe peer incompatible
**Missing instruction:** phase-14-sandbox-offline.md:40,57 requires source+per-document token on plugin messages, but its inventory :71,76 lists the generated host and React host only. Its valid-plugin acceptance criterion :147 has no named migration for the existing shipped protocol peer or a bootstrap sequence that lets that peer learn the nonce.
**Failure scenario:** a strict token host rejects Animated Counter's tokenless ready/update-data messages; data initialization or updates stop in Present/Share/portable output. Conversely, accepting the old protocol to keep it working retains the stale-message gap. Hardening the parent listener alone also does not stop forged navslides-host messages from being rendered inside the peer.
**Repository evidence:** plugins/animated-counter/parallax-plugin.json:21 resolves the sandbox asset. plugins/animated-counter/dist/sandbox.html:48-59 validates only the source string on incoming messages and emits tokenless ready/update-data. client/src/plugins/plugin-sandbox.jsx:48-59 checks the Window source but has no nonce; shared/src/htmlGenerator.js:165-192 initializes the asset directly and handles only ready. The peer is an actual consumer, not a proposed file.
**Exact proposed plan patch:** add plugins/animated-counter/dist/sandbox.html as MODIFY under phase14's protocol cutover (and its build/source owner if re-scout identifies a generated source). Specify trusted-parent init on iframe load; peer accepts init only from window.parent with validated schema, binds its instance/document token for that document lifetime, and echoes it on ready/update-data. Later host messages must match the bound token, direction and schema. Migrate the injected canvas bridge and generated-host bridge with the peer atomically, with no tokenless data-update compatibility path. Add actual builtin-plugin init/update plus sibling/stale-document rejection on canvas, generated hosted output and portable HTML.

## Per-phase plan samples (15 substantive instructions each)
All references in this table are within the named phase file. These samples were examined as contracts; proposed future behavior was not reported as implemented.
| Phase/file | Sampled instruction lines |
|---|---|
| 01 phase-01-start.md | 18,19,20,31,32,33,34,35,41,43,74,75,77,99,113 |
| 02 phase-02-editor-controls.md | 13,16,17,18,19,20,21,22,30,33,34,35,36,105,111 |
| 03 phase-03-schemas-authoring.md | 17,18,19,20,21,28,29,33,35,38,42,45,47,50,51 |
| 04 phase-04-standalone-runtime.md | 20,24,30,35,37,38,39,40,41,42,44,47,48,50,51 |
| 05 phase-05-existing-games.md | 26,30,31,33,37,38,39,40,41,42,47,48,49,50,116 |
| 06 phase-06-native-quiz.md | 20,21,27,33,35,40,44,46,47,48,49,50,54,55,57 |
| 07 phase-07-triggers-variables.md | 16,28,29,35,36,37,48,49,50,52,53,58,59,60,64 |
| 08 phase-08-utility-modules.md | 13,17,26,31,32,33,34,39,40,41,42,44,48,54,61 |
| 09 phase-09-memory-flashcards.md | 19,20,27,28,29,39,42,43,46,48,49,50,56,61,62 |
| 10 phase-10-drag-drop.md | 26,30,31,32,33,35,39,40,41,42,43,44,46,49,51 |
| 11 phase-11-word-games.md | 17,25,27,30,31,33,40,41,42,44,45,47,48,49,54 |
| 12 phase-12-live-server.md | 15,16,17,18,27,28,31,32,33,34,40,42,43,44,49 |
| 13 phase-13-live-player.md | 27,31,33,34,39,40,41,43,44,45,46,47,49,54,55 |
| 14 phase-14-sandbox-offline.md | 17,18,19,20,22,23,24,37,38,39,40,41,42,48,57 |
| 15 phase-15-templates-simulations.md | 22,23,25,32,37,38,40,41,44,45,49,50,51,52,55 |
| 16 phase-16-release-gates.md | 17,18,19,20,21,23,24,25,28,29,33,36,37,39,41 |

## Source-baseline fact probes (static; 32/32 verified)
| ID | Repository evidence | Verified fact |
|---|---|---|
| B01 | server/routes/presentations-extras.js:97-103 | Present calls the shared generator and returns HTML. |
| B02 | shared/src/element-renderers.js:951-975 | Current native game export is a static fallback, not gameplay. |
| B03 | server/services/socket-handler.js:135 | Note access is role-sensitive. |
| B04 | server/services/socket-handler.js:138 | HTML generation receives the normalized full deck. |
| B05 | server/services/socket-handler.js:163-179 | Presenter/speaker/remote/viewer fanout carries member roles. |
| B06 | server/services/socket-handler.js:174-178 | Async fanout checks room identity, generation and presenter. |
| B07 | server/services/socket-handler.js:184-195 | A single-recipient fallback rebroadcasts emitted presentation payloads. |
| B08 | shared/src/live-presenter-runtime.js:22-35 | Live query controls presenter bootstrap. |
| B09 | shared/src/live-presenter-runtime.js:33-35 | Socket.IO is loaded dynamically from /vendor. |
| B10 | shared/src/live-presenter-game-runtime.js:106-119 | Generated host owns capability and connection state. |
| B11 | shared/src/live-presenter-game-runtime.js:255-270 | Shortcut messages require opener source and same origin. |
| B12 | server/services/game-socket-handler.js:13-25 | Current public question uses top-level blacklist redaction. |
| B13 | server/services/game-socket-handler.js:121-148 | Rejoin hydration includes own answer result/correctIndex. |
| B14 | server/services/game-room-manager-singleton-service.js:587-601 | Answer mutation checks session and question ID. |
| B15 | server/services/game-room-manager-singleton-service.js:610-621 | Duplicate answers reuse the prior question result. |
| B16 | server/services/game-room-manager-singleton-service.js:606-608 | Answer elapsed time currently uses Date.now. |
| B17 | server/services/game-room-manager-singleton-service.js:634-645 | Correct-answer speed bonus mutates authoritative score. |
| B18 | server/routes/games-rest-api-handler.js:105-131 | REST answer calls the same engine with session/question checks. |
| B19 | server/routes/games-rest-api-handler.js:33-43 | Existing-room REST provisioning returns pending capability. |
| B20 | server/services/game-room-manager-singleton-service.js:180 | Room state records normalized owner. |
| B21 | server/services/game-room-manager-singleton-service.js:212 | Newly created rooms retain pending host capability. |
| B22 | server/services/game-room-manager-singleton-service.js:574-575 | Successful host claim removes pending capability. |
| B23 | server/services/presenter-game-bootstrap.js:91-96 | Presenter bootstrap requires a valid owner. |
| B24 | server/services/presenter-game-bootstrap.js:135-140 | Presenter bootstrap creates owner-bound rooms. |
| B25 | client/src/utils/offlineExport.js:79-80 | Inline closing-script replacement is currently case-sensitive. |
| B26 | shared/src/element-renderers.js:357-383 | HTML has print-blob, Mermaid-srcdoc and data-URL emission branches. |
| B27 | client/src/components/canvas/canvas-element-wrapper.jsx:622-634 | Canvas authored HTML currently has allow-same-origin. |
| B28 | client/src/utils/stem-embed-presets.js:47-59 | Nested STEM iframe grants forms/popups/same-origin and clipboard. |
| B29 | client/src/plugins/plugin-sandbox.jsx:48-59 | Canvas plugin listener checks frame source, not a token. |
| B30 | plugins/animated-counter/dist/sandbox.html:48-59 | Shipped peer protocol has no parent-source check or token. |
| B31 | shared/src/htmlGenerator.js:165-192 | Generated plugin host initializes directly and handles ready. |
| B32 | electron/content-security-policy.js:3-15 | Desktop CSP excludes unsafe-eval and data: scripts/styles. |

## Rejected candidates / explicit bounds
- Mixed-case closing-script handling is already an explicit phase04 requirement (:24,38); its existing bug is not an additional missing-plan finding.
- data: authored HTML is opaque-origin; no finding assumes parent same-origin access. The same-origin canvas/srcdoc, final PDF blob and nested permission branches are explicitly owned by phase14 (:17-24,29-42).
- Nested/static/dynamic dependency closure, per-embed network policy, CSP/CORS distinctions and fail-closed portable errors are explicit phase14 contracts (:39-49); deployment/CORS success is still unverified, not a confirmed contradiction.
- Source+token messaging, round/session/generation/room-instance authority and payload-conflict dedup are explicit requirements; the reported plugin issue is the concrete omitted peer, not a speculative claim that the planned validators fail.
- No finding demands internet-safe generic local provisioning, offline multiplayer, secrecy for local answer configs, new physics, or a scope cut.
