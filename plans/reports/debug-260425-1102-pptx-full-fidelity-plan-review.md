---
title: "PPTX Full Fidelity Plan Review"
description: "Debug-style review of plans/260425-1026-pptx-full-fidelity/plan.md against current NavSlides codebase."
status: completed
created: "2026-04-25"
sourcePlan: "plans/260425-1026-pptx-full-fidelity/plan.md"
reviewType: "debug-plan-review"
---

# PPTX Full Fidelity Plan Review

## Executive Summary

- **Issue:** Plan target good, but implementation details not safe to run as-is.
- **Impact:** High. Several phases can break editor/export schema or produce false fidelity results.
- **Root cause:** Plan assumes TipTap JSON / rich schema support that current codebase does not use consistently.
- **Status:** Reviewed. Needs plan revision before implementation.
- **Recommendation:** Revise Phase 1, 2, 3, 6, 7 before coding.

## Scope

- Reviewed plan: `plans/260425-1026-pptx-full-fidelity/plan.md`
- Reviewed phases: `phase-01` through `phase-07`
- Compared with current import/export/editor code and Phase 1 import baseline.
- Method: `ck:debug` evidence-first review, no code changes.

## Findings

### P0 - Text Schema Decision Conflicts With Current Runtime

Plan chooses `element.content = TipTap JSON`, but current app treats text content as HTML string.

Evidence:
- `shared/src/types/presentation.js` defines `TextElement` as `{ content: string }`.
- `client/src/pages/EditorPage.jsx` saves text via `editor.getHTML()`.
- `client/src/components/SlideCanvas.jsx` renders text with `dangerouslySetInnerHTML`.
- `client/src/utils/export-pptx-basic-renderers.js` exports text by passing `element.content` into `htmlToPptTextRuns()`.

Risk:
- Updating only export parser is insufficient.
- Breaks editor preview, thumbnails, find/replace, templates, markdown import, shared HTML export, and PPTX export consumers.

Recommendation:
- Keep HTML string as canonical for now.
- Improve sanitizer + HTML parser + PPTX text run export.
- If TipTap JSON is required, add separate schema migration phase first.

### P0 - Sanitizer Drops Formatting Phase 1 Wants To Preserve

Plan wants links, strike, subscript, superscript, text-decoration, vertical-align.
Current sanitizer strips many of those before conversion.

Evidence:
- `server/services/pptx-import/sanitize.js` allows tags: `p`, `span`, `strong`, `em`, `b`, `i`, `u`, `br`, `ul`, `ol`, `li`, `h1`, `h2`, `h3`.
- Allowed attrs only `style`; no `href`.
- Safe styles omit `text-decoration`, `vertical-align`, `background`, `letter-spacing`, `text-shadow`.

Risk:
- Data loss happens before `htmlToTiptap()` or export parser sees content.
- Link import cannot work with current sanitizer rules.

Recommendation:
- Update sanitizer first.
- Allow safe `a[href]`, `s/strike/del`.
- Add guarded style props needed by pptxtojson output.
- Keep URL protocol validation strict.

### P1 - Shape Target Overstates Existing Renderer/Exporter Support

Plan targets 20+ mapped shapes. Current shared renderer/export support is narrower.

Evidence:
- `shared/src/shapeUtils.js` supports about 15 shape ids.
- `client/src/utils/export-pptx-core.js#getShapeType()` maps a limited set to pptxgenjs shapes.

Risk:
- Mapper may emit shapes that render/export as `rect`.
- Claimed 95% shape fidelity likely false unless render/export are expanded too.

Recommendation:
- Split shape phase into:
  1. Supported native shapes.
  2. Custom/path shapes as `svg` fallback.
  3. Export mapping tests per shape.
- Do not claim 20+ editable shapes until shared renderer and PPTX export support them.

### P1 - Table Schema Requires Renderer, Editor, Export Work

Plan adds `cellStyles`, `mergedCells`, row/col sizing, borders. Current table stack is simple string matrix.

Evidence:
- `client/src/components/SlideCanvas.jsx#TableRenderer` uses `element.data` only.
- `client/src/components/properties/table-properties.jsx` edits simple cells only.
- `client/src/utils/export-pptx-basic-renderers.js#addTableElement()` exports uniform styles.

Risk:
- Imported metadata can be stored but not visible/editable/exported.
- Phase effort estimate of 2 days likely low.

Recommendation:
- Add explicit subtasks for canvas renderer, properties panel, export, thumbnails/shared renderers.
- Support merge rendering with `rowSpan`/`colSpan` before claiming table fidelity.

### P1 - Chart Editing Scope Is Underestimated

Plan says existing chart properties can edit chart data/colors, but current panel edits only first dataset.

Evidence:
- `client/src/components/properties/chart-properties.jsx` reads/writes `(datasets || [])[0]`.
- `client/src/utils/export-pptx-core.js#isNativeChartType()` supports only `bar`, `doughnut`, `line`, `pie`, `radar`.

Risk:
- Multi-series chart import can render but not be fully edited.
- Unsupported imported types silently degrade to bar/line approximations.

Recommendation:
- Add multi-series chart editor scope.
- Define fidelity as data fidelity, not visual parity.
- Store original pptx chart metadata under `_pptx` sidecar if needed.

### P1 - Fidelity Test Can Produce False Positives

Phase 7 compares import → export → re-import JSON. If import loses data, re-import can still match the lossy state.

Evidence:
- `phase-07-round-trip-fidelity-testing.md` diff starts after first import.
- Original pptxtojson output is not used as baseline in the proposed metric.

Risk:
- Report can claim high fidelity while original PPTX fidelity is low.

Recommendation:
- Compare against original `pptxtojson` semantic output first.
- Then compare exported re-import output as round-trip stability.
- Keep separate metrics:
  - original-to-import fidelity
  - import-to-export stability
  - visual spot-check score

### P2 - Slide Metadata Needs Schema Clarification

Plan wants per-slide transitions, notes as TipTap JSON, original size, theme colors.

Evidence:
- Shared presentation has global `presentation.transition`.
- Slide schema allows `background` passthrough, but notes currently string.
- Presentation `resolution` already exists in client/export paths.

Risk:
- Per-slide transition fields may be stored but not honored by reveal.js export.
- Notes as TipTap JSON repeats the text schema issue.

Recommendation:
- Preserve notes as sanitized HTML or plain string unless full notes editor/export is migrated.
- Map `output.size` to `presentation.resolution`, not only `_pptxMeta.originalSize`.
- Document which metadata is display-only vs export-active.

### P2 - Groups/SmartArt Need Array Return Contract In Mapper

Plan says `mapElement()` should return flattened arrays for groups and diagrams.
Current mapper assumes one mapped object per source object.

Evidence:
- `server/services/pptx-import/mapper.js` pushes `mapped` directly into `elements`.
- Placeholder count logic assumes a single element.

Risk:
- Flattened groups require mapper loop contract changes.
- z-index/stat/warning logic can break if not updated.

Recommendation:
- Change mapper contract to normalize `mapElement()` result into array.
- Add tests for stats and zIndex with multi-output elements.

## Recommended Plan Revision

### Immediate P0

- [ ] Replace TipTap JSON canonical decision with HTML canonical + parser/export improvements.
- [ ] Update sanitizer requirements before `htmlToTiptap`/HTML parser work.
- [ ] Add schema compatibility audit section to Phase 1.
- [ ] Define exact fidelity metrics before Phase 7.

### Short-Term P1

- [ ] Split shape/table/chart phases into mapper + renderer + editor + export + tests.
- [ ] Add shared renderer and thumbnail impact to related files.
- [ ] Add `layoutElements` handling or explicitly defer with warning.
- [ ] Add `presentation.resolution` mapping from PPTX size.

### Long-Term P2

- [ ] Keep `_pptx` sidecar metadata for lossy features.
- [ ] Add visual diff tooling only after semantic diff is reliable.
- [ ] Keep sensitive real-world corpus local or document redaction policy.

## Suggested Revised Phase Order

1. **Schema Compatibility + Sanitizer Hardening**
2. **Rich HTML Preservation + PPTX Text Export**
3. **Image/Line/Supported Shape Fidelity**
4. **Chart Data Import + Multi-Series Editor**
5. **Table Rendering/Export Upgrade**
6. **Slide Metadata + Resolution**
7. **Groups/SmartArt Flattening/Fallback**
8. **Fidelity Harness + Corpus**

## Evidence Links

- Plan overview: `plans/260425-1026-pptx-full-fidelity/plan.md`
- Text phase: `plans/260425-1026-pptx-full-fidelity/phase-01-enhanced-text-extraction.md`
- Shape phase: `plans/260425-1026-pptx-full-fidelity/phase-02-shape-line-image-enhancement.md`
- Table phase: `plans/260425-1026-pptx-full-fidelity/phase-03-table-full-support.md`
- Chart phase: `plans/260425-1026-pptx-full-fidelity/phase-06-chart-component.md`
- Fidelity phase: `plans/260425-1026-pptx-full-fidelity/phase-07-round-trip-fidelity-testing.md`
- Current mapper: `server/services/pptx-import/mapper.js`
- Sanitizer: `server/services/pptx-import/sanitize.js`
- Shared presentation types: `shared/src/types/presentation.js`
- Shape renderer: `shared/src/shapeUtils.js`
- PPTX export core: `client/src/utils/export-pptx-core.js`
- PPTX basic renderers: `client/src/utils/export-pptx-basic-renderers.js`
- Canvas renderer: `client/src/components/SlideCanvas.jsx`

## Unresolved Questions

- Keep HTML canonical, or accept large migration to TipTap JSON?
- Corpus PPTX can be committed, or must stay local/private?
- Target 95% means semantic fidelity, visual fidelity, or round-trip stability?
- Should unsupported shapes become editable SVG, locked SVG, or native rect fallback?
- Should per-slide transitions be supported in export, or only preserved as metadata?
