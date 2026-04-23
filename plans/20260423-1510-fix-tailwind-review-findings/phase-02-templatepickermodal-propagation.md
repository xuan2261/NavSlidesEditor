---
phase: 2
title: "Restore TemplatePickerModal Click Containment"
status: completed
priority: P1
effort: "10m"
dependencies: []
---

# Phase 02: Restore TemplatePickerModal Click Containment

## Overview

Restore `onClick={(e) => e.stopPropagation()}` on the inner modal container of `TemplatePickerModal.jsx` to prevent click events from bubbling to the overlay and closing the modal unexpectedly.

## Root Cause

During Tailwind migration, the `stopPropagation` handler was removed from the inner container div. The overlay div (line 87-89) has `onClick={onClose}`, and without propagation blocking on the inner container, any click inside the modal body bubbles up to the overlay → triggers close.

## Requirements

- Functional: Clicking inside the template picker modal must NOT close it
- Functional: Clicking the overlay background MUST close it
- Non-functional: Template selection workflow must remain functional

## Related Code Files

- Modify: `client/src/components/TemplatePickerModal.jsx` (line 91-93)

## Current State (Broken)

```jsx
// Line 87-89: Overlay has onClose
<div className="fixed inset-0 ..." onClick={onClose}>
  // Line 91-93: Inner container has NO propagation blocker
  <div className="bg-panel rounded-xl ...">
    {/* clicks here bubble to overlay → unintended close */}
  </div>
</div>
```

## Implementation Steps

### 1. Add stopPropagation to inner modal container

**File:** `client/src/components/TemplatePickerModal.jsx`

**Before (line 91-92):**
```jsx
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col p-6 w-full max-w-[800px] max-h-[90vh] overflow-y-auto animate-zoom-in"
      >
```

**After:**
```jsx
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col p-6 w-full max-w-[800px] max-h-[90vh] overflow-y-auto animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
```

This is a single-line addition on the div element.

### 2. Bonus: Fix double-close on template buttons (optional but recommended)

The template buttons at line 113-116 call `onClose()` explicitly after `onSelect()`. With stopPropagation fixed, `onClose()` is called only once (from the button handler), which is correct. No change needed here — the fix above resolves the double-close.

## Verification

### Automated

```bash
# 1. Browser regression coverage
npx playwright test tests/e2e/slide-management.spec.js
# Result: 10 passed

# 2. Build check
npm run build
# Result: success
```

### Browser Coverage

```
Playwright test `add slide modal keeps body clicks inside and closes on overlay click` now verifies:
- clicking the inner modal body keeps Add Slide open
- clicking the overlay closes the modal
- existing `can add slide from template (Two Column)` still passes, covering select → close behavior
```

## Success Criteria

- [x] `e.stopPropagation()` present on inner modal container
- [x] Clicking inside modal body does NOT close modal
- [x] Clicking overlay background DOES close modal
- [x] Template selection still works (select → close)
- [x] Cancel and X buttons still work
- [x] `npm run build` passes

## Risk Assessment

**Risk:** Very low. Adding `stopPropagation` on the inner container is the standard modal pattern used in every other modal in this codebase (`SyncModal`, `HistoryModal`, `TemplateGallery` all use `e.target === e.currentTarget` or `stopPropagation`).
