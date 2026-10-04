# Kongming — Phase 04 actual-IIFE hydration failed GREEN

Advisory only; installed kongming instructions attached at launch. Authorized full cook --auto --advice --tdd; Gemini temporarily excluded; no commit/push/deploy. Producer/counsel local52186/gpt-6.1-sol, independent context but not model-family independence. Cwd C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Do not edit, run tests/build/lint/formatters, or spawn nested agents.

Failed GREEN command: `npx vitest run shared/tests/education-live-hydration.test.js shared/tests/education-generated-document.test.js shared/tests/education-native-mount.test.js --maxWorkers=1`. Exact complete output artifact://1035 in parent; verbatim relevant output:
```
❯ |node-parallel| shared/tests/education-live-hydration.test.js (6 tests | 1 failed) 2670ms
× maps inherited copies to independent rooms and emits host commands without serializing private authority 924ms
AssertionError: expected [] to deeply equal [ [ { …(2) } ], [] ]
- [[{ event: 'game-poll-start', payload: { gameId: 'opaque-0' } }], []]
+ []
❯ shared/tests/education-live-hydration.test.js:39:96
Test Files 1 failed | 2 passed (3)
```
Other five hydration cases pass: four generation/tuple/config/revision mismatch guards; disconnect revokes a real host Start poll control. Actual generated document and native mount suites pass. No edits or further diagnosis after failed GREEN.

Changes: moved existing host namespace/socket/bootstrap ownership into shared/src/education/browser/live-host-transport.js + live-host-session.js, live-host-bindings.js and live-host-commands.js; standalone IIFE creates transport on live URL. Generated live-presenter-game-runtime.js now delegates presentation-data to transport, which validates same presentation/freshness/revision and public effective tuple snapshot before atomic host hydration. reveal-lifecycle refreshes roots on private bindings; mount binds host config in WeakMap; live-host-presenter.js creates disabled-until-joined authoritative native buttons. Socket HTML is audience-only; server presentation-data now includes presentationId/presentationGeneration; bootstrap returns presentationRevision. No credentials in DOM/configs. Opaque allocation fixture now 5/5 GREEN after prior counsel corrections.

Tests helper: shared/tests/helpers/education-document.js builds and loads actual IIFE and actual Reveal resources in JSDOM; only Socket.IO network client is shimmed to supplied fixture sockets. Test waits for generated outer presenter socket to load, emits presentation-data, waits one task, then clicks poll before/after simulated host join. Before implementation this correctly observed no mapped host commands/controls (after correcting helper readiness and scoping assertions to game roots). The first GREEN now still observes zero game sockets, although the disconnect case can hydrate a host control.

Inspect current modules/test/helper and essential generator/live runtime dependencies only. Diagnose production defect vs fixture scheduling/control error with source evidence. Recommend minimal repair retaining atomic privacy/identity guards and meaningful actual-IIFE assertions. Return GO/NO-GO to repair and exact paths/symbols, <=1000 words. Do not claim runtime verification; you are read-only.
