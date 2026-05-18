# Phase 2: CSS Snapshot Test + Present Mode CSS Fixes

**Priority:** P1 (CRITICAL)
**Status:** pending
**Effort:** 10-14h
**Upstream Commits:** `5055f3ec`, `87bd4dff`, `d800052a`, `a8bc9ad6`, `40c3687b`, `af600bd8`, `975bca4a`, `6ffa85ce`, `f5e6dcaa`, `fc2d1c7c`, `1d6e1117`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Personas 2, 4 both flag CSS as highest risk
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.2
- [Dependency Audit](dependency-audit-findings.md) — font-zoom impact

## Overview

**TDD: Write CSS snapshot test FIRST, then port all 11 CSS commits as single atomic change.**

Per Predict consensus: "CSS block = highest risk — golden-file snapshot test mandatory." All 11 commits touch the same `<style>` block in `shared/src/htmlGenerator.js` lines 146-169.

## TDD Approach

### RED Phase: Write failing tests first
1. Create `shared/tests/html-generator-css.test.js`
2. Create fixture presentation with all element types
3. Write snapshot test that captures current CSS output
4. Write assertion tests for specific CSS properties
5. Run tests — snapshot test PASSES (captures current state), assertion tests FAIL (asserting upstream values)

### GREEN Phase: Implement CSS changes
6. Apply all 11 upstream CSS changes to `htmlGenerator.js`
7. Update snapshot to match new CSS
8. Run tests — all PASS

### REFACTOR Phase: Clean up
9. Verify CSS specificity is reasonable (no unnecessary `!important`)
10. Verify `--font-zoom` system still works (per Persona 2 red flag)

## Test File: `shared/tests/html-generator-css.test.js`

```js
describe('htmlGenerator CSS output', () => {
  // Fixture: presentation with all 17 element types
  const fixturePresentation = { /* ... */ }

  test('CSS snapshot matches golden file', () => {
    const html = generateRevealHTML(fixturePresentation)
    const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)[1]
    expect(styleBlock).toMatchSnapshot()
  })

  test('section has overflow:hidden', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.reveal\s+\.slides\s+section\s*\{[^}]*overflow:\s*hidden/)
  })

  test('section has line-height:normal', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.reveal\s+\.slides\s+section\s*\{[^}]*line-height:\s*normal/)
  })

  test('fragment visibility rule exists', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.fragment:not\(\.visible\):not\(\.current-fragment\)/)
  })

  test('CSS variable overrides on :root', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/--r-main-font-size:\s*42px/)
    expect(html).toMatch(/--r-block-margin:\s*0px/)
  })

  test('auto-animate has unmatched="fade" attribute', () => {
    const html = generateRevealHTML({ ...fixturePresentation, slides: [{ autoAnimate: true, elements: [] }] })
    expect(html).toMatch(/data-auto-animate-unmatched="fade"/)
  })

  test('wildcard * selector removed', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).not.toMatch(/\.reveal\s+\.slides\s+section\s+\*/)
  })

  test('p uses 0.4em margin not 6px', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/\.reveal\s+p\s*\{[^}]*margin:\s*0\s+0\s+0\.4em/)
  })

  test('list uses 1.5em padding not 24px', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/padding-left:\s*1\.5em/)
  })

  test('headings have text-shadow:none', () => {
    const html = generateRevealHTML(fixturePresentation)
    expect(html).toMatch(/text-shadow:\s*none/)
  })
})
```

## Implementation Steps

### Step 1: Write test file (RED phase)
Create `shared/tests/html-generator-css.test.js` with all tests above.
- Snapshot test: captures current CSS (will PASS initially)
- Assertion tests: assert upstream values (will FAIL initially)

### Step 2: Verify tests run
```bash
npx vitest run shared/tests/html-generator-css.test.js
```
Expected: snapshot PASS, ~8 assertion tests FAIL.

### Step 3: Apply CSS changes (GREEN phase)
In `shared/src/htmlGenerator.js`:

**3a. Auto-animate fix** (line 67):
```js
const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate data-auto-animate-unmatched="fade"' : ''
```

**3b. Replace entire CSS block** (lines 146-169) with:
```css
:root {
  --r-main-font-size: 42px;
  --r-block-margin: 0px;
  --r-heading-margin: 0 0 0.4em 0;
  --r-heading-text-transform: none;
  --r-heading-letter-spacing: normal;
}
.reveal .slides { overflow: hidden !important; }
.reveal .slides section {
  padding: 0 !important;
  text-align: left !important;
  margin: 0 !important;
  font-family: var(--slide-font-family, sans-serif) !important;
  font-size: 42px;
  line-height: normal !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  overflow: hidden !important;
}
.reveal .slides section > * { overflow: hidden; }
.reveal .slides section .fragment:not(.visible):not(.current-fragment) {
  opacity: 0 !important;
  visibility: hidden !important;
}
.reveal p { margin: 0 0 0.4em 0 !important; font-size: inherit; line-height: inherit; }
.reveal h1 { font-size: 2.5em !important; margin: 0 0 0.4em 0 !important; text-shadow: none !important; }
.reveal h2 { font-size: 1.6em !important; margin: 0 0 0.4em 0 !important; text-shadow: none !important; }
.reveal h3 { font-size: 1.3em !important; margin: 0 0 0.4em 0 !important; text-shadow: none !important; }
.reveal h4 { font-size: 1em !important; margin: 0 0 0.4em 0 !important; text-shadow: none !important; }
.reveal ul, .reveal ol { margin: 0 0 0.4em 0 !important; padding-left: 1.5em !important; }
.reveal li { margin-bottom: 0.2em; line-height: inherit; }
.reveal code { font-family: monospace; }
.reveal pre { width: auto !important; box-shadow: none !important; margin: 0 0 0.4em 0 !important; }
.reveal pre code { display: block; padding: 0.5em; }
.reveal blockquote { width: auto !important; box-shadow: none !important; font-style: normal; margin: 0 0 0.4em 0 !important; }
.reveal img { margin: 0 !important; border: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
.reveal span { line-height: inherit; }
```

### Step 4: Update snapshot
```bash
npx vitest run shared/tests/html-generator-css.test.js --update
```

### Step 5: Verify all tests pass
```bash
npx vitest run shared/tests/html-generator-css.test.js
```

### Step 6: Callout line-height
In `shared/src/element-renderers.js`, find callout renderer and add `line-height: 1` to inline styles.

### Step 7: Verify font-zoom compatibility
Check that `--font-zoom` variable still works with the new `font-size: 42px` base. The 14 usages in `element-renderers.js` use `calc(${fontSize}px * var(--font-zoom, 1))` — this should be independent of the section font-size.

### Step 8: Full test suite
```bash
npm run test
npm run build
```

## Todo List

- [ ] Create `shared/tests/html-generator-css.test.js` with snapshot + assertions (RED)
- [ ] Verify tests run: snapshot PASS, assertions FAIL
- [ ] Apply auto-animate `data-auto-animate-unmatched="fade"` fix
- [ ] Replace CSS block with upstream values
- [ ] Update snapshot (GREEN)
- [ ] Verify all CSS tests pass
- [ ] Add callout `line-height: 1` in element-renderers.js
- [ ] Verify `--font-zoom` compatibility (14 usages)
- [ ] Run `npm run test` — all pass
- [ ] Run `npm run build` — success
- [ ] Manual: present mode text spacing matches editor
- [ ] Manual: PDF export matches editor layout
- [ ] Manual: auto-animate slides don't leak
- [ ] Manual: overview mode works

## Success Criteria

- `html-generator-css.test.js` all green
- Snapshot captures new CSS correctly
- Present mode text spacing matches editor
- Auto-animate doesn't leak to non-auto-animate slides
- Cross-slide images don't bleed
- Fragments hidden until reveal.js triggers
- Overview mode works
- PDF export matches editor
- `--font-zoom` system unaffected
- All existing tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSS regression in existing presentations | HIGH | Golden-file snapshot test catches unintended changes |
| `--font-zoom` breaks with 42px base | HIGH | Verify 14 usages still work (they use px, not em) |
| `!important` cascade makes future overrides impossible | Medium | Minimize `!important` usage, document why each needed |
| Fragment CSS conflicts with reveal.js built-in | Low | Use high-specificity selectors |
