---
phase: 5
title: "Slide Metadata + Resolution"
status: complete
priority: P2
effort: "1-2 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation, phase-02-shape-line-image-enhancement]
---

# Phase 5: Slide Metadata + Resolution

## Overview

Extract and preserve slide-level metadata: transition effects, gradient backgrounds, presentation size/resolution, and speaker notes formatting.

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P2-A Per-slide transitions
- Existing mapper: `server/services/pptx-import/mapper.js`
- Existing importer: `server/services/pptx-import/importer.js`
- Background export: `client/src/utils/export-pptx-background.js`
- pptxtojson schema: `plans/reports/researcher-260425-0946-pptxtojson-schema.md` §6

## Requirements

**Slide transition:**
- Extract transition type from `slide.transition.type` (e.g., 'fade', 'push', 'wipe')
- Map PPTX transition → reveal.js compatible transitions
- Extract transition duration (ms) from `slide.transition.duration`
- Extract transition direction from `slide.transition.direction`
- Store per-slide: `slide.transition`, `slide.transitionDuration`, `slide.transitionDirection`
- Export: map to reveal.js `data-transition` attribute on slide

**Slide background:**
- Handle `fill.type: 'gradient'` → `background: { type: 'gradient', gradientType, angle, stops }`
- Handle `fill.type: 'image'` → `background: { type: 'image', src }`
- Handle `fill.type: 'pattern'` → `background: { type: 'color' }` with warning
- Handle `fill.type: 'none'` → transparent background

**Presentation metadata:**
- Map `output.size` (from pptxtojson) → `presentation.resolution` field
- Pass through `usedFonts[]` and `themeColors[]` as `_pptxMeta` sidecar
- Speaker notes: apply Phase 1 HTML preservation

## Architecture

**Slide schema extension** — store in slide:
```js
{
  id: uuid,
  background: { type: 'gradient', ... },
  transition: 'fade',          // reveal.js compatible
  transitionDuration: 800,      // ms
  transitionDirection: 'left',  // or null
  notes: '<p>Speaker note</p>', // HTML (Phase 1)
  elements: [...],
}
```

**Transition mapping (PPTX → reveal.js):**
```
pptxtojson type    → reveal.js data-transition
fade               → fade
push               → slide
wipe               → slide
blinds             → slide
cover              → slide
uncover            → slide
dissolve           → fade
checker            → slide
flash              → fade
split              → slide
ribbon             → slide
gallery            → slide
cube               → fade
doors              → fade
flip               → fade
zoom               → fade
none               → (no attribute)
```

**Reveal.js gradient support:** Convert gradient background to CSS `linear-gradient()` on slide div, OR rasterize to PNG as background image.

## Related Code Files

**Modify:**
- `server/services/pptx-import/mapper.js` — update `mapPptxOutput()` for gradient backgrounds, transition, resolution
- `server/services/pptx-import/importer.js` — pass through `usedFonts`, `themeColors`, `size`
- `client/src/utils/export-pptx-background.js` — export gradient backgrounds to PPTX
- `server/services/pptx-import/mapper.test.js` — tests for slide metadata
- Slide canvas (verify gradient background rendering)

## Implementation Steps

1. **Update `colorValue()` in `mapper.js`**
   - Handle `{ type: 'gradient', value: { path, rot, colors } }` → return gradient descriptor
   - Handle `{ type: 'pattern', ... }` → return `'transparent'` with warning
   - Handle `fill === 'none'` or `{ type: 'none' }` → return `'none'`

2. **Update `mapPptxOutput()` for gradient backgrounds**
   - Check `slide.fill.type`: 'color' → existing; 'gradient' → create gradient object; 'image' → extract image

3. **Update `mapPptxOutput()` for transitions**
   - Read `slide.transition` object
   - Map PPTX type → reveal.js type
   - Store on slide: `transition`, `transitionDuration`, `transitionDirection`

4. **Update `mapPptxOutput()` for speaker notes**
   - Apply Phase 1 HTML preservation (keep as HTML string, not plain text)

5. **Update `importer.js`** — pass through metadata
   - Include `usedFonts[]`, `themeColors[]`, `size` in response
   - Store in `presentation._pptxMeta` sidecar

6. **Add gradient background rendering in SlideCanvas**
   - If `background.type === 'gradient'`, render CSS gradient or rasterized image
   - Convert pptxtojson gradient format → CSS `linear-gradient()` string

7. **Update export (`export-pptx-background.js`)**
   - For gradient background → generate PPTX gradient fill
   - For image background → embed image

8. **Add tests in `mapper.test.js`**
   - Test gradient background → gradient background object
   - Test slide transition → mapped reveal.js transition
   - Test image background → image background with src
   - Test pattern fill → warning + transparent
   - Test speaker notes HTML → preserved

## Success Criteria

- [ ] Gradient background → CSS gradient rendered in canvas
- [ ] Fade transition from PPTX → `transition: 'fade'` stored on slide
- [ ] Speaker notes with formatting → HTML preserved
- [ ] `usedFonts[]` → stored in `_pptxMeta`
- [ ] `themeColors[]` → stored in `_pptxMeta`
- [ ] Custom slide size → `resolution` field populated
- [ ] Export PPTX → transition and gradient preserved
- [ ] All existing tests pass
