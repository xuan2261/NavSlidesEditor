# Phase 07 - Plugin Architecture Feasibility Gate

## Context Links

- [Plan](./plan.md)
- Relevant upstream commits: `e37311be`, `82be9d02`, `278739b4`, `f9b64b61`, `4400b516`, `071205a1`, `fca7cc2a`, `4798a3b9`, `b6fda989`

## Overview

- Priority: P2 optional, possible P1 epic
- Status: Complete
- Estimate: 4h planning gate, 20h+ if implemented later
- Goal: evaluate plugin loader/Manim as separate architecture initiative.

## Key Insights

- Plugin execution changes trust boundary.
- Local README permits trusted author HTML, but plugin marketplace/sandbox is broader.
- Upstream plugin work touches server storage/routes, editor toolbar, sandbox HTML, plugin assets.
- Local app has no SaaS auth; plugin permissions must be local-first.

## Requirements

- Do not implement plugin system in same branch as bugfix ports.
- Produce threat model before implementation.
- Decide whether plugin scope is:
  - local-only bundled plugins
  - user-installed plugins
  - remote marketplace
- Keep MVP small if accepted.

## Architecture Option If Accepted

```text
plugins/
  -> bundled plugin manifests + sandbox assets
server/routes/plugins.js
  -> local plugin listing/assets only
client/src/plugins/
  -> registry, loader, sandbox bridge
Editor toolbar
  -> insert plugin element
shared renderer
  -> export plugin fallback
```

## Related Code Files

- Potential modify:
  - `server/index.js`
  - `server/routes/plugins.js`
  - `server/services/storage.js`
  - `client/src/plugins/*`
  - `client/src/components/Toolbar.jsx`
  - `client/src/pages/EditorPage.jsx`
  - `client/src/components/canvas/element-renderers/registry.js`
  - `shared/src/element-renderers.js`
  - `Dockerfile`
- Create if accepted:
  - `plugins/{plugin-name}/parallax-plugin.json`
  - `plugins/{plugin-name}/dist/sandbox.html`
  - tests for loader/sandbox/security.
- Delete: none.

## Implementation Steps

1. Feasibility only:
   - inspect upstream plugin commits.
   - compare to local trusted HTML embed model.
   - decide MVP boundary.
2. Threat model:
   - plugin asset serving
   - sandbox permissions
   - storage access
   - network access
   - export behavior
3. Decide:
   - defer
   - local-only plugin MVP
   - full plugin ecosystem later
4. If accepted, create separate plan with security review phase.

## Todo List

- [x] Inspect upstream plugin/Manim commits.
- [x] Write plugin threat model.
- [x] Define MVP scope.
- [x] Ask user for go/no-go.

## Success Criteria

- No plugin implementation in current sync branch.
- Security and export concerns are explicit.
- Separate epic plan exists if accepted.

## Verification

Planning gate only:
```powershell
git diff --stat
```

If implemented later, likely gates:
```powershell
npm run lint
npm run build
npm run test
npm run test:e2e -- tests/e2e/export.spec.js
npm run test:e2e -- tests/e2e/hardening-regression.spec.js
```

## Risk Assessment

- Risk: sandbox escape or plugin asset path traversal.
- Risk: export cannot faithfully serialize plugin content.
- Risk: product complexity grows beyond current editor.
- Mitigation: local-only MVP, no marketplace, no remote code by default.

## Security Considerations

- Treat plugin system as new trust boundary.
- Require path normalization for plugin assets.
- Do not expose file storage write APIs to plugin code by default.

## Next Steps

- Proceed to final regression integration for accepted small ports.

## Unresolved Questions

- User decision: defer to separate architecture epic, local-only MVP after security review.
