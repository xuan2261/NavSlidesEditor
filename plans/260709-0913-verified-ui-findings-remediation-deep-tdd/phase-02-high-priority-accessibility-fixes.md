---
phase: 2
title: "High Priority Accessibility Fixes"
status: pending
priority: P0
dependencies: [1]
effort: "1-2 dev-days"
---

# Phase 2: High Priority Accessibility Fixes

## Overview

Fix the highest-impact keyboard and assistive technology defects outside the canvas: Command Palette modal semantics, slide thumbnail invisible focus targets, and Home/Media file import controls.

## Requirements

- Functional: Command Palette behaves like a modal dialog with focus trap, Escape close, backdrop close, and focus restore.
- Functional: slide thumbnail Duplicate/Delete controls are not reachable while visually hidden, but remain reachable when the slide item is focused.
- Functional: all import/upload actions are operable via keyboard and have button semantics.
- Non-functional: reuse existing `ModalShell`, `Button`, and utility patterns where possible.

## Architecture

- Refactor `CommandPalette` onto `ModalShell` or `useModalFocusTrap` while preserving its custom listbox-like command search.
- Focus restore rule:
  - opened from a focused trigger or button: restore that element on close;
  - opened by global shortcut: restore the previously focused editor/workspace element when still connected;
  - if no prior focus target remains, focus the editor canvas/workspace fallback.
- Use one valid result pattern:
  - preferred: keep the input simple and make result rows real buttons with active styling, without `aria-selected`;
  - alternate: implement a complete `listbox`/`option` pattern with `aria-activedescendant`.
- For slide thumbnail controls, the thumbnail/card remains the first focusable target. It reveals actions on `focus-within`; action buttons then become focusable and have accessible names.
- Replace `<label><input className="hidden"></label>` patterns with `Button` + `useRef` + hidden file input. Use visually-hidden input only when needed for browser file picker behavior.

## Related Code Files

- Modify: `client/src/components/command-palette.jsx`
- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/components/MediaLibraryModal.jsx`
- Modify: `client/src/components/ui/ModalShell.jsx` only if existing trap needs minor extension
- Modify tests from Phase 1 for these components

## Implementation Steps

1. Implement Command Palette as an accessible dialog:
   - labelled title, `aria-modal`, `aria-labelledby`;
   - focus search input on open;
   - trap Tab inside palette;
   - restore focus to opener on close;
   - support global-shortcut open by restoring previous editor/workspace focus or a canvas/workspace fallback;
   - close on Escape and backdrop.
2. Convert command rows from clickable `li` to real buttons with keyboard activation and visual active styling. Do not use `aria-selected` on buttons.
3. Update SlidePanel thumbnail actions:
   - add `group-focus-within:opacity-100`;
   - make the slide thumbnail/card focus reveal the actions before action focus is required;
   - keep action buttons out of the tab order only when the owning thumbnail/card is not hover/focus-visible;
   - ensure `Duplicate slide X` and `Delete slide X` labels.
4. Refactor Home import actions:
   - create refs for PPTX/PDF/Markdown/Project inputs;
   - render `Button` controls that call `.click()`;
   - keep `accept` and reset value behavior.
5. Refactor MediaLibrary Upload control similarly.
6. Unit-test `.click()` on hidden input refs. Playwright should verify button reachability/tab order only, not native file picker windows.
7. Run targeted tests, then fix regressions from changed focus order.

## Success Criteria

- [ ] `CommandPalette` passes dialog/focus trap tests.
- [ ] `CommandPalette` focus restore passes trigger-open and global-shortcut-open tests.
- [ ] Keyboard tab order never lands on invisible thumbnail controls.
- [ ] Home import and Media Upload controls are discoverable by `getByRole('button', { name })`.
- [ ] Enter/Space activates import/upload buttons.
- [ ] Existing command palette filtering and Enter selection behavior remains unchanged.
- [ ] Command Palette result roles use a valid ARIA pattern.
- [ ] Targeted unit tests pass.

## Risk Assessment

- Risk: focus trap conflicts with editor shortcuts. Mitigation: Command Palette should stop propagation only for keys it handles and preserve input typing.
- Risk: file input click behavior differs in tests. Mitigation: unit-test button semantics and mock `.click()`.
- Risk: thumbnail actions become visually noisy. Mitigation: show on hover/focus-within, not permanently.
