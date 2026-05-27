---
date: 2026-05-25
type: planning-journal
plan: plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes
---

# PPTX Import Unit Conversion Plan

## Context

Created and validated a TDD implementation plan for PPTX import unit-conversion and scale-propagation fixes. Scope covers twelve fidelity bugs found after v1.9.7, centered on `pt` values leaking into px-based editor/render/export paths.

## What Happened

- Organized plan files under `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/`.
- Kept `plan.md` as a short overview and moved red-team/validation detail into `reports/planner-validation-and-red-team-summary.md`.
- Added concrete Phase 2 load/API-output normalization targets after inspecting current storage and route surfaces.
- Preserved tests-first phase structure for sanitizer conversion, resolution fixes, raw-length scaling, tables, shape rich text, text insets, and corpus/visual acceptance.

## Decisions

- Normalize new imports at write time, but handle legacy imported decks at API/output boundaries first.
- Keep `presentation.resolution` as canvas-px; use `_pptxMeta.originalSize` for PPTX export slide dimensions.
- Require strict shared rich-text/style sanitization before enabling shape `textHtml` rendering.
- Use browser/Playwright for rendered SVG bbox checks; avoid JSDOM layout assumptions.

## Next

Run `/ck:cook C:\Work\NavSlidesEditor\plans\260525-1450-pptx-import-unit-conversion-and-scale-fixes` to implement the phases.
