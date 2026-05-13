# Phase 05 - Editor Chrome Toolbar And Insert Controls

## Context Links

- [Plan](./plan.md)
- `client/src/pages/EditorPage.jsx`
- `client/src/components/EditorMenuBar.jsx`
- `client/src/components/QuickAccessToolbar.jsx`
- `client/src/components/Toolbar.jsx`
- `client/src/components/InsertMenu.jsx`
- `client/src/components/DropdownMenu.jsx`
- `client/src/components/FindReplaceBar.jsx`

## Overview

- Priority: P1
- Status: Complete
- Effort: 6h
- Goal: make editor commands scan better without reducing workspace.

## Key Insights

- Toolbar density is required for a presentation editor.
- DESIGN.md ring/elevation can improve hierarchy.
- Need clear active states for tools, color palettes, snapping, rulers.

## Requirements

- Functional:
  - Preserve all commands and shortcuts.
  - Improve visual grouping of toolbar sections.
  - Improve dropdown/menu active/hover/focus states.
  - Keep icon family consistent.
  - Replace structural emoji where present in editor chrome.
- Non-functional:
  - Toolbar height remains close to current.
  - No layout shift when active state changes.
  - Keyboard navigation and shortcuts keep working.

## Architecture

No major architecture change. Use shared primitives and token classes:

```text
EditorPage top shell
  QuickAccessToolbar
  Toolbar
  EditorMenuBar
  DropdownMenu
  InsertMenu
```

## Related Code Files

- Modify: `client/src/components/EditorMenuBar.jsx`
- Modify: `client/src/components/QuickAccessToolbar.jsx`
- Modify: `client/src/components/Toolbar.jsx`
- Modify: `client/src/components/InsertMenu.jsx`
- Modify: `client/src/components/DropdownMenu.jsx`
- Modify: `client/src/components/FindReplaceBar.jsx`
- Tests: `tests/e2e/toolbar-elements.spec.js`, `tests/e2e/find-replace.spec.js`, `tests/e2e/keyboard-shortcuts.spec.js`

## Implementation Steps

1. Review each toolbar button for accessible name.
2. Replace one-off toolbar button classes with shared Button where practical.
3. Use separators and warm surface tokens for grouping.
4. Ensure active states use `aria-pressed` where applicable.
5. Update InsertMenu category spacing and menu focus styling.
6. Update FindReplaceBar with clear error/no-match feedback.
7. Keep command logic untouched.

## Todo List

- [x] Audit toolbar accessible names.
- [x] Normalize toolbar button styles.
- [x] Normalize dropdown/insert menu surfaces.
- [x] Normalize find/replace feedback states.
- [x] Run toolbar/shortcut tests.

## Verify / Tests

- `npm run test:e2e -- tests/e2e/toolbar-elements.spec.js`
- `npm run test:e2e -- tests/e2e/find-replace.spec.js`
- `npm run test:e2e -- tests/e2e/keyboard-shortcuts.spec.js`
- `npm run build`
- Manual: add text/image/shape/table, use bold/italic/color/align.

## Success Criteria

- Commands remain discoverable and compact.
- Active states are visible in both themes.
- Keyboard shortcuts unchanged.

## Risk Assessment

- Risk: toolbar JSX is broad and command-heavy.
- Mitigation: style-only changes first; no command function rewrites.

## Security Considerations

- Do not alter HTML embed, CSS editor, media URL validation.

## Next Steps

- Phase 06 panels.

## Implementation Notes

- Updated `DropdownMenu` trigger/menu styling without forcing incorrect ARIA menu semantics onto mixed checkbox/select/custom content.
- Updated `InsertMenu` transition/focus/feedback styles and added alert semantics for upload failure.
- Updated `FindReplaceBar` focus styling, active toggle states, and live no-match/match feedback.
- Added toolbar unit coverage for toggle and rich-text command `aria-pressed` states.
- Added `aria-pressed` to editor chrome toggles and rich-text active commands where applicable.
- Improved keyboard/label contract for slide background swatches and palette controls.
- Targeted e2e toolbar and keyboard shortcut tests passed on 2026-05-13.

## Unresolved Questions

- Whether to add visible text labels for some top-level commands or keep icon-only with tooltips.
