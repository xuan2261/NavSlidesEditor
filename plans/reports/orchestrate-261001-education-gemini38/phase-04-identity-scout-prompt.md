# Goal
Continue authorized NavSlides education cook --auto --advice --tdd. Gemini 3.8 is temporarily excluded. Remain on explicit local52186/gpt-6.1-sol, no model switching or delegation. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. No commit/push/deploy.

# Role and constraints
First read C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/bundled-agent-profiles/scout.md and act as that read-only scout. Use only read/glob/grep. No edits/report files or commands; skip build/lint/tests/formatters. Read accepted worktree phase-04-standalone-runtime.md plus current nearby implementation/tests. Phase03 is finishing; do not claim Phase04 implementation or acceptance.

# Slice
Trace effective slide/master/vertical game identity, live tuple mapping/room lifecycle and Reveal input/lifecycle integration. Known entry points: shared/src/slide-layouts.js; shared/src/htmlGenerator.js; shared/src/element-renderers.js; server/services/presenter-game-bootstrap.js; game-room-manager-singleton-service.js and live-rooms.js; shared/src/live-presenter-runtime.js and live-presenter-game-runtime.js; existing presenter shortcut/action handlers; native Try/property/canvas game paths. Read installed Reveal keyboard/lifecycle sections when needed. Discover actual callers and relevant tests.

# Locked contract
Shared collectEffectiveGameDescriptors returns effectiveSlideId, elementId, gameType, config, resolving existing layouts and hidden overrides. Identity is (effectiveSlideId,elementId), saved IDs unchanged. Trusted bootstrap retains an opaque <=128-character transportGameId per owner/presentation-generation/effective tuple until room cleanup; reconnect reuses mapping. Deck timer element addressing is distinct from /games transport identity. DOM runtime reuses bootstrap-owned socket/auth; disconnected audience never silently local-scores. Initial ready/isReady and slidechanged operate on effective leaf; local timers pause on leave, live deadlines remain server-owned. Chain existing keyboardCondition including focused semantics; controls must not trigger delegated authored actions or Reveal navigation, outside navigation preserved.

# Deliverable
Return complete compact path:line caller/invariant maps: layout resolution/order/IDs/hidden behavior; room ownership/conflict/cleanup/reconnect mappings and every raw-ID transport lookup/emitter requiring cutover; existing Reveal/action/shortcut ownership and exact integration seams. Flag contradictions in accepted instructions versus current code, and smallest behavioral regression scenarios. Do not propose a new protocol, socket owner, or top-level plan. No execution/edits; report actual observations and mark inference.
