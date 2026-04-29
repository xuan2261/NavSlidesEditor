---
phase: 1
title: "Fix Critical CSS Variables"
status: pending
priority: P1
effort: "20 min"
dependencies: []
---

# Phase 1: Fix Critical CSS Variables

## Overview

Fix 2 undefined CSS variable families causing **invisible text** (dark mode) and **broken border-radius** on modals. These are the highest-impact, lowest-effort fixes.

## Requirements

- **Functional**: All text must be visible in both dark and light mode
- **Functional**: Modal border-radius must render correctly
- **Non-functional**: Zero runtime warnings from undefined CSS vars

## Architecture

Two parallel fixes:
1. **`var(--text)`** → Replace with `var(--text-primary)` in 6 files / 13 occurrences
2. **`var(--radius-sm/md)`** → Define in `index.css` as `6px` / `12px`, OR replace inline with literal values

**Decision**: Define `--radius-sm` and `--radius-md` in `:root` so they're reusable. This is better than hardcoding pixels.

## Related Code Files

### Modify:
- `client/src/index.css` — Add `--radius-sm`, `--radius-md` to `:root`
- `client/src/pages/SettingsPage.jsx` — L46: `var(--text)` → `var(--text-primary)`
- `client/src/pages/ExplorePage.jsx` — L123: `var(--text)` → `var(--text-primary)`
- `client/src/pages/dashboard/TemplatePreview.jsx` — L53: `var(--text)` → `var(--text-primary)`
- `client/src/components/SlideSorterView.jsx` — L34: `var(--text)` → `var(--text-primary)`
- `client/src/components/LivePresentationModal.jsx` — L46, L63, L84, L113: `var(--text)` → `var(--text-primary)`
- `client/src/components/dashboard/TemplateGallery.jsx` — L265, L279: `var(--text)` → `var(--text-primary)`
- `client/src/components/AnalyticsModal.jsx` — L84, L102, L212: `var(--text)` → `var(--text-primary)`

## Implementation Steps

### Step 1: Add missing CSS variables to `index.css`

Add to `:root` block (after `--sidebar-width`):

```css
/* Border radius tokens */
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 16px;
```

### Step 2: Replace `var(--text)` → `var(--text-primary)`

In each file listed above, find-and-replace:
- `color: 'var(--text)'` → `color: 'var(--text-primary)'`
- Only within inline `style={{}}` blocks — don't touch Tailwind className strings

**Critical**: `SettingsPage.jsx` line 46 is inside a `fieldStyle` object — this affects ALL form fields on the page.

### Step 3: Verify with build

```bash
cd client && npx vite build
```

## Success Criteria

- [ ] `var(--text)` has zero occurrences in `.jsx` files (grep returns empty)
- [ ] `var(--radius-sm)` and `var(--radius-md)` are defined in `:root`
- [ ] `vite build` passes with exit code 0
- [ ] Text is visible in dark mode on SettingsPage, ExplorePage, LivePresentationModal
- [ ] HomePage confirm dialog has rounded corners

## Test Plan

```bash
# Verify no remaining var(--text) usage (exact match, not --text-primary/muted/secondary)
grep -rn "var(--text)" client/src --include="*.jsx" | grep -v "var(--text-" | grep -v "var(--text)"

# More precise: match only var(--text) followed by ) or ,
grep -Prn "var\(--text\)" client/src --include="*.jsx"
```

**Browser Test**: Open SettingsPage → verify all labels, inputs, headings are visible in dark mode.

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| `var(--text-primary)` doesn't exist in some context | None | Verified in index.css `:root` block — defined as `#f0f0f5` |
| Replacing changes visual color slightly | None | `--text-primary` is the correct primary text color token |
