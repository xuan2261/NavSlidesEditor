---
title: "Fix Tailwind Review Findings Hard"
description: "Fix post-Tailwind runtime regressions across notes, editor batch actions, live protocol, remote controller, and speaker view."
status: completed
priority: P1
branch: "master"
tags: [bugfix, frontend, backend, live, test]
blockedBy: []
blocks: [20260423-0345-complete-tailwind-migration-remediation]
created: "2026-04-23T13:29:06.050Z"
createdBy: "ck:plan"
source: skill
---

# Fix Tailwind Review Findings Hard

## Overview

Close the 6 hard review findings after the Tailwind UI/UX refactor. Runtime correctness lands before more style remediation on the same live-presenting surfaces.

Core fixes:
- `Slide.notes` canonical everywhere; `speakerNotes` legacy input only.
- Editor batch slide actions use one state update and clamp active selection.
- Find/replace accepts empty replacement text.
- Live rooms separate presenter, controllers, and viewers.
- Remote and speaker routes are real controller surfaces.
- Regression coverage documents these bugs permanently.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Normalize Speaker Notes Contract](./phase-01-normalize-speaker-notes-contract.md) | Completed |
| 2 | [Fix Editor Batch Actions And Find Replace](./phase-02-fix-editor-batch-actions-and-find-replace.md) | Completed |
| 3 | [Harden Live Room Protocol](./phase-03-harden-live-room-protocol.md) | Completed |
| 4 | [Rebuild Remote Controller](./phase-04-rebuild-remote-controller.md) | Completed |
| 5 | [Rebuild Speaker View](./phase-05-rebuild-speaker-view.md) | Completed |
| 6 | [Regression Suite Docs And Final Verification](./phase-06-regression-suite-docs-and-final-verification.md) | Completed |

## Final Verification

- `npm run lint`: pass, 0 errors, existing warnings remain.
- `npm run build`: pass.
- `npm run test`: pass, 14 files / 68 tests.
- `npm run test:e2e`: pass, 98 tests.

## Dependencies

- Blocks `20260423-0345-complete-tailwind-migration-remediation` for live-presenting surfaces, because protocol/runtime correctness should land before further styling work.
- Uses current dirty worktree as baseline; do not revert existing edits.
- `docs/development-rules.md` is absent; follow injected development rules and `docs/code-standards.md`.
