---
phase: 4
title: "Element Render Fidelity"
status: complete
priority: P2
effort: "2d"
dependencies: []
---

# Phase 4: Element Render Fidelity

## Overview
Close editor↔export divergences: shapes that draw wrong on canvas, the `'auto'`
color sentinel not resolved in several JSX renderers, timeline event images
dropped on export, and the `game` element silently dropped. Builds the shared
renderers that Phase 5's stop-throw fix depends on.

## Findings Covered
- **I-R1.1** — 7 shapes (hexagon/pentagon/cloud/cylinder/parallelogram/trapezoid/bracket) draw as `<rect>` on canvas but correct on export.
- **I-R1.2** — `'auto'` sentinel not resolved in icon/line/drawing/callout/timeline/text JSX renderers → invisible/wrong color in editor, theme not applied.
- **I-R1.3** — timeline event images dropped on export (`renderTimeline` emits no image).
- **I-R1.4** — `game` element dropped on export (no `RENDERERS` entry, `renderElement` returns `''`).
- **M-R1×4** — `renderSvg` fill replace over-broad/misses `style="fill:"`; gradient `stop.offset` convention mismatch bg vs shape; dead `color:white` in `renderText`; line marker id collision from `id.slice(0,8)`.

## Requirements
- Functional: every canonical element type renders identically (within static
  limits) on canvas and in exported reveal.js HTML; no type silently produces empty output.
- Non-functional: reuse `resolveColorField` everywhere; no duplicate shape geometry source.

## Architecture

### I-R1.1 — shape parity
`client/src/components/canvas/element-renderers/shape-element-renderer.jsx:90-165`
handles only 6 shapes; export `shared/src/shapeUtils.js:126-187` handles 13.
Canvas should consume the SAME geometry source as export (import shapeUtils path
generators) so adding a shape updates both. Eliminates the divergence class, not
just the 7 instances (DRY).

### I-R1.2 — `'auto'` resolution
Default ships `'auto'`; `element-factory.js:25-32` stores it raw. Export resolves
via `resolveColorField`; these JSX renderers take raw and emit invalid
`stroke="auto"`/`fill="auto"`/`color:auto`:
- `icon-element-renderer.jsx:5`, `line-element-renderer.jsx:69`,
  `drawing-element-renderer.jsx:16`, `callout-element-renderer.jsx:4`,
  `timeline-element.jsx:15-17`, `canvas-element-wrapper.jsx:118` (text).
Apply `resolveColorField` at each read site (reuse helper; do not re-implement).
(shape + table already correct — confirm, don't double-fix.)

### I-R1.3 — timeline images on export
`shared/src/element-renderers.js:590-609` `renderTimeline` emits line/circle/text
only. Add `<image href={item.image}>` emission matching canvas
`timeline-element.jsx:130-155` (sanitize/escape href; honor connectorOffset if present).

### I-R1.4 — game static export renderer
Decision (locked): write a REAL static representation. Add a `game` entry to
`RENDERERS` (`element-renderers.js:654-673`) that emits a labeled static snapshot
(title + type badge + question count or first question), never `''`, never throw.
Interactive runtime is not exported; the static block stands in.

### Mediums
- M1 `renderSvg:514-516`: scope fill replace to root attrs, leave gradient defs;
  also handle `style="fill:"`.
- M2: unify gradient `stop.offset` convention between `htmlGenerator.js:27` and
  `shapeUtils.js:89`.
- M3: remove dead `color:white` in `renderText:141`.
- M4: line marker id from full id (or hash) not `slice(0,8)` to avoid collision (`element-renderers.js:480`).

## Related Code Files
- Modify: `shared/src/element-renderers.js`, `shared/src/shapeUtils.js`, `shared/src/htmlGenerator.js`
- Modify: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx`, `icon-element-renderer.jsx`, `line-element-renderer.jsx`, `drawing-element-renderer.jsx`, `callout-element-renderer.jsx`
- Modify: `client/src/components/timeline-element.jsx`, `canvas-element-wrapper.jsx`
- Reference (read): `client/src/data/element-defaults.js`, `client/src/components/canvas/element-renderers/registry.js`, `shared/tests/bug-fixes-element-renderers.test.js`
- Create: `shared/tests/element-export-parity.test.js`, `client/src/components/canvas/element-renderers/auto-color-resolution.test.jsx`

## TDD — Tests First
1. **I-R1.1**: render hexagon on canvas → produces hexagon geometry, not `<rect>` (red).
2. **I-R1.2**: element with `color:'auto'` under a theme → resolved color, no literal `auto` in output (red, per renderer).
3. **I-R1.3**: timeline with event image → export HTML contains the image (red).
4. **I-R1.4**: export a slide with a `game` element → non-empty static block, no throw (red).
5. **Registry parity**: assert every `ELEMENT_DEFAULTS` type has a shared renderer.

## Implementation Steps
1. Write failing tests 1–5.
2. Shape geometry unification → test 1.
3. `resolveColorField` at each raw site → test 2.
4. Timeline image emission → test 3.
5. Game static renderer → test 4; registry parity → test 5.
6. Mediums M1–M4.

## Success Criteria
- [x] Tests 1–5 green.
- [x] No JSX renderer emits literal `auto` as a color value.
- [x] Every canonical type has a shared renderer (parity test enforces).
- [x] `npm run test` shared + client renderer suites green.

## Red-Team Amendments (2026-06-11)

- **I-R1.1 — DROP the "unify geometry source" refactor (Medium, scope cut).**
  Canvas builds JSX SVG elements; `shapeUtils.js:102-208` builds SVG *strings* —
  incompatible representations, geometry inlined in both. There is no shared
  source to unify; the plan's own risk note admits it can regress the 6
  already-correct shapes. **Just add the 7 missing `case` branches** to
  `shape-element-renderer.jsx:90-164` (hexagon/pentagon/cloud/cylinder/
  parallelogram/trapezoid/bracket), mirroring `shapeUtils` path math. YAGNI — no
  abstraction. Test 1 unchanged.

- **I-R1.4 — game renderer is a labeled placeholder, NOT a content snapshot
  (Medium, scope cut).** The only requirement (from I-R3.3) is "never throw".
  Precedent exists: `renderPluginFallback` (`element-renderers.js:633-637`). Game
  holds heterogeneous sub-configs (`element-defaults.js:224-249`) with no uniform
  "question" field, so "question count / first question" is gold-plating that
  breaks across game types. **Emit a labeled static box** (title + game-type
  badge) only. Test 4 asserts non-empty + no-throw, not specific content.

- **I-R3.2 cite correction (for Phase 5 handoff).** Server image-opacity span is
  `~:42-86`, not `:42-98`; shape already maps opacity at `:104-107`. Narrow the
  Phase 5 fix to the image branch only.


  output subtly. *Mitigation:* snapshot before/after for the 6 already-handled shapes; only the 7 missing should change.
- **Risk:** `resolveColorField` at text site changes legit explicit colors.
  *Mitigation:* helper is identity for non-`auto` values; test explicit color unchanged.
- **Risk:** game static renderer scope-creep into rendering interactive UI.
  *Mitigation:* static snapshot ONLY (title/type/first-question); no JS.
