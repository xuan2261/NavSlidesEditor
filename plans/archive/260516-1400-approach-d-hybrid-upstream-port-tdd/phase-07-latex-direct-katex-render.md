# Phase 7: LaTeX Direct KaTeX Render in Present Mode

**Priority:** P2
**Status:** pending
**Effort:** 4-5h
**Upstream Commit:** `edfc1ba5`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Persona 1: security concern with KaTeX macros, Persona 5: split-brain renderer
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5

## Overview

**TDD: Write tests for LaTeX direct render + security tests FIRST.**

For non-TikZ LaTeX, render KaTeX directly in DOM instead of iframe. Per Persona 1: audit KaTeX extensions for XSS risk before implementing.

## Key Decisions (from Predict)

1. **Keep iframe sandbox for client renderer** — per Persona 1, KaTeX `\htmlClass`/`\href` macros can emit raw HTML. Client renderer keeps `sandbox="allow-scripts"`.
2. **Shared renderer already does direct render** — `element-renderers.js` line 271 uses `<span data-math-latex>`. This is SAFE because it's for export/present mode (no user interaction).
3. **Only modify shared renderer** — don't touch client `latex-element-renderer.jsx`. The shared path is what generates present mode HTML.

## TDD Approach

### RED Phase: Write failing tests
1. Create `shared/tests/latex-render.test.js`
2. Test: non-TikZ LaTeX renders with `data-math-latex` attribute (not iframe)
3. Test: TikZ LaTeX still renders via iframe
4. Test: LaTeX XSS attempt is sanitized
5. Run tests — FAIL (if direct render not already in place)

### GREEN Phase: Implement
6. Verify shared renderer already does direct render for non-TikZ
7. If not, modify `renderLatex()` in `element-renderers.js`
8. Add post-render KaTeX script in `htmlGenerator.js`
9. Run tests — PASS

## Test File: `shared/tests/latex-render.test.js`

```js
describe('LaTeX rendering', () => {
  test('non-TikZ LaTeX uses data-math-latex in present mode', () => {
    const el = { type: 'latex', content: 'E = mc^2', id: 'l1' }
    const html = renderSlideElements([el], { mode: 'present' })
    expect(html).toMatch(/data-math-latex/)
    expect(html).not.toMatch(/<iframe/)
  })

  test('TikZ LaTeX uses iframe', () => {
    const el = { type: 'latex', content: '\\begin{tikzpicture}\\end{tikzpicture}', id: 'l2' }
    const html = renderSlideElements([el], { mode: 'present' })
    expect(html).toMatch(/<iframe/)
  })

  test('LaTeX with fontSize renders correct style', () => {
    const el = { type: 'latex', content: 'x^2', id: 'l3', fontSize: 24, textColor: '#ff0000' }
    const html = renderSlideElements([el], { mode: 'present' })
    expect(html).toMatch(/font-size:\s*24px/)
    expect(html).toMatch(/color:\s*#ff0000/)
  })

  test('LaTeX fallback image works for malformed content', () => {
    const el = { type: 'latex', content: '', id: 'l4', _fallbackSrc: '/uploads/latex.png' }
    const html = renderSlideElements([el], { mode: 'present' })
    expect(html).toMatch(/<img[^>]*src="\/uploads\/latex\.png"/)
  })

  test('LaTeX post-render script is in generated HTML', () => {
    const presentation = { slides: [{ elements: [{ type: 'latex', content: 'x', id: 'l5' }] }] }
    const html = generateRevealHTML(presentation)
    expect(html).toMatch(/data-latex-block/)
    expect(html).toMatch(/katex\.render/)
  })
})
```

## Implementation Steps

### Step 1: Write test file (RED)
Create `shared/tests/latex-render.test.js`. Run — check which tests pass/fail.

### Step 2: Audit current shared renderer
Read `shared/src/element-renderers.js` lines 223-260. The shared renderer ALREADY uses `<span data-math-latex>` for non-TikZ in some paths. Verify this is correct.

### Step 3: Verify post-render script
Check if `htmlGenerator.js` already has a `katex.render()` post-render script in the reveal.js `ready` callback. If not, add it.

### Step 4: Add post-render script (if missing)
In `htmlGenerator.js`, in the reveal.js initialization script block:
```js
Reveal.on('ready', function() {
  document.querySelectorAll('[data-math-latex]').forEach(function(el) {
    try {
      katex.render(el.getAttribute('data-math-latex'), el, {
        throwOnError: false,
        displayMode: true,
        fontSize: el.getAttribute('data-font-size') || undefined
      })
    } catch(e) {
      console.warn('KaTeX render failed:', e)
      el.textContent = el.getAttribute('data-math-latex')
    }
  })
})
```

### Step 5: Ensure KaTeX CSS/JS in generated HTML
Verify `<head>` includes:
```html
<link rel="stylesheet" href="/vendor/katex/katex.min.css">
<script src="/vendor/katex/katex.min.js"></script>
```

### Step 6: Run tests (GREEN)
```bash
npx vitest run shared/tests/latex-render.test.js
npm run test
```

## Todo List

- [ ] Create `shared/tests/latex-render.test.js` (RED)
- [ ] Audit current shared renderer LaTeX path
- [ ] Verify non-TikZ uses `data-math-latex` (not iframe)
- [ ] Verify/fix post-render KaTeX script in htmlGenerator.js
- [ ] Verify KaTeX CSS/JS included in generated HTML
- [ ] Verify fontSize/textColor applied to LaTeX wrapper
- [ ] Run tests — PASS (GREEN)
- [ ] Run `npm run test` — all pass
- [ ] Manual: non-TikZ LaTeX renders in present mode
- [ ] Manual: TikZ still renders via iframe
- [ ] Manual: LaTeX font size/color work

## Success Criteria

- Non-TikZ LaTeX renders directly with KaTeX in present mode
- TikZ content still renders via iframe (unchanged)
- LaTeX font size and color properties work
- Fallback image works for malformed LaTeX
- KaTeX CSS/JS loaded in generated HTML
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| KaTeX macros emit raw HTML (XSS) | HIGH | Keep iframe sandbox for client renderer |
| Post-render script fails silently | Medium | Add error handler with fallback to raw text |
| KaTeX vendor files not found | Low | Verify `/vendor/katex/` path exists |
| Split-brain between client/shared renderers | Low | Only modify shared renderer, leave client unchanged |

## Security Considerations (per Persona 1)

- Client renderer (`latex-element-renderer.jsx`) keeps iframe sandbox — DO NOT modify
- Shared renderer uses `data-math-latex` attribute — KaTeX renders into `<span>` elements only
- `\htmlClass` and `\href` macros in KaTeX generate safe `<span>` and `<a>` elements
- No raw HTML injection risk in shared renderer path
