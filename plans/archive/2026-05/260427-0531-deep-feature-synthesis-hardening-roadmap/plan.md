---
title: "Deep Feature Synthesis Hardening Roadmap"
description: "Convert the deep feature synthesis audit into a gated execution roadmap for command cleanup, canvas decomposition, PPTX fidelity, and validated next features."
status: pending
priority: P1
effort: "8-13w gated"
branch: "master"
tags: [feature, refactor, frontend, backend, pptx, analytics, tech-debt]
blockedBy: []
blocks: []
created: "2026-04-26T22:32:56.875Z"
createdBy: "ck:plan"
source: skill
---

# Deep Feature Synthesis Hardening Roadmap

## Overview

Hard-mode execution plan from the brainstorm and audit reports. Do first: unify
clipboard/keyboard commands, then decompose `SlideCanvas.jsx` to a stable
`<=1200 LOC` target, then ship custom shortcuts and PPTX fidelity hardening.
Slide Master, editable PDF import, and analytics are gated work, not automatic
large builds.

## Scope Challenge

- Corrected stale input: charts are already mapped; diagrams/SmartArt flattening exists.
- P0 scope: remove duplicate command paths and reduce canvas refactor risk.
- P1 scope: custom shortcuts and PPTX corpus/metadata hardening.
- P2 scope: Slide Master validation, editable PDF spike, privacy-bounded analytics.
- Out of scope: realtime collab, SaaS, mobile editing, plugin marketplace, AI vibe editing, MCP v1.x, full TypeScript migration.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Baseline Scope And Gates](./phase-01-baseline-scope-and-gates.md) | Pending |
| 2 | [Command Layer Unification](./phase-02-command-layer-unification.md) | Pending |
| 3 | [SlideCanvas Render Decomposition](./phase-03-slidecanvas-render-decomposition.md) | Pending |
| 4 | [Canvas Chrome And Interaction Extraction](./phase-04-canvas-chrome-and-interaction-extraction.md) | Pending |
| 5 | [Custom Shortcut Registry And Settings](./phase-05-custom-shortcut-registry-and-settings.md) | Pending |
| 6 | [PPTX Fidelity Corpus And Metadata Hardening](./phase-06-pptx-fidelity-corpus-and-metadata-hardening.md) | Pending |
| 7 | [Slide Master Validation And Hybrid Design](./phase-07-slide-master-validation-and-hybrid-design.md) | Pending |
| 8 | [Editable PDF Import Spike](./phase-08-editable-pdf-import-spike.md) | Pending |
| 9 | [Privacy Bounded Presentation Analytics](./phase-09-privacy-bounded-presentation-analytics.md) | Pending |
| 10 | [Roadmap Docs And Release Gates](./phase-10-roadmap-docs-and-release-gates.md) | Pending |

## Dependencies

- Source reports: `plans/reports/brainstorm-260426-1740-deep-feature-synthesis.md`, `plans/reports/debug-260426-2125-deep-feature-synthesis-audit.md`.
- Current docs: `README.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`, `docs/pptx-import-fidelity-report.md`.
- Completed related plans: `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/`, `plans/260426-1708-e2e-testing-hardening-stable-selectors/`.

## Global Gates

- After every code phase: targeted tests, `npm run lint`, and `npm run build`.
- Before handoff: `npm run test`, targeted Playwright suites, and `npm run test:corpus`.
- Keep new modules focused; prefer files under 200 LOC. First canvas target is `<=1200 LOC`, not `~400 LOC`.
- Cook command: `/ck:cook D:\NCKH_2025\Para_WorkSpace\NavSlidesEditor\Projects\NavSlidesEditor\repo\plans\260427-0531-deep-feature-synthesis-hardening-roadmap\plan.md`.

## Unresolved Questions

1. Does the current corpus include enough real chart-heavy decks?
2. Is Python acceptable in Electron packaging for editable PDF import?
3. Is Slide Master validated by user demand, or are templates enough now?
4. Should custom shortcuts default to localized `e.key` or physical `e.code`?
5. Analytics: what retention, opt-out, and wording preserve the no-tracking identity?
