# Phase 03: Sandbox Canvas Runtime

## Context Links

- Depends on: `phase-02-client-registry-and-element-model.md`
- Local files: `client/src/components/canvas/canvas-element-wrapper.jsx`, `client/src/components/SlideCanvas.jsx`
- Source file: `client/src/plugins/PluginSandbox.jsx`

## Overview

- Priority: P1
- Status: Complete
- Description: Render plugin elements on editor canvas and synchronize sandbox data/layout.

## Key Insights

- Existing HTML embed iframe disables pointer events. Plugin sandbox needs pointer events only when selected/editing.
- Message bridge must check `event.source === iframe.contentWindow`.
- Data patch updates must merge into existing `pluginData` through `onUpdateElement`.

## Requirements

- Functional:
  - Render `plugin:*` element as iframe sandbox.
  - Fetch sandbox HTML from `/api/plugins/:slug/assets/<sandbox>`.
  - Inject bridge script before sandbox body runs.
  - Send `init`, `data-changed`, `resize`.
  - Receive `update-data`, `ready`, `error`.
- Non-functional:
  - No script execution in parent.
  - No layout shift during load.
  - Clear fallback when sandbox missing.

## Architecture

```text
CanvasElement
  -> if type startsWith('plugin:')
  -> <PluginSandbox sandboxUrl pluginData width height ... />

PluginSandbox
  -> fetch sandbox HTML
  -> inject bridge
  -> iframe sandbox="allow-scripts"
  -> postMessage protocol
```

## Related Code Files

- Create: `client/src/plugins/plugin-sandbox.jsx`
- Create: `client/src/plugins/plugin-sandbox.test.jsx`
- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx`

## TDD Plan

1. Component test: renders loading state while sandbox fetch pending.
2. Component test: iframe uses `sandbox="allow-scripts"`.
3. Component test: ready message triggers `init` post.
4. Component test: update-data message calls `onDataUpdate`.
5. Component test: unrelated window message ignored.
6. Wrapper test: `plugin:counter` renders PluginSandbox.

## Implementation Steps

1. Port sandbox bridge with NavSlides naming (`navslides-host`, `navslides-plugin`).
2. Inject script/style into `<head>` if present, else prepend.
3. Use `srcDoc` not remote `src` to allow bridge injection.
4. Keep iframe dimensions stable: `width:100%; height:100%; border:none`.
5. In `canvas-element-wrapper.jsx`, resolve plugin metadata via registry and pass sandbox URL.
6. Merge patch: `{ pluginData: { ...element.pluginData, ...patch } }`.

## Todo List

- [x] Sandbox tests
- [x] PluginSandbox component
- [x] Canvas wrapper integration
- [x] Ignored message tests
- [x] Missing sandbox fallback

## Success Criteria

- Plugin element appears in editor canvas.
- Sandbox can update `pluginData`.
- Parent ignores messages from other frames.
- Tests cover bridge basics.

## Risk Assessment

- Infinite update loop if host sends data-change after every patch; compare or accept patch merge carefully.
- Pointer events can break drag selection; enable interaction only when selected.

## Security Considerations

- `sandbox="allow-scripts"` only. No `allow-same-origin`.
- No parent DOM access from sandbox.
- Message schema must include source marker and known type.

## Next Steps

- Phase 04 exposes insert UI and sample plugin.
