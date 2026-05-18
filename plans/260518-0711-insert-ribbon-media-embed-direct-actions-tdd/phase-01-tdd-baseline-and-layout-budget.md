---
phase: 1
title: "TDD Baseline And Layout Budget"
status: complete
effort: "2-3h"
---

# Phase 1: TDD Baseline And Layout Budget

## Context Links

- [Scout report](./reports/scout-report.md)
- [Design decision](./reports/design-decision-report.md)
- [Ribbon layout spec](../../tests/e2e/ribbon-layout.spec.js)
- [EditorPage metrics](../../tests/e2e/pages/EditorPage.js)

## Overview

Priority: P1. Add failing tests that encode the desired Insert UX before changing components.

## Key Insights

- Current tests expect `Media`, `Embed`, `Advanced` trigger buttons.
- New behavior expects direct buttons for Media/Embed actions.
- Static width math is unreliable; use browser metrics.

## Requirements

Functional:
- Add/adjust tests so current dropdown Media/Embed fails.
- Assert direct Media/Embed buttons are visible at 1280px.
- Assert Insert still has no 1280 horizontal overflow.

Non-functional:
- Tests must use real DOM accessible names.
- Tests must not assume implementation class names beyond existing metrics helpers.

## Architecture

Use existing Playwright `getRibbonLayoutMetrics('Insert')` and role selectors. Extend `CRITICAL_VISIBLE_CONTROLS.Insert` to include direct Media/Embed action labels after final behavior.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\pages\EditorPage.js` only if current metrics cannot express direct-action checks.

Create: None.

Delete: None.

## Implementation Steps

1. Add test: `Insert tab exposes Media actions as direct buttons at 1280px`.
2. Add test: `Insert tab exposes Embed actions as direct buttons at 1280px`.
3. Update critical controls list:
   - Keep `Add text`, `Insert shape`, `Add chart`, `Advanced`.
   - Add `Add video`, `Audio / Upload`, `Open media library`, `Add HTML embed`, `Add SVG`, `Add drawing`, `Add divider`.
   - Add `Open file browser` if EditorPage context wires it.
4. Keep existing no-clipping/no-overlap assertions.
5. Run the focused spec and confirm intended failure before implementation.

## Todo List

- [x] Add direct Media action layout test.
- [x] Add direct Embed action layout test.
- [x] Update 1280 critical controls.
- [x] Confirm tests fail against current dropdown implementation.

## Success Criteria

- Current implementation fails because Media/Embed actions are not direct buttons.
- Existing metric helper still reports useful overflow/clipping/overlap data.

## Verification

```powershell
$env:PLAYWRIGHT_CLIENT_PORT=4282; $env:PLAYWRIGHT_SERVER_PORT=4311; npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium
```

Expected during this phase: failing tests proving TDD gate.

## Risk Assessment

- Risk: accessible label mismatch causes false failure. Mitigation: align with existing helper aliases and call-site labels.
- Risk: `Open file browser` not present in some contexts. Mitigation: make assertion conditional only if the button exists in EditorPage wiring, or test a component-level context later.

## Security Considerations

- No runtime behavior change.

## Next Steps

Proceed to direct Media implementation.
