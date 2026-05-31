---
phase: 6
title: "Header Responsive Pressure Relief"
status: complete
effort: "2-4h"
---

# Phase 6: Header Responsive Pressure Relief

## Context Links

- [EditorPage header](../../client/src/pages/EditorPage.jsx)
- [RibbonHeaderBar](../../client/src/components/ribbon/ribbon-header-bar.jsx)
- [TabBar](../../client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx)
- [QuickAccessToolbar](../../client/src/components/QuickAccessToolbar.jsx)

## Overview

Priority: P2. Reduce header pressure at medium/narrow widths. Secondary to ribbon content compaction but improves perceived layout stability.

## Key Insights

- At 1024px, tablist client width 434px, scrollWidth 611px; `View` is off-screen.
- At 768px, multiple tabs are off-screen.
- Fixed title input and right action labels compete with tabs.

## Requirements

Functional:
- Make title input responsive with lower min pressure.
- Keep File/AI/Share/Present accessible at all widths.
- Use icon-only labels below thresholds.
- Preserve Radix Tabs keyboard semantics.

Non-functional:
- No route/layout rewrite.
- No editor body side panel width change.
- No new state store for responsive mode.

## Architecture

Preferred CSS-only approach:
- Title input: `w-[140px] sm:w-[180px] lg:w-[220px] max-w-[22vw]`.
- Action labels hidden until `lg` if they clip.
- Tab labels already hidden below `sm`; reduce tab padding at `md` if needed.

Avoid:
- Moving tabs to dropdown.
- Changing top header height.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\pages\EditorPage.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-header-bar.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\tab-bar-with-scroll-and-icons.jsx`

Create: None.

Delete: None.

## TDD Tests First

1. Add header metric test:
   - At 1024px and 768px, header has no document-level horizontal overflow.
   - File/AI/Share/Present are visible.
   - Active tab remains switchable by role.
2. Optional component test:
   - TabBar classes include responsive compact padding/labels.

## Implementation Steps

1. Adjust `EditorPage` title input responsive classes.
2. Ensure File/AI/Share text labels are hidden where they clip.
3. Reduce TabBar padding at smaller widths if needed.
4. Preserve `aria-label` on icon-only actions.
5. Re-run header metric tests.

## Todo List

- [ ] Add failing header pressure test.
- [ ] Tune title input width.
- [ ] Tune action label breakpoints.
- [ ] Tune tab padding/label breakpoints.
- [ ] Verify tab navigation.

## Success Criteria

- Header creates no body horizontal overflow at 1024/900/768.
- Important top-level actions remain visible.
- Tabs remain scrollable if necessary, but not visually colliding with right actions.

## Risk Assessment

- Too small title input hurts title editing. Mitigate with wider desktop width and normal input text scrolling.
- Hiding labels reduces clarity. Mitigate with stable `title` and `aria-label`.

## Security Considerations

- No security changes.

## Verification

```powershell
npm run test:e2e -- tests/e2e/editor.spec.js
npm run build
```

## Next Steps

Proceed to full browser verification and docs.
