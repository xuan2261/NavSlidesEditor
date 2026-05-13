# Phase 02 - Shared UI Primitives

## Context Links

- [Plan](./plan.md)
- [Scout report](./reports/scout-report.md)
- `client/src/components/ui/Button.jsx`
- `client/src/components/ui/Input.jsx`
- `client/src/components/ui/Select.jsx`
- `client/src/components/ui/ColorPicker.jsx`

## Overview

- Priority: P1
- Status: Complete
- Effort: 6h
- Goal: make shared controls visually coherent, accessible, and tactile.

## Key Insights

- Button is already centralized and tested.
- Existing icon buttons fallback aria-label from title.
- Many call sites depend on className overrides; keep API stable.

## Requirements

- Functional:
  - Improve primary/secondary/danger/ghost/icon variants.
  - Add visible focus rings.
  - Use ring-shadow style from DESIGN.md.
  - Keep disabled semantics.
  - Keep `Button` props API stable.
- Non-functional:
  - Avoid `transition-all`.
  - Use property-specific transitions.
  - Keep toolbar density reasonable.

## Architecture

Shared primitive contract remains:

```jsx
<Button variant="primary|secondary|danger|ghost|icon" />
<Input />
<Select />
<ColorPicker />
```

## Related Code Files

- Modify: `client/src/components/ui/Button.jsx`
- Modify: `client/src/components/ui/Button.test.js`
- Modify: `client/src/components/ui/Input.jsx`
- Modify: `client/src/components/ui/Select.jsx`
- Modify: `client/src/components/ui/ColorPicker.jsx`
- Optional modify: `client/src/components/ui/index.js`

## Implementation Steps

1. Update base classes:
   - stable min-height for normal buttons.
   - focus-visible ring.
   - explicit transition properties.
2. Update variants:
   - primary uses brand token.
   - secondary uses warm card/sand token.
   - icon remains compact but focusable.
3. Ensure icon-only controls keep aria-label fallback.
4. Align Input/Select heights, radius, background, focus border/ring.
5. Add/adjust tests for class expectations and aria fallback.

## Todo List

- [x] Refactor button variants.
- [x] Refactor input/select visual states.
- [x] Refactor color picker focus state.
- [x] Update tests.
- [x] Run unit tests.

## Verify / Tests

- `npm run test -- --run client/src/components/ui/Button.test.js`
- Add/adjust unit tests for focus/aria classes if existing pattern supports.
- `npm run build`
- Manual: keyboard tab through dashboard header buttons and editor toolbar.

## Success Criteria

- Shared controls feel consistent in light/dark.
- Icon buttons still have accessible names.
- No high-use control visually shifts layout on press.

## Risk Assessment

- Risk: changed class expectations break tests.
- Mitigation: update tests to verify behavior/contract, not exact obsolete colors.

## Security Considerations

- None. UI primitives only.

## Next Steps

- Phase 03 dashboard.

## Implementation Notes

- Existing `primary` variant maps to brand; no new Button API.
- Icon-only `Button` still derives `aria-label` from `title`.
- Input, Select, and ColorPicker now share visible focus treatment.

## Unresolved Questions

- None.
