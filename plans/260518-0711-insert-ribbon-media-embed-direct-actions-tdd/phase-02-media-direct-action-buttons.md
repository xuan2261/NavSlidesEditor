---
phase: 2
title: "Media Direct Action Buttons"
status: complete
effort: "2-4h"
---

# Phase 2: Media Direct Action Buttons

## Context Links

- [Insert tab](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx)
- [Button component](../../client/src/components/ui/Button.jsx)
- [Phase 1 tests](./phase-01-tdd-baseline-and-layout-budget.md)

## Overview

Priority: P1. Replace `Media` dropdown trigger with direct icon-only buttons while preserving handlers.

## Key Insights

- Media has conditional `File Browser`.
- Direct icon-only buttons reduce click depth from 2 to 1.
- Use `variant="icon"` with explicit `h-7 w-7`, `title`, `aria-label`.

## Requirements

Functional:
- `Add video` opens existing `PromptPopover`.
- `Audio / Upload` calls existing upload flow.
- `Open media library` calls `onOpenMediaLibrary`.
- `Open file browser` appears only when `onOpenFileBrowser` exists.

Non-functional:
- No visible text inside icon-only buttons.
- Enter/Space activation works.
- No new package.

## Architecture

Keep `RibbonSection label="Media"`. Replace `RibbonDropdownMenuGroup` usage with a `div` row of `Button variant="icon"` controls. Reuse existing `handleKeyboardActivation`.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`

Create: None.

Delete: None.

## Implementation Steps

1. Remove `RibbonDropdownMenuGroup` usage from Media section only.
2. Add direct `Button variant="icon"` for video:
   - `title="Add video"`
   - `aria-label="Add video"`
   - action: `setShowVideoPrompt(true)`.
3. Add direct button for audio/upload:
   - `title="Audio / Upload"`
   - action: `handleFileUpload('audio/*,video/*', handleMediaUpload)`.
4. Add direct button for media library:
   - `title="Open media library"`.
5. Conditionally add direct button for file browser:
   - `title="Open file browser"`.
6. Re-run Phase 1 layout spec. Fix spacing only if 1280 overflows.

## Todo List

- [x] Convert Media dropdown to direct buttons.
- [x] Preserve video prompt behavior.
- [x] Preserve audio/video upload behavior.
- [x] Preserve conditional file browser behavior.
- [x] Run focused layout test.

## Success Criteria

- Phase 1 Media direct-action tests pass.
- 1280 Insert no overflow, no clipping, no overlaps.
- Existing Video URL prompt still opens.

## Verification

```powershell
$env:PLAYWRIGHT_CLIENT_PORT=4283; $env:PLAYWRIGHT_SERVER_PORT=4312; npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium
```

## Risk Assessment

- Risk: 4 media buttons push layout over budget. Mitigation: reduce `RibbonSection` horizontal padding for Media/Embed to `px-1.5` before changing architecture.
- Risk: upload opens file picker in E2E. Mitigation: existing tests should use route/fixture or verify button visibility, not force OS picker where unsupported.

## Security Considerations

- Upload handling unchanged.
- Media URL prompt unchanged.

## Next Steps

Proceed to Embed direct buttons.
