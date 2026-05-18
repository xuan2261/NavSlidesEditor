# Red Team Review Report

**Date:** 2026-05-17
**Reviewer:** code-reviewer (adversarial)
**Verdict:** PASS WITH CONCERNS

## Critical Findings (Fixed)

### C1. E2E tests break on Phase 8 deletion
Phase 8 deleted old components without updating E2E tests. **FIX:** Split Phase 8 into 8a (Format tab) and 8b (E2E migration + cleanup). Phase 8b updates all 7 E2E files BEFORE deletion.

### C2. Duplicate Insert Quick controls
Home tab "Insert Quick" and Insert tab both have Text/Image/Shape/Chart. **FIX:** Defined Insert Quick as "one-click default" (Shape inserts rectangle without gallery) vs Insert tab full picker.

### C3. Ctrl+Shift+R shortcut conflict
Browser hard refresh shortcut cannot be intercepted. **FIX:** Changed to `Ctrl+Alt+R`.

## High Findings (Fixed)

### H1. TipTap selection across tab switches
No test for selection preservation after tab switch. **FIX:** Added explicit test in Phase 2.

### H2. useRibbon localStorage cleanup
Stale flag after Phase 8 removal. **FIX:** Added `localStorage.removeItem` in Phase 8b Step 14.

### H3. Phase 8 effort too low (3d → 5d)
12 new files, 3 deletions, 7+ E2E files, PropertiesPanel extraction. **FIX:** Split into 8a (3d) + 8b (2d).

### H4. Animation preview underspecified
Play/Step/Close buttons not described. **FIX:** Added delegation to AnimationTimeline + fragment navigation.

### H5. Phase 2→3 hidden dependency
useElementInsertion hook created in Phase 2 but Phase 3 needs it. **FIX:** Moved hook extraction to Phase 1 Step 11.

## Medium Findings (Applied)

### M2. Page Numbers toggle duplicates Footer
View tab and Design tab both control page numbers. **FIX:** Removed from View tab, kept in Design > Footer.

### M3. ribbonCollapsed never implemented
Dead code from Phase 1. **FIX:** Removed from Phase 1, deferred to post-launch.

## Medium Findings (Noted)

### M1. Background controls LOC underestimated
100 LOC is optimistic for gradient editor. Note for implementation.

### M4. No responsive tests
No viewport tests at 375px/768px. Should add in Phase 1 and Phase 8b.

### M5. Per-slide transition scope selector is new UX
Added explicit test for "Use presentation default" flow.

### M6. PropertiesPanel extraction may break tests
Added "Read PropertiesPanel.test.jsx first" as Step 1 in Phase 8a.

## Low Findings (Noted)

- L1: localStorage key name now specified (`navslides-ribbon-active-tab`)
- L2: Icon subset (~100) to be curated during implementation
- L3: No bundle size budget — consider adding
- L4: Delete files one at a time with build check (applied in Phase 8b)

## Summary

All critical and high findings addressed. Plan is now implementation-ready.
