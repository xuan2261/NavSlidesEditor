---
phase: 4
title: "PPTX Export Policy and Dispatcher Unification"
status: completed
priority: P1
dependencies: [3]
---

# Phase 04: PPTX Export Policy and Dispatcher Unification

## Overview

Make PPTX export behavior explicit and reduce duplicated client/server dispatcher drift.

## Requirements

- Functional: client and server PPTX dispatch must consume the same element export policy/classification.
- Functional: fallback/raster behavior must remain intact for unsupported native elements.
- Functional: warnings must continue to identify fallback reason and element type.
- Non-functional: no broad PPTX renderer rewrite.

## Architecture

Add a CommonJS-compatible shared policy table in `shared/src/`, exported through `shared/src/index.js`, so both client and server can consume it through the existing `revealjs-shared` package boundary:

```js
const PPTX_ELEMENT_EXPORT_POLICY = {
  text: { mode: 'native' },
  html: { mode: 'server-prefetch-raster', requiresServer: true, failure: 'error' },
  latex: { mode: 'server-prefetch-raster', requiresServer: true, failure: 'error' },
  markdown: { mode: 'client-fallback-raster' },
  video: { mode: 'media-cover', fallback: 'placeholder' },
  game: { mode: 'live-only-static' },
}
```

Client/server dispatcher functions can still call environment-specific renderers, but the list of supported modes must come from one policy.

## Related Code Files

- Create/modify: `shared/src/pptx-export-policy.js`
- Modify: `shared/src/index.js`
- Modify: `client/src/utils/export-pptx-renderers.js`
- Modify: `client/src/utils/exportPptx.js`
- Modify: `server/utils/server-renderers.js`
- Modify: `server/utils/server-raster.js`
- Modify: `client/src/utils/exportPptx.test.js`
- Modify: `server/services/raster-resilience.test.js`

## TDD Steps

1. Add failing shared policy test that all 19 element types have a PPTX policy.
2. Add failing client and server import smoke tests proving the policy is available through `revealjs-shared`.
3. Add failing parity test that client and server native type lists match the shared policy.
4. Add failing tests for current non-native routing: `html`/`latex` use server-required `server-prefetch-raster` and error when unavailable or missing, most visual non-native elements use `client-fallback-raster`, media can use `media-cover`, and `game` remains static/live-only.
5. Add behavior-level tests for one representative native, server-prefetch, client-fallback, media-cover, and placeholder/live-only path.
6. Refactor client/server switches to use shared policy for classification before dispatch.
7. Preserve existing native renderer calls and fallback calls.
8. Verify warning schema remains stable.

## Targeted Tests

```powershell
npx vitest run client/src/utils/exportPptx.test.js
npx vitest run server/services/raster-resilience.test.js
npx vitest run shared/src/pptx-export-policy.test.js
```

## Success Criteria

- [x] All 19 element types have explicit PPTX policy.
- [x] Shared policy imports successfully from client and server code paths.
- [x] Client/server native coverage cannot drift silently.
- [x] HTML/LaTeX server-prefetch failure behavior is preserved unless intentionally changed by explicit tests.
- [x] Existing fallback/raster behavior remains green.
- [x] Game export remains static/live-only, not interactive.

## Risk Assessment

Risk: shared policy import may break CommonJS/ESM boundaries. Mitigation: follow existing shared package export style (`revealjs-shared`) and add both client and server import tests.
