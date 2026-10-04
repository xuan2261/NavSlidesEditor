# Kongming — Phase04 failed shortcut verification checkpoint

Advisory only. Full cook --auto --advice --tdd remains authorized; Gemini is temporarily excluded, no commit/push/deploy. Independent context on explicitly pinned local52186/gpt-6.1-sol; model-family independence is false. Workspace C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Read-only, no tests/build/lint/formatters or source edits. Return concise verdict and risks, at most 350 words.

## Change immediately before verification
The effective game helper now resolves layout masters and excludes hidden games; EditorPage computes canonical effectiveSlideIdentity for the active parent/vertical child and passes it to useEditorLiveSessionController. Typed shortcuts carry {action,elementId,gameType,effectiveSlideId}. Canonical tuple routing is Phase04's required cutover; prior parser-failure counsel asked for this propagation.

## Exact failed command
npx vitest run server/services/presenter-game-bootstrap.test.js server/services/presenter-game-allocations.test.js shared/tests/education-live-hydration.test.js client/src/pages/__tests__/editor-page-present-wiring.test.jsx --maxWorkers=1
Cwd: C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001

## Verbatim output
Read artifact://1074:raw in full. Exit 1: 3 test files passed, 1 failed; 32 tests passed, 2 failed. The two failures expect the old shortcut payload without effectiveSlideId; received payload includes effectiveSlideId:'s1'. They are named 'game shortcut actions publish a typed event instead of being console stubs' and 'routes a shortcut to the selected game using that subtype action'. No retry to confirm the failure and no subsequent source edits have been made after delivery of this failure.

## Relevant files
- client/src/pages/__tests__/editor-page-present-wiring.test.jsx (failures lines169 and192)
- client/src/pages/editor-page-helpers.js
- client/src/pages/EditorPage.jsx (active game/identity lines577-600)
- client/src/hooks/editor-controller/use-editor-live-session-controller.js (shortcut dispatch)
- shared/tests/education-live-hydration.test.js (actual generated IIFE tuple/queue/authority behavior)
- shared/tests/live-presenter-runtime.test.js (just replaced obsolete VM bootstrap tests with generated-document security/recovery cases; not yet verified)

## Exact decision
Repository delivery policy prohibits permanent forwarding/wiring/mock-echo/source-text/incidental implementation assertions, and requires deleting existing implementation-only tests rather than re-pinning. Is deleting these two exact mock-wiring shortcut cases, while retaining actual generated-document admission/routing tests and adding behavioral inherited/hidden/parent-child game selection coverage where missing, the correct cutover? Identify any real consumer contract regression that the evidence does not establish, and the narrowest remaining verification. Counsel first; no independent implementation.
