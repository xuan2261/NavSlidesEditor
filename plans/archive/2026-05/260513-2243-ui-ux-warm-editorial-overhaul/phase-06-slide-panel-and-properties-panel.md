# Phase 06 - Slide Panel And Properties Panel

## Context Links

- [Plan](./plan.md)
- `client/src/components/SlidePanel.jsx`
- `client/src/components/PropertiesPanel.jsx`
- `client/src/components/SelectionPane.jsx`
- `client/src/components/CollapsibleSection.jsx`
- `client/src/components/properties/*.jsx`

## Overview

- Priority: P1
- Status: Complete
- Effort: 7h
- Goal: make dense side panels easier to scan and operate.

## Key Insights

- Panels contain many 10-11px labels.
- Slide thumbnails have tiny overlay controls.
- Properties panel must remain compact but not cramped.

## Requirements

- Functional:
  - Preserve slide add/delete/duplicate/reorder/context menu.
  - Preserve all property controls.
  - Improve label readability and grouping.
  - Improve multi-select and active slide states.
  - Keep thumbnail preview lightweight.
- Non-functional:
  - No canvas model changes.
  - No slide data changes.
  - Avoid nested card-heavy layout.

## Architecture

Panel components remain:

```text
SlidePanel -> slide list + context menu
PropertiesPanel -> common controls + type-specific controls
properties/* -> focused control groups
```

## Related Code Files

- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/components/PropertiesPanel.jsx`
- Modify: `client/src/components/SelectionPane.jsx`
- Modify: `client/src/components/CollapsibleSection.jsx`
- Modify selectively: `client/src/components/properties/*.jsx`
- Tests: `tests/e2e/slide-management.spec.js`, `tests/e2e/properties-panel.spec.js`, `tests/e2e/element-properties.spec.js`

## Implementation Steps

1. Update panel backgrounds/borders to warm tokens.
2. Increase label readability where labels are not space-critical.
3. Standardize input row spacing with 4/8px scale.
4. Improve CollapsibleSection headers:
   - clear active/open state.
   - keyboard focus visible.
5. Improve SlidePanel:
   - active slide ring.
   - selected multi-range indicator.
   - overlay buttons with stable size and contrast.
6. Update context menu states.
7. Migrate property subcomponents gradually.

## Todo List

- [x] Update panel shell styles.
- [x] Update CollapsibleSection.
- [x] Update SlidePanel overlays/context menu.
- [x] Update PropertiesPanel common areas.
- [x] Update high-use property groups.
- [x] Run panel tests.

## Verify / Tests

- `npm run test:e2e -- tests/e2e/slide-management.spec.js`
- `npm run test:e2e -- tests/e2e/properties-panel.spec.js`
- `npm run test:e2e -- tests/e2e/element-properties.spec.js`
- `npm run test -- --run client/src/components/properties`
- `npm run build`
- Manual: edit x/y/w/h/rotation, colors, footer, notes, selection pane.

## Success Criteria

- Panels are easier to scan.
- No lost controls.
- Drag/reorder/context menu still works.
- No significant workspace shrink.

## Risk Assessment

- Risk: property subcomponents are many and inconsistent.
- Mitigation: target common wrappers first, then only high-use controls.

## Security Considerations

- Do not alter custom CSS/HTML content handling.
- Preserve sanitization in thumbnail preview.

## Next Steps

- Phase 07 a11y/responsive/motion.

## Implementation Notes

- Converted `CollapsibleSection` header to a real button with `aria-expanded` and visible focus.
- Added unit coverage for disclosure semantics.
- Updated slide thumbnail active/focus/context menu styling and keyboard selection support.
- Added accessible labels to SelectionPane visibility/lock controls.
- Added `PropertiesPanel` labelled complementary landmark coverage.
- Updated common property lock/layer controls to use Lucide icons instead of structural emoji/glyphs.
- Targeted properties panel e2e tests passed on 2026-05-13.

## Unresolved Questions

- Whether to widen right panel from 240px to 260px. Usability gain vs workspace loss.
