# Phase 05: Export And Share Fallbacks

## Context Links

- Depends on: `phase-01-server-plugin-api-contract.md`, `phase-04-ribbon-insert-and-sample-plugin.md`
- Local files: `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js`, `shared/tests/htmlGenerator.test.js`, `server/index.js`

## Overview

- Priority: P1
- Status: Complete
- Description: Ensure plugin elements survive present/share/export with deterministic fallback.

## Key Insights

- Shared generator runs in both client and server. It cannot depend on client registry singleton.
- Phase 1 static fallback is intentional for offline/PDF.
- Present/share can use `/api/plugins/:slug/assets/sandbox.html` only when `pluginSlug` and sandbox path are stored in element metadata.

## Requirements

- Functional:
  - `renderElement()` recognizes `plugin:*`.
  - Reveal HTML includes visible plugin container, not empty output.
  - If element has `pluginRuntime.sandbox`, reveal/share can embed sandbox iframe.
  - Print/PDF uses static label/fallback.
  - Offline HTML remains understandable without plugin API.
- Non-functional:
  - No async rendering in shared generator.
  - No remote fetch from shared module.
  - Fallback does not execute plugin script.

## Architecture

```text
plugin element data:
{
  type: "plugin:counter",
  pluginId,
  pluginSlug,
  pluginData,
  pluginRuntime: { label, sandbox, exportMode: "fallback" }
}

shared renderer:
  if opts.forPrint -> static fallback
  else if pluginSlug + sandbox -> iframe data URL wrapper or /api asset iframe
  else -> static fallback
```

## Related Code Files

- Modify: `shared/src/element-renderers.js`
- Modify: `shared/tests/htmlGenerator.test.js`
- Modify: `client/src/plugins/plugin-loader.js` to store `pluginRuntime`
- Possibly modify: `client/src/utils/offlineExport.js` if fallback marker needs explicit preservation

## TDD Plan

1. Shared test: plugin element renders non-empty fallback in reveal HTML.
2. Shared test: plugin element with `pluginSlug` and sandbox emits iframe asset URL in reveal HTML.
3. Shared test: print HTML renders static fallback and no `/api/plugins/` dependency.
4. Shared test: plugin data is escaped in attributes/content.
5. Offline test if existing helper exposes direct assertion: generated offline output keeps fallback label.

## Implementation Steps

1. Add `renderPlugin(el, style, wrap, vis, opts)`.
2. Register plugin renderer via dispatcher prefix check, because `RENDERERS[el.type]` cannot match dynamic `plugin:*`.
3. Use `escapeHtml` for labels and JSON.
4. For print: render static value when data has `value`, else label.
5. For reveal: embed iframe only if sandbox route path is safe from metadata.
6. Keep fallback visually neutral and consistent with other placeholder styles.

## Todo List

- [x] Failing shared tests
- [x] Dynamic plugin renderer dispatch
- [x] Reveal iframe path support
- [x] Print/static fallback
- [x] Escape coverage

## Success Criteria

- Plugin element never disappears in generated HTML.
- PDF/offline are understandable without server plugin assets.
- Reveal/share use runtime when metadata is present.

## Risk Assessment

- Server-side render may lack `window.location.origin`; use relative asset path when needed.
- Embedding sandbox via `src` cannot inject bridge; present mode Phase 1 may be display-only unless bridge is in sandbox itself.

## Security Considerations

- Escape all plugin labels/data rendered into HTML.
- Do not inline arbitrary sandbox HTML into export in Phase 1.
- Do not add `allow-same-origin` to exported iframe.

## Next Steps

- Phase 06 runs full verification and docs updates.
