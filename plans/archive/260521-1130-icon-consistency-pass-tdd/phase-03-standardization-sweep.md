---
phase: 3
title: "Standardization Sweep"
status: completed
priority: P2
effort: "2-3h"
dependencies: [1, 2]
---

<!-- Merged from old phase-04, phase-05, phase-06 per Red Team F4 (collapse to 4 phases). Format-tab align unify scoped to existing 3 actions per Red Team F11. -->
<!-- Updated: Validation Session 3 — 2026-05-21: dropped phase-numbered monolithic test file; co-located per project convention. -->

# Phase 3: Standardization Sweep

## Overview

All Medium/Low standardization fixes in one phase, one test file:

- **Issue #3 (High):** Insert/Embed `Pencil` dup — Add SVG → `FileImage` (Add drawing keeps `Pencil`).
- **Issue #4 (High):** Design Footer toggle `Layout` → `PanelBottom`. (Same-panel non-adjacent `Layout` dup at Loop+Presenter accepted per Validation Session 2 — invariant scoped to *adjacent* buttons.)
- **Issue #5 (Medium):** Slide-Size preset row — 4 buttons (`16:9 / 4:3 / Wide / Ultra`) all `MonitorSmartphone` → split into `Monitor / Square / MonitorPlay / MonitorSpeaker`.
- **Issue #6 (Medium):** Format tab align icons unified with Home/Arrange — **scoped to the 3 actions Format tab actually has** (`left`, `center-h`, `right`); top/middle/bottom/distribute stay Home/Arrange-only (Red Team F11). Test invariant: same action → same Lucide component reference across panels.
- **Issue #8 (Medium):** QuickAccessToolbar inline `<svg>` Undo/Redo → `Undo2`/`Redo2`.
- **Issue #9 (Low):** `BarChart2` (SelectionPane:12,27) → `BarChart3`.
- **Issue #10 (Low):** Bare `Image` lucide imports → `Image as ImageIcon` (`SelectionPane.jsx`, `MediaLibraryModal.jsx`).

## Requirements

### Functional
- Insert/Embed: Add SVG=`FileImage`, Add drawing=`Pencil` (kept), Add HTML=`Globe` (kept), Add divider=`Scissors` (kept). No two adjacent buttons share an icon.
- Design Footer toggle uses `PanelBottom`.
- 4 Slide-Size preset buttons each render a distinct icon (`Monitor`/`Square`/`MonitorPlay`/`MonitorSpeaker`).
- Kiosk-mode button (line 297) keeps `MonitorSmartphone` (orphan ok).
- Format tab Align Left/Center-h/Right render the SAME Lucide component refs as Home/Arrange (`AlignStartVertical` / `AlignHorizontalJustifyCenter` / `AlignEndVertical`).
- QuickAccessToolbar Undo button renders `Undo2`; Redo renders `Redo2`. No inline `<svg>` in the file.
- `BarChart2` zero usage in `client/src/**/*.{jsx,js}`.
- Every Lucide `Image` import in `client/src/**` uses `as ImageIcon`.

### Non-functional
- No layout shift > 1px in any affected panel.
- All tooltips, aria-labels, click handlers, disabled states unchanged.

## Architecture

### Affected files (verified)

| Issue | File | Change |
|---|---|---|
| #3 | `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:371` | Add SVG: `Pencil` → `FileImage` |
| #4 | `client/src/components/ribbon/design-tab-content.jsx:232` | Footer toggle: `Layout` → `PanelBottom` |
| #5 | `client/src/components/ribbon/design-tab-content.jsx:217` (SIZE_PRESETS map) | Add `icon` field per entry; render `<entry.icon size={12} />` |
| #6 | `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:295,303,311` | Align L/C-h/R: `AlignStartVertical/AlignCenterVertical/AlignEndVertical` → `AlignStartVertical/AlignHorizontalJustifyCenter/AlignEndVertical` |
| #8 | `client/src/components/QuickAccessToolbar.jsx:77,98` | Replace inline `<svg>` with `<Undo2 size={16} />` / `<Redo2 size={16} />` |
| #9 | `client/src/components/SelectionPane.jsx:12,27` | `BarChart2` → `BarChart3` |
| #10 | `client/src/components/SelectionPane.jsx:9,24`; `client/src/components/MediaLibraryModal.jsx:2` + every JSX `<Image ` usage in that file | Bare `Image` → `Image as ImageIcon`; rewrite JSX/map refs |

### SIZE_PRESETS implementation hint
`SIZE_PRESETS` is `[{label,w,h}, …]`. Add a per-entry `icon` field (Lucide component) and render `<entry.icon size={12} />` inside the existing `.map(...)`. Preserves iteration shape; no JSX restructure.

### Format tab align — invariant under test
Test imports the icon set from both `ribbon-format-tab-element-position-size-rotation-controls.jsx` and `ribbon/controls/arrange-controls.jsx`, then asserts `formatLeft === arrangeLeft && formatCenter === arrangeCenter && formatRight === arrangeRight` — by component identity, not by name string. Top/Middle/Bottom/Distribute are NOT asserted because Format tab does not have those buttons (verified: only 3 align buttons at lines 295/303/311). Issue #6 invariant codified as "for actions Format tab supports, icons match Home/Arrange".

### Lucide name probes
All target names verified present in `client/src/data/icon-paths.json` (1 hit each): `FileImage`, `PanelBottom`, `Monitor`, `Square`, `MonitorPlay`, `MonitorSpeaker`, `AlignHorizontalJustifyCenter`, `Undo2`, `Redo2`, `BarChart3`, `CopyPlus`, `Crosshair`. No fallbacks needed in the common path.

## Related Code Files

### Modify
- `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- `client/src/components/ribbon/design-tab-content.jsx`
- `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- `client/src/components/QuickAccessToolbar.jsx`
- `client/src/components/SelectionPane.jsx`
- `client/src/components/MediaLibraryModal.jsx`

### Create
- `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx` — Issue #3
- `client/src/components/ribbon/design-tab-content.test.jsx` — Issues #4 + #5
- `client/src/components/QuickAccessToolbar.test.jsx` — Issue #8
- `client/src/components/SelectionPane.test.jsx` — Issue #9 (and reflects Issue #10 alias rename)

### Append (existing test files)
- `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx` — append `describe('icon consistency pass — align identity', ...)` for Issue #6

### Covered by invariants (no new test)
- `client/src/components/MediaLibraryModal.jsx` — Issue #10 enforced by Phase 1 source-scan invariant (`Image as ImageIcon` everywhere)

## Implementation Steps

### TDD: Tests first
1. **Issue #3** — `ribbon-insert-tab-element-galleries-panel.test.jsx` (new): render Insert tab Embed section, assert Add SVG = `FileImage`, Add drawing = `Pencil`, no two adjacent Embed buttons share an icon.
2. **Issues #4 + #5** — `design-tab-content.test.jsx` (new): render Design tab; Footer button uses `PanelBottom`; the 4 SIZE_PRESETS preset buttons each have a distinct Lucide icon (`Monitor`/`Square`/`MonitorPlay`/`MonitorSpeaker`); Kiosk-mode button keeps `MonitorSmartphone`.
3. **Issue #6** — append `describe('icon consistency pass — align identity', ...)` to `ribbon-format-tab-element-position-size-rotation-controls.test.jsx`: import the icon refs used at lines 295/303/311 and the `ALIGN_ACTIONS` array from `arrange-controls.jsx`; assert `formatLeft === arrangeLeft && formatCenterH === arrangeCenterH && formatRight === arrangeRight` by component identity.
4. **Issue #8** — `QuickAccessToolbar.test.jsx` (new): render component; Undo button has `Undo2` SVG; Redo has `Redo2`; assert no inline `<svg>` outside Lucide-rendered SVG; `disabled` attribute and class preserved across icon swap.
5. **Issue #9** — `SelectionPane.test.jsx` (new): render with chart + image elements; chart row uses `BarChart3`; image row uses `ImageIcon` (alias) — verifies Issue #10 alias rename in this file too.
6. Run — every new file fails; appended describe in Format tab test fails.

### Implementation
7. Update Insert/Embed: import `FileImage`, swap `<Pencil />` → `<FileImage />` for the Add SVG button.
8. Update Design tab: import `PanelBottom`, swap `<Layout />` → `<PanelBottom />` for Footer toggle (line 232). Update SIZE_PRESETS — add `icon` field per entry; rewrite render to `<entry.icon size={12} />`. Import `Monitor`, `Square`, `MonitorPlay`, `MonitorSpeaker`.
9. Update Format tab: replace `AlignCenterVertical` with `AlignHorizontalJustifyCenter` in the import + JSX at line 303.
10. Update QuickAccessToolbar: import `Undo2, Redo2`; delete inline `<svg>` JSX at lines 77 and 98; replace with `<Undo2 size={16} />` / `<Redo2 size={16} />` — match peer `Save` icon size.
11. Update SelectionPane: swap `BarChart2` → `BarChart3` (import line 12, TYPE_ICONS line 27); change bare `Image` to `Image as ImageIcon` (line 9 import + line 24 map ref).
12. Update MediaLibraryModal: change `Image` → `Image as ImageIcon` in line-2 import; rewrite `<Image ...>` JSX to `<ImageIcon ...>` everywhere in the file (1 site verified via grep).

### Green
13. `npm run lint` clean.
14. `npm run test -- ribbon-insert-tab-element-galleries-panel design-tab-content ribbon-format-tab-element-position-size-rotation-controls QuickAccessToolbar SelectionPane` all pass.
15. `npm run test -- icon-policy-invariants` — remaining 3 `it` blocks (`QuickAccessToolbar inline svg`, `BarChart2 zero`, `Image alias`) flip green. Combined with Phase 2's flips, all 5 invariant `it`s now pass.
16. Manual smoke: Insert tab Embed row, Design tab Footer + Slide Size, Format tab Align section, QuickAccessToolbar undo/redo, SelectionPane with chart element, MediaLibraryModal with image media.

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| `ribbon-insert-tab-element-galleries-panel.test.jsx` (new) | Vitest component | Issue #3: Add SVG = `FileImage`, Embed adjacent dedup |
| `design-tab-content.test.jsx` (new) | Vitest component | Issues #4 + #5: Footer = `PanelBottom`, 4 distinct preset icons, Kiosk = `MonitorSmartphone` |
| `ribbon-format-tab-element-position-size-rotation-controls.test.jsx` (append) | Vitest component | Issue #6: align L/C-h/R component identity matches `arrange-controls.jsx` |
| `QuickAccessToolbar.test.jsx` (new) | Vitest component | Issue #8: Undo2/Redo2 render, no inline `<svg>`, disabled state preserved |
| `SelectionPane.test.jsx` (new) | Vitest component | Issue #9 + part of #10: chart row = `BarChart3`, image row = `ImageIcon` |
| `icon-policy-invariants.test.js` | Vitest source-scan | Final 3 of 5 `it` blocks flip green (Issue #10 MediaLibraryModal covered here) |

## Success Criteria

- [x] Insert/Embed Add SVG and Add drawing render distinct icons; no adjacent dup
- [x] Design Footer uses `PanelBottom`
- [x] 4 SIZE_PRESETS preset buttons each render distinct Lucide icons
- [x] Format tab Align L/C-h/R icons match Home/Arrange refs (component identity)
- [x] QuickAccessToolbar has no inline `<svg>`; Undo/Redo render Lucide icons
- [x] `BarChart2` zero usage in `client/src/**`
- [x] All Lucide `Image` imports use `Image as ImageIcon` (incl. MediaLibraryModal — covered by invariants)
- [x] All `icon-policy-invariants` `it` blocks pass

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Some target Lucide names missing in installed lucide-react | Verified present in `icon-paths.json`; all 1 hit each |
| `Image` rename collision with non-Lucide imports | None — npm grep confirms only `lucide-react` raw `Image` imports in `MediaLibraryModal.jsx:2` and `SelectionPane.jsx:9` |
| Same-panel non-adjacent `Layout` dup (Loop+Presenter slide menu) | Accepted as out of scope per Validation Session 2; invariant scoped to *adjacent* buttons |
| Format tab missing top/middle/bottom/distribute buttons (Home/Arrange has 8, Format has 3) | Test asserts equality only for the 3 shared actions; documented in phase notes (Red Team F11) |
| Inline-SVG removal breaks disabled-state styling on Undo/Redo | Test asserts `disabled` attribute and class kept; Lucide inherits color/stroke from existing Tailwind classes |

## Notes

- Original phase-04, phase-05, phase-06 collapsed into this single phase (Red Team F4 accepted).
- Issue #6 scoped to existing Format-tab actions (Red Team F11 accepted) — rejected the implicit scope creep of "add 5 buttons to Format tab" reading.
- Format tab icon `AlignCenterVertical` becomes `AlignHorizontalJustifyCenter` purely so the same Lucide component references the same logical action across panels (icon-identity invariant).
