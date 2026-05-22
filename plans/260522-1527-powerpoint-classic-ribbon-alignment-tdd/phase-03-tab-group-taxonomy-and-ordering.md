# Phase 03: Tab Group State Matrix And Ordering

## Context Links

- [Research summary](./research/powerpoint-classic-ribbon-research-summary.md)
- Existing docs: `C:\Work\NavSlidesEditor\docs\design-guidelines.md`
- Existing Insert tests: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.test.jsx`

## Overview

Priority: P1  
Status: Complete  
Goal: define the minimal state-specific group/order matrix needed for tests, without broad label churn.

## Key Insights

- Home and Insert are already close; do not rename healthy groups.
- Conditional tabs need state-aware expectations.
- Use current group labels as stable anchors unless a failing test proves an outlier.

## Requirements

- Functional: required group presence/order documented by tab state.
- Non-functional: direct common actions remain direct.
- Avoid broad redesign.

## Architecture

State matrix:

| State | Required Groups / Order |
| --- | --- |
| Home idle | Clipboard, Text, Canvas, Arrange |
| Home text editing | Clipboard, Font, Paragraph, Canvas, Arrange |
| Insert default | Basic, Shapes, Content, Media, Embed, Advanced |
| Design default | Existing visible groups only; no rename unless failing gate proves drift |
| Transitions default | Transition, Slide, Speed, Auto-Advance, Preview |
| Animations default | Animation, Order, Preview |
| View default | Show, Tools, Window |
| Format empty | Selection |
| Format shape/line | Fill, Stroke, Position, Size, Rotate, Opacity, Align, Properties |
| Format image | Fit, Alt Text, Position, Size, Rotate, Opacity, Align, Properties |
| Format chart | Chart Type, Position, Size, Rotate, Opacity, Align, Properties |

Do not introduce a generic `Contextual` group label.

## Related Code Files

- Modify app files only if a state-matrix test exposes a real missing/misordered group.
- Likely modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify tests: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`

## Implementation Steps

1. Add a `GROUP_STATE_EXPECTATIONS` table in `ribbon-layout.spec.js` with setup steps per state.
2. Test required group set first, then order, at 1280px.
3. For contextual or optional states, make setup explicit; do not use a loose subsequence that can pass after a group disappears.
4. Adjust only labels/order that fail this state matrix.
5. Do not move commands across tabs unless there is a concrete mismatch.
6. Preserve accessible names for buttons.

## Phase Tests

- `npm run test:e2e -- tests/e2e/ribbon-layout.spec.js --project=chromium`
- `npm run test -- client/src/components/ribbon`
- `npm run lint`

## Todo List

- [x] Add state-aware group matrix.
- [x] Confirm current groups against matrix.
- [x] Apply minimal fixes only where matrix fails.
- [x] Verify insertion helpers still pass.

## Success Criteria

- Required states have predictable group presence/order at 1280px.
- No group count explosion.
- Insert direct actions remain direct.

## Risk Assessment

- Risk: strict label order fails when contextual groups hidden. Mitigation: explicit setup per state and separate required/optional expectations.
- Risk: label churn breaks user memory. Mitigation: no rename unless current label blocks the accepted contract.

## Security Considerations

- None.

## Next Steps

- Phase 04 fixes Format contextual alignment and no-selection rhythm.

## Unresolved Questions

- None.
