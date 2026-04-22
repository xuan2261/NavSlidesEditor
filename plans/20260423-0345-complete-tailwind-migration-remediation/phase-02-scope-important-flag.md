---
phase: 2
title: "Scope Important Flag & Preflight"
status: pending
priority: P1
effort: "45 min"
dependencies: [1]
---

# Phase 2: Scope Important Flag & Preflight

## Overview

Change `important: true` (global `!important` on ALL Tailwind utilities) to `important: '#root'` (scoped to `#root` container). This fixes the cascade conflict where Tailwind classes override inline `style={{}}` and third-party library styles.

## Requirements

- **Functional**: Tailwind utilities still override legacy CSS classes within the app
- **Functional**: Inline `style={{}}` can override Tailwind when needed (for dynamic values)
- **Functional**: Third-party libraries (Reveal.js, TipTap, KaTeX, React-Joyride) styles work correctly
- **Non-functional**: No visual regression across Dashboard and Editor

## Architecture

### Current Problem
```
important: true → ALL utilities get !important → beats inline styles → breaks dynamic styling
```

### Solution
```
important: '#root' → utilities scoped via #root selector → higher specificity than classes, 
                      but LOWER than inline styles → cascade works correctly
```

**Why `#root`?** The React app renders into `<div id="root">`. Scoping to `#root` means Tailwind utilities get specificity of `#root .class` which beats plain `.class` but loses to inline `style=""`.

### Preflight Gap Fix

Add explicit `border-style: solid` to base reset to compensate for disabled Preflight:

```css
*, *::before, *::after {
  border-style: solid;
  border-width: 0;
}
```

## Related Code Files

### Modify:
- `client/tailwind.config.js` — L5: `important: true` → `important: '#root'`
- `client/src/index.css` — Add `border-style: solid; border-width: 0` to `*` reset

## Implementation Steps

### Step 1: Update Tailwind config

```diff
- important: true,
+ important: '#root',
```

### Step 2: Fix Preflight gap in index.css

Add to the existing `*` reset block:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
+ border-style: solid;
+ border-width: 0;
}
```

### Step 3: Scan for `!bg-` and `!text-` manual overrides

Some components may have added manual `!` prefix to force override:

```bash
grep -rn "className=.*\!" client/src --include="*.jsx" | head -30
```

These `!` prefixes are now unnecessary with scoped important and may need review (they'll still work but are redundant).

### Step 4: Test critical surfaces

1. **Dashboard** (HomePage) — card layouts, sidebar nav, template grid
2. **Editor** (EditorPage) — canvas background, toolbar, properties panel
3. **Modals** — Create, Share, TemplateGallery overlay z-index
4. **Reveal.js** — Presentation mode, slide transitions, KaTeX rendering

### Step 5: Build verification

```bash
cd client && npx vite build
```

## Success Criteria

- [ ] `tailwind.config.js` has `important: '#root'` (not `true`)
- [ ] `index.css` has `border-style: solid; border-width: 0` in `*` reset
- [ ] `vite build` passes
- [ ] Inline `style={{}}` overrides work (test: SlideCanvas background color)
- [ ] Tailwind utilities still override base/legacy CSS
- [ ] Reveal.js presentation mode renders correctly
- [ ] `border-border` class renders visible borders on elements

## Test Plan

**Critical regression surfaces to verify:**

| Surface | Test | Expected |
|---------|------|----------|
| SlideCanvas | Open editor, check slide background color | Matches slide.background, NOT Tailwind bg class |
| SettingsPage | Open settings, check form field styling | Fields have borders, proper background |
| HomePage sidebar | Nav items hover effect | Smooth hover transition, no style flash |
| Create Modal | Template selector cards | Conditional styling (selected = accent bg) works |
| TemplateGallery | Open gallery overlay | z-index and backdrop work correctly |
| Reveal.js | Start presentation | No Tailwind styles leak into slides |

**Browser Test Checklist:**
1. Dashboard: light mode, dark mode
2. Editor: open presentation, verify canvas
3. Modal: open create modal, verify form fields
4. Presentation: start slideshow, verify no style leakage

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Some Tailwind classes lose specificity war with legacy CSS | Medium | Most legacy CSS was removed in migration. Test key surfaces. |
| `border-border` stops rendering borders | Medium | Fixed by adding `border-style: solid` to `*` reset |
| `!` prefix classes stop working | None | `!` prefix still adds `!important` even with scoped important |
| Reveal.js slide styles affected | Low | Reveal.js lives in iframe, unaffected by `#root` scoping |
