---
title: "Teaching Interactivity Elements Controls TDD"
description: "Conservative P0+P1 plan for technical teaching interactivity via Mermaid, STEM embed presets, game subtypes, code walkthroughs, LaTeX UX, and symbol packs."
status: completed
priority: P1
effort: "15-25 dev-days"
branch: master
tags: [frontend, teaching, interactivity, elements, controls, games, export, tdd]
blockedBy: []
blocks: []
created: 2026-06-18
createdBy: ck-plan-skill
mode: "--deep --tdd"
source: "../reports/260617-elements-controls-teaching-interactivity-brainstorm.md"
---

# Teaching Interactivity Elements Controls TDD

## Overview

Implement teaching/technical interactivity without element bloat. Keep the canonical element count at 19. Prefer existing `html`, `game`, `code`, `latex`, `shape`, `svg`, plugin, and export fallback infrastructure. Mermaid and STEM features use `html`; live activities use `game`.

## Scope

In scope:
- Mermaid diagram authoring as `html` element mode with `embedKind: 'mermaid'`, not a new canonical element.
- STEM simulation embed presets for PhET, GeoGebra, Desmos, and CircuitJS/Falstad.
- New `game` subtypes: live poll, word cloud, drag/drop matching.
- Code walkthrough controls for line focus/steps.
- LaTeX authoring UX: symbols, snippets, error feedback.
- Technical symbol packs: UML, network, circuit, cloud.
- TDD-first matrix/export governance for each feature.

Out of scope:
- Native circuit editor, spreadsheet element, virtual lab platform, 3D model editor, AI activity generator.
- Editable PPTX parity for live/HTML/DOM-generated content.
- Broad game engine rewrite.

## Source Context

| Source | Use |
|---|---|
| `plans/reports/260617-elements-controls-teaching-interactivity-brainstorm.md` | Product decision and candidate matrix |
| `client/src/data/element-defaults.js` | Canonical element defaults; avoid new type unless needed |
| `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` | Insert affordances |
| `client/src/hooks/use-element-creation.js` | Element creation helpers |
| `client/src/components/properties/*` | Existing controls and modal entry points |
| `client/src/constants/game-element-types-constants.js` | Existing game subtypes |
| `server/services/game-socket-handler.js` | Live game socket behavior |
| `server/services/game-room-manager-singleton-service.js` | Game room state |
| `shared/src/element-renderers.js` | Reveal HTML export renderer |
| `docs/export-fidelity-and-limits.md` | PPTX fallback policy |
| `plans/260617-0739-element-control-audit-matrix-tdd/` | Matrix governance baseline |

## Cross-Plan Dependencies

No active blockers found. This plan depends conceptually on completed element-control matrix governance and export warning contracts. It should not reopen completed PPTX/import plans.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Contracts And Matrix Prep](./phase-01-contracts-and-matrix-prep.md) | Completed |
| 2 | [Mermaid Diagram Authoring](./phase-02-mermaid-diagram-authoring.md) | Completed |
| 3 | [STEM Simulation Embed Presets](./phase-03-stem-simulation-embed-presets.md) | Completed |
| 4 | [Live Poll Game Subtype](./phase-04-live-poll-game-subtype.md) | Completed |
| 5 | [Word Cloud Game Subtype](./phase-05-word-cloud-game-subtype.md) | Completed |
| 6 | [Drag Drop Matching Game Subtype](./phase-06-drag-drop-matching-game-subtype.md) | Completed |
| 7 | [Code Walkthrough Controls](./phase-07-code-walkthrough-controls.md) | Completed |
| 8 | [LaTeX Authoring UX](./phase-08-latex-authoring-ux.md) | Completed |
| 9 | [Technical Symbol Packs](./phase-09-technical-symbol-packs.md) | Completed |
| 10 | [Final Verification And Release Gate](./phase-10-final-verification-and-release-gate.md) | Completed |

## Dependency Graph

`Phase 1 -> Phase 2 -> Phase 10`

`Phase 1 -> Phase 3 -> Phase 10`

`Phase 1 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 10`

`Phase 1 -> Phase 7 -> Phase 10`

`Phase 1 -> Phase 8 -> Phase 10`

`Phase 1 -> Phase 9 -> Phase 10`

Game phases are serialized because they share `GAME_TYPES`, `game-properties.jsx`, player UI, and server game services. Mermaid, STEM, code, LaTeX, and symbol phases are parallel-safe after Phase 1 if file ownership is respected.

## TDD Strategy

- Every phase starts with failing tests for authoring, render, persistence/export, and matrix rows.
- Live/game phases add server reducer/socket tests before UI.
- Export-related phases assert structured warning `matrixRowId`, not just "export succeeds".
- E2E is reserved for one happy path per feature family after unit/component coverage exists.

## Global Success Criteria

- [x] Canonical element count remains 19 unless a documented design gate approves otherwise.
- [x] P0 features: Mermaid and STEM presets work in editor and HTML export; live poll works in editor/live player flow, while static HTML/PPTX exports include only public prompt/options or placeholder plus structured fallback warning.
- [x] P1 features: word cloud, matching, code walkthrough, LaTeX UX, symbol packs land without breaking existing controls.
- [x] `npm run matrix:gate` passes.
- [x] `npm run test`, `npm run lint`, and `npm run build` pass.
- [x] Export fallbacks are user-visible and machine-readable for PPTX gaps.
- [x] No participant/private live data leaks into static exports by default.

## Red Team Findings

- Main risk is scope creep: keep each feature on existing element/control paths.
- Second risk is false PPTX parity: live/HTML features must warn/rasterize/placeholder.
- Third risk is game state leakage: live responses must be ephemeral unless user explicitly saves aggregate results.

## Locked Decisions

- Mermaid storage path: `html` element with `embedKind: 'mermaid'` and `mermaidSource`; no canonical `mermaid` element.
- Mermaid runtime: vendored Mermaid asset via existing vendor/offline pattern. Online-only is a fallback only if a future plan update explicitly accepts bundle-size trade-off.
- STEM support: all four providers in v1 using strict URL/id templates only; reject unknown providers/domains.
- Poll vote behavior: anonymous aggregate by default; one vote per player, later vote updates prior vote (last-write-wins) and aggregate adjusts.
- Live activity persistence: raw submissions are ephemeral room state; static exports include prompt/config and optional aggregate only if explicitly saved later. MVP exports no raw participant data.

## Release Checkpoints

- MVP checkpoint after Phases 1-4: Mermaid, STEM presets, and live poll.
- Full plan completion after Phases 5-10: word cloud, matching, code walkthrough, LaTeX UX, symbol packs, and final verification.

## Next Step

Run `/ck:cook plans/260618-0737-teaching-interactivity-elements-controls-tdd/plan.md` only after reviewing this plan. Deep-mode red-team/validation were handled during planning; implementation should still re-scout exact files per phase before editing.
