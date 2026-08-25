---
title: Phase 05 semantic accessibility completed
date: 2026-08-21
summary: "Completed and verified semantic controls, modal focus, safe URL prompts, and native-dialog removal."
---

# Phase 05 semantic accessibility completed

## What happened

Completed Phase 05 semantic control accessibility across the editor. Added contextual accessible names to dense Properties and Ribbon controls, including all 10 game inspectors. Replaced native URL/link prompt flows with labelled modal prompts, inline validation, focus trapping/restoration, and topmost Escape ownership. Unified client URL entry with shared content-safety policy and media data-kind checks. Replaced remaining production native alerts in shared export/presenter paths with themed feedback or nonblocking role=alert UI.

Browser smoke exposed a CommonJS interop defect: direct/named content-safety imports produced undefined exports in Vite. Fixed by consuming the revealjs-shared CommonJS default and making URL safety exports explicit in shared/src/index.js. Browser then confirmed unsafe image URLs stay open, preserve input, announce an error, and restore trigger focus on Escape.

## Decision

Keep one shared URL policy and preserve existing project-relative media behavior. Scope Escape propagation at each active modal instead of changing global keyboard ownership. Preserve compact visuals; semantic changes stay in labels, roles, focus, and validation behavior.

## Verification

- Full Vitest: 574 files passed, 1 skipped; 4,662 tests passed, 3 skipped.
- Final affected import/mocking suite: 9 files, 42 tests passed.
- ESLint: 0 errors; 2 existing TextEncoder warnings.
- Client production build passed.
- Browser smoke passed editor load, accessibility-tree names, unsafe URL error persistence, Escape dismissal, and focus restoration.
- Final code review: safe to finalize.

## Next steps

Continue Phase 01 remaining evidence or Phase 06 media accessibility metadata per the dependency plan. Phase 12 owns evergreen docs/changelog integration.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
