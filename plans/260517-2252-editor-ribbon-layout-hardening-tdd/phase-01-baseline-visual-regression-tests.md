---
phase: 1
title: "Baseline Visual Regression Tests"
status: complete
effort: "3-4h"
---

# Phase 1: Baseline Visual Regression Tests

## Context Links

- [Ribbon UI Review](../reports/ribbon-ui-review-260517-2235.md)
- [Editor E2E POM](../../tests/e2e/pages/EditorPage.js)
- [Editor regression spec](../../tests/e2e/editor.spec.js)
- [Toolbar insertion spec](../../tests/e2e/toolbar-elements.spec.js)
- [Design guidelines](../../docs/design-guidelines.md)

## Overview

Priority: P1. Create failing tests that reproduce current ribbon issues before implementation. This phase owns test harness only. No UI behavior change.

## Key Insights

- Existing `getToolbarOverflowMetrics()` only checks vertical overflow and misses controls outside visible ribbon width.
- Browser audit found no true button-to-button overlap; failures are clipping, hidden overflow, and inconsistent sizing.
- Need deterministic setup: create presentation, skip product tour, select/edit text element, switch tabs.

## Requirements

Functional:
- Add Playwright helper(s) to collect ribbon layout metrics per active tab.
- Add viewport matrix: 1280, 1024, 900, 768 px.
- Add tests for normal ribbon and text-editing Home state.
- Store no golden screenshots unless existing visual regression pattern requires.

Non-functional:
- Use semantic selectors first.
- Tests must fail on current defects.
- Tests must not depend on user data or external network.

## Architecture

Add metric collection to `EditorPage` POM:

```js
{
  tab,
  viewport,
  panel: { clientWidth, scrollWidth, clientHeight, scrollHeight },
  clippedControls: [{ label, clientWidth, scrollWidth }],
  outsideControls: [{ label, rect }],
  overlaps: [{ a, b, area }]
}
```

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\pages\EditorPage.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\editor.spec.js`

Create:
- Optional: `D:\NCKH_2025\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`

Delete:
- None.

## TDD Tests First

1. Add failing test for icon+text clipping: File/Share/Text/Shape/Games must not have `scrollWidth > clientWidth + 1`.
2. Add failing test for Insert tab critical controls: at 1280px, Basic/Shapes/Content/Media/Embed/Advanced triggers visible.
3. Add failing test for Home text-editing: at 1280px, Font, Paragraph compact trigger, Canvas, Arrange visible or intentionally grouped.
4. Add failing test for Format vertical rhythm: wrappers share stable 28/32px row height.

## Implementation Steps

1. Extend POM with `page.evaluate` metric collector.
2. Add helper to switch ribbon tab by role.
3. Add viewport loop with `page.setViewportSize`.
4. Prefer real failing tests; use `test.fixme` only if current suite would block all future work.
5. Document current expected failures in comments.

## Todo List

- [ ] Add metric collector.
- [ ] Add baseline normal-state tests.
- [ ] Add baseline text-editing tests.
- [ ] Add baseline Format alignment test.
- [ ] Run targeted Playwright tests and capture failing output.

## Success Criteria

- Targeted test command runs and exposes current failures.
- Failures map to report findings, not flaky selectors.
- No product code touched.

## Risk Assessment

- False positives from intentional scroll. Mitigate by distinguishing clipped controls vs scroll container.
- Product tour overlay affects metrics. Mitigate with `navSlidesTutorialSeen=true`.

## Security Considerations

- No security surface change.
- Tests create/delete local presentations through existing API.

## Verification

```powershell
npm run test:e2e -- tests/e2e/editor.spec.js
npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
```

Expected: new tests fail before Phase 2; existing unrelated tests stay green or are documented.

## Next Steps

Proceed to Phase 2 after baseline failures are stable.
