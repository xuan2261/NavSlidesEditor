---
phase: 4
title: "Fix Minor CSS & Animation Issues"
status: pending
priority: P3
effort: "45m"
dependencies: []
---

# Phase 4: Fix Minor CSS & Animation Issues

## Overview

Fix remaining lower-priority issues: Toolbar color indicators, HomePage form-group/animations, and TemplatePickerModal animation classes.

## Audit References

- Issue #4: Toolbar.jsx — `.color-indicator`, `.color-btn-wrapper` mất CSS
- Issue #5: HomePage.jsx — `.form-group` mất spacing, `.anim-fade-in` không hoạt động
- Issue #21: TemplatePickerModal — `animate-in fade-in zoom-in-95` cần plugin

## Related Code Files

### Modify:
- `client/src/components/Toolbar.jsx` — lines 902, 962, 1003
- `client/src/pages/HomePage.jsx` — lines 790, 1323, 1335, 1418, 1431
- `client/src/components/TemplatePickerModal.jsx` — line 92
- `client/src/index.css` — add animation keyframes

## Implementation Steps

### Step 4.1 — Toolbar Color Indicators

```diff
# Line 902: .color-indicator (font color button)
- <span className="color-indicator" style={{ background: currentColor }} />
+ <span className="inline-block w-4 h-1 rounded-sm mt-0.5" style={{ background: currentColor }} />

# Line 962: .color-btn-wrapper
- <div className="color-btn-wrapper" style={{ flex: 1 }}>
+ <div className="flex-1">

# Line 1003: .color-indicator (highlight color)
- className="color-indicator"
+ className="inline-block w-4 h-1 rounded-sm mt-0.5"
```

### Step 4.2 — HomePage Form Groups & Animations

**A) Replace `.form-group` with Tailwind spacing:**
```diff
# Lines 1323, 1335, 1418, 1431:
- <div className="form-group">
+ <div className="mb-3">
```

**B) Add `.anim-fade-in` CSS animation to `index.css`:**
```css
/* Add to index.css */
.anim-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Step 4.3 — TemplatePickerModal Animation

**Option A (recommended): Add CSS animation to replace `animate-in` plugin classes:**

```diff
# TemplatePickerModal.jsx line 92:
- className="... animate-in fade-in zoom-in-95 duration-200"
+ className="... anim-fade-in"
```

**Also add in `index.css`** (same animation as Step 4.2, or a zoom variant):
```css
.anim-zoom-in {
  animation: zoomIn 0.2s ease-out;
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

Then update TemplatePickerModal:
```diff
- className="... animate-in fade-in zoom-in-95 duration-200"
+ className="... anim-zoom-in"
```

**Also update HomePage.jsx** modal containers using same `animate-in` pattern (lines 1317, 1496):
```diff
- className="... animate-in fade-in zoom-in-95 duration-200"
+ className="... anim-zoom-in"
```

## Success Criteria

- [ ] Color indicator bar visible under font color button in Toolbar
- [ ] Color indicator bar visible under highlight color button
- [ ] Modal form fields properly spaced in HomePage
- [ ] Empty state messages fade in smoothly
- [ ] TemplatePickerModal and HomePage modals zoom-in animate on open
- [ ] `npm run build` passes

## Verification

1. `npm run build` — zero errors
2. Browser subagent: Open editor → check Toolbar font color button has color indicator bar
3. Browser subagent: Open "New Presentation" modal → check form field spacing
4. Browser subagent: Navigate to empty Trash → check fade-in animation
5. Grep: `grep -r "form-group\|color-indicator\|color-btn-wrapper\|animate-in" --include="*.jsx" client/src/` — expect 0 matches

## Risk Assessment

- **LOW:** Purely cosmetic changes
- **NOTE:** `anim-fade-in` CSS could conflict with Tailwind's built-in `animate-*` utilities if any exist — verify no collision
