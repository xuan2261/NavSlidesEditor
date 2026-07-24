---
title: "Teaching Interactivity UX Polish And Bilingual Docs TDD"
description: "Polish discoverability, empty states, templates, accessibility, keyboard flows, and bilingual docs after the v1.15 teaching interactivity release."
status: completed
priority: P1
effort: "6-9 dev-days"
branch: master
tags: [frontend, ux, accessibility, docs, website, teaching, tdd]
blockedBy: []
blocks: []
created: 2026-06-19
createdBy: ck-plan-skill
mode: "--deep --tdd"
source: "post-v1.15 user request"
---

# Teaching Interactivity UX Polish And Bilingual Docs TDD

## Overview

Polish the in-app experience after the v1.15 teaching/interactivity release. Primary deliverable is app UX: teaching feature onboarding, empty states/templates, and accessibility/keyboard polish. English and Vietnamese docs must stay aligned with implemented UX.

## Scope

In scope:
- Teaching feature onboarding and discoverability for Mermaid, STEM simulation, LaTeX/TikZ, technical symbols, and game activities.
- Empty-state and template UX polish for dashboard/editor entry points.
- Accessibility and keyboard polish across Insert ribbon, teaching modals, dashboard cards, and game join flow.
- English and Vietnamese docs updates that describe observable UX paths.
- TDD-first tests for every UX contract before implementation.

Out of scope:
- New canonical element types or game subtypes.
- Backend schema/data migrations.
- New feature families beyond polish/discoverability.
- Release/version bump.
- Broad visual redesign or theme overhaul.
- Editable PPTX parity for HTML/live-only features.

## Source Context

| Source | Use |
|---|---|
| `README.md` | Current v1.15 feature surface, 19 canonical elements, 10 game subtypes |
| `client/src/components/ProductTour.jsx` | Existing Joyride onboarding entry point |
| `client/src/pages/HomePage.jsx` | Dashboard, empty states, templates, marketplace/template cards |
| `client/src/pages/EditorPage.jsx` | Editor shell, tour mount, keyboard wiring |
| `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` | Insert teaching feature discovery |
| `client/src/components/HtmlEditorModal.jsx` | HTML/Mermaid authoring warnings and accessible descriptions |
| `client/src/components/LatexEditorModal.jsx` | LaTeX authoring UX |
| `client/src/components/stem-simulation-preset-modal.jsx` | STEM preset validation and warnings |
| `client/src/pages/game-player-join-page.jsx` | Player-facing game join and activity UX |
| `website/features/*`, `website/tutorials/*` | English docs |
| `website/vi/features/*`, `website/vi/tutorials/*` | Vietnamese docs |
| `docs/manual-smoke-checklist.md`, `docs/critical-user-journeys.md` | Release/manual validation surfaces |

## Cross-Plan Dependencies

No blocking plan. Related plans:
- `plans/260618-0737-teaching-interactivity-elements-controls-tdd/` is completed and is the predecessor feature release.
- Pending QA/upstream plans overlap in validation/manual-smoke governance only; this plan must not rewrite their scope.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Discovery And UX Contracts](./phase-01-discovery-and-ux-contracts.md) | Completed |
| 2 | [Teaching Feature Onboarding](./phase-02-teaching-feature-onboarding.md) | Completed |
| 3 | [Empty States And Templates](./phase-03-empty-states-and-templates.md) | Completed |
| 4 | [Accessibility Keyboard Polish](./phase-04-accessibility-keyboard-polish.md) | Completed |
| 5 | [Bilingual Docs Sync](./phase-05-bilingual-docs-sync.md) | Completed |
| 6 | [Final Verification](./phase-06-final-verification.md) | Completed |

## Dependency Graph

`Phase 1 -> Phase 2 -> Phase 5 -> Phase 6`

`Phase 1 -> Phase 3 -> Phase 5 -> Phase 6`

`Phase 1 -> Phase 4 -> Phase 5 -> Phase 6`

Phases 2-4 can be implemented in parallel only with strict file ownership. Phase 5 waits until UX copy and behavior are stable.

## TDD Strategy

- Start each phase with failing/guard tests for observable UX behavior.
- Prefer role-based and keyboard-focused Playwright assertions for user flows.
- Prefer component tests for modal copy, accessible descriptions, and empty-state rendering.
- Preserve existing count guards for 19 canonical element types and 10 game subtypes.
- Run targeted checks during iteration, then full lint/test/docs/build gates at Phase 6.

## Global Success Criteria

- [x] Teaching features are discoverable from the app without reading docs.
- [x] Insert controls with stable roles/names exist for Mermaid, STEM, LaTeX/TikZ, technical symbols, and game activities.
- [x] Enter/Space opens each polished flow; Escape closes popups/modals and restores focus to the trigger where applicable.
- [x] Dashboard/editor empty states have clear primary CTAs and do not confuse loading/error/search-empty states.
- [x] Blocking validation errors use `role="alert"` or `aria-live`.
- [x] Keyboard-only users can reach and operate polished teaching flows.
- [x] No new critical axe/accessibility violations in touched flows.
- [x] English and Vietnamese docs describe the same observable UX paths.
- [x] Canonical element count remains 19 and game subtype count remains 10.
- [x] `npm run lint`, `npm run test`, `npm run docs:build`, and targeted Playwright checks pass.

## Locked Decisions

- Primary deliverable is in-app UX polish.
- UX scope includes teaching onboarding, empty states/templates, and accessibility/keyboard polish.
- Docs scope includes English and Vietnamese.
- No release bump in this plan.
