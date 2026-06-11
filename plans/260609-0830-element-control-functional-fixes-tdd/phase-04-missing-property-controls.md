---
phase: 4
title: "Missing Property Controls"
status: completed
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4: Missing Property Controls

## Overview
Add controls for properties the renderer already consumes but no UI exposes.
These are "incomplete feature" gaps — the render support exists, the control is
missing. New controls adopt the Phase 3 indeterminate pattern.

## Defects Addressed
- **P1-SAT** — image: renderer applies `saturate()` from `filterSaturate`
  (`canvas-element-wrapper.jsx:167`); no slider in `image-properties.jsx`.
- **P1-CHART-AREA** — chart: renderer reads `element.areaFill`
  (`chart-element-renderer.jsx:5`); no control.
- **P1-CHART-STACK** — chart: renderer reads `element.stacked`
  (`chart-element-renderer.jsx:6`); no control.
- **P1-TBL-HDRTXT** — table: renderer applies `headerTextColor`
  (`table-element-renderer.jsx:40`); no control.
- **P1-TBL-BORDER** — table: renderer uses `borderStyle` via `safeBorderStyle`
  (`table-element-renderer.jsx:15`); no solid/dashed/dotted control.
- **P1-SVG-EDIT** — svg: renderer reads `element.content` (raw markup)
  (`svg-element-renderer.jsx:3`); no editor to change it post-creation.
- **P1-TL-CONN** (decision 3, LOW) — timeline per-event connector: renderer reads
  `item.connectorLength` (`timeline-element.jsx:66`); no per-event control. NOTE:
  the renderer key is `connectorLength`, NOT `connectorOffset` (the decision/defint
  text) — write `connectorLength` (red-team m3).
- **P0-PANEL-OPACITY** (pulled in from Phase 3 M4) — non-shape types have NO panel
  opacity control (only the ribbon exposes opacity; shape-properties has it for
  shape/line). After Phase 1 makes opacity render for all types, a generic panel
  opacity slider for non-shape types is still missing. Add it in
  `common-element-controls.jsx` so opacity is panel-editable for every type;
  adopt Phase 3 indeterminate.

## Requirements
- Functional: each listed prop becomes user-editable via its panel; edits render
  live. Saturation mirrors the existing brightness/contrast slider pattern. Chart
  area/stacked are checkboxes (area shown only for line charts). Table header text
  color + border style selects. SVG content editable via a modal/textarea (mirror
  html/latex edit-button pattern). Timeline connector is a per-event numeric input.
- Non-functional: new controls adopt Phase 3 indeterminate pattern; reuse existing
  control components (ColorPicker, Select, slider) — DRY.

## Architecture
- Mirror existing patterns in each sub-panel; no new infrastructure.
- `image-properties.jsx`: add Saturation slider next to brightness/contrast/grayscale.
- `chart-properties.jsx`: add "Fill area under line" checkbox (gate `chartType==='line'`) + "Stacked" checkbox.
- `table-properties.jsx`: add Header Text Color picker (beside Header BG) + Border
  Style select (solid/dashed/dotted).
- `misc-properties.jsx` (svg branch): add an Edit-SVG affordance updating
  `element.content`. **Harden injection (red-team m6):** `svg-element-renderer.jsx:6-13`
  interpolates `fillOverride`/`strokeOverride` into `fill="…"`/`stroke="…"` via
  regex BEFORE `sanitizeSvgContent` — a value like `red" onload="…` can break out
  of the attribute. Validate `fillOverride`/`strokeOverride` against a color
  allowlist at the renderer; ensure the SVG-content editor output passes through
  `sanitizeSvgContent`. Do NOT add an unsanitized passthrough.
- `timeline-properties.jsx`: add per-event "Connector length" numeric input writing
  `connectorLength` (the key the renderer reads — red-team m3).
- **Generic panel opacity (P0-PANEL-OPACITY, from Phase 3 M4):** add an opacity
  slider to `common-element-controls.jsx` so opacity is panel-editable for ALL
  types (not just shape/line + ribbon). Adopt the Phase 3 `computeMixedValues`
  indeterminate pattern.

## Related Code Files
- Modify: `client/src/components/properties/image-properties.jsx`
- Modify: `client/src/components/properties/chart-properties.jsx`
- Modify: `client/src/components/properties/table-properties.jsx`
- Modify: `client/src/components/properties/misc-properties.jsx` (svg branch)
- Modify: `client/src/components/canvas/element-renderers/svg-element-renderer.jsx` (color allowlist for overrides ~6-13)
- Modify: `client/src/components/properties/timeline-properties.jsx`
- Modify: `client/src/components/properties/common-element-controls.jsx` (generic opacity slider + indeterminate)
- Possibly modify: `client/src/pages/EditorPage.jsx` (svg edit modal wiring, if reusing html/latex modal)
- Create: per-panel tests or extend existing `*-properties.test.jsx`

## Implementation Steps (TDD)
1. **Test first (saturation):** ImageProperties renders a saturation slider that
   writes `filterSaturate`; renderer applies it. Implement; green.
2. **Test first (chart area/stacked):** ChartProperties renders area checkbox
   (line only) + stacked checkbox writing `areaFill`/`stacked`. Implement; green.
3. **Test first (table header text + border):** TableProperties renders
   headerTextColor picker + borderStyle select; renderer reflects them. Implement; green.
4. **Test first (svg edit + hardening, m6):** svg branch renders an edit affordance
   that updates `element.content`; renderer re-renders new markup AND
   `fillOverride='red" onload="alert(1)'` does NOT produce an executable attribute
   (allowlist rejects / sanitize strips). Implement editor + color allowlist; green.
   (Confirm reuse of html/latex modal vs textarea first.)
5. **Test first (timeline connector, LOW):** event editor renders per-event
   connector-length input writing `connectorLength` (the key the renderer reads —
   m3); rendered connector position changes. Implement; green.
6. **Test first (panel opacity, P0-PANEL-OPACITY):** common-element-controls renders
   an opacity slider for a non-shape type (e.g. text) that writes `opacity`;
   mixed selection → indeterminate (Phase 3 pattern). Implement; green.
7. **Indeterminate:** new multi-applicable controls (saturation, colors, panel
   opacity) adopt the Phase 3 `computeMixedValues` pattern. Add a mixed test for
   saturation + panel opacity.
8. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] Saturation, chart area+stacked, table headerTextColor+borderStyle, svg content editor, timeline connector (`connectorLength`) all editable + render live
- [ ] Generic panel opacity slider works for all types (P0-PANEL-OPACITY) with indeterminate
- [ ] SVG override injection hardened (color allowlist + sanitize); no executable attribute escape
- [ ] New controls use Phase 3 indeterminate pattern where multi-applicable
- [ ] No regression to existing property-panel suites; lint clean

## Risk Assessment
- **Risk:** svg content editor — XSS via raw markup injection. **Mitigation:**
  sanitize on render (svg renderer should already sanitize; verify) — do NOT add
  an unsanitized passthrough. Flag if sanitization absent.
- **Risk:** reusing html/latex modal for svg may not fit. **Mitigation:** verify
  modal genericity first (step 4); fall back to textarea if not.
- **Risk:** timeline connector aliasing (`connectorOffset` vs `connectorLength`).
  **Mitigation:** write the key the renderer actually reads; test the rendered position.
