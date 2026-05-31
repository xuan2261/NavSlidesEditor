---
title: "Port Plugin Runtime From Parallax"
description: "Port a scoped, self-hosted plugin runtime with TDD gates, sandboxed plugin elements, and safe export fallbacks."
status: completed
priority: P2
effort: 20h
issue:
branch: master
tags: [feature, frontend, backend, export, testing, tdd]
blockedBy: []
blocks: []
created: 2026-05-20
---

# Port Plugin Runtime From Parallax

## Overview

Port plugin runtime concept from `jbirky/parallax-presentations@ce548c535abc7701ac45cc3164560caba121adce`.
Scope is local/self-hosted runtime only: bundled plugin discovery, sandbox rendering, ribbon insert, persisted `plugin:*` elements, and export fallback. No marketplace, billing, auth, install ZIP, or plugin KV storage.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Related historical | [Plugin Manim Architecture Epic](../260514-1350-plugin-manim-architecture-epic/plan.md) | cancelled |

## Phases

| Phase | Name | Status | Progress |
| --- | --- | --- | --- |
| 1 | [Server Plugin API Contract](./phase-01-server-plugin-api-contract.md) | Complete | 100% |
| 2 | [Client Registry And Element Model](./phase-02-client-registry-and-element-model.md) | Complete | 100% |
| 3 | [Sandbox Canvas Runtime](./phase-03-sandbox-canvas-runtime.md) | Complete | 100% |
| 4 | [Ribbon Insert And Sample Plugin](./phase-04-ribbon-insert-and-sample-plugin.md) | Complete | 100% |
| 5 | [Export And Share Fallbacks](./phase-05-export-and-share-fallbacks.md) | Complete | 100% |
| 6 | [Integration Verification And Docs](./phase-06-integration-verification-and-docs.md) | Complete | 100% |

## Execution Strategy

TDD first per phase. Write failing unit/route/component tests before implementation. Keep all new code files focused and under 200 LOC where practical. Use existing file-based storage and route patterns.

## Key Decisions

- First bundled plugin: `animated-counter`.
- Element model: `type: "plugin:<contributed-type>"`, `pluginId`, `pluginSlug`, `pluginData`, optional `pluginRuntime`.
- Host activation API: minimal; no broad host command/export API in Phase 1.
- Sandbox: iframe with `sandbox="allow-scripts"` and strict `event.source` checks.
- Offline/PDF export: static fallback in Phase 1; plugin sandbox asset inlining deferred.

## Dependencies

- Existing Express route mounting in `server/index.js`.
- Existing JSON persistence in `server/services/storage.js`.
- Existing element factory and ribbon Insert tab.
- Existing shared render pipeline in `shared/src/element-renderers.js`.

## Validation Gates

- `npm run lint`
- `npm run test -- server/routes/plugins.test.js client/src/plugins client/src/components/ribbon shared/tests/htmlGenerator.test.js`
- `npm run build`
- Focused Playwright flow if implementation touches visible editor UI.

## Handoff

Cook command:

```bash
/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260520-1430-port-plugin-runtime-from-parallax\plan.md
```
