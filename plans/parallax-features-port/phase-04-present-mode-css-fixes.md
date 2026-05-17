# Phase 04: Present Mode CSS Fixes

**Priority:** P1 | **Effort:** Medium | **Status:** Complete

---

## Context

- Source: parallax commits `f5e6dca`, `fc2d1c7`, `975bca4`, `6c3ef00`, `a8bc9ad`, `d800052`, `af600bd`, `40c3687`, `87bd4df`, `5055f3e`, `edfc1ba`, `cde1b2e`, `347d6ad`, `5317359`, `6ffa85c`, `1d6e111`
- NavSlidesEditor has present mode via reveal.js, but may have similar CSS mismatches between editor and present mode

---

## Requirements

### CSS Consistency Fixes
1. Force `line-height: normal` on reveal.js sections to prevent spacing mismatch
2. Match editor font-size in present mode (remove `!important` overrides)
3. Force fragments hidden until reveal.js triggers them (`!important`)
4. Remove `contain: paint` from sections (breaks reveal.js overview mode)
5. Use `px` instead of `em` for margins to prevent dimension mismatches
6. Add `overflow: hidden` to sections to prevent cross-slide image bleed
7. Match export CSS exactly to editor CSS for text spacing

### HTML Rendering Fixes
8. Render HTML embeds with data URLs instead of blob URLs in present mode
9. Render LaTeX blocks directly with KaTeX instead of srcdoc iframe in present mode
10. Fix auto-animate elements leaking to non-auto-animate slides

---

## Files to Modify

| File | Change |
|------|--------|
| `shared/src/htmlGenerator.js` | Apply CSS fixes to generated reveal.js HTML |
| `shared/src/element-renderers.js` | Fix HTML embed and LaTeX rendering for present mode |
| `client/src/pages/EditorPage.jsx` | Add section-level CSS overrides for present mode |
| `client/public/reveal-overrides.css` (new) | Present mode CSS override stylesheet |

---

## Implementation Steps

### Step 1: Create reveal-overrides.css
```css
/* client/public/reveal-overrides.css */
.reveal section {
  line-height: normal !important;
  overflow: hidden;
}
.reveal section p {
  line-height: inherit !important;
}
.reveal .fragment {
  visibility: hidden !important;
}
.reveal .fragment.visible {
  visibility: visible !important;
}
```

### Step 2: Update htmlGenerator.js
- Include `reveal-overrides.css` link in generated HTML `<head>`
- Remove any `contain: paint` from section styles
- Use `px` units for margins instead of `em`

### Step 3: Fix HTML embeds in element-renderers.js
In `renderHtml()`, use data URLs for present mode:
```js
function renderHtml(el, style, wrap, vis, opts) {
  const isExport = opts.isExport
  if (isExport) {
    // Use data URL instead of srcdoc/blob
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(el.content)
    return `<iframe src="${dataUrl}" ...></iframe>`
  }
  // ... existing editor rendering
}
```

### Step 4: Fix LaTeX in element-renderers.js
In `renderLatex()`, for export/present mode render KaTeX directly:
```js
function renderLatex(el, style, wrap, vis, opts) {
  if (opts.isExport) {
    // Render KaTeX HTML directly instead of iframe
    return `<div class="katex-display" style="font-size:${el.latexFontSize||20}px;color:${el.latexColor||'#fff'}">${el.renderedHtml || ''}</div>`
  }
  // ... existing editor rendering
}
```

### Step 5: Fix auto-animate leak
Add `data-auto-animate` only to slides that explicitly have it:
```js
// In htmlGenerator.js
const autoAnimateAttr = slide.autoAnimate ? 'data-auto-animate' : ''
```

---

## Tests

### Unit Tests
```js
// shared/src/present-mode-css.test.js
import { describe, it, expect } from 'vitest'
import { generateHTML } from './htmlGenerator'

describe('Present mode CSS', () => {
  const presentation = {
    slides: [{
      elements: [{ type: 'text', content: '<p>Hello</p>', x: 0, y: 0, width: 400, height: 100 }],
      background: { type: 'color', color: '#000' }
    }],
    theme: 'black',
    transition: 'slide'
  }

  it('includes reveal-overrides.css link', () => {
    const html = generateHTML(presentation)
    expect(html).toContain('reveal-overrides.css')
  })

  it('does not contain contain:paint on sections', () => {
    const html = generateHTML(presentation)
    expect(html).not.toContain('contain: paint')
    expect(html).not.toContain('contain:paint')
  })

  it('uses px units for margins', () => {
    const html = generateHTML(presentation)
    expect(html).not.toMatch(/margin.*em/)
  })

  it('renders HTML embeds with data URLs in export', () => {
    const pres = { ...presentation, slides: [{ elements: [{ type: 'html', content: '<div>test</div>', x: 0, y: 0, width: 400, height: 300 }], background: { type: 'color', color: '#000' } }] }
    const html = generateHTML(pres, { isExport: true })
    expect(html).toContain('data:text/html')
  })
})
```

### Visual Verification
1. Create presentation with dense text → export HTML → compare spacing with editor
2. Create slide with fragments → export → verify fragments are hidden initially
3. Create slide with HTML embed → export → verify iframe renders in present mode
4. Create slide with LaTeX → export → verify KaTeX renders correctly
5. Test overview mode (press O) → verify no layout breakage

---

## Success Criteria

- [x] `reveal-overrides.css` created and linked in exports
- [x] `line-height: normal` applied to sections
- [x] Fragments hidden until triggered
- [x] No `contain: paint` in generated HTML
- [x] Margins use `px` not `em`
- [x] HTML embeds use data URLs in export
- [x] LaTeX renders directly in export (regular KaTeX blocks; TikZ remains iframe-rendered)
- [x] Auto-animate doesn't leak to non-auto-animate slides
- [x] Unit tests pass
- [x] `npm run build` succeeds

## Verification Update - 2026-05-17

- Added regression coverage in `shared/tests/present-mode-section-styles.test.js` for stylesheet link, section line-height reset, data URL HTML embeds, and direct KaTeX present rendering.
- Updated renderer integration tests to decode data URL embeds while preserving trusted author HTML/script behavior.
- Added `<base>` inside data URL embeds so `/uploads` and `/vendor` assets keep resolving from the app origin.
- Updated offline export to inline `/reveal-overrides.css` so offline HTML does not keep an external override stylesheet.
- Verification passed: targeted Vitest renderer/offline sweep, `npm run lint`, `npm run build`, and targeted parallax Playwright E2E.
