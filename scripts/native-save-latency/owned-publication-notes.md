# Owned publication change (source-only verification)

## Actual evidence and root

Read `live-cache-1794820701869-notes.json`, its report `result.json`, and aggregated the retained `get.cpuprofile` with explicit `C:/nvm4w/nodejs/node.exe` (no new profiler/browser run). Self samples: canonicalJson 8052.818 ms, canonical mapping callback 2174.637 ms, structuredClone 1775.701 ms, GC 1641.444 ms. These are instrumented diagnostic samples, not a deadline qualification.

The journal exact key and full dependencies hit. The residual root was `acquireOwnedAuthorityState` canonicalizing and hashing `{root,state}` on EVERY acquisition, including warm hits and the admission callback. Publication changed that historical envelope, forcing another full clone and fresh context. Receipt adoption additionally hashed projections even though it still required complete deep equality.

Latest native `69816c2c` remains FAILED: paste 850 ms, HTTP 200 save finished about 23.5 seconds after input start, observation deadline failed. No replacement native qualification is claimed.

## Bounded implementation

- `server/services/pptx-import/package-store/index.js`: detach and recursively seal publication state/root after verified init/reload/recovery and AFTER StateStore.publish. Finally handles a durable root replacement followed by a completion fault; unpublished drafts never acquire authority. Mutator-returned/retained references remain detached and editable. Public getState remains a fully mutable copy. No StateStore edit needed.
- `server/services/pptx-import/package-authority-snapshot.js`: skip full-state canonical serialization only when BOTH state and root are recursively proven immutable plain data. Mutable, accessor, exotic, shallow-frozen and replaced graphs retain full canonical-envelope proof. Build owned snapshots by sharing immutable publication children rather than cloning all history; copy result shells for certified receipt adoption. Remove redundant receipt hash pass; bounded candidates still require full deep equality and original admission/budget checks. Journal digests and dependency semantics unchanged.
- Authority and read tests add durable success/pre-root failure/post-root failure/completion failure, retained draft isolation, public copy isolation, frozen metadata, reload, and mutable-graph fail-closed fallback coverage.

## Verification

Explicit Node command: `C:/nvm4w/nodejs/node.exe node_modules/vitest/vitest.mjs run tests/pptx-semantic/native-latency-server-authority.test.js tests/pptx-semantic/native-latency-server-read.test.js tests/pptx-semantic/native-latency-server-response.test.js tests/pptx-semantic/native-latency-server-safety.test.js server/services/pptx-import/package-store/package-store.test.js`

Final: 5 files, 59 tests passed. Generation/replay and stricter raw-metadata budgets remain tested. No browser, build, new live probes, commits, or digest changes. Native deadline/reload qualification remains open.
