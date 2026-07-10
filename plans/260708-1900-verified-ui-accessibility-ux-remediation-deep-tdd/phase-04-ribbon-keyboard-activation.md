---
phase: 4
title: "Ribbon Keyboard Activation"
status: pending
priority: P1
dependencies: [1]
effort: "1-2 dev-days"
---

# Phase 4: Ribbon Keyboard Activation

## Overview

Normalize ribbon and toolbar activation so every visible command works with pointer, Enter, and Space exactly once, without breaking TipTap/canvas selection preservation.

## Requirements

- Functional: all ribbon buttons, big buttons, dropdown triggers, menu items, and tab controls must be keyboard operable.
- Functional: disabled controls cannot activate by keyboard.
- Functional: no double activation from keydown plus native click.
- Non-functional: preserve existing `onMouseDown preventDefault` patterns where they intentionally keep editor selection alive.

## Architecture

Introduce a small shared activation helper or component-level `onAction` convention. Native `<button>` controls should prefer `onClick` when selection preservation is not required. Controls that must use `onMouseDown` need an explicit `onKeyDown` path for Enter/Space and tests proving single activation.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-big-button.jsx`
- Modify: `client/src/components/ribbon/controls/clipboard-buttons.jsx`
- Modify: `client/src/components/ribbon/ribbon-view-mode-controls-content.jsx`
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify: `client/src/components/ribbon/transitions-tab-content.jsx`
- Modify: `client/src/components/ribbon/design-tab-content.jsx`
- Modify: `client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx`
- Modify: `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx`
- Tests: `client/src/components/ribbon/*.test.jsx`
- E2E: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`

## Implementation Steps

1. Inventory all `onMouseDown` usages in `client/src/components/ribbon/`, plus non-button clickables and command-like controls. Create an allowlist only for controls that are proven non-action surfaces, with a reason per entry.
2. Classify each usage:
   - semantic button can use `onClick`
   - needs pointer `preventDefault` but also keyboard handler
   - non-button needs conversion to `<button>`
3. Fix the missing focus token by replacing `focus-visible:ring-ring` with `focus-visible:ring-focus`, unless a deliberate `ring` token is added in Phase 1.
4. Update `RibbonBigButton` API to support a single `onAction` path if needed. Keep backward compatibility only if tests require it.
5. Update clipboard, view-mode, format-position, transitions, design, and dropdown controls to support Enter/Space.
6. Add tests:
   - mouse activates once
   - Enter activates once
   - Space activates once
   - repeated keydown does not repeatedly execute a command unless the control explicitly supports repeated action
   - disabled does not activate
   - focus ring class uses an existing token
7. Add a static inventory test or source contract that fails when a new ribbon `onMouseDown` action lacks keyboard activation or an allowlist rationale.
8. Extend keyboard-only Playwright spec to traverse ribbon tabs/actions.
9. Run targeted ribbon tests and Playwright ribbon/a11y slice.

## Success Criteria

- [ ] No ribbon command is pointer-only unless it has a separate documented shortcut and is not focusable.
- [ ] Enter/Space activate each control exactly once.
- [ ] Held/repeated Enter or Space does not cause accidental duplicate command execution.
- [ ] Ribbon `onMouseDown` inventory is complete, tested, and allowlisted where necessary.
- [ ] Focus rings render from defined tokens.
- [ ] Existing editor selection is not lost when using formatting commands.

## Risk Assessment

- Risk: double activation from native click and custom keydown.
  - Mitigation: avoid custom key handlers on normal buttons unless `onMouseDown` bypasses click; test counts.
- Risk: TipTap selection lost when converting to `onClick`.
  - Mitigation: keep selection-preserving mouse path where necessary and add keyboard-specific action path.
