---
phase: 5
title: "Home Text Editing Compact Controls"
status: complete
effort: "4-6h"
---

# Phase 5: Home Text Editing Compact Controls

## Context Links

- [Home tab](../../client/src/components/ribbon/home-tab-content.jsx)
- [Font controls](../../client/src/components/ribbon/controls/ribbon-text-formatting-controls.jsx)
- [Paragraph controls](../../client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.jsx)
- [Selection preservation hook](../../client/src/hooks/use-selection-preservation.js)
- [Toolbar insertion spec](../../tests/e2e/toolbar-elements.spec.js)

## Overview

Priority: P1. Reduce Home tab width while editing text. Keep core typography direct. Move lower-frequency paragraph/advanced actions into compact group(s).

## Key Insights

- Text-editing Home currently extends to x=1489 while visible ribbon ends x=1040 at 1280px.
- TipTap selection preservation is fragile; commands use `onMouseDown` to avoid losing selection.
- Do not add second ribbon row in this plan.

## Requirements

Functional:
- Keep visible: font family, font size, font weight, bold, italic, underline, text color, highlight.
- Group paragraph/advanced actions: align, lists, line height, clear formatting.
- Keep Canvas and Arrange reachable at 1280px in text edit mode.
- Preserve `ProseMirror` mounted during ribbon interactions.

Non-functional:
- No regression to text formatting E2E.
- Group commands still use selection preservation.
- Accessible names stable.

## Architecture

Recommended:
- Keep `FontControls` as inline core controls.
- Replace full inline `ParagraphControls` in Home with `ParagraphMoreControls`.
- Menu commands call `handleTextCommandMouseDown` compatible logic or `runTextCommand` wrapper.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\home-tab-content.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-formatting-and-alignment-controls.jsx`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\toolbar-elements.spec.js`
- `D:\NCKH_2025\NavSlidesEditor\tests\e2e\editor.spec.js`

Create:
- Optional: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-more-controls.jsx`
- Optional test: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-more-controls.test.jsx`

Delete: None.

## TDD Tests First

1. Extend text toolbar E2E:
   - Start editing text.
   - Apply bold, font size, font family.
   - Open paragraph compact group.
   - Apply line height or alignment.
   - Assert `ProseMirror` remains mounted and content updated.
2. Add layout metric:
   - At 1280px text-editing Home outside critical controls count is zero.

## Implementation Steps

1. Define direct controls and grouped controls.
2. Build `ParagraphMoreControls` preserving `rememberSelection` on trigger and menu commands.
3. Replace inline `ParagraphControls` in Home with compact group.
4. Keep `ParagraphControls` if tests/components still import it.
5. Confirm Canvas and Arrange visible at 1280px in text edit mode.
6. Verify Escape/canvas click still exits editing.

## Todo List

- [ ] Add failing text-editing layout test.
- [ ] Add paragraph menu command test.
- [ ] Implement compact paragraph group.
- [ ] Update E2E helper if selectors changed.
- [ ] Run text toolbar regression suite.

## Success Criteria

- Text-editing Home no longer hides Canvas/Arrange at 1280px.
- Text formatting commands preserve selection.
- No `toolbarHintVisible` while editor is active.

## Risk Assessment

- Menu interaction blurs TipTap selection. Mitigate with `onMouseDown.preventDefault`, `rememberSelection`, `runTextCommand`.
- Hiding paragraph controls slows power users. Mitigate with one labeled compact trigger, not nested menus.

## Security Considerations

- No content trust boundary change.

## Verification

```powershell
npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
npm run test:e2e -- tests/e2e/editor.spec.js
```

## Next Steps

Proceed to header responsive pressure relief.
