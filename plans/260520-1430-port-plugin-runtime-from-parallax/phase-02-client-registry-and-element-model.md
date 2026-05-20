# Phase 02: Client Registry And Element Model

## Context Links

- Depends on: `phase-01-server-plugin-api-contract.md`
- Local files: `client/src/utils/element-factory.js`, `client/src/data/element-defaults.js`, `client/src/pages/EditorPage.jsx`
- Source files: `client/src/plugins/PluginRegistry.js`, `PluginLoader.js`, `PluginContext.js`

## Overview

- Priority: P1
- Status: Complete
- Description: Add client plugin registry, loader, and plugin element creation without broad host API.

## Key Insights

- `element-factory.js` currently requires a known `ELEMENT_DEFAULTS[type]`; `plugin:*` types need a separate creation path.
- Keep `EditorPage.jsx` as composer only; runtime logic goes in `client/src/plugins/`.
- Dynamic import of plugin `main` is riskier than sandbox render. Phase 1 can register manifests and defer activation.

## Requirements

- Functional:
  - Fetch `/api/plugins`.
  - Register contributed element types as `plugin:<type>`.
  - Expose insertable plugin types to ribbon.
  - Create plugin elements with default size/data from manifest.
  - Persist `pluginId`, `pluginSlug`, `pluginData`, `pluginRuntime`.
- Non-functional:
  - No global mutable leaks except singleton registry.
  - Loader tolerant of API failure.
  - Tests do not need real network.

## Architecture

```text
client/src/plugins/plugin-registry.js
  -> registerPlugin(plugin)
  -> getInsertablePluginTypes()
  -> getPluginForElement(type)

client/src/plugins/plugin-loader.js
  -> loadPlugins(fetcher = fetch)
  -> createPluginElement(fullType, overrides)
```

## Related Code Files

- Create: `client/src/plugins/plugin-registry.js`
- Create: `client/src/plugins/plugin-loader.js`
- Create: `client/src/plugins/plugin-context.js` minimal placeholder
- Create: `client/src/plugins/index.js`
- Create: `client/src/plugins/plugin-registry.test.js`
- Create: `client/src/plugins/plugin-loader.test.js`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/utils/element-factory.js` only if adding a helper there is cleaner

## TDD Plan

1. Registry test: manifest element type becomes `plugin:counter`.
2. Registry test: duplicate manifest id does not duplicate types.
3. Loader test: API failure returns empty list and does not throw.
4. Factory test: plugin element uses default size/data and generated id.
5. Factory test: caller overrides win.

## Implementation Steps

1. Implement `PLUGIN_TYPE_PREFIX = 'plugin:'`.
2. Implement registry as class + exported singleton.
3. Keep contributed type schema normalized: `fullType`, `pluginId`, `pluginSlug`, `label`, `defaultSize`, `defaultData`, `sandbox`.
4. Implement `createPluginElement(fullType, overrides = {})`.
5. Load plugins in `EditorPage.jsx` mount effect.
6. Store `pluginTypes` state in `EditorPage.jsx` and pass to ribbon.

## Todo List

- [x] Registry tests
- [x] Loader/factory tests
- [x] Registry module
- [x] Loader module
- [x] EditorPage load wiring

## Success Criteria

- Plugin metadata loads without crashing editor.
- `plugin:counter` element can be created without editing `ELEMENT_DEFAULTS`.
- Repeated loads are idempotent.

## Risk Assessment

- EditorPage is already large; avoid embedding registry logic there.
- Dynamic import may fail in production paths; do not make it required for basic render.

## Security Considerations

- Treat manifest text as data only.
- Do not eval manifest fields.
- If optional `main` import is added, catch all errors and do not block sandbox render.

## Next Steps

- Phase 03 renders plugin elements through sandbox iframe.
