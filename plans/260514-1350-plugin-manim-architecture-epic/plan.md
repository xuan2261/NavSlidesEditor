---
title: "Plugin Manim Architecture Epic"
description: "Evaluate and implement a local-only plugin MVP before any plugin marketplace or Manim plugin work."
status: cancelled
priority: P1/P2
effort: 30-46h before Manim
created: 2026-05-14
source: ../260514-1024-upstream-feature-audit-and-port-roadmap/reports/plugin-architecture-feasibility-report.md
---

# Plugin Manim Architecture Epic

## Goal

Introduce plugin architecture only after a security-reviewed local-only MVP proves the sandbox, asset serving, message bridge, and export contract.

## Scope

- Local-only bundled plugins.
- Static manifest discovery.
- Sandboxed iframe renderer with validated host/plugin messages.
- Capability manifest.
- Export fallback/static render contract.
- Security tests for path traversal and message validation.

## Out Of Scope

- Remote marketplace.
- User-installed remote plugins.
- Install/uninstall API.
- Plugin storage write APIs.
- Manim plugin until the generic plugin MVP passes review.

## Threat Model

- Plugin code is executable trusted/semtrusted author content.
- Asset serving must normalize paths.
- `postMessage` must validate source and message shape.
- Sandbox should start with `allow-scripts` only.
- Plugins must not access presentation/global storage except through explicit capability APIs.

## MVP Architecture

```text
plugins/{slug}/plugin.json
  -> local manifest
server/routes/plugins.js
  -> read-only local plugin list/assets
client/src/plugins/
  -> registry, loader, validated bridge
client/src/components/canvas/element-renderers/
  -> plugin element renderer
shared/src/element-renderers.js
  -> export fallback
```

## Phases

| Phase | Status | Goal |
| --- | --- | --- |
| 1 | Cancelled | Security model and API contract |
| 2 | Cancelled | Local manifest + asset serving |
| 3 | Cancelled | Client registry/loader |
| 4 | Cancelled | Sandbox bridge with validation |
| 5 | Cancelled | Export fallback |
| 6 | Cancelled | Example local plugin |
| 7 | Cancelled | Security/E2E/docs |
| 8 | Cancelled | Manim plugin feasibility after MVP |

## Success Criteria

- No remote code loading.
- No path traversal in plugin assets.
- No unchecked host/plugin messages.
- Export degrades predictably.
- All tests and security review pass before Manim work.

## Verification

```powershell
npm run lint
npm run build
npm run test
npm run test:e2e -- tests/e2e/export.spec.js tests/e2e/hardening-regression.spec.js
```

## Unresolved Questions

- Which bundled plugin should be the first MVP sample: counter, Manim placeholder, or local HTML widget?
