---
phase: 3
title: "Embed Direct Action Buttons"
status: complete
effort: "2-4h"
---

# Phase 3: Embed Direct Action Buttons

## Context Links

- [Insert tab](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx)
- [Coverage gaps spec](../../tests/e2e/coverage-gaps.spec.js)

## Overview

Priority: P1. Replace `Embed` dropdown trigger with direct icon-only buttons while preserving HTML/SVG/drawing/divider behavior.

## Key Insights

- Embed actions are core element creation actions.
- SVG still needs file input handling.
- HTML Embed opens existing dialog/flow through `onAddHtml`.

## Requirements

Functional:
- `Add HTML embed` directly invokes `onAddHtml`.
- `Add SVG` directly opens SVG file picker and passes text to `onAddSvg`.
- `Add drawing` directly invokes `onAddDrawing`.
- `Add divider` directly invokes `onAddDivider`.

Non-functional:
- Icon-only accessible labels stable.
- Enter/Space activation works.
- No visible text clipping.

## Architecture

Keep `RibbonSection label="Embed"`. Add direct icon-only button row. SVG file input code can remain inline initially; extract only if readability suffers.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`

Create: None unless extraction needed.

Delete: None.

## Implementation Steps

1. Remove `RibbonDropdownMenuGroup` usage from Embed section.
2. Add direct HTML button:
   - `title="Add HTML embed"`
   - `aria-label="Add HTML embed"`.
3. Add direct SVG button:
   - `title="Add SVG"`
   - preserve `.svg,image/svg+xml` input flow.
4. Add direct Drawing button:
   - `title="Add drawing"`.
5. Add direct Divider button:
   - `title="Add divider"`.
6. Re-run focused layout tests. If overflow returns, reduce section padding/gaps before reconsidering grouping.

## Todo List

- [x] Convert Embed dropdown to direct buttons.
- [x] Preserve SVG file read behavior.
- [x] Preserve HTML/drawing/divider callbacks.
- [x] Verify keyboard activation.
- [x] Run focused layout tests.

## Success Criteria

- Phase 1 Embed direct-action tests pass.
- HTML Embed and Drawing insertion E2E still pass.
- 1280 Insert no overflow, no clipping, no overlaps.

## Verification

```powershell
$env:PLAYWRIGHT_CLIENT_PORT=4284; $env:PLAYWRIGHT_SERVER_PORT=4313; npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium
$env:PLAYWRIGHT_CLIENT_PORT=4285; $env:PLAYWRIGHT_SERVER_PORT=4314; npx playwright test tests/e2e/toolbar-elements.spec.js --project=chromium
```

## Risk Assessment

- Risk: SVG button cannot be fully E2E clicked due OS file picker. Mitigation: assert direct button presence and keep helper path compatible; existing SVG coverage may use route-level or file chooser APIs.
- Risk: file grows. Mitigation: extract `createSvgFileInput` helper inside same file or focused utility only if needed.

## Security Considerations

- Trusted SVG author content policy unchanged.

## Next Steps

Proceed to Advanced flyout hardening.
