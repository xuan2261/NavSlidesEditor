---
phase: 4
title: "Insert Tab Compact Grouping"
status: complete
effort: "4-6h"
---

# Phase 4: Insert Tab Compact Grouping

## Context Links

- [Insert tab](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx)
- [Ribbon insert helper](../../tests/e2e/pages/RibbonInsertHelper.js)
- [Toolbar insertion spec](../../tests/e2e/toolbar-elements.spec.js)
- [Game element constants](../../client/src/constants/game-element-types-constants.js)

## Overview

Priority: P1. Compact Insert tab without burying core authoring actions. Keep Basic/Shapes/Content visible. Group low-frequency Media/Embed/Advanced/Games.

## Key Insights

- Insert scrollWidth 1021px inside 840px at 1280px.
- At 1024px and below, Media/Embed/Interactive/Games are mostly outside visible ribbon.
- Discoverability matters; do not hide Text/Shape/Chart/Table/Code/Markdown/LaTeX/QR aggressively.

## Requirements

Functional:
- Keep Basic, Shapes, Content visible at desktop.
- Add groups:
  - Media: video, audio/upload, media library, file browser.
  - Embed: HTML, SVG, drawing, divider.
  - Advanced: kinetic text, math grid, Anime.js, Three.js, timeline, games.
- Preserve shape gallery, table picker, video URL, game dropdown behavior.
- Existing insertion flows still pass.

Non-functional:
- Dropdowns keyboard/focus accessible.
- No new external package.
- Avoid mega component; split only if file grows further.

## Architecture

Recommended:
- `RibbonMenuGroup`: reusable dropdown trigger for grouped commands.
- `RIBBON_INSERT_GROUPS`: local config mapping command id, icon, label, handler.

Keep shape/table custom popovers separate because they are special pickers.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\toolbar-elements.spec.js`

Create:
- Optional: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-menu-group.jsx`
- Optional: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-menu-group.test.jsx`

Delete: None.

## TDD Tests First

1. Add component test for group menu:
   - Trigger has `aria-expanded`.
   - Menu opens below trigger.
   - Menu item click invokes handler and closes.
2. Update insertion E2E helpers to open group then command.
3. Add layout E2E:
   - At 1280px Insert critical triggers visible: Text, Shape, Chart, Table, Media, Embed, Advanced.
   - No clipped text in grouped triggers.

## Implementation Steps

1. Add `RibbonMenuGroup` with explicit button and accessible menu/list.
2. Convert Media section into one trigger + menu.
3. Convert Embed section into one trigger + menu.
4. Convert Interactive + Games into Advanced trigger.
5. Keep upload error and video prompt behavior unchanged.
6. Update `RibbonInsertHelper` selectors.
7. Run insertion tests.

## Todo List

- [ ] Add group component tests.
- [ ] Add Insert layout failing test.
- [ ] Implement Media group.
- [ ] Implement Embed group.
- [ ] Implement Advanced group.
- [ ] Update E2E helpers and insertion tests.

## Success Criteria

- Insert tab fits critical triggers at 1280px.
- All existing insert actions still executable.
- `toolbar-elements.spec.js` passes.

## Risk Assessment

- Hidden controls reduce discoverability. Mitigation: use domain labels, not generic `More`.
- Click-away/menu focus bugs. Mitigation: reuse File/AI/Share dropdown pattern where practical.

## Security Considerations

- File upload behavior unchanged.
- HTML/SVG trusted author content policy unchanged.

## Verification

```powershell
npm run test -- --run client/src/components/ribbon
npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
```

## Next Steps

Proceed to Home text-editing compaction.
