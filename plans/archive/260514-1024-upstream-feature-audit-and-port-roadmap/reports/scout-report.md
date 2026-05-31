# Scout Report

## Summary

Repo is not merge-compatible with upstream. Treat upstream as a source of ideas and targeted patches, not as a branch to merge.

## Codebase Shape

| Area | Local path | Notes |
| --- | --- | --- |
| Client app | `client/src/` | React 18, Vite, React Router, Zustand |
| Editor page | `client/src/pages/EditorPage.jsx` | composition root, large but already decomposed |
| Canvas | `client/src/components/SlideCanvas.jsx`, `client/src/components/canvas/` | extracted renderers/chrome/hooks |
| Properties | `client/src/components/PropertiesPanel.jsx`, `client/src/components/properties/` | type-specific property editors |
| Export/render | `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js` | shared HTML/present/print render path |
| Server | `server/index.js`, `server/routes/`, `server/services/` | Express + Socket.IO + services |
| Storage | `server/services/storage.js` | file-backed JSON with locks |
| Tests | `client/src/**/*.test.*`, `server/**/*.test.js`, `shared/tests/`, `tests/e2e/` | Vitest + Playwright |

## Existing Patterns To Preserve

- New editor behavior goes into hooks, stores, focused components.
- Element renderers register via `client/src/components/canvas/element-renderers/registry.js`.
- Shared export logic belongs in `shared/src/`.
- E2E selectors prefer role/label/text, then `data-testid`.
- New files use kebab-case except established PascalCase React component files.
- Avoid adding SaaS/auth/database assumptions to self-host single-user app.

## Upstream Sync Constraints

- Full merge rejected: no merge-base and huge diff.
- Local `Copy URL` has already landed.
- Upstream HTML render implementation does not map 1:1 to local shared renderer.
- Upstream plugin/storage/SaaS changes imply architecture direction changes.

## Relevant Existing Plans

| Plan | Status | Relation |
| --- | --- | --- |
| `260514-0749-upstream-main-merge-sync` | cancelled | superseded unsafe full merge idea |
| `260514-1045-upstream-main-selective-port-workflow` | complete | prior selective port baseline |
| `260513-2243-ui-ux-warm-editorial-overhaul` | complete | UI surface context |

## Unresolved Questions

- None blocking plan creation.
