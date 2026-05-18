---
phase: 2
title: "Button Variant Root Cause Fix Plan"
status: complete
effort: "3-4h"
---

# Phase 2: Button Variant Root Cause Fix Plan

## Context Links

- [Button primitive](../../client/src/components/ui/Button.jsx)
- [Button tests](../../client/src/components/ui/Button.test.js)
- [File dropdown](../../client/src/components/ribbon/ribbon-file-dropdown-menu.jsx)
- [Ribbon header](../../client/src/components/ribbon/ribbon-header-bar.jsx)
- [Insert tab](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx)
- [Format tab](../../client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx)

## Overview

Priority: P1. Fix hard root cause: `variant="icon"` is used for icon+text buttons, but forces `w-8 h-8 !p-0`.

## Key Insights

- Current call-site classes cannot override `!p-0`.
- Do not weaken icon variant globally; many icon-only buttons depend on exact 32x32 behavior.
- New ribbon variant needs accessible-name fallback like icon buttons.

## Requirements

Functional:
- Add shared button variant for ribbon icon+text controls.
- Keep icon-only controls 32x32.
- Update visible-label controls to new variant.
- No behavior changes to handlers, dropdown state, or keyboard focus.

Non-functional:
- Tailwind utilities only.
- Button API backward-compatible.
- Tests lock variant behavior.

## Architecture

Add `ribbon` variant:

```js
ribbon: 'h-8 min-h-8 min-w-8 w-auto shrink-0 px-2 py-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent text-[11px] text-text-secondary hover:bg-hover hover:text-text-primary'
```

Accessible-name rule: `icon` and `ribbon` fallback `aria-label` from `title` if no explicit aria-label.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ui\Button.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ui\Button.test.js`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-file-dropdown-menu.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-header-bar.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`

Create: None unless a tiny `ribbon-button` helper is justified.

Delete: None.

## TDD Tests First

1. Update `Button.test.js`:
   - `icon` keeps `w-8 h-8 !p-0`.
   - `ribbon` has `w-auto`, `min-w-8`, `px-2`, no `!p-0`.
   - `ribbon` title fallback creates accessible name.
2. Run Phase 1 clipping test and verify it still fails before call-site changes.
3. After implementation, clipping test passes for File/Share/Text/Shape/Games.

## Implementation Steps

1. Add `ribbon` variant to `buttonVariants`.
2. Update computed aria-label logic to include `ribbon`.
3. Replace `variant="icon"` with `variant="ribbon"` where button includes visible text:
   - File trigger.
   - AI/Share dropdown triggers if label visible.
   - Insert Text, Shape, Games.
   - Format Properties lock button if label visible.
4. Keep pure icon buttons on `variant="icon"`.
5. Remove conflicting `h-7 px-2` where new variant covers sizing; keep contextual active classes.

## Todo List

- [ ] Add failing Button tests.
- [ ] Add `ribbon` variant.
- [ ] Update call sites.
- [ ] Run unit tests.
- [ ] Run Phase 1 clipping tests.

## Success Criteria

- No visible text control uses `variant="icon"`.
- Icon-only buttons remain 32x32.
- Clipped control count for File/Share/Text/Shape/Games is zero at 1280px.

## Risk Assessment

- New variant can increase header width. Mitigate in Phase 6.
- Class-string tests can be brittle. Assert key utility tokens, not full ordering.

## Security Considerations

- No auth/data change.
- Accessibility improves via stable names.

## Verification

```powershell
npm run test -- --run client/src/components/ui/Button.test.js
npm run test:e2e -- tests/e2e/editor.spec.js
```

## Next Steps

Proceed to Phase 3 for vertical alignment.
