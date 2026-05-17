# Phase 6: LaTeX Direct KaTeX Render in Present Mode

**Priority:** P2
**Status:** pending
**Effort:** 3-4h
**Upstream Commit:** `edfc1ba5`

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

For non-TikZ, non-table LaTeX blocks, render KaTeX directly in the DOM instead of using an iframe. This fixes LaTeX rendering issues in present mode and improves performance.

## Key Insights

- Local LaTeX renderer (`element-renderers.js:223-258`) currently uses iframe srcdoc for ALL LaTeX in present mode
- Upstream splits: non-TikZ → `<div data-latex-block>` + post-render `katex.render()`, TikZ/table → iframe (unchanged)
- Must preserve TikZ support (iframe path) while adding direct render path
- Depends on Phase 3 (iframe wrapping) being complete — the wrapping pattern affects how LaTeX iframes are structured
- Local KaTeX is vendored to `server/vendor/katex/` — need to verify KaTeX CSS/JS availability in present mode

## Related Code Files

### Files to modify:
- `shared/src/element-renderers.js` — `renderLatex()` function (lines 223-258)
- `shared/src/htmlGenerator.js` — add post-render KaTeX script in reveal.js `ready` callback

### Files to read for context:
- `shared/src/element-renderers.js` lines 220-260 (full renderLatex function)
- `shared/src/htmlGenerator.js` lines 180-210 (reveal.js config and scripts)
- `server/vendor/katex/` — verify KaTeX assets available

## Implementation Steps

### Step 1: Read current renderLatex function
Understand the full LaTeX rendering flow: TikZ detection, fallback image logic, print mode, present mode.

### Step 2: Modify present mode path for non-TikZ LaTeX
In `renderLatex()`, change the present mode branch:

**Current** (all LaTeX → iframe):
```js
// builds iframe srcdoc with KaTeX CSS/JS
```

**New** (split by type):
```js
if (isTikZ || isTable) {
  // Keep iframe path (unchanged)
} else {
  // Direct render path
  return `<div data-latex-block="${escapeHtml(el.content)}" data-id="${el.id}" ${wrap} ${vis} style="${style}">
    <span class="katex-block">${escapeHtml(el.content)}</span>
  </div>`
}
```

### Step 3: Add post-render KaTeX script
In `htmlGenerator.js`, add to the reveal.js initialization script:
```js
Reveal.on('ready', () => {
  document.querySelectorAll('[data-latex-block]').forEach(el => {
    try {
      katex.render(el.getAttribute('data-latex-block'), el, {
        throwOnError: false,
        displayMode: true
      })
    } catch (e) {
      console.warn('KaTeX render failed:', e)
    }
  })
})
```

### Step 4: Ensure KaTeX CSS/JS is loaded in present mode
Verify that `katex.min.css` and `katex.min.js` are included in the generated HTML `<head>`.

### Step 5: Handle font-size and color from element properties
The direct render path must respect `element.fontSize` and `element.textColor` — apply as inline styles on the wrapper div.

## Todo List

- [ ] Read and understand current renderLatex function
- [ ] Split present mode: TikZ/table → iframe, regular → direct render
- [ ] Add `data-latex-block` div output for non-TikZ LaTeX
- [ ] Add post-render KaTeX script in reveal.js ready callback
- [ ] Verify KaTeX CSS/JS loaded in present mode HTML
- [ ] Apply fontSize/textColor to direct render wrapper
- [ ] Run `npm run test` — all pass
- [ ] Manual: verify non-TikZ LaTeX renders correctly in present mode
- [ ] Manual: verify TikZ still renders via iframe
- [ ] Manual: verify LaTeX font size/color properties still work

## Success Criteria

- Non-TikZ LaTeX renders directly with KaTeX in present mode (no iframe)
- TikZ content still renders via iframe (unchanged)
- LaTeX font size and color properties work in both paths
- LaTeX with fallback image still works
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| KaTeX not available in present mode | Medium | Verify vendor path and script inclusion |
| Direct render breaks complex LaTeX | Medium | Fall back to iframe on render error |
| TikZ detection regex misses edge cases | Low | Test with various TikZ patterns |
| Font size/color not applied to direct render | Low | Copy inline style logic from iframe path |

## Verification Commands

```bash
npm run test 2>&1 | tail -10
# Manual tests:
# 1. Insert LaTeX (non-TikZ) → present mode → verify renders without iframe
# 2. Insert TikZ → present mode → verify still uses iframe
# 3. Change LaTeX font size/color → verify applied in present mode
# 4. Insert malformed LaTeX → verify fallback image works
```
