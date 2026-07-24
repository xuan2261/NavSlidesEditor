---
title: "Validation Report: Element Interaction and Control Bug Fixes"
status: completed
created: 2026-07-03
plan: ../plan.md
---

# Validation Report: Element Interaction and Control Bug Fixes

## Summary

Validation found the red-teamed plan was mostly implementation-ready but had two blockers and five coverage/wording gaps. All findings were accepted and folded into `plan.md` plus affected phase files.

## Accepted Findings

| ID | Severity | Finding | Resolution |
|---|---:|---|---|
| V1 | P0 | Mixed locked group ungroup behavior contradicted itself | Locked groups cannot be ungrouped while any member is locked; unlock first with pure lock toggle |
| V2 | P0 | Phase 04 depended on Phase 05 group semantics without declaring it | Phase 04 now depends on Phase 05 |
| V3 | P1 | Phase 01 allowed merely reserving the Playwright repro | Phase 01 now requires creating the repro before Phase 06 |
| V4 | P1 | Phase 07 targeted validation omitted planned helper/shared tests | Phase 07 now requires a generated touched-test command map and expanded static list |
| V5 | P1 | Offline/print export validation was conditional and vague | Phase 06 now mandates export path discovery and proof/test coverage |
| V6 | P2 | Phase 05 referenced Phase 02 tests before Phase 02 runs | Phase 05 wording now separates current available tests from Phase 02 rerun |
| V7 | P2 | Formatting validation was not explicit | Phase 07 now includes Prettier check or documented skip when only write-mode formatting exists |

## Binding Decisions

- A group containing any locked member cannot be ungrouped until locked members are explicitly unlocked.
- Hidden group members remain non-selected/non-mutated, and visible partial groups cannot be moved/geometrically mutated until made complete safely.
- Context-menu work runs after group-selection semantics.
- Browser line hit-target repro is mandatory before the line fix.
- Final validation must use actual touched files to generate commands, not only the static command list.

## Open Questions

None.
