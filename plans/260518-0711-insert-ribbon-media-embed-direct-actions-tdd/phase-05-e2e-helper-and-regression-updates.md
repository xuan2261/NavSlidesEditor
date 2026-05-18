---
phase: 5
title: "E2E Helper And Regression Updates"
status: complete
effort: "3-4h"
---

# Phase 5: E2E Helper And Regression Updates

## Context Links

- [RibbonInsertHelper](../../tests/e2e/pages/RibbonInsertHelper.js)
- [Ribbon layout spec](../../tests/e2e/ribbon-layout.spec.js)
- [Coverage gaps spec](../../tests/e2e/coverage-gaps.spec.js)
- [Toolbar elements spec](../../tests/e2e/toolbar-elements.spec.js)

## Overview

Priority: P1. Align Playwright helpers/specs with the new direct Media/Embed UI while preserving public helper aliases.

## Key Insights

- Existing helper callers should not need to know UI internals.
- `Advanced` remains grouped, so only Media/Embed mappings should change.
- Coverage spec has local grouped item mapping that must be updated.

## Requirements

Functional:
- `clickInsertMenuItem('Media Library')` clicks direct `Open media library`.
- `clickInsertMenuItem('Embed HTML')` clicks direct `Add HTML embed`.
- `clickInsertMenuItem('Video')`/`Add video` opens Video URL prompt via direct button.
- Game aliases still route through `Advanced -> Games...`.

Non-functional:
- Avoid arbitrary waits where role selectors can wait.
- Keep helper names backward compatible.

## Architecture

Update `RibbonInsertHelper`:
- Remove Media/Embed entries from `GROUPED_ITEMS`.
- Keep Advanced entries in `GROUPED_ITEMS`.
- Keep alias map mapping old labels to direct aria labels.
- Keep `MENU_ITEM_LABELS` only for Advanced or any remaining menu items.

Update `coverage-gaps.spec.js` local `getInsertItem`:
- Direct path for Video/Audio/Drawing/SVG where possible.
- Preserve menu path only for Advanced if used.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\coverage-gaps.spec.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\toolbar-elements.spec.js` only if direct labels require updates.

Create: None.

Delete: None.

## Implementation Steps

1. Update `RibbonInsertHelper.GROUPED_ITEMS`:
   - Remove Media group aliases.
   - Remove Embed group aliases.
   - Keep Advanced aliases.
2. Update alias map:
   - `Video` -> `Add video`.
   - `Audio` -> `Audio / Upload`.
   - `Media Library` -> `Open media library`.
   - `Embed HTML` -> `Add HTML embed`.
   - `Drawing Canvas` -> `Add drawing`.
   - `SVG` -> `Add SVG`.
3. Update `coverage-gaps.spec.js` `groupedItems`:
   - Remove Video/Audio/Drawing/SVG group mapping.
   - Return direct buttons for those labels.
4. Update `ribbon-layout.spec.js` comments/assertions to reflect direct Media/Embed, Advanced grouped.
5. Run targeted insertion suites.

## Todo List

- [x] Update `RibbonInsertHelper`.
- [x] Update `coverage-gaps.spec.js`.
- [x] Update layout spec critical controls/comments.
- [x] Run insertion and coverage E2E.

## Success Criteria

- Existing page-object API remains compatible.
- Direct Media/Embed insertion/open flows pass.
- Advanced game insertion still passes.

## Verification

```powershell
$env:PLAYWRIGHT_CLIENT_PORT=4287; $env:PLAYWRIGHT_SERVER_PORT=4316; npx playwright test tests/e2e/toolbar-elements.spec.js --project=chromium
$env:PLAYWRIGHT_CLIENT_PORT=4288; $env:PLAYWRIGHT_SERVER_PORT=4317; npx playwright test tests/e2e/coverage-gaps.spec.js --project=chromium
$env:PLAYWRIGHT_CLIENT_PORT=4289; $env:PLAYWRIGHT_SERVER_PORT=4318; npx playwright test tests/e2e/games/game-elements.spec.js --project=chromium
```

## Risk Assessment

- Risk: removing grouped mappings breaks old tests that rely on menu labels. Mitigation: aliases map old user-facing names to new direct aria labels.
- Risk: duplicate accessible labels. Mitigation: use exact role selectors.

## Security Considerations

- No security logic change.

## Next Steps

Run final verification and update docs.
