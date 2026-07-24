---
phase: 5
title: "Bilingual Docs Sync"
status: completed
priority: P2
effort: "1d"
dependencies: [2, 3, 4]
---

# Phase 5: Bilingual Docs Sync

## Overview

Update English and Vietnamese docs to match the final polished UX, without making docs the primary deliverable or overpromising behavior.

## Requirements

- Functional: English and Vietnamese docs describe the same UX paths for teaching feature onboarding, templates/empty states, and keyboard accessibility.
- Functional: update manual smoke or critical journeys only when observable manual steps change.
- Non-functional: no release bump and no stale game/element count drift.
- Non-functional: docs must build and links must remain valid.

## Architecture

Docs are VitePress markdown. Treat English as the source wording and Vietnamese as parity content. Keep docs grounded in implemented UI paths.

## Docs Parity Table

| English | Vietnamese |
|---|---|
| `website/features/overview.md` | `website/vi/features/overview.md` |
| `website/features/game-mode.md` | `website/vi/features/game-mode.md` |
| `website/features/latex.md` | `website/vi/features/latex.md` |
| `website/tutorials/code-math.md` | `website/vi/tutorials/code-math.md` |
| `website/tutorials/using-latex.md` | `website/vi/tutorials/using-latex.md` |
| `website/guide/keyboard-shortcuts.md` | `website/vi/guide/keyboard-shortcuts.md` |

## Related Code Files

- Modify: `website/features/overview.md`
- Modify: `website/features/game-mode.md`
- Modify: `website/features/latex.md`
- Modify: `website/tutorials/code-math.md`
- Modify: `website/tutorials/using-latex.md`
- Modify: `website/guide/keyboard-shortcuts.md`
- Modify: exact Vietnamese counterparts listed in the docs parity table
- Modify if observable manual steps change: `docs/manual-smoke-checklist.md`
- Modify if observable critical journey steps change: `docs/critical-user-journeys.md`
- Modify: website content guard tests if needed

## Implementation Steps

1. Add or update content guard tests for any new UX claims that should not drift.
2. Update English docs for polished user paths.
3. Update Vietnamese docs with equivalent scope.
4. Search for stale feature counts and rejected claims.
5. Update stale website guard assertions to v1.15 facts: 19 canonical element types and 10 game subtypes.
6. Run docs build and explicit website content tests.

## Success Criteria

- [x] English and Vietnamese pages have matching feature scope.
- [x] Parity checks cover headings, UX-path claims, and 19/10 count claims where applicable.
- [x] Docs mention only implemented, observable behavior.
- [x] No stale 7-game or 20-element claims reappear.
- [x] `npm run docs:build` passes.
- [x] `npx vitest run tests/unit/website-content-accuracy-v1-14-guards.test.js tests/unit/website-content-port-pages-and-sidebar-coverage.test.js tests/unit/release-verification-docs-contract.test.js` passes, or the stale guard file is renamed and equivalent updated command passes.

## Risk Assessment

Risk: bilingual drift. Mitigation: parity checklist by heading and feature count search.

Risk: docs overpromise. Mitigation: write after app UX is finalized and validate against tests.
