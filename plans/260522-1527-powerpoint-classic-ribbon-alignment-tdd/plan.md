---
title: "PowerPoint Classic Ribbon Alignment TDD"
description: "Fix ribbon classic alignment outliers with narrow TDD gates and minimal shared-contract hardening."
status: complete
priority: P1
effort: 10h
branch: master
tags: [frontend, tdd, ui, ribbon]
blockedBy: []
blocks: []
created: 2026-05-22
---

# PowerPoint Classic Ribbon Alignment TDD

## Overview

Fix the remaining PowerPoint classic ribbon alignment outliers without a broad ribbon redesign: keep tab panels left-flow, keep group content centered, normalize Format empty state, and add deterministic gates for the command states that can regress.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Builds on | [Editor Ribbon Layout Hardening TDD](../260517-2252-editor-ribbon-layout-hardening-tdd/plan.md) | complete |
| Builds on | [Insert Ribbon Media Embed Direct Actions TDD](../260518-0711-insert-ribbon-media-embed-direct-actions-tdd/plan.md) | complete |
| Related | [Icon Consistency Pass TDD](../260521-1130-icon-consistency-pass-tdd/plan.md) | complete |

## Phases

| Phase | Name | Status | Progress |
| --- | --- | --- | --- |
| 1 | [Baseline And Classic Ribbon Contract](./phase-01-baseline-and-classic-ribbon-contract.md) | Complete | 100% |
| 2 | [Shared Ribbon Layout Primitives](./phase-02-shared-ribbon-layout-primitives.md) | Complete | 100% |
| 3 | [Tab Group State Matrix And Ordering](./phase-03-tab-group-taxonomy-and-ordering.md) | Complete | 100% |
| 4 | [Contextual Format Tab Rhythm](./phase-04-contextual-format-tab-rhythm.md) | Complete | 100% |
| 5 | [Density Overflow And Responsive Gates](./phase-05-density-overflow-and-responsive-gates.md) | Complete | 100% |
| 6 | [Visual Accessibility And Keyboard Verification](./phase-06-visual-accessibility-and-keyboard-verification.md) | Complete | 100% |
| 7 | [Docs Review And Release Gate](./phase-07-docs-review-and-release-gate.md) | Complete | 100% |

## Dependencies

- React 18, Radix Tabs, Tailwind utilities, existing `Button` and `RibbonSection`.
- Existing tests: Vitest ribbon unit tests, Playwright `ribbon-layout.spec.js`, visual baseline spec, keyboard a11y spec.
- Microsoft references in [research summary](./research/powerpoint-classic-ribbon-research-summary.md).

## Success Criteria

- All touched tabs expose one testable layout contract: active tab panel left-flow, sections stretch height, section content centered.
- Format empty state no longer visually diverges from other tabs.
- Required tab/group states are explicit; no broad group rename/order churn without a failing gate.
- Critical command controls are listed and visible at 1280px; at 1024/900/768 they may require row scroll but must not clip, overlap, or lose keyboard access.
- No control clipping, overlap, vertical overflow across supported ribbon viewport matrix.
- Docs updated with final contract and verification commands.

## Accepted Red-Team Corrections

The red-team review found the original plan was too broad for the known defect. These corrections are now binding:

- Keep the ribbon height at current `80px` for this plan. Escalate any height increase to a separate decision with screenshot/header impact.
- Do not commit known-red TDD tests to a shared branch. New failing assertions must be fixed in the same atomic implementation slice or quarantined with explicit `test.fixme` and ticket context.
- Prefer stable DOM contract selectors (`data-ribbon-content-row`, `data-ribbon-section`, `data-ribbon-section-label`) over Tailwind-class assertions and brittle DOM-shape queries.
- Use one scroll owner for command rows. The active content row owns horizontal scroll; tests must measure that row, not only `.tour-step-ribbon`.
- Define group expectations by state, not as one static taxonomy. Format contextual prefixes must use real labels such as `Fill`, `Stroke`, `Fit`, `Alt Text`, and `Chart Type`, not a fake `Contextual` label.
- Replace the Insert 1024px `fixme` with assertions that allow horizontal scroll but forbid clipping, overlap, and vertical overflow.
- If visual snapshots change, regenerate them only with the repository's canonical Playwright/Linux workflow and record diff artifacts in the final report.

## Cook Handoff

Cook command: `/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260522-1527-powerpoint-classic-ribbon-alignment-tdd\plan.md`

## Red Team Review
### Session - 2026-05-22
**Findings:** 15 deduped (12 accepted, 3 rejected)
**Severity breakdown:** 4 Critical, 8 High, 3 Medium
**Details:** [Red-team review report](./reports/red-team-review-2026-05-22.md)

## Validation Log

### Session 1 — 2026-05-22
**Trigger:** `/ck:plan validate plans\260522-1527-powerpoint-classic-ribbon-alignment-tdd\`
**Questions asked:** 1

#### Questions & Answers

1. **[Scope / Architecture / Risk]** Confirm all recommended validation defaults?
   - Options: Keep scope narrow, height `80px`, create `RibbonTabContentRow` only if justified by 2+ touched tabs, update visual snapshots only after geometry/a11y pass via canonical Playwright/Linux workflow, and keep full E2E conditional (Recommended) | Change one or more defaults
   - **Answer:** Keep all recommended defaults.
   - **Custom input:** đồng ý
   - **Rationale:** These decisions prevent scope creep, brittle visual-only validation, accidental header height regressions, and unnecessary full-suite cost for a layout-only ribbon fix.

#### Confirmed Decisions
- Scope: stay narrow on ribbon alignment and Format rhythm; no ribbon redesign.
- Height: keep ribbon height at `80px`; solve pressure through density/scope reduction, horizontal row scroll, or existing dropdown patterns.
- Shared primitive: create `RibbonTabContentRow` only if at least two touched tabs need the same wrapper; otherwise keep selector/class changes minimal.
- Visual baseline: regenerate snapshots only after geometry and keyboard/a11y gates pass, and only with canonical Playwright/Linux workflow.
- Final gates: targeted ribbon/a11y/visual Chromium gates plus lint/build are required; full E2E is conditional when changes spill outside ribbon.

#### Action Items
- [ ] Preserve these defaults during implementation and code review.

#### Impact on Phases
- Phase 02: shared primitive remains conditional, not automatic.
- Phase 05: `80px` height remains binding under viewport pressure.
- Phase 06: visual snapshots remain downstream of semantic/geometry/a11y gates.
- Phase 07: final gate keeps full E2E conditional unless implementation blast radius expands.

## Unresolved Questions
- None.
