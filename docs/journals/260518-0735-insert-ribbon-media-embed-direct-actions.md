---
date: 2026-05-18
topic: insert-ribbon-media-embed-direct-actions
plan: ../plans/260518-0711-insert-ribbon-media-embed-direct-actions-tdd/plan.md
---

# Insert Ribbon Media Embed Direct Actions

## Context

The previous ribbon layout hardening grouped Media, Embed, and Advanced actions to protect the 1280px layout budget. That solved overflow, but common Media/Embed actions became slower and cramped behind dropdowns.

## What Happened

- Converted Media actions to direct icon-only buttons: Video URL, Audio/Upload, Media Library, optional File Browser.
- Converted Embed actions to direct icon-only buttons: HTML Embed, SVG File, Drawing Canvas, Divider.
- Kept Advanced grouped, widened the flyout to 260px, used a 2-column item grid, and added Escape focus restore.
- Updated Playwright helpers so old aliases like `Video`, `Embed HTML`, `Drawing Canvas`, and `Media Library` still work.
- Added layout and component tests for direct buttons, Advanced keyboard behavior, and click-outside close.

## Verification

- Component/ribbon tests: 13 files, 124 tests passed.
- Ribbon layout E2E: 62/62 passed.
- Toolbar/coverage/game E2E: 41/41 passed in local run; tester also saw retry-pass with one flake outside this change.
- `npm run lint`: passed.
- `npm run build`: passed with existing chunk-size warning.

## Decisions

- Use icon-only direct buttons with `title` and `aria-label` rather than reintroducing visible labels.
- Compact Insert section padding and remove visible text from Basic/Shapes primary buttons to keep Advanced inside the 1280px visible ribbon.
- Reuse `RibbonDropdownMenuGroup` with `menuClassName` and `itemsClassName` instead of creating a separate Advanced-only component.

## Residual Risks

- `coverage-gaps.spec.js` has a known flaky shadow/rotation assertion seen by tester; retry passed and local targeted run passed.
- Vite chunk-size warning remains existing.

## Unresolved Questions

None.
