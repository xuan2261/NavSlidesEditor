---
title: "UI Warm Editorial Cook Slice"
date: 2026-05-13
plan: "plans/260513-2243-ui-ux-warm-editorial-overhaul"
status: in_progress
---

# UI Warm Editorial Cook Slice

## Context

Executed `ck:cook` against the warm editorial overhaul plan with TDD discipline for the next UI slice after token/primitives groundwork.

## What Changed

- Added `ModalShell` as the shared dialog primitive with labelled dialog semantics, backdrop/Escape close, focus entry, focus trap, and focus restore.
- Migrated Sync, History, Home create, and Home confirm dialogs to the shell.
- Updated dashboard and Explore card styling to use warm tokenized states and removed layout-shifting hover in touched paths.
- Added keyboard activation for touched dashboard cards, list title action, new-presentation tile, and slide thumbnails.
- Updated editor command surfaces in `DropdownMenu`, `InsertMenu`, and `FindReplaceBar` with clearer focus, feedback, and live status.
- Converted `CollapsibleSection` into a real disclosure button and improved SlidePanel/SelectionPane a11y details.

## Verification

- Targeted Vitest passed for `ModalShell`, `CollapsibleSection`, and shared button tests.
- `npm run lint` passed with 3 pre-existing warnings in `tests/e2e/games/game-elements.spec.js`.
- `npm run build` passed with existing Vite bundle-size warning.
- Tester and code-reviewer subagents found no blocking regressions after follow-up fixes.

## Decisions

- Kept the overhaul in progress. E2E/manual visual gates and remaining modal/template/property migrations are still pending.
- Removed incorrect `role="menu"` semantics from mixed dropdown content and used generic popup semantics instead.
- Kept command logic, slide canvas, export model, API, env, and schemas unchanged.

## Next

- Run dashboard/template/panel/toolbar E2E gates.
- Continue remaining modal migrations where the `ModalShell` API fits.
- Finish PropertiesPanel high-use groups and manual small viewport pass.

## Unresolved Questions

- Whether dashboard headings should use already-imported serif fonts or Georgia fallback to avoid extra network cost.
