---
date: 2026-07-22
time: "14:17 Asia/Saigon"
type: journal
status: completed
plan: plans/archive/260619-ux-polish-teaching-docs-tdd
---

# Teaching Interactivity UX Polish and Bilingual Docs

## Context

This archive record covers the completed [teaching-interactivity UX plan](../archive/260619-ux-polish-teaching-docs-tdd/plan.md). It followed the v1.15 feature release: teaching capabilities existed, but their discovery, empty-state guidance, and assistive-technology contracts needed deliberate repair. Scope stayed intentionally narrow: no new element or game types, backend migrations, persistent onboarding system, or release bump.

## What Happened

- **2026-06-19:** Phase 1 turned the intended paths into observable contracts: named Insert controls, `Enter`/`Space` activation, focus restoration, dialog descriptions, `role="alert"` validation, and distinct dashboard/template states. See [UX contracts](../archive/260619-ux-polish-teaching-docs-tdd/reports/ux-contracts.md).
- **2026-06-20:** Commit `02de1f17` added a teaching-tools tour step; screen-reader helper text and `aria-describedby` links in the [Insert ribbon](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx); modal and game-join error semantics; and explicit empty/search-no-result states plus teaching-starter badges in [HomePage](../../client/src/pages/HomePage.jsx).
- The same change synchronized English/Vietnamese [feature overview](../../website/features/overview.md) and [keyboard guidance](../../website/guide/keyboard-shortcuts.md), retaining the canonical 19 element types and 10 game subtypes.
- Recorded validation passed: focused Vitest coverage; full Vitest at **318 files / 2,687 tests / 1 skipped**; ESLint with existing warnings only; VitePress and client builds; and three targeted teaching/game Playwright tests. Details are in the [final verification report](../archive/260619-ux-polish-teaching-docs-tdd/reports/final-verification-report.md).

## Impact

Mermaid, STEM, LaTeX/TikZ, technical symbols, and games became discoverable without documentation hunting; blocked input now has programmatic feedback. The unpleasant truth is that a rich release is still a bad teaching experience when users and screen readers must guess where features live or why insertion failed. This was necessary corrective UX work, not new functionality.

## Decisions

| Decision | Alternative rejected | Why |
| --- | --- | --- |
| Polish existing entry points and handlers | Add feature families, schema changes, or a new onboarding store | The defect was discoverability and semantics, not missing capability. |
| Use native labels, descriptions, and alert semantics | Rewrite shortcuts or introduce custom focus traps | Existing scope-aware keyboard behavior could be preserved with lower regression exposure. |
| Update English then Vietnamese observable-path docs | Publish aspirational copy ahead of implementation | Parity remains credible only when both languages describe tested UI behavior. |

## Concerns / Limitations

- Full Playwright was **not** run; only the targeted teaching/game path passed. Historical evidence also notes `npm`/`npx` were unavailable on PATH, so local `node_modules/.bin/*.cmd` fallbacks ran validators.
- This archival capture did not rerun the June validators; it records the committed evidence rather than pretending it is fresh.
- AgentWiki publish skipped: outward sharing was not authorized.

## Next

- Archive coordinator: preserve this journal and the linked plan reports with the completed plan during this archival pass.
- Future UX releases: write keyboard/announcement contracts before adding discoverability copy, then run the full browser suite when release time permits.

## Unresolved Questions

- None.
