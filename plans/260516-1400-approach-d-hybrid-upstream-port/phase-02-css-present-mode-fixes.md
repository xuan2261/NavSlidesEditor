# Phase 2: Present Mode CSS Fixes

**Priority:** P1 (CRITICAL)
**Status:** pending
**Effort:** 8-12h
**Upstream Commits:** `5055f3ec`, `87bd4dff`, `d800052a`, `a8bc9ad6`, `40c3687b`, `af600bd8`, `975bca4a`, `6ffa85ce`, `f5e6dcaa`, `fc2d1c7c`, `1d6e1117`

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.2
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Port 11 upstream CSS fix commits into `shared/src/htmlGenerator.js`. These commits fix present mode text spacing, auto-animate leaks, cross-slide image bleed, fragment visibility, overview mode, and reveal.js theme overrides. All touch the same inline `<style>` block (lines 146-169).

## Key Insights

- 11 commits all modify the same CSS block — must be applied in correct order
- Commit `d800052a` partially reverts `87bd4dff` (removes `contain:paint` that broke overview mode) — final state uses `section > * { overflow: hidden }` instead
- Commit `f5e6dcaa` changes font-size from `16px` to `42px` — this is the biggest change, aligning em-based calculations with editor canvas
- Local uses `shared/src/htmlGenerator.js` (CommonJS), NOT `client/src/utils/generateHTML.js` (which is a 9-line re-export)
- Local also needs changes in `shared/src/element-renderers.js` for callout `line-height: 1`

## Architecture

Upstream modifies `client/src/utils/generateHTML.js` + `server/index.js` (duplicated CSS). Local has single source: `shared/src/htmlGenerator.js` imported by both client and server.

## Related Code Files

### Files to modify:
- `shared/src/htmlGenerator.js` — main CSS block (lines 146-169), auto-animate attribute (line 67)
- `shared/src/element-renderers.js` — callout renderer `line-height: 1`
- `client/src/index.css` — editor heading line-height (upstream `f5e6dcaa`)

### Files to read for context:
- `shared/src/htmlGenerator.js` lines 60-70 (auto-animate logic)
- `shared/src/htmlGenerator.js` lines 130-200 (full CSS section)
- `shared/src/element-renderers.js` lines 200-210 (callout renderer)

## Implementation Steps

### Step 1: Auto-animate fix (`5055f3ec`)
In `shared/src/htmlGenerator.js` line 67, change:
```js
// FROM:
const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate' : ''
// TO:
const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate data-auto-animate-unmatched="fade"' : ''
```

### Step 2: CSS variable overrides (part of `6ffa85ce`)
Add to the `<style>` block, BEFORE the section rule:
```css
:root {
  --r-main-font-size: 42px;
  --r-block-margin: 0px;
  --r-heading-margin: 0 0 0.4em 0;
  --r-heading-text-transform: none;
  --r-heading-letter-spacing: normal;
}
```

### Step 3: Section rule overhaul (`6ffa85ce`, `87bd4dff`, `d800052a`, `f5e6dcaa`, `fc2d1c7c`, `975bca4a`)
Replace current section rule with:
```css
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
.reveal .slides { overflow: hidden !important; }
.reveal .slides section > * { overflow: hidden; }
```

### Step 4: Fragment visibility (`a8bc9ad6`)
Add new CSS rule:
```css
.reveal .slides section .fragment:not(.visible):not(.current-fragment) {
  opacity: 0 !important;
  visibility: hidden !important;
}
```

### Step 5: Element rules overhaul (`6ffa85ce`, `af600bd8`, `40c3687b`, `975bca4a`, `1d6e1117`)
Replace current element rules. Move selectors from `.reveal .slides section X` to `.reveal X` for higher specificity:
```css
.reveal p {
  margin: 0 0 0.4em 0 !important;
  font-size: inherit;
  line-height: inherit;
}
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

### Step 6: Remove wildcard rule
Remove: `.reveal .slides section * { text-transform: none !important; letter-spacing: normal !important; }`
(Upstream `40c3687b` removes this because it was overriding inline letter-spacing)

### Step 7: Callout line-height (`975bca4a`)
In `shared/src/element-renderers.js`, find callout renderer and add `line-height: 1` to inline styles.

### Step 8: Editor CSS alignment (`f5e6dcaa`)
In `client/src/index.css`, add `line-height: 1.2` to heading styles to match present mode.

## Todo List

- [ ] Auto-animate `data-auto-animate-unmatched="fade"` attribute
- [ ] CSS variable overrides on `:root`
- [ ] Section rule overhaul (overflow, font-size 42px, line-height normal)
- [ ] Fragment visibility CSS rule
- [ ] Element rules overhaul (p, h1-h4, ul/ol, li, code, pre, blockquote, img, span)
- [ ] Remove wildcard `*` selector
- [ ] Callout `line-height: 1` in element-renderers.js
- [ ] Editor CSS heading line-height alignment
- [ ] Run `npm run test` — all pass
- [ ] Run `npm run build` — success
- [ ] Manual present mode verification (5 presentations)
- [ ] Manual PDF export verification (3 presentations)

## Success Criteria

- Present mode text spacing matches editor exactly
- Auto-animate slides don't leak to non-auto-animate slides
- Cross-slide images don't bleed across slides
- Overview mode works correctly
- Fragments are hidden until reveal.js triggers them
- PDF export matches editor layout
- All existing tests pass
- Build succeeds

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSS regression in existing presentations | Medium | Test 5+ diverse presentations in present mode |
| Font-size 42px breaks em-based calculations | Medium | Verify heading sizes, margins, list indentation match editor |
| `overflow: hidden` on section breaks overview | Low | Upstream `d800052a` already solved this with `section > *` approach |
| Fragment CSS conflicts with custom animations | Low | Test fade-in, grow, zoom-in animations still work |

## Security Considerations

None — CSS-only changes, no user input handling.

## Verification Commands

```bash
# In worktree:
npm run test 2>&1 | tail -10
npm run build 2>&1 | tail -5
# Manual: open 5 presentations in present mode, verify text spacing
# Manual: export 3 presentations to PDF, compare with editor
```
