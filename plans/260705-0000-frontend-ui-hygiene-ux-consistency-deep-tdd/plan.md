---
title: "Frontend UI Hygiene UX Consistency Deep TDD Plan"
description: "Test-first plan for confirmed frontend UI hygiene defects, visual consistency, editor usability, and responsive/touch polish from the recent audit/debug review."
status: pending
priority: P1
effort: "8-14 dev-days"
branch: master
tags: [frontend, ui, ux, accessibility, responsive, ribbon, tdd]
blockedBy: [260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd]
blocks: []
created: 2026-07-05
createdBy: ck-plan-skill
mode: "--deep --tdd"
redTeamReviewed: 2026-07-05
validated: 2026-07-05
---

# Frontend UI Hygiene UX Consistency Deep TDD Plan

## Overview

Implement the confirmed UI/UX fixes from the audit and ck-debug review with TDD gates per phase. The plan deliberately does **not** hide advanced Insert ribbon actions. It keeps NavSlides' PowerPoint-style discoverability and improves only measurable defects, token consistency, density controls, overflow behavior, accessibility, and responsive safety.

## Source Context

| Source | Use |
|---|---|
| `README.md` | Current feature surface and UX promises: ribbon UI, status bar, touch gestures, live/remote/speaker views |
| `DESIGN.md` | Warm/editorial design system reference and token direction |
| Recent frontend audit | Initial UI/UX findings and proposed phases |
| Recent ck-debug review | Evidence-backed confirmation of real issues and corrections |
| Ribbon re-analysis | Rejects hiding advanced actions; prefers discoverability-preserving overflow/density |
| `client/src/App.jsx` | Lazy route Suspense fallback currently `null` |
| `client/tailwind.config.js`, `client/src/index.css` | Theme token source of truth |
| `client/src/pages/game-player-join-page.jsx` | Uses missing `bg-editor-bg` token |
| `client/src/components/ribbon/ribbon-panel.jsx`, `tab-bar-with-scroll-and-icons.jsx` | Use missing `bg-background` token |
| `client/src/pages/HomePage.jsx` | Dashboard cards, native dialogs, import flows |
| `client/src/components/command-palette.jsx` | Hard-coded inline colors |
| `client/src/pages/RemoteControlPage.jsx`, `SpeakerViewPage.jsx` | Slate/white hard-coded UI classes |
| `client/src/components/layout/StatusBar.jsx` | Small zoom/view hit targets |
| `client/src/components/PropertiesPanel.jsx` | Text element type-specific panel returns `null` |
| `client/src/components/FindReplaceBar.jsx` | Fixed width and high-z floating overlay |
| `client/src/components/ribbon/*` | Ribbon action density, overflow, contextual tabs, tests |

## Confirmed Findings

| ID | Finding | Severity | Evidence |
|---|---|---:|---|
| F1 | Lazy route fallback can render blank screen | P1 | `App.jsx` uses `Suspense fallback={null}` |
| F2 | Missing Tailwind tokens cause background classes to be no-ops | P1 | `bg-editor-bg`, `bg-background` used but not defined |
| F3 | Native `alert/confirm` breaks themed UX and testability | P2 | Multiple pages/hooks/components call `alert()` / `confirm()` |
| F4 | Dashboard cards use `div role="button"` with nested action buttons | P1 | Grid presentation cards contain edit/duplicate/delete buttons inside clickable container |
| F5 | Command palette and presentation control shells bypass design tokens | P2 | Inline `#1e1e2e`, `#fff`, `text-slate-400`, `hover:text-white` |
| F6 | Status/ribbon hit targets are too small for touch-comfort mode | P2 | `w-5 h-5`, `h-7 w-7`, compact controls |
| F7 | Text selection PropertiesPanel has poor discoverability | P3 | `case 'text': return null` |
| F8 | Find/replace bar can overflow or obscure workspace controls | P2 | `min-w-[380px]`, fixed top/right, `z-[9990]` |
| F9 | Ribbon advanced-action hiding would be counterproductive | P1 decision | Re-analysis confirms advanced features are differentiators and should stay discoverable |

## Scope

In scope:
- TDD-first fixes for F1-F8.
- Keep advanced Insert actions visible/discoverable and improve responsive overflow only when space is constrained.
- Add static contract tests where regressions are detectable without a browser, scoped to production UI chrome files only.
- Add/extend Playwright checks for layout, accessibility, responsive pressure, and keyboard behavior.
- Preserve current visual identity and existing product IA.

Out of scope:
- Hiding advanced Insert ribbon actions by default.
- Full ribbon redesign, Backstage/File view, new slide sorter, new Designer pane, or major EditorPage rewrite.
- Brand/theme replacement or broad Typography redesign beyond token consistency.
- New element types, new game types, or backend API changes.
- Documentation updates unless implementation changes a user-visible contract, per repository instruction.
- Static audits over slide templates, export fixtures, security fixtures, tests, or trusted author content.

## Phase Roadmap

| # | Phase | Priority | Dependencies | Status |
|---|---|---|---|---|
| 1 | [Baseline UI Contract Harness](phase-01-baseline-ui-contract-harness.md) | P0 | [] | pending |
| 2 | [App Shell Loading And Token Hygiene](phase-02-app-shell-loading-and-token-hygiene.md) | P1 | [1] | pending |
| 3 | [Themed Dialog And Feedback System](phase-03-themed-dialog-and-feedback-system.md) | P1 | [1,2] | pending |
| 4 | [Dashboard Card Semantics And Keyboard Flow](phase-04-dashboard-card-semantics-and-keyboard-flow.md) | P1 | [1,2] | pending |
| 5 | [Tokenized Presentation Shells And Command Palette](phase-05-tokenized-presentation-shells-and-command-palette.md) | P2 | [1,2] | pending |
| 6 | [Editor Density Hit Targets And Properties Guidance](phase-06-editor-density-hit-targets-and-properties-guidance.md) | P2 | [1,2] | pending |
| 7 | [Find Replace And Ribbon Responsive Overflow](phase-07-find-replace-and-ribbon-responsive-overflow.md) | P1 | [1,2,6] | pending |
| 8 | [Final Verification Release Gate](phase-08-final-verification-release-gate.md) | P0 | [2,3,4,5,6,7] | pending |

## Dependency Graph

`Phase 1 -> Phase 2 -> Phase 3 -> Phase 8`

`Phase 1 -> Phase 2 -> Phase 4 -> Phase 8`

`Phase 1 -> Phase 2 -> Phase 5 -> Phase 8`

`Phase 1 -> Phase 2 -> Phase 6 -> Phase 7 -> Phase 8`

Phases 3-6 can be parallelized only with strict file ownership. Phase 7 waits for Phase 6 because density/hit-target decisions affect ribbon pressure behavior.

## Architecture Direction

- Prefer small, reusable UI primitives over one-off inline fixes.
- Use existing theme tokens (`bg-panel`, `bg-card`, `bg-secondary`, `text-*`, `border-*`, `focus`) or add explicit aliases only when they map to real product concepts.
- Keep `Button` backward-compatible. If new size/density variants are needed, add opt-in variants instead of changing all call sites globally.
- Replace native dialogs through a centralized app feedback/confirm abstraction, not ad-hoc per page modals.
- Keep dashboard cards semantically simple: one main open affordance plus separate action buttons, no nested interactive roles.
- Keep Insert ribbon advanced actions discoverable. At constrained widths, expose overflow with keyboard navigation and tests proving access, not disappearance.
- Static audits must exclude tests/fixtures/templates/export utilities and use explicit, reasoned allowlists for rare exceptions.
- Dialog replacements must preserve accessible modal behavior: `aria-modal`, focus trap, Escape/cancel/confirm semantics, focus restore, and background non-interaction.
- Touch/comfortable hit-target policy must be defined before implementation. Compact desktop exceptions are allowed, but touch/comfortable targets must be measured.

## TDD Strategy

1. For every phase, write or extend tests first and record the failing assertion before implementation.
2. Prefer static contract tests for class/token/native-dialog regressions that are cheap and deterministic.
3. Use React component tests for semantic render contracts.
4. Use Playwright for viewport, keyboard, hit-target, overflow, and accessibility checks.
5. Run targeted commands per phase, then full final validators in Phase 8.

## Required Command Matrix

| Gate | Command |
|---|---|
| App/token hygiene | `npx vitest run client/src/App.suspense-fallback.test.jsx client/src/utils/tailwind-token-contract.test.js client/src/utils/tailwind-inline-style-audit.test.js shared/tests/design-tokens.test.js` |
| Native dialog audit | `npx vitest run client/src/utils/native-dialog-audit.test.js` |
| Dashboard semantics | `npx vitest run client/src/pages/home-dashboard-card-semantics.test.jsx client/src/pages/home-editor-responsive-source.test.js` |
| Command palette/token shells | `npx vitest run client/src/components/command-palette.test.jsx client/src/utils/command-palette.test.jsx client/src/utils/presentation-ui-token-audit.test.js client/src/utils/tailwind-inline-style-audit.test.js` |
| Editor hit targets/properties | `npx vitest run client/src/components/ui/Button.test.js client/src/components/layout/StatusBar.test.jsx client/src/components/PropertiesPanel.test.jsx client/src/components/properties/text-properties-panel-render.test.jsx` |
| Find/ribbon responsive | `npx vitest run client/src/components/find-replace-vertical-slides.test.jsx client/src/components/find-replace-helpers.test.js` and `npx playwright test tests/e2e/find-replace-responsive-overlay.spec.js tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js tests/e2e/ribbon/responsive-pressure-points.spec.js` |
| A11y/viewport | `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js tests/e2e/a11y/minimum-hit-targets.spec.js tests/e2e/a11y/dashboard-card-semantics.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js` |
| Full unit | `npm run test` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| E2E smoke | Iteration: scoped Playwright matrix is allowed. Final gate: `npm run test:e2e` is required unless an objective blocker is documented and explicitly approved. |

New tests listed in the matrix are created by Phase 1 before any command matrix is used as a green gate. Scoped Playwright commands are iteration gates only; the final release gate requires full E2E unless an objective blocker is documented and explicitly approved.

## Global Success Criteria

- [ ] Lazy route transitions never show a blank screen.
- [ ] No source usage of undefined Tailwind theme aliases for app chrome backgrounds.
- [ ] Primary user-facing import/export/delete/share/live errors use themed feedback, not native blocking dialogs.
- [ ] Dashboard presentation cards have no nested interactive control violations and remain keyboard-operable.
- [ ] Command palette, remote view, and speaker view use theme tokens and preserve light/dark contrast.
- [ ] Compact UI remains available, but comfortable/touch mode exposes larger hit targets where required.
- [ ] Text element selection provides clear PropertiesPanel guidance or quick controls.
- [ ] Find/replace remains within viewport and does not block critical editor controls at narrow widths.
- [ ] Advanced Insert actions remain discoverable inline or through a tested overflow path.
- [ ] `npm run lint`, `npm run test`, `npm run build`, and targeted Playwright gates pass.

## Locked Decisions

- Do not hide advanced ribbon actions by default.
- Do not rewrite the ribbon or EditorPage shell in this plan.
- Do not update docs unless a concrete user-facing contract changes.
- Phase 1 must establish red evidence before fixes.
- Phase 8 cannot pass on manual inspection alone.
- Phase 8 cannot treat skipped full E2E as success without a blocker and user approval.
- Do not add persisted density state unless CSS/touch-media scoped sizing cannot satisfy tests.

## Red-Team And Validation Artifacts

- [Red-team review](red-team-review.md)
- [Validation report](validation-report.md)

## Handoff

After review, implement with:

```bash
/ck:cook C:\Work\NavSlidesEditor\plans\260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd\plan.md
```
