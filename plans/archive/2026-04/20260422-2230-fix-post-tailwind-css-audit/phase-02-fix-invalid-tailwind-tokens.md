---
phase: 2
title: "Fix Invalid Tailwind Tokens"
status: pending
priority: P1
effort: "45min"
dependencies: [1]
---

# Phase 2: Fix Invalid Tailwind Tokens

## Overview

Fix 2 categories of invalid Tailwind tokens that produce wrong colors or no styling:
1. `text-primary` → `text-text-primary` (26 instances in properties/)
2. `bg-surface` → `bg-surface-2` (2 instances)
3. `placeholder:text-muted` → `placeholder:text-text-muted` (26 instances)

## Root Cause Analysis

In `tailwind.config.js`, `primary` is defined under `colors.primary.DEFAULT` = `var(--color-primary)` (#6366f1 — indigo). So `text-primary` sets text to **indigo**, not the intended `var(--text-primary)` (#f0f0f5 — white/light).

The correct token for text colors is `text-text-primary` which maps to `colors.text.primary` = `var(--text-primary)`.

Similarly, `bg-surface` has no direct mapping — only `surface-0` through `surface-4` exist.

## Requirements

- Functional: All input text in Properties Panel renders in correct color (white on dark, dark on light)
- Non-functional: No visual regression elsewhere

## Related Code Files

### Modify:
- `client/src/components/properties/chart-properties.jsx` — 4 instances
- `client/src/components/properties/code-properties.jsx` — 2 instances
- `client/src/components/properties/common-element-controls.jsx` — 11 instances
- `client/src/components/properties/image-properties.jsx` — 1 instance
- `client/src/components/properties/media-properties.jsx` — 3 instances
- `client/src/components/properties/shape-properties.jsx` — 5 instances
- `client/src/components/properties/table-properties.jsx` — 1 instance
- `client/src/components/MiniToolbar.jsx` — 1 instance (`bg-surface`)
- `client/src/components/SlidePanel.jsx` — 1 instance (`bg-surface`)

## Implementation Steps

### Step 1: Fix `text-primary` → `text-text-primary` in properties/

All 7 property files use this exact pattern in className:
```
text-primary px-2.5 py-1.5
```
Replace with:
```
text-text-primary px-2.5 py-1.5
```

And similarly for the `px-2` variant in `common-element-controls.jsx`:
```
text-primary px-2 py-1.5
```
→
```
text-text-primary px-2 py-1.5
```

### Step 2: Fix `placeholder:text-muted` → `placeholder:text-text-muted`

Same files — replace:
```
placeholder:text-muted
```
→
```
placeholder:text-text-muted
```

### Step 3: Fix `bg-surface` → `bg-surface-2`

**MiniToolbar.jsx:140:**
```diff
- className="cursor-pointer rounded border border-border bg-surface px-1 py-0.5 text-xs text-text-primary outline-none"
+ className="cursor-pointer rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-text-primary outline-none"
```

**SlidePanel.jsx:588:**
```diff
- className="flex items-center gap-2 py-1.5 px-3 border-t border-border bg-surface text-xs text-text-muted"
+ className="flex items-center gap-2 py-1.5 px-3 border-t border-border bg-surface-2 text-xs text-text-muted"
```

## Verification Steps

### Automated
```bash
# No remaining `text-primary px-2` in properties (should be text-text-primary)
grep -rn "text-primary px-2" client/src/components/properties/ --include="*.jsx"
# Expected: 0 results

# No remaining `placeholder:text-muted` (should be placeholder:text-text-muted)
grep -rn "placeholder:text-muted" client/src/components/properties/ --include="*.jsx"
# Expected: 0 results

# No remaining `bg-surface ` (should be bg-surface-N)
grep -rn "bg-surface " client/src/components/ --include="*.jsx"
# Expected: 0 results

# Build check
cd client && npx vite build --mode development
```

### Browser Visual Tests
1. Open editor → select a text element → Properties Panel opens
2. Check ELEMENT section — X, Y, W, H input fields should have **white text on dark bg** (not indigo)
3. Check Drop Shadow X, Y, Blur inputs — same white text
4. Select a shape → Shape Properties → fill/stroke/opacity inputs → white text
5. Select a code block → Code Properties → language/theme selects → white text
6. Check placeholder text in empty inputs — should be muted gray, not invisible
7. Check MiniToolbar font size select → should have dark surface background
8. Check SlidePanel footer → should have visible surface background

## Success Criteria

- [ ] All Properties Panel inputs show `var(--text-primary)` text color (white on dark, dark on light)
- [ ] All placeholders show `var(--text-muted)` color
- [ ] MiniToolbar select has `bg-surface-2` background
- [ ] SlidePanel footer has `bg-surface-2` background
- [ ] 0 grep results for `text-primary px-2` in properties/
- [ ] 0 grep results for `placeholder:text-muted` in properties/
- [ ] 0 grep results for `bg-surface ` (without number) in components/
- [ ] Build passes with zero errors

## Risk Assessment

- **Medium:** `text-primary` is used elsewhere (buttons, headings) where it correctly means the primary brand color. Must only change in `properties/` directory where context is form input text.
- Mitigation: Use `AllowMultiple` replace scoped to properties/ directory only.
