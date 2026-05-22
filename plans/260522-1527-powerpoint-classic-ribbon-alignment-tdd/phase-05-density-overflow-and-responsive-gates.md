# Phase 05: Density Overflow And Responsive Gates

## Context Links

- Existing E2E: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Existing helper: `C:\Work\NavSlidesEditor\tests\e2e\pages\ribbon-tab-toolbar-helper.js`
- Prior plan: [Editor Ribbon Layout Hardening TDD](../260517-2252-editor-ribbon-layout-hardening-tdd/plan.md)

## Overview

Priority: P0  
Status: Complete  
Goal: enforce classic density without clipping/overlap, while accepting intentional horizontal scroll at narrow widths.

<!-- Updated: Validation Session 1 - keep ribbon height at 80px; solve pressure through density/scope, row scroll, or existing dropdowns. -->

## Key Insights

- Current tests already check clipping, overlap, vertical overflow, header pressure.
- There is an existing `fixme` for Insert overflow at 1024px.
- Classic desktop ribbon can scroll/collapse under pressure, but critical controls must not be clipped.
- Critical controls must be explicit by tab/state before assertions are meaningful.

## Requirements

- Functional: no listed critical control clipping or offscreen placement at 1280px.
- Functional: no overlap or vertical overflow from 1280 to 768.
- Non-functional: no document-level horizontal overflow from header/ribbon.

## Architecture

Metrics model should distinguish:

```text
panel overflow = acceptable horizontal scroll in narrow viewports
active row overflow = canonical command-row scroll; must be measured directly
control clipping = not acceptable
control overlap = not acceptable
document overflow = not acceptable
critical outside visible area at 1280 = not acceptable
```

Critical visible controls at 1280px:

| State | Controls |
| --- | --- |
| Home idle | Paste, Add slide |
| Home text editing | Font family, Font size, Paragraph |
| Insert default | Add text, Insert shape, Add chart, Add video, Audio / Upload, Open media library, Add HTML embed, Add SVG, Add drawing, Add divider, Advanced |
| Design default | Change theme, Change slide background |
| Format empty | Selection message |
| Format shape | Fill color, Stroke color, X position, Width, Align left, Toggle lock |
| Transitions default | Change transition |
| Animations default | Toggle animation |
| View default | Find & Replace, Animation Timeline, Custom CSS, Speaker Notes |

At 1024/900/768px these controls may require horizontal row scroll, but must remain reachable by keyboard and must not clip or overlap.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\pages\ribbon-tab-toolbar-helper.js`
- Modify app files only if tests reveal real clipping.

## Implementation Steps

1. Improve `getRibbonLayoutMetrics` to query the active `tabpanel`, `data-ribbon-content-row`, `data-ribbon-section`, and `data-ribbon-section-label`.
2. Add assertions:
   - first section is left-flow relative to active row.
   - listed critical controls are inside visible row at 1280px.
   - no clipped visible text, control overlap, or vertical overflow at supported widths.
3. Replace the existing 1024 Insert `fixme`: horizontal scroll is ok; clipping/overlap/vertical overflow is not ok.
4. Fix any source CSS/class issues found.
5. Keep ribbon height at `80px`. If controls cannot fit, reduce density/scope or move non-critical actions behind existing dropdowns; do not raise height in this plan.

## Phase Tests

- `npm run test:e2e -- tests/e2e/ribbon-layout.spec.js --project=chromium`
- `npm run test:e2e -- tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium`
- `npm run build`

## Todo List

- [x] Extend metrics helper.
- [x] Add label fit/section overlap checks.
- [x] Re-run all viewport matrix cases.
- [x] Replace Insert 1024px `fixme` with scroll-aware assertions.
- [x] Fix only actual failures.

## Success Criteria

- 1280px: listed critical controls visible without row scroll.
- 1024/900/768: scroll allowed, no clipping/overlap/vertical overflow.
- Header still no document overflow.

## Risk Assessment

- Risk: over-constraining 768px. Mitigation: assert usability and keyboard reachability, not full visibility.
- Risk: snapshot-only validation hides issues. Mitigation: geometry first, snapshots second.
- Risk: helper becomes a pixel-test framework. Mitigation: only measure row origin, critical controls, clipping, overlap, and vertical overflow.

## Security Considerations

- None.

## Next Steps

- Phase 06 handles visual snapshots, keyboard, and accessibility final gates.

## Unresolved Questions

- None. The 1024px Insert `fixme` must be replaced by scroll-aware assertions in this plan.
