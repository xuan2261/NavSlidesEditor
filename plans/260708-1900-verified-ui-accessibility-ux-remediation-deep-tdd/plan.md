---
title: "Verified UI Accessibility UX Remediation Deep TDD"
description: "Deep TDD plan to remediate verified UI/UX findings from code-review and ck-debug: canvas keyboard access, ribbon activation, modal focus traps, renderer contrast, focus tokens, 404 recovery, mobile dashboard polish, and tour clarity."
status: pending
priority: P1
branch: "master"
tags: [frontend, accessibility, ui, ux, tdd, keyboard, canvas, ribbon, modals]
blockedBy: [260709-0913-verified-ui-findings-remediation-deep-tdd, 260711-1038-editorpage-ui-ux-remediation-deep-tdd]
blocks: [260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd]
created: "2026-07-08T12:00:52.643Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
redTeamReviewed: "2026-07-08"
validated: "2026-07-08"
validationRequired: false
validationResult: "conditional-pass"
redTeamResult: "conditional-pass"
---

# Verified UI Accessibility UX Remediation Deep TDD

## Overview

This plan converts the verified UI/UX findings into a test-first remediation program. It deliberately separates hard accessibility defects from subjective polish so implementation does not sprawl into a full visual redesign.

Primary goal: make critical editor surfaces operable, perceivable, and recoverable by keyboard and assistive technology users while preserving existing PowerPoint-style workflow, TipTap focus behavior, slide rendering fidelity, and desktop density.

## Source Evidence

| Source | Evidence used |
|---|---|
| Code review report | Initial UI/UX findings across canvas, ribbon, modals, renderers, routing, Home header, and Joyride |
| ck-debug verification | Reclassified findings as true, partial, or polish; verified `/not-a-real-route` renders blank |
| Runtime browser check | 375px Home page had no horizontal overflow, but cramped search/actions; unknown route snapshot had no interactive content |
| `README.md` | Product promises: WYSIWYG editor, ribbon UI, keyboard shortcuts, touch gestures, live presentation |
| `CLAUDE.md` | Architecture: React/Vite client, shared renderer/export paths, test scripts |
| `DESIGN.md` | Warm editorial design tokens and focus/contrast expectations |
| Research subagent | File inventory, existing tests, and recommended implementation order |
| Red-team subagent | Risk register: shortcut conflicts, focus trap nesting, renderer appearance drift, double activation |

## Verified Findings

| ID | Finding | Verdict | Severity | Primary evidence |
|---|---|---:|---:|---|
| F1 | Canvas element wrapper and resize/rotation handles are mouse-only | True | P0 | `canvas-element-wrapper.jsx` uses `div` + `onMouseDown`, no role/tabIndex/key handlers |
| F2 | Ribbon actions have inconsistent keyboard activation | Partial but real | P1 | Some controls add `onKeyDown`; others only use `onMouseDown`, e.g. clipboard/view controls |
| F3 | Modal focus trap/focus restore behavior is inconsistent | True | P1 | `ModalShell.jsx` has trap; many custom dialogs implement only `role="dialog"` / `aria-modal` |
| F4 | Chart/Markdown/Table renderers hardcode white defaults | True | P1 | White-ish fallbacks break light slide backgrounds and token themes |
| F5 | Ribbon tab uses missing Tailwind `ring-ring` token | True | P2 | `tab-bar-with-scroll-and-icons.jsx`; `tailwind.config.js` defines `focus`, not `ring` |
| F6 | Home mobile header is cramped | Polish, not overflow bug | P2 | 375px runtime `scrollWidth=375`, but search/actions are compressed |
| F7 | Joyride overlay clarity is too dim | Polish, subjective | P3 | `ProductTour.jsx` overlay `rgba(0,0,0,0.6)` and visual screenshot |
| F8 | App lacks wildcard 404 route | True | P2 | `App.jsx` has no `path="*"`; invalid URL renders blank |

## Scope

In scope:
- TDD-first tests for every finding before code changes.
- Accessibility fixes for keyboard operability, focus visibility, ARIA names, and modal focus management.
- Contrast-safe defaults only when element color is missing, `auto`, or unsafe. Explicit user styling must be preserved.
- Minimal route recovery with a themed, accessible Not Found state.
- Mobile dashboard header and Joyride overlay polish only after critical defects are covered.
- Browser verification for keyboard-only flows and visual behavior where JSDOM cannot prove correctness.

Out of scope:
- Full redesign of HomePage, EditorPage, ribbon IA, or presentation templates.
- New element types, new backend APIs, or data migrations.
- Replacing Joyride, TipTap, Radix Tabs, Chart.js, or Tailwind.
- Changing trusted-author content policy.
- Documentation updates unless implementation changes a user-visible contract.

## Cross-Plan Dependencies

- This plan **blocks** `plans/260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd/` for overlapping frontend accessibility/token work. Implement this narrower verified plan first to avoid duplicate fixes.
- Related but not blocking: `plans/260705-0001-template-gallery-polish-deep-tdd/`, because TemplateGallery modal accessibility overlaps only at the dialog shell level.
- Completed predecessor context: `plans/260703-0000-element-interaction-controls-fixes-deep-tdd/` and `plans/260704-0000-element-control-defect-regression-deep-tdd/` define prior element interaction/export guardrails.

## Phases

| Phase | Name | Priority | Dependencies | Status |
|---|---|---:|---|---|
| 1 | [Baseline Contracts And Token Gate](./phase-01-baseline-contracts-and-token-gate.md) | P0 | [] | Pending |
| 2 | [Renderer Contrast Defaults](./phase-02-renderer-contrast-defaults.md) | P1 | [1] | Pending |
| 3 | [404 Route Recovery](./phase-03-404-route-recovery.md) | P2 | [1] | Pending |
| 4 | [Ribbon Keyboard Activation](./phase-04-ribbon-keyboard-activation.md) | P1 | [1] | Pending |
| 5 | [Modal Focus Trap Standardization](./phase-05-modal-focus-trap-standardization.md) | P1 | [1,4] | Pending |
| 6 | [Canvas Keyboard Accessibility](./phase-06-canvas-keyboard-accessibility.md) | P0 | [1] | Pending |
| 7 | [Mobile Header And Tour Polish](./phase-07-mobile-header-and-tour-polish.md) | P2 | [1,3,4,5,6] | Pending |
| 8 | [Final Verification](./phase-08-final-verification.md) | P0 | [2,3,4,5,6,7] | Pending |

## TDD Strategy

1. Write failing or characterization tests first in each phase.
2. Prefer role-based assertions over brittle class assertions for accessibility flows.
3. Use static/source tests for token contracts and route presence.
4. Use component tests for ModalShell, ProductTour, renderer srcDoc/style contracts, and ribbon button activation.
5. Use Playwright only for browser-specific truths: keyboard tab order, focus trap, canvas element focus, and mobile viewport layout.
6. Characterization tests must be labeled `safe baseline` or `red defect`. Every `red defect` test must be converted to a normal passing acceptance test by its implementation phase.
7. No `it.skip`, `test.skip`, `describe.skip`, `it.fails`, `it.todo`, or `test.todo` may remain in tests touched by this plan after Phase 8.

## Red-Team Amendments

The red-team review returned **CONDITIONAL PASS**. These amendments are binding before implementation:

1. **P0 canvas work must not wait on broad modal/ribbon remediation.** Phase 6 now depends only on Phase 1. Implement core keyboard selection/delete/nudge first, then integrate with ribbon/modal behavior as a later slice inside Phase 6.
2. **Canvas Enter/Space behavior must be state-specific.** Focused-but-unselected elements use Enter/Space to select. Selected editable elements use Enter or F2 to enter edit mode. Escape exits edit mode/selection according to current editor semantics.
3. **Modal migration must start with a complete inventory.** Phase 5 must search every `role="dialog"` and `aria-modal="true"` usage, classify each as migrated, already compliant, non-modal/deferred, or out-of-scope with reason.
4. **Ribbon migration must start with a complete inventory.** Phase 4 must scan all `onMouseDown`, non-button clickables, and command-like controls under `client/src/components/ribbon/`, using an allowlist with rationale.
5. **Browser gates require deterministic fixtures.** Phase 8 must define seeded presentation/share/live route setup before Playwright a11y assertions.
6. **Renderer parity must include shared/export paths.** Phase 2 must test `shared/src/element-renderers.js` or equivalent generated HTML for chart/markdown/table defaults, not just client preview.
7. **Game route ambiguity must be resolved during 404 work.** Phase 3 must decide whether `/game/join` is a supported route/redirect or stale documentation, and test the chosen behavior.
8. **Keyboard repeat must not double-trigger commands.** Phase 4 must include repeat-key tests for custom activation handlers.
9. **Canvas tab strategy must be explicit.** Phase 6 must use roving tabindex, element cycling, or another bounded strategy so decks with many elements remain usable.

## Validation Amendments

The validation review returned **CONDITIONAL PASS** and found no blockers for Phase 1 or Phase 6A. These amendments are binding:

1. **Polish must wait for critical accessibility phases.** Phase 7 now depends on Phases 1, 3, 4, 5, and 6 to match its stated sequencing.
2. **Route ambiguity must be verified against source before deciding.** Phase 3 must read current `App.jsx`, `README.md`, and `CLAUDE.md` before choosing `/game/join` handling.
3. **Modal inventory must be auditable.** Phase 5 must save its classification table in implementation notes or the final report.
4. **Parallel execution is allowed only for safe slices.** Phase 3 and Phase 6A can proceed after Phase 1; Phase 7 must not begin until critical accessibility phases are complete.

## Global Acceptance Criteria

- [ ] All known routes still resolve, and unknown routes show accessible 404 recovery.
- [ ] Ribbon controls activate exactly once with Enter/Space and pointer interaction.
- [ ] Active modal traps focus, restores focus to opener, and Escape closes the correct layer.
- [ ] Canvas elements are reachable and operable without a mouse for selection, editing, delete, and nudge.
- [ ] Renderer defaults are readable on light and dark slide backgrounds without overwriting explicit user colors.
- [ ] Focus indicators are visible in light/dark editor surfaces.
- [ ] Home mobile header is usable at 320, 375, 414, tablet, and desktop widths.
- [ ] Product tour target context remains visible enough to orient users.
- [ ] `npm run lint`, `npm run test`, targeted Playwright a11y specs, and `npm run build` pass.

## Validation Command Matrix

Targeted during phases:

```powershell
npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx
npx vitest run client/src/components/SlideCanvas.test.jsx
npx vitest run client/src/components/ribbon/ribbon-big-button.test.jsx
npx vitest run client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx
npx vitest run client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
npx vitest run client/src/components/ui/ModalShell.test.jsx
npx vitest run client/src/components/ProductTour.test.js
npx vitest run client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx
npx vitest run client/src/components/canvas/element-renderers/markdown-element-renderer.test.jsx
npx vitest run client/src/components/canvas/element-renderers/table-element-renderer.test.jsx
npx vitest run client/src/utils/tailwind-token-contract.test.js
npx vitest run client/src/pages/home-editor-responsive-source.test.js
npx vitest run client/src/App.suspense-fallback.test.jsx
```

Browser gates:

```powershell
npm run test:e2e -- tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js
npm run test:e2e -- tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js
npm run test:e2e -- tests/e2e/dashboard.spec.js
npm run test:e2e -- tests/e2e/ribbon
```

Final gate:

```powershell
npm run lint
npm run test
npm run build
```

## Open Questions

None. Current findings have enough evidence to plan. Implementation may discover modal-specific edge cases, but those should be handled inside Phase 5 inventory rather than blocking planning.
