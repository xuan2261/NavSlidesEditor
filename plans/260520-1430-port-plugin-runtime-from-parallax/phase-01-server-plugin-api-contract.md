# Phase 01: Server Plugin API Contract

## Context Links

- Report: `reports/xia-plugin-runtime-port-report.md`
- Local files: `server/index.js`, `server/services/storage.js`, `server/routes/marketplace.js`, `server/routes/templates.js`
- Source pattern: Parallax public `/api/plugins` listing and `/api/plugins/:slug/assets/*`

## Overview

- Priority: P1
- Status: Complete
- Description: Add safe file-based plugin discovery and public read-only plugin API.

## Key Insights

- NavSlides has no auth/database. Do not port install/license APIs.
- Plugin packages are local privileged extensions. Route still must block path traversal.
- Keep scanning logic in a focused service, not `server/index.js`.

## Requirements

- Functional:
  - Scan bundled `plugins/<slug>/parallax-plugin.json`.
  - Optionally scan user plugin root `server/data/plugins/<slug>/parallax-plugin.json`.
  - Return normalized plugin list via `GET /api/plugins`.
  - Return one plugin via `GET /api/plugins/:slug`.
  - Return manifest via `GET /api/plugins/:slug/manifest`.
  - Serve plugin assets from `dist/` only via `/api/plugins/:slug/assets/*`.
- Non-functional:
  - No DB migration.
  - No write/install endpoint.
  - Deterministic ordering by plugin name then slug.
  - Reject unsafe slug/path.

## Architecture

```text
server/index.js
  -> app.use('/api/plugins', pluginsRouter)
  -> app.use('/api/plugins/:slug/assets', servePluginAsset)

server/services/plugin-runtime.js
  -> listPlugins()
  -> getPlugin(slug)
  -> resolvePluginAssetRoot(slug)
```

## Related Code Files

- Create: `server/services/plugin-runtime.js`
- Create: `server/routes/plugins.js`
- Create: `server/routes/plugins.test.js`
- Modify: `server/index.js`
- Modify: `server/services/storage.js` only if `DATA_DIR` export is insufficient

## TDD Plan

1. Route test: empty plugin dirs returns `[]`.
2. Route test: bundled `animated-counter` manifest appears.
3. Route test: unknown slug returns 404.
4. Route test: slug with `../` returns 400.
5. Asset test: `dist/sandbox.html` served with HTML MIME.
6. Asset test: path traversal under assets returns 400/404.

## Implementation Steps

1. Add `server/services/plugin-runtime.js`.
2. Implement safe slug regex: `/^[a-z0-9][a-z0-9-]{0,63}$/`.
3. Implement manifest read with minimal validation: `id`, `name`, `version`, `contributes`.
4. Add routes in `server/routes/plugins.js`.
5. Mount routes and asset middleware before SPA fallback.
6. Keep errors client-safe: `{ error: 'Plugin not found' }`, `{ error: 'Invalid plugin path' }`.

## Todo List

- [x] Failing route/service tests
- [x] Plugin runtime service
- [x] Read-only plugin routes
- [x] Static asset route
- [x] Server index mount
- [x] Targeted tests pass

## Success Criteria

- API contract is test-covered.
- No new write endpoint.
- Asset serving cannot escape `dist/`.
- Works with bundled and user plugin roots.

## Risk Assessment

- Path traversal: mitigate via slug allowlist and resolved path root check.
- Bad manifest crashes list: skip invalid manifest and log warning.
- Route order collision: mount plugin routes before generic `/api` fallback only.

## Security Considerations

- Plugin assets are local trusted extensions, still isolated from arbitrary filesystem reads.
- Do not expose `server/data` directory recursively.
- Do not execute plugin code on server.

## Next Steps

- Phase 02 consumes `/api/plugins` in client registry/loader.
