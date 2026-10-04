# Kongming — Phase04 actual editor smoke failure and timer cutover

Advisory only; no edits/build/lint/tests/formatters. Full cook --auto --advice --tdd authorized; Gemini temporarily excluded; no commit/push/deploy. Explicit local52186/gpt-6.1-sol, separate context; model-family independence false. Cwd C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001. Return <=400 words, concrete go/no-go and next risk.

## New actual surface failure (authoritative, do not rerun)
Exact Eval command:
display(await phase04Editor.observe({compact:true})); display(await phase04Editor.screenshot({selector:'[role="dialog"]',ifChanged:true}));
Observed URL http://127.0.0.1:55173/editor/e10d985a-1d9f-4102-a561-6527e0efe674; buttons Try Again, Reload Page; no dialog. Screenshot failed because selector absent.
Next read-only diagnosis:
display(await phase04Editor.text('body')); display(await phase04Editor.errors());
Verbatim body:
⚠️
Something went wrong

effectiveSlideIdentity is not a function

Try Again
Reload Page
Verbatim new page error:
TypeError: effectiveSlideIdentity is not a function
    at EditorPage (http://127.0.0.1:55173/src/pages/EditorPage.jsx?t=1790933082689:567:49)
    at renderWithHooks (http://127.0.0.1:55173/node_modules/.vite/deps/react-dom-kEWwM5XG.js?v=9b856f0e:9624:19)

## Relevant evidence
- shared/src/index.js:146 now exports education/effective-slide-identity.js via spread; that module exports the function.
- client/vite.config.js:57-62 already optimizes root revealjs-shared and the mount/config-serialization deep entrypoints per previous Vite counsel.
- client/node_modules/.vite/deps/_metadata.json:205-222 includes these three entries. Current isolated Vite service education-phase04-deep-runtime-vite-55173 was started before the new root export and has the old optimized linked-dependency snapshot.
- Existing counsel C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/phase-04-vite-failure-counsel.md distinguishes unoptimized deep entrypoint repair from forced restart for already-optimized linked dependency source changes.
- The narrow unit run passes the controller/helper computation but has two obsolete event-shape failures. Its verbatim output is now available as C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/phase04-shortcut-failure-output.log (parent artifact URIs are not accessible to CLI children).

## Proposed minimal repair
Do not edit a valid barrel/import or create a shim. Stop only owned isolated Vite service; restart client dev with VITE_API_PROXY_TARGET=http://127.0.0.1:34102, host127.0.0.1 port55173 --strictPort --force, preserve API/data, disable browser cache and reload. Verify real editor plus Try and offline download. Is this GO on the evidenced cached-root-export failure?

## Required next timer boundary, previously identified in callers counsel
The server's timer handlers still ignore effectiveSlideId, reject inherited colon-containing element IDs and key by raw elementId. Client useLiveTimerSync does likewise. Canonical tuples are already serialized identically in effective-game-descriptors, host-bindings and allocator. Plan: use one shared pure tuple-key helper; require both stable tuple fields for timer commands/events; key timer state/timeouts and join/reconnect/expiry by tuple; preserve role admission and existing numeric limits; carry fields through client sync and host transport. Extract existing timer logic into a <200 LOC service to avoid duplicating five handlers. No raw-ID fallback, aliases or parent-global reader in new runtime. Keep behavior tests for independent inherited copies, pause/adjust/stop, expiry/reconnect, stale callbacks and role revocation; update affected legacy raw-ID fixtures. Is this in-scope clean cutover? Flag exact public-contract or authority risks before implementation.
