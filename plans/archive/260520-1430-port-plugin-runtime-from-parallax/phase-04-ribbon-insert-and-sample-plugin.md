# Phase 04: Ribbon Insert And Sample Plugin

## Context Links

- Depends on: `phase-02-client-registry-and-element-model.md`, `phase-03-sandbox-canvas-runtime.md`
- Local files: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`, `client/src/pages/EditorPage.jsx`
- Source sample: `plugins/animated-counter/*`

## Overview

- Priority: P2
- Status: Complete
- Description: Surface plugin insertion in ribbon and add bundled `animated-counter` plugin.

## Key Insights

- Insert ribbon already has an Advanced dropdown and a games flyout. Plugin UI can be a compact dropdown section.
- Avoid adding property panel extension in Phase 1. Data changes happen inside sandbox.
- Sample plugin must prove bridge, persistence, and export fallback.

## Requirements

- Functional:
  - Insert tab shows plugins when loaded.
  - Clicking `Animated Counter` inserts `plugin:counter`.
  - Sample sandbox animates value and can send patch through `window.navslides.updateData`.
  - Element persists after autosave/reload because it is regular JSON.
- Non-functional:
  - No visual clutter if no plugins loaded.
  - Keyboard activation works.
  - Accessible labels for plugin buttons.

## Architecture

```text
EditorPage
  -> pluginTypes state
  -> addPluginElement(fullType)
  -> RibbonPanel -> InsertTabContent(pluginTypes, onAddPluginElement)

plugins/animated-counter/
  -> parallax-plugin.json
  -> dist/sandbox.html
  -> dist/plugin.js optional no-op
```

## Related Code Files

- Create: `plugins/animated-counter/parallax-plugin.json`
- Create: `plugins/animated-counter/dist/sandbox.html`
- Create: `plugins/animated-counter/dist/plugin.js`
- Create: `client/src/components/ribbon/ribbon-plugin-insert.test.jsx`
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/pages/EditorPage.jsx`

## TDD Plan

1. Ribbon test: no plugin section when `pluginTypes=[]`.
2. Ribbon test: plugin button appears with `Animated Counter`.
3. Ribbon test: keyboard activation calls `onAddPluginElement('plugin:counter')`.
4. Editor handler test or focused component test: `createPluginElement` result is added through existing `addElement` flow.
5. Server route test from Phase 01 verifies sample plugin manifest.

## Implementation Steps

1. Add `pluginTypes` and `onAddPluginElement` props to `InsertTabContent`.
2. Add plugin dropdown under Advanced or a new `Plugins` ribbon section depending width.
3. Add `addPluginElement(fullType)` in `EditorPage.jsx`.
4. Create sample plugin manifest with default data:
   - `value`, `prefix`, `suffix`, `duration`, `color`, `fontSize`, `label`.
5. Create sandbox HTML using `window.navslides` bridge.
6. Keep `plugin.js` as no-op or logging-only; no host API dependency.

## Todo List

- [x] Ribbon tests
- [x] Editor add handler
- [x] Plugin section UI
- [x] Sample manifest
- [x] Sample sandbox
- [x] Manual insert smoke

## Success Criteria

- User can insert Animated Counter from Insert ribbon.
- Inserted element renders animated counter on canvas.
- Plugin group absent when no plugins.
- Keyboard path covered.

## Risk Assessment

- Ribbon is dense; keep plugin UI compact.
- If plugin loads after initial render, UI must update without page refresh.

## Security Considerations

- Sample plugin has no external network dependency.
- No inline secrets or config.

## Next Steps

- Phase 05 covers present/share/export fallback behavior.
