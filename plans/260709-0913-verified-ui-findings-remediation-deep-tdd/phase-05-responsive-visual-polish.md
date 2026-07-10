---
phase: 5
title: "Responsive Visual Polish"
status: pending
priority: P2
dependencies: [1, 2]
effort: "0.5-1 dev-day"
---

# Phase 5: Responsive Visual Polish

## Overview

Address the verified responsive and structural-icon polish findings after the core accessibility contracts exist: TemplatePicker grid, Media Library toolbar, slide thumbnail placeholder glyphs, and lock indicators.

## Requirements

- Functional: TemplatePicker grid adapts from one column on small screens to four columns on large screens.
- Functional: Media Library toolbar stacks or wraps at narrow viewport widths without horizontal overflow.
- Functional: structural emoji/glyph UI indicators follow the explicit disposition list below.
- Non-functional: preserve dense desktop layout and existing visual hierarchy.

## Architecture

- Use Tailwind responsive utilities already present in the project.
- Avoid CSS media query sprawl. Prefer utility classes like `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, `flex-col sm:flex-row`, and `flex-wrap`.
- Keep thumbnail content placeholders lightweight. Lucide icons may be too heavy inside very small thumbnails, so text abbreviations are acceptable where purely decorative and `aria-hidden`.
- Use `aria-hidden="true"` for non-meaningful thumbnail glyphs and visible/accessible labels for meaningful lock/protection state.

## Structural Emoji/Glyph Disposition

| File/element | Required disposition |
|---|---|
| `ShareModal.jsx` tab labels `🔗 Links`, `📋 Embed` | Replace with Lucide/SVG icon plus text in Phase 4 |
| `ShareModal.jsx` protected column `🔒` | Replace with readable `Password protected` header in Phase 4 |
| `SlideCanvas.jsx` locked slide indicator `🔒 Slide Locked` | Replace lock emoji with Lucide `Lock` icon plus text |
| `SlidePanel.jsx` drawing preview `✏` | May remain only if decorative and `aria-hidden`; otherwise replace with small SVG/text abbreviation |
| `SlidePanel.jsx` line preview `↗` | May remain only if decorative and `aria-hidden`; otherwise replace with small SVG/text abbreviation |

## Related Code Files

- Modify: `client/src/components/TemplatePickerModal.jsx`
- Modify: `client/src/components/MediaLibraryModal.jsx`
- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/components/SlideCanvas.jsx`
- Modify/Create: `tests/e2e/responsive/ui-modal-toolbar-responsive.spec.js`
- Modify/Create: `client/src/__tests__/ui-accessibility-findings-regression.test.js`

## Implementation Steps

1. Update TemplatePicker grid classes to responsive columns.
2. Update MediaLibrary:
   - tab row wraps or scrolls accessibly;
   - search/filter/upload toolbar stacks on mobile;
   - filter chips wrap and remain keyboard accessible.
3. Replace meaningful structural emoji:
   - `ShareModal` handled in Phase 4;
   - `SlideCanvas` lock indicator should use `Lock` icon + text or accessible text;
   - `SlidePanel` drawing/line preview glyphs should be `aria-hidden` decorative or iconized.
4. Add Playwright checks at 375px:
   - TemplatePicker modal has no horizontal overflow;
   - MediaLibrary toolbar has no horizontal overflow;
   - upload button remains reachable.
   Use measurable assertions: `document.documentElement.scrollWidth <= window.innerWidth`; for modals, modal `scrollWidth <= clientWidth` except intentionally scrollable inner content.
5. Run targeted responsive tests.

## Success Criteria

- [ ] TemplatePicker is usable at 375px, 768px, and desktop widths.
- [ ] MediaLibrary toolbar does not force horizontal scroll at 375px.
- [ ] Responsive overflow assertions use `scrollWidth <= clientWidth/window.innerWidth` at 375px, 768px, and desktop width.
- [ ] Structural emoji is removed from meaningful UI controls/statuses.
- [ ] Decorative thumbnail glyphs are marked `aria-hidden` if retained.
- [ ] Desktop layout remains compact.

## Risk Assessment

- Risk: wrapping toolbar increases modal height. Mitigation: body already scrolls, keep sticky/fixed sections minimal.
- Risk: replacing thumbnail glyphs reduces recognizability. Mitigation: use small SVG icons only where scale permits, otherwise text abbreviations.
- Risk: responsive tests may be brittle. Mitigation: assert no overflow and reachability, not exact pixel positions.
