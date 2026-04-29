---
phase: 4
title: "Normalize Dashboard Animation Classes"
status: completed
priority: P3
effort: "10m"
dependencies: []
---

# Phase 04: Normalize Dashboard Modal Animation Classes

## Overview

Replace non-existent `animate-in fade-in zoom-in-95` CSS classes with the valid `animate-zoom-in` class in `TemplateGallery.jsx` and `TemplatePreview.jsx`.

## Root Cause

The classes `animate-in`, `fade-in`, and `zoom-in-95` are from the `tailwindcss-animate` plugin (Radix/shadcn ecosystem). This plugin is **NOT installed** in the project (`tailwind.config.js` line 74: `plugins: []`).

The project's Tailwind config only defines:
```js
animation: {
  'fade-in': 'fadeIn 0.3s ease-out',    // → .animate-fade-in
  'zoom-in': 'zoomIn 0.2s ease-out',    // → .animate-zoom-in
}
```

These generate classes `animate-fade-in` and `animate-zoom-in` — NOT `animate-in`, `fade-in`, or `zoom-in-95`.

## Requirements

- Functional: Dashboard modal open animations should be visible
- Non-functional: Use only classes that exist in the current Tailwind config

## Related Code Files

- Modify: `client/src/components/dashboard/TemplateGallery.jsx` (line 242)
- Modify: `client/src/components/dashboard/TemplatePreview.jsx` (line 165)
- Reference: `client/tailwind.config.js` (lines 58-71, animation definitions)

## Implementation Steps

### 1. Fix TemplateGallery.jsx (line 242)

**Before:**
```jsx
className="flex max-h-[88vh] w-[960px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200"
```

**After:**
```jsx
className="flex max-h-[88vh] w-[960px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl animate-zoom-in"
```

**Changes:**
- Remove: `animate-in fade-in zoom-in-95 duration-200` (4 invalid classes)
- Add: `animate-zoom-in` (1 valid class, already defined in tailwind config with 0.2s duration)

### 2. Fix TemplatePreview.jsx (line 165)

**Before:**
```jsx
className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-[1000px] h-[90vh]"
```

**After:**
```jsx
className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-zoom-in w-[1000px] h-[90vh]"
```

**Changes:** Same as above — replace 4 invalid with 1 valid class.

### Why `animate-zoom-in` instead of `animate-fade-in`?

- `zoom-in` (scale 0.95→1.0 + fade) is the more appropriate animation for modal appearance
- `TemplatePickerModal` already uses `animate-zoom-in` for its modal (line 92)
- Consistent pattern across all modal components

## Verification

### Automated

```bash
# 1. Focused static audit
npx vitest run client/src/utils/tailwind-inline-style-audit.test.js --reporter=verbose
# Result: 3 passed

# 2. Source check
rg -n "animate-zoom-in|animate-in|fade-in|zoom-in-95" client/src/components/dashboard/TemplateGallery.jsx client/src/components/dashboard/TemplatePreview.jsx
# Result: only animate-zoom-in remains in both files

# 3. Build check
npm run build
# Result: success

# 4. Verify animation class exists in build output
Select-String -Path "client/dist/assets/*.css" -Pattern "animate-zoom-in"
# Result: generated class found in built CSS bundle
```

### Visual Verification Note

```
Manual visual smoke was not rerun separately after the automated pass.
The fix is verified by:
- a dedicated static audit test
- source-level confirmation that invalid classes are gone
- build-output confirmation that `animate-zoom-in` is generated
```

## Success Criteria

- [x] No `animate-in`, `fade-in`, `zoom-in-95` classes in dashboard components
- [x] `animate-zoom-in` used consistently in TemplateGallery and TemplatePreview
- [x] Static audit and build confirm the modal animation class is generated
- [x] `npm run build` passes
- [x] Animation class found in production CSS bundle

## Risk Assessment

**Risk:** Very low. Pure CSS class replacement. The animations are visual-only — no interaction or layout impact.
