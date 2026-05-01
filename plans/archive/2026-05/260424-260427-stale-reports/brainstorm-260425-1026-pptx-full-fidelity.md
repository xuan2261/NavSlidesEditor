# Brainstorm Report: pptxtojson Full-Fidelity Integration

**Date:** 2026-04-25 | **Author:** Claude Code Brainstorming Agent | **Plan:** `plans/260425-1026-pptx-full-fidelity/`

---

## 1. Problem Statement

NavSlides Editor Phase 1 PPTX import (shipped 2026-04-24) uses `pptxtojson@2.0.2` as primary parser but the mapper (`server/services/pptx-import/mapper.js`) extracts only the minimum data — causing 60-100% data loss across all element types. The import is effectively a "preview skeleton" with placeholders for most content.

## 2. pptxtojson Capabilities (What It Provides)

pptxtojson v2.0.2 outputs rich, structured data for 10 element types:
- **Text:** Rich HTML with inline CSS (bold, italic, underline, color, font-size, alignment, lists, hyperlinks)
- **Shape:** `shapType` (100+ presets), custom SVG paths, fill (solid/gradient/image/pattern), stroke, shadow, rotation, flip
- **Image:** Base64, crop (`srcRect`), filters (brightness, contrast, saturation), border, hyperlink
- **Table:** Cell data with rowSpan/colSpan, per-cell fill/font/borders, row heights, column widths
- **Chart:** 15 types (line, bar, pie, doughnut, area, scatter, bubble, radar, stock, 3D variants) with full data series
- **Math:** OMML → LaTeX conversion (fractions, matrices, radicals, etc.)
- **Diagram/SmartArt:** Text nodes extracted from diagram XML
- **Group:** Nested children with relative coords, transforms (rotation, flip, scale)
- **Video/Audio:** Blob URLs for embedded media
- **Slide:** Background (gradient/image/pattern), transition (type/duration/direction), speaker notes

3 dependencies only: jszip, tinycolor2, txml. Client-side or Node.js.

## 3. Current Data Losses

| Element | Loss | Root Cause |
|---|---|---|
| Text formatting | 100% | `plainText()` strips all HTML; no font/color/size extraction |
| Shape type | ~70% | `shapeName()` only maps 6 types; 14+ → 'rect' |
| Line coords | 100% | Hardcoded horizontal: `x1=0, y1=h/2, x2=w, y2=h/2` |
| Image metadata | ~60% | `objectFit` always 'contain'; crop/flip/border lost |
| Table cell styling | ~90% | All cells → plain text; no colSpan/rowSpan/colors |
| Gradient fill | 100% | `colorValue()` only handles 'color' type |
| Group children | 100% | Replaced by placeholder |
| Chart/Code/Callout/Icon/QR/LaTeX | 100% | Replaced by placeholder |
| Slide transition | 100% | Not extracted |
| Slide background | ~60% | Only solid color; gradient/image → transparent |

## 4. Goals

- **Full fidelity** — extract maximum data from pptxtojson output
- **Editable after import** — user can edit all imported content in the NavSlides editor
- **Charts supported** — interactive Chart.js charts with editable data
- **~95% round-trip** — import → edit → export PPTX should match original structure

## 5. Approaches Evaluated

### Approach A: Fix Mapper Only (Minimal)
Quick wins only. Fix text, shape, line. No new element types.
- Pros: Fast, low risk
- Cons: Charts, groups, SmartArt remain placeholders
- **Rejected** — user wants full fidelity

### Approach B: Tier-by-Tier Sequential (Recommended)
Phase 1: Text + Shape + Line + Image
Phase 2: Table + Slide metadata + Group + SmartArt
Phase 3: Charts
Phase 4: Round-trip testing
- Pros: Manageable scope per phase, clear dependencies
- Cons: 3 weeks total
- **Selected** — matches user preference

### Approach C: Full Rewrite
Replace mapper with comprehensive converter handling all types at once.
- Pros: Cleanest architecture
- Cons: High risk, long development, hard to validate incrementally
- **Rejected** — too large a scope

## 6. Final Design

### Sequential Phases (7 total)

| Phase | Content | Effort | Deliverable |
|---|---|---|---|
| 1 | HTML → TipTap JSON, 20+ shape types, line coords, image metadata | 2-3 days | Rich text editable after import |
| 2 | Enhanced Shape/Line/Image mapping | 2-3 days | All shape types, real lines, image metadata |
| 3 | Table: merged cells, per-cell styling, borders | 2 days | Full table editability |
| 4 | Slide transitions, gradient backgrounds, notes, metadata | 1-2 days | Transitions + backgrounds |
| 5 | Group flattening, SmartArt → elements/SVG | 2-3 days | Groups + SmartArt editable |
| 6 | Chart component (Recharts), data mapper | 3-4 days | Interactive charts |
| 7 | Round-trip fidelity testing, corpus, benchmarks | 3-4 days | 95% fidelity validation |

**Total: ~3 weeks**

### Key Modules

| Module | Purpose |
|---|---|
| `html-to-tiptap.js` | Convert pptxtojson HTML output to TipTap JSON |
| `chart-mapper.js` | Map pptxtojson chart data → NavSlides schema |
| `group-flattener.js` | Flatten nested groups with transforms |
| `smartart-converter.js` | Convert SmartArt → individual elements |
| `fidelity-tester.js` | Automated round-trip comparison |

### Text Representation Decision
**TipTap JSON (Option A)** — NavSlides already uses TipTap. Requires `htmlToTiptap()` converter (~150 LOC). Best for round-trip fidelity and native editing.

### Chart Decision
**Interactive Chart.js (Option A)** — Keep existing iframe approach. Focus on data fidelity (85%). Pixel-perfect rendering impossible without PowerPoint engine.

## 7. Realistic Fidelity Targets

| Element | Target | Why |
|---|---|---|
| Text | 98% | TipTap JSON preserves all formatting |
| Shapes | 95% | Custom paths may differ |
| Lines | 95% | Connectors are edge case |
| Images | 100% | Base64 preserved exactly |
| Tables | 90% | Merged cells complex |
| Charts | 85% | Data accurate, rendering differs |
| Groups | 90% | Transforms may have edge cases |
| SmartArt | 80% | Complex layouts simplified |

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| htmlToTiptap edge cases | Try/catch + plain text fallback |
| Chart rendering ≠ PowerPoint | Document: data fidelity goal, not pixel-perfect |
| pptxtojson data gaps | Validate + placeholder with warning |
| Export side needs updates | Backward compat for HTML string content |
| Performance (100+ slides) | 60s timeout guard already in place |

## 9. Unresolved Questions

1. Does TipTap editor support `fontSize`/`fontFamily` as marks (vs inline styles)?
2. Does pptxtojson output `colSpan`/`rowSpan` reliably for all merged cells?
3. Does pptxtojson handle embedded charts with external data links?
4. Does `identifyShape()` handle all 100+ PPTX preset shapes?

---

**Status:** Plan created at `plans/260425-1026-pptx-full-fidelity/`
**Next:** User approval → `/ck:cook` with plan context
