# Kongming — Phase04 failed verification checkpoint

Advisory-only. Read installed kongming instructions attached at launch. Full authorized cook --auto --advice --tdd; Gemini temporarily excluded; no commit/push/deploy. Producer and counsel local52186/gpt-6.1-sol; independent context, not model-family independence. Worktree C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001.

Exact failed GREEN command: `npx vitest run server/services/presenter-game-allocations.test.js --maxWorkers=1` in the worktree. Verbatim output is artifact://1026 in the parent; key exact failure:
```
❯ |node-serial| server/services/presenter-game-allocations.test.js (5 tests | 1 failed) 38ms
× isolates inherited parent/vertical roots and hidden overrides without changing saved IDs
AssertionError: expected [] to deeply equal [ 'one', 'child', 'two' ]
- [ "one", "child", "two" ]
+ []
❯ server/services/presenter-game-allocations.test.js:21:61
Test Files 1 failed (1)
```
The same test observed expected RED before implementation; remaining four new cases now PASS. Generated actual-IIFE tests already PASS (2/2). No diagnosis or edits after failed GREEN.

Changes: new presenter-game-allocations.js WeakMap scope owner/current lineage, fingerprint canonical descriptors, random transport IDs and actual room cleanup callback; bootstrap uses shared collectEffectiveGameDescriptors and owner allocationScope; route supplies live-room object; reconnect keeps allocation lineage. New tests in presenter-game-allocations.test.js cover inherited roots/hidden, reconnect score continuity, config fork/cosmetic preservation, cleanup and capability admission. Earlier join fixture was corrected to actual joinRoom(gameId, playerId, name, {socketId,...}) before GREEN.

Question: diagnose missing inherited allocation using current source and fixture, recommend correct boundary repair without weakening effective identity/privacy behavior. Inspect shared/src/slide-layouts.js and slide-layout-normalization.js, shared/src/education/effective-game-descriptors.js, server/services/presenter-game-bootstrap.js and new tests. Is the fixture invalid under required master geometry, or actual resolution/descriptor/bootstrap bug? Return exact evidence, correction and GO/NO-GO to repair. Do not edit, run tests/build/lint/formatters, or spawn nested agents. Keep reads to these files and dependencies only. Final <=1200 words; no report files.
