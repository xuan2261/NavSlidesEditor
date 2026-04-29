---
phase: 5
title: "Verification & E2E Testing"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verification & E2E Testing

## Overview

Toàn diện kiểm tra tất cả fixes bằng build check, grep verification, browser visual testing, và E2E test suite. Đảm bảo zero-regression state.

## Dependencies

- Phase 1 (broken components) — MUST be completed
- Phase 2 (logic bugs) — MUST be completed
- Phase 3 (token standardization) — MUST be completed
- Phase 4 (minor CSS) — MUST be completed

## Verification Steps

### Step 5.1 — Build Verification

```bash
cd client && npm run build
```

**Expected:** Zero errors, zero warnings related to missing imports or syntax.

### Step 5.2 — Grep Verification (Automated)

Run all these commands and verify **0 results** for each:

```bash
# Orphaned CSS classes (should all be converted to Tailwind)
grep -rn "slide-sorter-overlay\|slide-sorter-header\|slide-sorter-grid\|sorter-slide-card\|sorter-slide-preview\|sorter-slide-number" client/src/ --include="*.jsx"

grep -rn "slide-context-overlay\|slide-context-menu\|context-separator" client/src/ --include="*.jsx"

grep -rn "transition-preview-overlay\|transition-preview-modal\|transition-preview-header\|transition-preview-content" client/src/ --include="*.jsx"

# Invalid Tailwind tokens
grep -rn "bg-muted" client/src/ --include="*.jsx"
grep -rn "text-foreground[^-]" client/src/ --include="*.jsx"
grep -rn "text-muted-foreground" client/src/ --include="*.jsx"
grep -rn "bg-bg-" client/src/ --include="*.jsx"

# Old CSS class references
grep -rn "color-indicator\|color-btn-wrapper" client/src/ --include="*.jsx"
grep -rn '"form-group"' client/src/ --include="*.jsx"
grep -rn "animate-in" client/src/ --include="*.jsx"
```

### Step 5.3 — Browser Visual Testing (Manual via subagent)

**Test Plan:**

#### A. Dashboard (HomePage)
1. Navigate to `http://localhost:5173`
2. Verify page background color correct
3. Verify sidebar text colors visible
4. Verify "New Presentation" modal opens with proper spacing
5. Verify empty states have fade-in animation

#### B. Editor Layout
1. Open any presentation
2. **Slide Panel:** Verify thumbnails have spacing between them (not touching)
3. **Slide Panel:** Right-click → verify context menu appears styled
4. **Toolbar:** Verify font color indicator bar visible
5. **Toolbar:** Verify highlight color indicator bar visible

#### C. Insert Menu
1. Click Insert button
2. Hover over **Shape** → verify shape picker grid appears
3. Hover over **Table** → verify 8×8 size picker grid appears
4. Click **Icon** → verify icon picker still works (regression check)
5. Click **Image** → verify image insertion still works

#### D. View Menu
1. Click View → **Slide Sorter**
2. Verify styled overlay with grid of all slides
3. Verify current slide highlighted
4. Right-click slide in Sorter → verify context menu
5. Drag a slide to reorder → verify visual feedback
6. Close Sorter → verify returns to normal editor

7. Click View → **Speaker Notes**
8. Verify it scrolls/focuses the Speaker Notes textarea in PropertiesPanel
9. Verify it does NOT open a presenter window

#### E. Transition Preview
1. If accessible, trigger transition preview
2. Verify modal overlay centered
3. Verify iframe renders properly
4. Verify transition select dropdown works

#### F. Find & Replace
1. Press Ctrl+H or trigger Find/Replace
2. Verify text colors correct (not default browser colors)
3. Verify input fields visible and styled

#### G. Animation Timeline
1. If accessible, open Animation Timeline
2. Verify step labels and element items have correct colors
3. Verify drag-and-drop zones visible

### Step 5.4 — E2E Test Suite

```bash
cd client && npx playwright test
```

Or if E2E tests are in a different location:
```bash
npm run test:e2e
```

**Expected:** All existing E2E tests pass. If any test fails:
1. Identify if failure is related to our changes (selector changes, etc.)
2. Update test selectors if needed
3. Re-run and verify

### Step 5.5 — Dark/Light Mode Verification

1. Browser subagent: Toggle to **Light Mode**
2. Verify all text readable against light backgrounds
3. Verify borders visible
4. Toggle to **Dark Mode**
5. Verify same components render correctly

## Success Criteria

- [ ] `npm run build` passes with 0 errors
- [ ] All grep checks return 0 results (no orphaned classes remain)
- [ ] SlideSorterView renders correctly (styled grid overlay)
- [ ] TransitionPreview renders correctly (centered modal)
- [ ] SlidePanel context menu appears styled
- [ ] Slide thumbnails have visible spacing
- [ ] Shape picker submenu fully visible (not clipped)
- [ ] Table size picker fully visible (not clipped)
- [ ] Speaker Notes handler focuses notes textarea (not presenter)
- [ ] Toolbar color indicators visible
- [ ] Modal animations work (zoom-in on open)
- [ ] Find/Replace bar text colors correct
- [ ] Animation Timeline colors correct
- [ ] E2E tests pass (or failures documented as pre-existing)
- [ ] Dark mode visual check passes
- [ ] Light mode visual check passes

## Risk Assessment

- **E2E tests may fail** due to selector changes if tests reference old CSS class names
- **Theme switching** may reveal color issues where inherited values worked before but explicit tokens now differ
- **Transition Preview** may be hard to trigger in automated testing — may need manual verification
