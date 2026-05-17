# Phase 3: Canvas Fixes + Fragment Animations

**Priority:** P1
**Status:** pending
**Effort:** 6-8h
**Upstream Commits:** `efcf2632`, `77f6b74b`, `8050b08a`

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Sections 3.3, 3.4
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Fix cropped images in editor canvas, wrap iframes for animation compatibility, and add new fragment animation types (strike, slide, flip).

## Key Insights

- Image crop fix needs nested wrapper divs with `position:relative` — local uses single-div structure
- Iframe wrapping is critical for auto-animate to work with embedded content
- Fragment animations need changes in 3 places: `AnimationTimeline.jsx` (UI), `element-renderers.js` (CSS classes), `htmlGenerator.js` (CSS rules)

## Related Code Files

### Files to modify:
- `client/src/components/canvas/canvas-element-wrapper.jsx` — image wrapper structure (lines 110-124)
- `shared/src/element-renderers.js` — iframe wrapping for html/markdown/chart/latex renderers
- `client/src/components/AnimationTimeline.jsx` — add new animation types (line 4-17)
- `shared/src/htmlGenerator.js` — fragment CSS rules for new animation types

### Files to read for context:
- `client/src/components/canvas/canvas-element-wrapper.jsx` lines 70-130
- `shared/src/element-renderers.js` lines 140-160 (html renderer), 220-260 (latex renderer)
- `client/src/components/AnimationTimeline.jsx` lines 1-20

## Implementation Steps

### Step 1: Fix cropped images (`efcf2632`)
In `canvas-element-wrapper.jsx`, change image rendering to use nested wrapper divs:

**Current structure** (single div):
```jsx
<div style={imageWrapperStyle}>
  <img src={element.src} style={{ ... }} />
</div>
```

**New structure** (nested divs):
```jsx
<div style={imageWrapperStyle}>
  <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
    <img src={element.src} style={{ ... , maxWidth: 'none', maxHeight: 'none' }} />
  </div>
</div>
```

### Step 2: Wrap iframes for animation (`77f6b74b`)
In `element-renderers.js`, wrap all iframe-based renderers (html, markdown, chart, latex) in a container div that carries animation attributes. The iframe itself gets `width:100%;height:100%;display:block`.

For each iframe renderer, change from:
```html
<iframe data-id="..." class="fragment ..." srcdoc="..."></iframe>
```
To:
```html
<div data-id="..." class="fragment ...">
  <iframe srcdoc="..." style="width:100%;height:100%;display:block;border:none;"></iframe>
</div>
```

Affected renderers:
- `renderHtml()` — line ~142
- `renderMarkdown()` — if exists
- `renderChart()` — if exists
- `renderLatex()` — line ~247 (present mode path)

### Step 3: Add fragment animation types (`8050b08a`)
In `AnimationTimeline.jsx`, expand `ANIMATION_TYPES` array:
```js
const ANIMATION_TYPES = [
  // Fade
  { value: 'fade-in', label: 'Fade In', group: 'Fade' },
  { value: 'fade-out', label: 'Fade Out', group: 'Fade' },
  { value: 'fade-up', label: 'Fade Up', group: 'Fade' },
  { value: 'fade-down', label: 'Fade Down', group: 'Fade' },
  { value: 'fade-left', label: 'Fade Left', group: 'Fade' },
  { value: 'fade-right', label: 'Fade Right', group: 'Fade' },
  { value: 'semi-fade-out', label: 'Semi Fade Out', group: 'Fade' },
  // Zoom/Scale
  { value: 'grow', label: 'Grow', group: 'Zoom' },
  { value: 'shrink', label: 'Shrink', group: 'Zoom' },
  { value: 'zoom-in', label: 'Zoom In', group: 'Zoom' },
  // Slide
  { value: 'slide-up', label: 'Slide Up', group: 'Slide' },
  { value: 'slide-down', label: 'Slide Down', group: 'Slide' },
  { value: 'slide-left', label: 'Slide Left', group: 'Slide' },
  { value: 'slide-right', label: 'Slide Right', group: 'Slide' },
  // Flip
  { value: 'flip-up', label: 'Flip Up', group: 'Flip' },
  { value: 'flip-down', label: 'Flip Down', group: 'Flip' },
  // Highlight
  { value: 'highlight-red', label: 'Highlight Red', group: 'Highlight' },
  { value: 'highlight-green', label: 'Highlight Green', group: 'Highlight' },
  { value: 'highlight-blue', label: 'Highlight Blue', group: 'Highlight' },
  { value: 'highlight-current-red', label: 'Highlight Current Red', group: 'Highlight' },
  { value: 'highlight-current-green', label: 'Highlight Current Green', group: 'Highlight' },
  { value: 'highlight-current-blue', label: 'Highlight Current Blue', group: 'Highlight' },
  // Other
  { value: 'strike', label: 'Strike', group: 'Other' },
]
```

### Step 4: Fragment CSS rules in htmlGenerator.js
Add to the `<style>` block in `htmlGenerator.js`:
```css
.fragment.slide-up { transform: translateY(100%); opacity: 0; }
.fragment.slide-up.visible { transform: translateY(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-down { transform: translateY(-100%); opacity: 0; }
.fragment.slide-down.visible { transform: translateY(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-left { transform: translateX(100%); opacity: 0; }
.fragment.slide-left.visible { transform: translateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.slide-right { transform: translateX(-100%); opacity: 0; }
.fragment.slide-right.visible { transform: translateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.flip-up { transform: rotateX(90deg); opacity: 0; }
.fragment.flip-up.visible { transform: rotateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.flip-down { transform: rotateX(-90deg); opacity: 0; }
.fragment.flip-down.visible { transform: rotateX(0); opacity: 1; transition: all 0.5s ease; }
.fragment.strike { text-decoration: line-through; opacity: 0; }
.fragment.strike.visible { text-decoration: line-through; opacity: 1; transition: all 0.5s ease; }
.fragment.semi-fade-out.visible { opacity: 0.5; }
.fragment.highlight-current-red.visible { background-color: red; }
.fragment.highlight-current-green.visible { background-color: green; }
.fragment.highlight-current-blue.visible { background-color: blue; }
```

### Step 5: Properties panel integration
Check if `properties/` has fragment animation dropdown. If so, update it with new types organized by `<optgroup>`. If the dropdown is in a different component, find and update it.

## Todo List

- [ ] Fix cropped images with nested wrapper divs
- [ ] Add `maxWidth: 'none'`, `maxHeight: 'none'` to img style
- [ ] Wrap iframe renderers in container divs
- [ ] Add new animation types to `ANIMATION_TYPES` array
- [ ] Add fragment CSS rules for slide/flip/strike/semi-fade/highlight-current
- [ ] Update properties panel animation dropdown (if applicable)
- [ ] Run `npm run test` — all pass
- [ ] Manual: verify cropped images display correctly in editor
- [ ] Manual: verify iframes animate correctly on auto-animate slides
- [ ] Manual: verify all new fragment animations work in present mode

## Success Criteria

- Cropped images show only the cropped region in editor (not full image)
- Iframes on animated slides don't break during transitions
- All new fragment animations (slide-up/down/left/right, flip-up/down, strike, semi-fade-out, highlight-current-*) work in present mode
- Existing animations (fade-*, grow, shrink, zoom-in) still work
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Image wrapper change breaks resize/crop handles | Medium | Test crop, resize, rotate on image elements |
| Iframe wrapping breaks existing html/chart elements | Medium | Test all iframe element types in editor and present mode |
| New fragment CSS conflicts with reveal.js built-in fragments | Low | Use `.fragment.X.visible` specificity pattern |
| AnimationTimeline UI change breaks existing animation assignments | Low | Ensure old animation values still in the array |

## Verification Commands

```bash
npm run test 2>&1 | tail -10
# Manual tests:
# 1. Insert image → crop → verify only cropped region visible
# 2. Insert HTML embed → add auto-animate → verify transition works
# 3. Add fragment with each new animation type → verify in present mode
```
