---
title: "Verified UI Findings Remediation Deep TDD"
description: "Deep TDD plan to remediate the 12 verified UI/UX findings from the latest code-review and ck-debug verification: command palette semantics, hidden focus traps, file import keyboard access, canvas labels/nudge behavior, token colors, panel layout, menu/tab/table semantics, responsive grids/toolbars, and structural emoji cleanup."
status: pending
priority: P1
branch: "master"
tags: [frontend, ui, ux, accessibility, tdd, keyboard, responsive, design-tokens]
blockedBy: []
blocks: [260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd, 260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd]
created: "2026-07-09T02:13:58.623Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
redTeamReviewed: "2026-07-09"
redTeamResult: "conditional-pass"
validated: "2026-07-09"
validationResult: "conditional-pass"
---

# Verified UI Findings Remediation Deep TDD

## Overview

Implement the verified UI/UX findings from the latest debug pass with a strict test-first workflow. The work is intentionally scoped to defects confirmed by source evidence, not a broad redesign.

Primary goals:
- Make command palette, file import, slide thumbnail actions, menus, tabs, and share tables accessible to keyboard and assistive technology users.
- Correct the documented canvas keyboard nudge contract.
- Improve canvas element names without changing selection model or export behavior.
- Replace hard-coded editor chrome colors with theme tokens.
- Remove fragile fixed layout offsets and responsive overflow risks.
- Replace structural emoji in UI controls with Lucide/SVG equivalents.

## Source Evidence

| Finding | Verdict | Evidence |
|---|---|---|
| F1 Command Palette lacks dialog semantics/focus trap | True | `client/src/components/command-palette.jsx:38-80`; compare compliant `client/src/components/ui/ModalShell.jsx` |
| F2 Slide thumbnail Duplicate/Delete hidden but focusable | True | `client/src/components/SlidePanel.jsx:389-409` |
| F3 Home import labels not keyboard-accessible | True | `client/src/pages/HomePage.jsx:903-961` |
| F4 Canvas accessible name too generic | True | `client/src/components/canvas/canvas-element-wrapper.jsx:39-43`; test asserts generic label |
| F5 Canvas keyboard nudge contract reversed | True | Code `canvas-element-wrapper.jsx:291`; docs `website/guide/keyboard-shortcuts.md:23-24` |
| F6 Canvas selection chrome hard-codes colors | True | `canvas-element-wrapper.jsx:367+` |
| F7 Right panels use magic `80px` offset | True | `client/src/pages/EditorPage.jsx:1691`, `1727` |
| F8 File dropdown lacks full menu keyboard navigation | True | `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx:60-127` |
| F9 ShareModal tabs/table semantics incomplete | True | `client/src/components/ShareModal.jsx:134-166` |
| F10 TemplatePicker fixed 4-column grid | True | `client/src/components/TemplatePickerModal.jsx:151` |
| F11 Media Library toolbar overflow risk | Partial but actionable | `client/src/components/MediaLibraryModal.jsx:192-234` |
| F12 Structural emoji in UI controls | Partial but actionable | `ShareModal.jsx:143`, `ShareModal.jsx:164`, `SlideCanvas.jsx:481`, `SlidePanel.jsx:372` |

## Scope

In scope:
- TDD characterization and acceptance tests for every finding.
- Minimal implementation changes preserving current product information architecture.
- Component/unit tests for accessibility semantics, keyboard activation, tokenized styles, and responsive class contracts.
- Playwright smoke coverage for keyboard-only command palette, slide thumbnail focus visibility, import actions, and responsive modal/toolbars.
- Final full validators: lint, unit tests, scoped e2e, and build.

Out of scope:
- Full Home/Editor redesign.
- New element types, new backend APIs, storage migrations, or presentation schema changes.
- Documentation updates except for correcting keyboard shortcut docs if implementation intentionally differs. Current plan fixes code to match docs.
- Broad static audits unrelated to these 12 findings.

## Cross-Plan Dependencies

- This plan should run before `plans/260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd/` and `plans/260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd/` where scopes overlap. It is narrower and based on the latest verified findings.
- Related completed context: `plans/260619-ux-polish-teaching-docs-tdd/` Phase 4 already covered earlier accessibility polish, but did not address these current defects.

## Architecture Direction

- Reuse existing `ModalShell`, `Button`, Radix Tabs, Lucide icons, and theme tokens. Do not introduce new UI libraries.
- Prefer semantic native controls over `div role="button"` where feasible. Where role wrappers remain, add full keyboard semantics and focus visibility.
- Use token aliases from existing CSS/Tailwind theme. If a new token is required, add it once in the theme source and use it consistently.
- Keep canvas interaction behavior centralized in `canvas-element-wrapper.jsx` and preserve existing mouse/drag/crop flows.
- For file inputs, use hidden input refs triggered by accessible buttons, not focus-invisible labels.
- For menu keyboard support, implement roving focus only inside the dropdown, restore focus to trigger on close, and prevent repeated key double-activation.
- For command palette results, choose one valid ARIA pattern. Default to simple buttons with active styling unless a complete `listbox`/`option` + `aria-activedescendant` implementation is built.
- For canvas names, sanitize and truncate any user slide content. Labels should identify elements, not expose full slide text.
- Keep modifications to large files (`EditorPage.jsx`, `HomePage.jsx`) minimal and scoped. No opportunistic cleanup.

## Red-Team Amendments

The red-team review returned **CONDITIONAL PASS**. These amendments are binding before implementation:

1. **Command Palette ARIA pattern must be valid.** Do not put `aria-selected` on plain buttons. Use simple result buttons with active styling, or fully implement `listbox`/`option` with `aria-activedescendant`.
2. **Hidden slide action strategy must avoid circular focus.** The slide thumbnail/card remains focusable, reveals actions on `focus-within`, then Duplicate/Delete can receive focus.
3. **File picker behavior must not rely on flaky browser picker assertions.** Unit-test hidden input `.click()` through refs; Playwright only verifies button reachability and tab order.
4. **Token replacement must inspect existing tokens first.** Use existing CSS/Tailwind tokens when available; add new tokens only once with contrast checks.
5. **Right panel layout refactor requires explicit regression coverage.** Verify ribbon visible/hidden states, PropertiesPanel, DesignIdeasPanel, canvas height, and scroll behavior.
6. **ShareModal tab changes must preserve functional flows.** Tests must cover create/copy/delete share-link behavior in addition to tab/table semantics.
7. **Final validation order is standardized.** Run targeted tests, scoped Playwright, lint, full unit tests, then build. Phase 6 is the source of truth for final commands.

## Validation Amendments

The validation review returned **CONDITIONAL PASS**. These amendments are binding before implementation:

1. **File menu arrow navigation wraps.** ArrowDown from the last menu item moves to the first; ArrowUp from the first moves to the last. Home/End jump directly.
2. **Phase 5 depends on Phase 2.** MediaLibrary upload accessibility is fixed before responsive toolbar polish to avoid ownership conflicts.
3. **Structural emoji scope is explicit.** ShareModal tab/header emoji must be replaced. SlideCanvas lock indicator must use a Lucide icon/text. SlidePanel drawing/line thumbnail glyphs may remain only if decorative and `aria-hidden`, otherwise iconize.
4. **Responsive criteria are measurable.** At 375px, 768px, and desktop widths, assert `document.documentElement.scrollWidth <= window.innerWidth`; for modals, assert modal scrollWidth does not exceed its clientWidth except intentionally scrollable content areas.
5. **Command Palette focus restore is deterministic.** If opened from a focused trigger, restore that trigger. If opened by global shortcut, restore the previously focused editor/workspace element when still connected; otherwise focus the editor canvas/workspace fallback.
6. **Right-panel layout checks are concrete.** Verify normal ribbon-visible editor state, collapsed/hidden ribbon state if `Ctrl+Alt+R` remains supported, PropertiesPanel open, DesignIdeasPanel open, canvas visible height above zero, and workspace scroll remains usable.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Regression Characterization](./phase-01-regression-characterization.md) | pending |
| 2 | [High Priority Accessibility Fixes](./phase-02-high-priority-accessibility-fixes.md) | pending |
| 3 | [Editor Canvas Interaction Corrections](./phase-03-editor-canvas-interaction-corrections.md) | pending |
| 4 | [Menu Modal Semantics](./phase-04-menu-modal-semantics.md) | pending |
| 5 | [Responsive Visual Polish](./phase-05-responsive-visual-polish.md) | pending |
| 6 | [Full Validation](./phase-06-full-validation.md) | pending |

## Dependencies

`Phase 1 -> Phase 2 -> Phase 4 -> Phase 6`

`Phase 1 -> Phase 3 -> Phase 6`

`Phase 1 -> Phase 2 -> Phase 5 -> Phase 6`

Phase 2 and Phase 3 can run in parallel after Phase 1 if file ownership is strict. Phase 4 waits for Phase 2 because modal/menu semantics share focus-management utilities. Phase 5 waits for Phase 2 because both phases touch `MediaLibraryModal.jsx`.

## TDD Strategy

1. Add failing tests first, label them with finding IDs in test names or comments.
2. Prefer role/name assertions over class-only tests for accessibility.
3. Use source/static tests only where browser behavior is not required, such as absence of structural emoji or hard-coded color literals.
4. Use component tests for `CommandPalette`, `SlidePanel`, `HomePage` import controls, `ShareModal`, `FileDropdown`, and modal/tab semantics.
5. Use Playwright for tab order, focus visibility, import button reachability, and responsive overflow. Native file picker activation is unit-tested through input refs.
6. No `it.skip`, `test.skip`, `it.todo`, `test.todo`, or `it.fails` may remain in touched tests by Phase 6.

## Validation Commands

Targeted during phases:
- `npx vitest run client/src/components/command-palette.test.jsx`
- `npx vitest run client/src/components/SlidePanel.test.jsx`
- `npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx`
- `npx vitest run client/src/components/ShareModal.test.jsx`
- `npx vitest run client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx`
- `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`

Final gate:
- Targeted unit/component/static tests
- Scoped Playwright a11y/responsive specs
- `npm run lint`
- `npm run test`
- `npm run build`

## Success Criteria

- [ ] All 12 findings have a corresponding failing test or explicit characterization test before implementation.
- [ ] Command Palette is a labelled modal dialog with focus trap, Escape close, and focus restore.
- [ ] Invisible slide thumbnail actions are not keyboard-focusable unless visible via hover/focus-within.
- [ ] Import actions are reachable and operable from keyboard.
- [ ] Canvas accessible labels include useful type/content/state context.
- [ ] Arrow nudge behavior matches docs: Arrow = 1px, Shift+Arrow = 10px.
- [ ] Canvas selection chrome uses tokens, not raw purple/teal literals.
- [ ] Right side panels no longer depend on fixed `80px` vertical offsets.
- [ ] File menu supports ArrowUp/ArrowDown/Home/End/Escape and restores trigger focus.
- [ ] Share modal tabs/table expose correct ARIA semantics and non-emoji labels.
- [ ] TemplatePicker and MediaLibrary adapt at narrow widths without horizontal overflow.
- [ ] Structural emoji in UI controls are replaced by SVG/icon/text alternatives.
- [ ] Command Palette focus restore works for trigger-open and global-shortcut-open paths.
- [ ] Lint, tests, build, and scoped e2e validators pass.

## Open Questions

None.
