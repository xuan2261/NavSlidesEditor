---
title: "Phase 07: Action and Hotspot Metadata"
status: completed
---

# Phase 07: Action and Hotspot Metadata

## Goal

Add safe, accessible element-level navigation/actions and invisible hotspots without adding a twentieth canonical element type or allowing editor-mode accidental activation.

## Dependencies

- Phase 03 Reveal 6 runtime.
- Phase 05 shared URL policy and semantic fields.

## Canonical Files

- `shared/src/types/presentation.js`
- Recommended shared pure module: `shared/src/element-actions.js`
- `client/src/utils/editor-presentation-migration.js`, `client/src/utils/element-factory.js`
- `client/src/components/PropertiesPanel.jsx`
- Format Ribbon action section and `canvas-right-click-context-menu-for-slide-elements.jsx`
- `client/src/components/canvas/canvas-element-wrapper.jsx`
- `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js`
- `shared/src/shared-text-runs.js`, `client/src/utils/export-pptx-text-runs.js`
- `client/src/utils/export-pptx-basic-renderers.js`, `client/src/utils/exportPptx.js`
- Focused unit/component/browser/export tests

## Data and Runtime Contract

Use optional `BaseElement.action` metadata:

```js
{
  kind: 'url' | 'slide' | 'next' | 'previous' | 'first' | 'last' | 'email' | 'download',
  url?: string,
  slideId?: string,
  target?: 'same' | 'new',
  label?: string,
  hotspot?: boolean
}
```

- All valid actions are keyboard operable; there is no accessibility opt-out flag.
- `hotspot: true` makes the presentation activation surface visually transparent while retaining labelled focus and existing element geometry. The editor shows a selectable hotspot affordance and never activates it.
- URL/email/download fields are kind-specific. Unknown keys/kinds, unsafe schemes, malformed controls, or missing slide IDs normalize to inert/invalid with explicit feedback.
- Internal slide actions resolve stable slide IDs, including vertical children, to Reveal `(h,v)` coordinates. Never accept arbitrary selectors or scripts.
- URL/email/download with `target: new` use `noopener,noreferrer`; first/last/next/previous use the Reveal API.

## RED

- [x] Pure normalizer tests for all eight kinds, required/forbidden fields, unsafe schemes, injection payloads, unknown keys, legacy absence, and non-mutating normalization.
- [x] Properties/Format/context-menu tests for create/edit/clear, kind-specific fields, mixed selection, locks, validation errors, and parity between surfaces.
- [x] Canvas tests prove click/Enter/Space only selects/edits in editor mode and never calls navigation/open/download.
- [x] Shared HTML tests prove semantic anchor/button output, accessible label, focus style, safe serialized data, hotspot transparency, and invalid-action inertness.
- [x] Runtime tests resolve top-level/vertical slide IDs, missing targets, first/last/next/previous, same/new URL, email, and download behavior.
- [x] Offline HTML test activates all supported kinds with network disabled where the target is local.
- [x] PPTX tests prove native hyperlinks for rich text and only proven non-text renderers; every unsupported action emits a deterministic warning.

## GREEN

- [x] Add one dependency-free action normalizer/serializer consumed by client migration, controls, shared renderer, runtime, rich-text hyperlink export, and PPTX policy.
- [x] Add a shared Action section reused by Properties and Format; context menu opens/focuses the same editor rather than duplicating fields.
- [x] Render safe action data attributes/wrappers and one Reveal runtime dispatcher with event delegation and keyboard activation.
- [x] Resolve slide IDs against a generated immutable deck map; missing targets remain inert and warn once.
- [x] Preserve TipTap `openOnClick: false` and validate existing rich-text links before HTML/PPTX emission.
- [x] Probe PPTXGenJS shape/image hyperlink support with generated package inspection before enabling native mapping; otherwise flatten/fallback with warning.

## REFACTOR

- [x] Remove client/shared link-sanitizer drift and duplicate action switch statements.
- [x] Keep action dispatch out of canvas renderers and React editor state.
- [x] Keep the feature bounded: no arbitrary JavaScript, chained triggers, animation sequencing, hover actions, or external workflow engine.

## Focused Verification

```bash
npm test -- client/src/utils/url-safety.test.js client/src/utils/editor-presentation-migration.test.js
npm test -- client/src/components/PropertiesPanel.test.jsx client/src/components/ribbon/ribbon-format-tab-contextual-controls.test.jsx
npm test -- client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx
npm test -- shared/tests/element-renderers.test.js shared/src/shared-text-runs.test.js client/src/utils/exportPptx.test.js client/src/utils/offlineExport.test.js
```

Browser smoke: create visible actions and hotspots, verify editor inertness, enter presentation/preview/offline, activate with mouse/Enter/Space, traverse top-level and vertical slide targets, and inspect new-window opener isolation.

## Success Criteria

- [x] Every supported kind works in Reveal presentation and offline HTML.
- [x] Hotspots are transparent but keyboard-focusable and named in presentation; visible/selectable in edit mode.
- [x] Editor interactions never navigate or open URLs.
- [x] Unsafe/missing actions are inert and surfaced to the author.
- [x] Properties, Format, and context menu edit the same metadata contract.
- [x] PPTX behavior is native only where proven and warned everywhere else.

## Risks / Rollback

- Embedding raw JSON/URLs into HTML can create injection vulnerabilities. Serialize through the shared normalizer and escape at the attribute/script boundary.
- Invisible focus targets can be inaccessible. Always render a visible focus outline independent of element opacity.
- Rollback disables dispatcher/rendering while preserving action metadata; never strip unknown action fields from stored presentations.