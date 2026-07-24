---
title: "Verified Element Control Interaction Defects Deep TDD"
description: "Test-first remediation of ck-debug-verified element/control interaction defects: cut/lock consistency, table merge preservation, find-replace coverage, group/lock feedback, geometry/mixed UX, and regression harness."
status: completed
priority: P1
effort: "4-6 dev-days"
branch: "master"
tags: [deep, tdd, elements, controls, clipboard, table, find-replace, interaction, editor]
blockedBy: []
blocks: []
created: "2026-07-09T02:17:15.585Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
redTeamReviewed: "2026-07-09"
validated: "2026-07-09"
validationResult: "passed-with-amendments"
redTeamResult: "conditional-pass"
---

# Verified Element Control Interaction Defects Deep TDD

## Overview

Implement **only findings confirmed** by the 2026-07-09 element/control risk report and the subsequent `/ck:ck-debug` verification pass. Exclude overstated claims (multi-select arrow nudge already works via `EditorPage.onArrow`; hot-potato/jeopardy renderers already exist; PPTX format limits are documentation-only).

Primary goal: make lock, cut, table merge, find-replace, and group-block semantics **consistent, test-backed, and user-visible** without redesigning EditorPage or expanding game/export scope.

## Source of Truth

| Source | Role |
|--------|------|
| Session risk report (elements/controls) | Initial candidate backlog |
| ck-debug verification report | **Verdict matrix**: CONFIRMED / OVERSTATED / DESIGN-LIMIT |
| `client/src/hooks/use-clipboard.js` | Cut/dup/paste pure ops |
| `client/src/hooks/use-slide-operations.js` | Delete/align/group lock filters |
| `client/src/pages/EditorPage.jsx` | `handleCut`, `onArrow` multi-nudge, `updateSelectedElements` |
| `client/src/utils/active-slide-selection.js` | `hasBlockedGroupMutation` |
| `client/src/utils/element-update-fanout.js` | Multi-select fan-out + MIN_SIZE |
| `client/src/components/properties/table-properties-utils.js` | `normalizeTableShape` wipe merges |
| `client/src/components/find-replace-helpers.js` + `FindReplaceBar.jsx` | Search/replace type whitelist |
| `client/src/components/properties/common-element-controls.jsx` | Mixed opacity UX |
| `client/src/data/element-defaults.js` | Callout 36×36 vs `MIN_SIZE=40` |
| `client/src/editor-interaction-bug-repro.test.js` | Prior interaction regression harness |
| Completed plan `260608-1503-editorpage-element-interaction-bug-fixes-tdd` | Prior lock/dup decisions (dup skips locked) |
| Completed plan `260609-0830-element-control-functional-fixes-tdd` | Export limits = document only |

## Locked Product Decisions (2026-07-09)

1. **Cut + lock:** Align with Delete/Duplicate — **skip locked members**, cut free members only. If all selected are locked → no-op (clipboard unchanged). NOT abort-all when mixed.
2. **Paste of locked payload:** Keep current behavior (paste preserves `locked` when present on clipboard). After Phase 1, cut will no longer put locked els on clipboard via cut path; copy still can.
3. **Table merges on ±row/col:** **Preserve merges that remain fully in-bounds**; drop or clamp only merges that become invalid. Do **not** wipe all merges on every shape change. Update tests that currently assert `mergedCells: []`.
4. **Find/replace Phase 3 scope:** Add **`table.data`** (and vertical children already covered). Defer chart labels / game questions / QR / timeline to optional Phase 6 stretch or follow-up.
5. **Group/lock feedback:** Minimal non-modal notice (`data-testid="editor-blocked-action-notice"`) via small ui-store or local EditorPage state; auto-clear ~2.5s. No new toast library.
6. **Out of scope (explicit):** Game subtype polish, HTML sandbox security redesign, PPTX format limits workarounds, EditorPage full decomposition, multi-select nudge “fix” (already works).

## Severity Legend

| ID | Finding | Severity | Phase |
|----|---------|----------|-------|
| V1 | Cut deletes locked; Delete/Dup skip locked | **P0** inconsistency | 1 |
| V2 | Table ±row/col wipes all merges | **P1** silent data loss | 2 |
| V3 | Find/replace blind to table cells | **P1** silent partial | 3 |
| V4 | `hasBlockedGroupMutation` silent early-return | **P2** UX | 4 |
| V5 | Callout 36 < MIN_SIZE 40 size jump | **P2** geometry | 5 |
| V6 | Opacity mixed: label “—” but slider shows primary | **P2** UX | 5 |
| V7 | Missing cut-lock unit tests; docs/class drift | **P2** harness | 6 |

## Architecture Approach

```
Pure ops (clipboard, table-utils, find-replace helpers)
    ↑ unit tests first (RED)
EditorPage / Properties / Status notice (wire)
    ↑ characterization + component tests
Regression harness (editor-interaction + phase suites)
    ↑ full npm run test gate
```

**TDD iron rule per phase:**
1. Write failing tests that encode CONFIRMED desired behavior.
2. Implement minimal fix.
3. Green + no unrelated suite red.
4. Phase VERIFY checklist before next phase.

## Phases

| # | Phase | Priority | Status | File |
|---|-------|----------|--------|------|
| 1 | [P0 Cut Lock Consistency](./phase-01-p0-cut-lock-consistency.md) | P1 | completed | `phase-01-*.md` |
| 2 | [Table Merge Preservation](./phase-02-table-merge-preservation.md) | P1 | completed | `phase-02-*.md` |
| 3 | [Find Replace Coverage](./phase-03-find-replace-coverage.md) | P1 | completed | `phase-03-*.md` |
| 4 | [Group Lock Feedback UX](./phase-04-group-lock-feedback-ux.md) | P2 | completed | `phase-04-*.md` |
| 5 | [Geometry And Mixed Controls UX](./phase-05-geometry-and-mixed-controls-ux.md) | P2 | completed | `phase-05-*.md` |
| 6 | [Regression Harness And Docs](./phase-06-regression-harness-and-docs.md) | P2 | completed | `phase-06-*.md` |

## Cross-Plan Dependencies

| Relationship | Plan | Notes |
|--------------|------|-------|
| Related (completed) | `260608-1503-editorpage-element-interaction-bug-fixes-tdd` | Lock/dup/paste group decisions — this plan extends cut parity |
| Related (completed) | `260609-0830-element-control-functional-fixes-tdd` | Export limits stay doc-only |
| Related (pending, **no block**) | `260709-0913-verified-ui-findings-remediation-deep-tdd` | UI a11y different surface; may touch `canvas-element-wrapper` in Phase 5 only for MIN_SIZE/callout — coordinate if concurrent cook |
| Related (pending) | `260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd` | Canvas keyboard a11y; multi-nudge contract — do not re-fix multi-nudge here |

**blockedBy:** none (can start immediately).  
**blocks:** none (UI a11y plans not dependent on these fixes).

## Out of Scope (do not implement)

- Fix multi-select arrow nudge (already correct via `EditorPage.onArrow`)
- Implement missing game renderers (hot-potato/jeopardy already wired)
- PPTX shadow/filter/radius/media playable workarounds
- HTML `allow-same-origin` removal (trusted-author model)
- Full EditorPage split refactor
- Find/replace for game/chart/QR/timeline (unless Phase 6 stretch time remains)

## Global Test Gate (every phase exit)

```bash
npx vitest run client/src/hooks/use-clipboard.test.js
npx vitest run client/src/editor-interaction-bug-repro.test.js
# plus phase-specific files listed in each phase
npm run test   # before plan complete (Phase 6)
npm run lint
```

## Effort Estimate

| Phase | Effort |
|-------|--------|
| 1 Cut/lock | 0.5–1 d |
| 2 Table merge | 1–1.5 d |
| 3 Find/replace table | 0.75–1 d |
| 4 Group feedback | 0.5–0.75 d |
| 5 Geometry/mixed | 0.5–0.75 d |
| 6 Harness/docs | 0.5 d |
| **Total** | **4–6 d** |

## Research Artifacts

- [reports/researcher-01-verified-findings-matrix.md](./reports/researcher-01-verified-findings-matrix.md)
- [reports/researcher-02-code-anchors-and-call-paths.md](./reports/researcher-02-code-anchors-and-call-paths.md)
- [reports/red-team-review.md](./reports/red-team-review.md)
- [reports/validation-interview.md](./reports/validation-interview.md)

## Open Questions

None remaining for cook — product decisions locked above. If product later wants “cut may delete locked”, reverse Phase 1 decision and flip tests.

## Cook Handoff

```bash
/ck:cook plans/260709-0917-verified-element-control-interaction-defects-deep-tdd
```

Execute phases **1 → 6 in order**. Phase 2 updates existing tests that assert wipe; do not land Phase 2 without rewriting those expects.
