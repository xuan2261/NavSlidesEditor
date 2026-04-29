---
phase: 1
title: 'Migrate Core UI Components'
status: completed
priority: P1
effort: '4h'
dependencies: []
---

# Phase 1: Migrate Core UI Components

## Overview

Migrate fundamental UI building blocks (Buttons, Inputs, Selects, Labels) from globally scoped CSS classes to Tailwind-based components or utility classes. This establishes the foundation for higher-level layouts.

## Requirements

- Functional: Create generic, reusable UI components (`<Button>`, `<Input>`, `<Select>`) that encapsulate Tailwind styling.
- Non-functional: Must strictly match the existing UI Pro Max standards and Dark/Light mode color tokens defined in `tailwind.config.js`.

## Architecture

- Replace `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-icon`, `.btn-ghost` with a centralized `Button` component using `clsx` and `tailwind-merge`.
- Replace `.custom-select` and `.label-caps` with generic Tailwind classes.
- Create a `src/components/ui/` folder for these core components.

## Related Code Files

- Create: `client/src/components/ui/Button.jsx`
- Create: `client/src/components/ui/Input.jsx`
- Modify: `client/src/index.css`
- Modify: `client/src/styles/components.css`

## Implementation Steps

1. Create `Button.jsx` that accepts `variant` (primary, secondary, danger, ghost, icon) and applies Tailwind classes via `cva` or a custom mapper.
2. Refactor existing occurrences of `<button className="btn...">` to `<Button variant="...">` across globally used utility files.
3. Replace `.label-caps` globally with `text-[11px] font-medium uppercase tracking-wider text-muted`.
4. Refactor forms/inputs to Tailwind.

## Verification & Testing

- **Test:** Run `vitest` to ensure no components using standard buttons break their event handlers.
- **Browser Subagent:** Run the application locally, use `browser_subagent` to render a page containing buttons, and verify visual integrity (hover states, focus rings, contrast).

## Success Criteria

- [ ] `<Button>` component handles all existing button variants.
- [ ] No regressions in form input styling.

## Risk Assessment

- **Risk:** High refactoring blast radius. Breaking a core component affects the entire app.
- **Mitigation:** Rely heavily on IDE search/replace with regex, and verify with Vitest UI tests.
