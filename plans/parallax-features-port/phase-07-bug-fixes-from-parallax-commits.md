# Phase 07: Bug Fixes from parallax-presentations Commits

**Priority:** P2 | **Effort:** Low | **Status:** Pending

---

## Context

- Source: parallax commits with `fix` prefix (30 commits)
- Some fixes are present-mode-specific (covered in Phase 04)
- Remaining fixes apply to editor behavior and may affect NavSlidesEditor

---

## Bug Fixes to Port

### Fix 1: Cropped images showing full image in editor
- **Commit:** `efcf263`
- **Root cause:** Clip div missing `position: relative`
- **Fix:** Add `position: relative` to image clip container
- **File:** `client/src/components/SlideCanvas.jsx` or image element renderer
- **Test:** Upload image, crop it, verify only crop region visible in editor

### Fix 2: JSXGraph lines not rendering
- **Commit:** `5a84411`
- **Root cause:** SVG fit script overriding library-managed SVGs
- **Fix:** Skip SVG fit for JSXGraph containers
- **File:** `client/src/components/SlideCanvas.jsx`
- **Test:** Insert JSXGraph element → verify lines render
- **Note:** Only applicable if NavSlidesEditor uses JSXGraph

### Fix 3: Iframes not rendering on animated slides
- **Commit:** `77f6b74`
- **Root cause:** Iframes need container div wrapper for animation
- **Fix:** Wrap iframes in container div in `renderHtml()`
- **File:** `shared/src/element-renderers.js`
- **Test:** Add HTML embed to slide with fragment animation → verify renders after animation

### Fix 4: Phantom image from timeline
- **Commit:** `69c8195`
- **Root cause:** `position: relative` overriding `position: absolute`
- **Fix:** Don't apply `position: relative` to elements that use `position: absolute`
- **File:** `client/src/components/SlideCanvas.jsx`
- **Test:** Add timeline with images → verify no phantom duplicate images

### Fix 5: Title slide spacing
- **Commit:** `1d6e111`
- **Root cause:** `!important` on `p` line-height override
- **Fix:** Remove `!important` from `p` line-height in theme CSS
- **File:** `client/public/reveal-overrides.css` or theme CSS
- **Test:** Create title slide → verify paragraph spacing normal

### Fix 6: Missing Clock import in Toolbar
- **Commit:** `5177e11`
- **Root cause:** `Clock` icon imported but not used, or missing import
- **Fix:** Verify Clock import exists in Toolbar.jsx
- **File:** `client/src/components/Toolbar.jsx`
- **Test:** `npm run build` succeeds without import errors

### Fix 7: React not defined in timeline component
- **Commit:** `2ba20cd`
- **Root cause:** Timeline JSX in file without React import
- **Fix:** Ensure `import React from 'react'` in timeline component
- **File:** `client/src/components/TimelineElement.jsx` (new file from Phase 05)
- **Test:** Insert timeline → verify no "React not defined" error

### Fix 8: Cropped image showing overflow with citations
- **Commit:** `b69202d`
- **Root cause:** Citation text causing overflow in cropped image container
- **Fix:** Add `overflow: hidden` to image citation container
- **File:** `shared/src/element-renderers.js` (renderImage)
- **Test:** Add image with citation + crop → verify no overflow

---

## Implementation Steps

### Step 1: Fix cropped image rendering
```js
// In SlideCanvas.jsx — image element wrapper
<div style={{ position: 'relative', overflow: 'hidden', ...clipStyle }}>
  <img src={element.src} style={{ ...imageStyle }} />
</div>
```

### Step 2: Fix iframe animation wrapper
```js
// In element-renderers.js — renderHtml()
function renderHtml(el, style, wrap, vis, opts) {
  const iframe = `<iframe srcdoc="..." ...></iframe>`
  return `<div class="html-embed-wrapper">${iframe}</div>`
}
```

### Step 3: Fix position conflicts
Ensure image elements don't have conflicting `position: relative` and `position: absolute`.

### Step 4: Fix title slide spacing
Remove any `!important` from paragraph line-height overrides in theme CSS.

### Step 5: Fix image citation overflow
```js
// In renderImage() — citation container
<div style="overflow: hidden; max-height: ${citationHeight}px">
  <p style="font-size: ${el.citationFontSize || 12}px">${el.citation}</p>
</div>
```

---

## Tests

### Unit Tests
```js
// shared/src/bug-fixes.test.js
import { describe, it, expect } from 'vitest'
import { renderHtml, renderImage } from './element-renderers'

describe('Bug fixes', () => {
  it('wraps iframes in container div', () => {
    const el = { type: 'html', content: '<div>test</div>', x: 0, y: 0, width: 400, height: 300 }
    const html = renderHtml(el, {}, () => '', () => '', {})
    expect(html).toContain('html-embed-wrapper')
  })

  it('image citation has overflow hidden', () => {
    const el = { type: 'image', src: '/test.jpg', citation: 'Long text', x: 0, y: 0, width: 400, height: 300 }
    const html = renderImage(el, {}, () => '', () => '', {})
    expect(html).toContain('overflow: hidden')
  })
})
```

### Regression Tests
1. Upload image + crop → verify only crop region shows
2. Add HTML embed to animated slide → verify renders after fragment animation
3. Create title slide → verify paragraph spacing normal
4. Add image with citation → verify no overflow
5. Build project → verify no import errors

---

## Success Criteria

- [ ] Cropped images show only crop region
- [ ] Iframes render on animated slides
- [ ] No phantom images from position conflicts
- [ ] Title slide spacing correct
- [ ] Image citation overflow fixed
- [ ] No import errors in build
- [ ] Unit tests pass
- [ ] `npm run build` succeeds
