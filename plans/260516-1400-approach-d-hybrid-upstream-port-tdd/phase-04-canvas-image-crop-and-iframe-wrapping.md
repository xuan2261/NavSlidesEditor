# Phase 4: Canvas Image Crop Fix + Iframe Wrapping

**Priority:** P1
**Status:** pending
**Effort:** 6-8h
**Upstream Commits:** `efcf2632`, `77f6b74b`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Personas 1, 5: iframe alignment, sandbox concerns
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.4

## Overview

**TDD: Write tests for image crop rendering and iframe wrapping FIRST.**

Two independent fixes: (1) cropped images show full image in editor → add nested wrapper divs, (2) iframes break on animated slides → wrap in container divs.

## TDD Approach

### RED Phase: Write failing tests
1. Create `shared/tests/element-renderers-structure.test.js`
2. Test that iframe-based elements are wrapped in container divs
3. Test that image elements have nested wrapper structure
4. Run tests — FAIL

### GREEN Phase: Implement
5. Fix image crop in `canvas-element-wrapper.jsx`
6. Wrap iframes in `element-renderers.js`
7. Run tests — PASS

## Test File: `shared/tests/element-renderers-structure.test.js`

```js
describe('element renderer DOM structure', () => {
  test('HTML embed iframe is wrapped in container div', () => {
    const html = renderSlideElements([{ type: 'html', content: '<p>test</p>', id: '1' }], opts)
    // Should have: <div data-id="1" ...><iframe ...></iframe></div>
    expect(html).toMatch(/<div[^>]*data-id="1"[^>]*>.*<iframe/s)
  })

  test('LaTeX iframe is wrapped in container div', () => {
    const html = renderSlideElements([{ type: 'latex', content: 'x^2', id: '2' }], opts)
    expect(html).toMatch(/<div[^>]*data-id="2"[^>]*>.*<iframe/s)
  })

  test('Chart iframe is wrapped in container div', () => {
    const html = renderSlideElements([{ type: 'chart', chartType: 'bar', id: '3' }], opts)
    expect(html).toMatch(/<div[^>]*data-id="3"[^>]*>.*<iframe/s)
  })

  test('container div carries fragment class, not iframe', () => {
    const el = { type: 'html', content: '<p>t</p>', id: '4', fragmentAnimation: 'fade-in' }
    const html = renderSlideElements([el], opts)
    // Outer div should have fragment class
    expect(html).toMatch(/<div[^>]*class="[^"]*fragment[^"]*fade-in[^"]*"[^>]*>.*<iframe/s)
    // Iframe should NOT have fragment class
    expect(html).not.toMatch(/<iframe[^>]*class="[^"]*fragment/)
  })

  test('iframe has width:100%;height:100%;display:block', () => {
    const html = renderSlideElements([{ type: 'html', content: '<p>t</p>', id: '5' }], opts)
    expect(html).toMatch(/<iframe[^>]*style="[^"]*width:\s*100%.*height:\s*100%.*display:\s*block/)
  })
})
```

## Implementation Steps

### Step 1: Write test file (RED)
Create `shared/tests/element-renderers-structure.test.js`. Run — FAIL.

### Step 2: Fix image crop in canvas-element-wrapper.jsx
Change image rendering from single div to nested divs:

**Current** (line ~115):
```jsx
<div style={imageWrapperStyle}>
  <img src={element.src} style={imgStyle} />
  {isCropping && <CropOverlay />}
</div>
```

**New**:
```jsx
<div style={imageWrapperStyle}>
  <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
    <img src={element.src} style={{ ...imgStyle, maxWidth: 'none', maxHeight: 'none' }} />
    {isCropping && <CropOverlay />}
  </div>
</div>
```

### Step 3: Wrap iframes in element-renderers.js
For each iframe-based renderer, change from bare iframe to wrapped structure:

**renderHtml()** — change to:
```js
function renderHtml(el, style, wrap, vis, opts) {
  const srcdoc = buildHtmlSrcdoc(el)
  return `<div data-id="${el.id}" ${wrap} ${vis} style="${style}">
    <iframe srcdoc="${escapeHtml(srcdoc)}" style="width:100%;height:100%;display:block;border:none;" sandbox="allow-scripts"></iframe>
  </div>`
}
```

**renderLatex()** — present mode path, change to:
```js
// For non-TikZ: keep existing data-math-latex approach (safe, no iframe)
// For TikZ: wrap iframe in container div
return `<div data-id="${el.id}" ${wrap} ${vis} style="${style}">
  <iframe srcdoc="${escapeHtml(tikzSrcdoc)}" style="width:100%;height:100%;display:block;border:none;" sandbox="allow-scripts"></iframe>
</div>`
```

**renderChart()** — wrap iframe similarly.

### Step 4: Run tests (GREEN)
```bash
npx vitest run shared/tests/element-renderers-structure.test.js
```

### Step 5: Update CSS snapshot
```bash
npx vitest run shared/tests/html-generator-css.test.js --update
```

### Step 6: Full test suite
```bash
npm run test
npm run build
```

## Todo List

- [ ] Create `shared/tests/element-renderers-structure.test.js` (RED)
- [ ] Verify tests FAIL
- [ ] Fix image crop: nested wrapper divs in canvas-element-wrapper.jsx
- [ ] Add `maxWidth: 'none'`, `maxHeight: 'none'` to img style
- [ ] Wrap renderHtml() iframe in container div
- [ ] Wrap renderLatex() TikZ iframe in container div
- [ ] Wrap renderChart() iframe in container div
- [ ] Run tests — PASS (GREEN)
- [ ] Update CSS snapshot
- [ ] Run `npm run test` — all pass
- [ ] Manual: cropped images show correctly in editor
- [ ] Manual: iframes animate correctly on auto-animate slides

## Success Criteria

- Cropped images show only cropped region in editor
- All iframe elements wrapped in container divs
- Fragment/animation attributes on container div, not iframe
- Iframes have `width:100%;height:100%;display:block`
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Image wrapper breaks resize/crop handles | Medium | Test crop, resize, rotate on images |
| Iframe wrapping breaks existing html/chart elements | Medium | Test each iframe element type |
| Fragment class on wrong element | Medium | Test that animation applies to container, not iframe |
| Security: iframe sandbox preserved | HIGH | Per Persona 1 — verify sandbox attribute on all iframes |

## Security Considerations (per Persona 1)

- All `<iframe>` elements MUST have `sandbox="allow-scripts"` attribute
- Fragment class MUST be on container div, not iframe (prevents sandbox bypass)
- Add test: LaTeX with `\href{javascript:alert(1)}` does not execute
