---
title: Warm Editorial Token Primitives
date: 2026-05-13
plan: plans/260513-2243-ui-ux-warm-editorial-overhaul
---

# Warm Editorial Token Primitives

## Context

Implemented the first slice of the UI/UX Warm Editorial Overhaul with TDD: design tokens, shared UI primitives, docs sync, and a reduced-motion baseline.

## What Happened

- Added warm light/dark app chrome tokens while preserving `--bg-canvas-default: #ffffff`.
- Split semantics: terracotta `brand` for CTAs, blue `focus` and `selection` for technical UI states.
- Updated Tailwind aliases for `brand`, `focus`, and `selection`.
- Updated `Button`, `Input`, `Select`, and `ColorPicker` visual/focus contracts without changing public APIs.
- Added primitive tests covering button focus, icon aria fallback, form focus states, and neutral focus ring offsets.
- Synced `docs/design-guidelines.md` and plan phase status.

## Decisions

- Keep `--accent` as a backward-compatible brand alias.
- Keep focus/selection blue to avoid mixing CTA style with editor selection or keyboard affordances.
- Keep `ghost` buttons compact to protect dense toolbar layout.
- Use neutral surface ring offsets, not brand offsets, for focus rings.

## Verification

- `npm run test -- --run client/src/components/ui/Button.test.js client/src/components/ui/form-primitives.test.jsx` passed.
- `npm run build` passed.
- `npm run lint` passed with 0 errors and 3 unrelated existing warnings in `tests/e2e/games/game-elements.spec.js`.
- Tester, code reviewer, docs-manager, and UI/UX designer subagents reviewed the slice.

## Next

- Continue with dashboard/empty states.
- Then modal shell, editor chrome, panels, remaining a11y audit, and final visual regression gate.

## Unresolved Questions

- Should dashboard headings use already-imported serif fonts or Georgia fallback to avoid extra network cost?
