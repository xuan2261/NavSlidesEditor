---
title: "Insert Advanced Direct Actions And Overlay TDD"
description: "Improve Insert Advanced UX by exposing fixed advanced insert actions as direct icon buttons and hardening ribbon popups against clipping."
status: completed
priority: P1
effort: 22-30h
branch: master
tags: [frontend, ui-ux, ribbon, tdd, accessibility]
blockedBy: []
blocks: []
created: 2026-05-22
---

# Insert Advanced Direct Actions And Overlay TDD

## Overview

Fix Insert tab `Advanced` UX. Current dropdown is rendered inside the `80px` ribbon content area and is easy to clip/hard to scan. Expose fixed advanced commands directly as icon buttons; keep dynamic/multi-choice actions in a launcher; harden ribbon popup positioning across all ribbon popups that currently use `absolute top-full`.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Builds on | [Editor Ribbon Layout Hardening TDD](../260517-2252-editor-ribbon-layout-hardening-tdd/plan.md) | complete |
| Builds on | [Insert Ribbon Media Embed Direct Actions TDD](../260518-0711-insert-ribbon-media-embed-direct-actions-tdd/plan.md) | complete |
| Builds on | [PowerPoint Classic Ribbon Alignment TDD](../260522-1527-powerpoint-classic-ribbon-alignment-tdd/plan.md) | complete |
| Input report | [Ribbon Advanced Investigation Report](./reports/ribbon-advanced-investigation-report.md) | complete |

## Phases

| Phase | Name | Status | Progress |
| --- | --- | --- | --- |
| 1 | [TDD Baseline And UX Contract](./phase-01-tdd-baseline-and-ux-contract.md) | Complete | 100% |
| 2 | [Advanced Direct Icon Actions](./phase-02-advanced-direct-icon-actions.md) | Complete | 100% |
| 3 | [Games And Plugin Launcher](./phase-03-games-and-plugin-launcher.md) | Complete | 100% |
| 4 | [Ribbon Overlay Clipping Hardening](./phase-04-ribbon-overlay-clipping-hardening.md) | Complete | 100% |
| 5 | [Responsive Keyboard And Visual Verification](./phase-05-responsive-keyboard-and-visual-verification.md) | Complete | 100% |
| 6 | [Docs Changelog And Release Gate](./phase-06-docs-changelog-and-release-gate.md) | Complete | 100% |

## Key Decisions

- Keep ribbon height `80px`; do not solve by increasing header height.
- Keep section label `Advanced` unless product owner explicitly chooses rename.
- Direct buttons for fixed actions only: `Kinetic Text`, `Math Grid`, `Anime.js`, `Three.js`, `Timeline`.
- Keep grouped launcher for `Games` and plugin insert items.
- Use existing Lucide icons and `Button` variants; no new UI dependency.
- Apply shared `RibbonFloatingOverlay` to every ribbon popup currently rendered with `absolute top-full` or equivalent `top-full` placement in this PR, including File, Header AI/Share, Design, Transitions, Animations, Paragraph compact controls, Insert Advanced launcher, Shape, Table, and Games.
- 1280px Insert row should have zero horizontal overflow if feasible; reachable horizontal scroll is acceptable only with measured proof of no clipping/overlap and all controls reachable.
- After a launcher item inserts a game/plugin, return focus to the launcher trigger for predictable keyboard flow.

## Dependencies

- React 18, Vite 5, Radix Tabs, Tailwind, Lucide.
- Existing files under `client/src/components/ribbon`.
- Existing tests: Vitest ribbon tests, `tests/e2e/ribbon-layout.spec.js`, `tests/e2e/pages/RibbonInsertHelper.js`, visual ribbon baseline.

## Success Criteria

- Fixed Advanced actions are visible direct icon buttons in Insert.
- `Games` and plugin insert items remain reachable through a compact launcher.
- All ribbon popups migrated from `absolute top-full` or equivalent `top-full` placement are not clipped by `.tour-step-ribbon`, command-row overflow, or header overflow.
- Insert passes 1280/1024/900/768 layout gates: no clipped visible controls, no vertical overflow, no overlap, and clean horizontal scroll when needed.
- 1280px target: no horizontal overflow if feasible; if the direct-action row exceeds width, horizontal scroll is acceptable only when every control remains visible/reachable and the final verification report documents the measured reason.
- Keyboard: Tab/Enter/Space/Escape work for direct buttons and migrated popup surfaces; focus returns to the correct trigger after close.
- Docs and changelog reflect final behavior, including Header AI/Share if migrated with the shared overlay.

## Red-Team Review

### Session 1 - 2026-05-22

**Trigger:** User requested `$ck:cook red-team` for this plan before implementation.
**Report:** [Red-Team Plan Review](./reports/red-team-plan-review.md)

#### Findings Applied

- [x] Added Header `AI` and `Share` dropdowns to ribbon-wide `top-full` overlay migration scope.
- [x] Clarified Phase 03/04 sequencing so overlay-dependent Games/plugin focus tests live with the overlay primitive work.
- [x] Added explicit plugin selection close/focus-return requirement.
- [x] Added popup geometry helper/selector contract requirement.
- [x] Required Games surface to anchor to launcher trigger unless centered behavior is proven by tests.

## Validation Log

### Session 1 - 2026-05-22

**Trigger:** User requested `/ck:plan validate` and then asked to update the plan using the architecture clarification plus recommended validation answers.
**Questions asked:** 5

#### Questions & Answers

1. **[Scope]** Shape/Table/Games overlay migration co bat buoc trong plan nay khong?
   - Options: Bat buoc migrate hoac co test geometry pass tuong duong (Recommended) | Chi migrate Advanced launcher, con lai follow-up | Chi fix Advanced clipping, khong mo rong scope
   - **Answer:** Bat buoc migrate hoac co test geometry pass tuong duong
   - **Rationale:** These surfaces share the same clipping failure mode and are in the reported Insert UX area.

2. **[Tradeoff]** Quy dinh 1280px Insert row nen la gi?
   - Options: Zero horizontal overflow bat buoc | Zero overflow preferred; scroll duoc chap nhan neu do va chung minh reachable/no clipping (Recommended) | Scroll duoc chap nhan mac dinh o moi viewport
   - **Answer:** Zero overflow preferred; scroll duoc chap nhan neu do va chung minh reachable/no clipping
   - **Rationale:** Direct icon actions can increase row width; final acceptance should be based on measured layout, not guesswork.

3. **[Architecture]** Shared `RibbonFloatingOverlay` ap dung pham vi nao?
   - Options: Chi Insert surfaces trong plan: Advanced, Shape, Table, Games (Recommended before user clarification) | Tat ca ribbon popup dang dung `absolute top-full` trong cung PR | Chi `RibbonDropdownMenuGroup`, khong dung Shape/Table custom popup
   - **Answer:** Tat ca ribbon popup dang dung `absolute top-full` trong cung PR
   - **Custom input:** User asked why not make every ribbon popup use the same click-to-open interactive popup behavior like File.
   - **Rationale:** A single clipping-safe overlay contract gives consistent ribbon popup behavior and avoids leaving known clipped popup implementations behind.

4. **[Accessibility]** Sau khi chon mot game/plugin tu launcher, focus nen di dau?
   - Options: Return focus ve launcher trigger de predictable keyboard flow (Recommended) | Move focus vao element vua insert tren canvas | De browser tu xu ly, chi dam bao khong focus vao node da unmount
   - **Answer:** Return focus ve launcher trigger de predictable keyboard flow
   - **Rationale:** Portal menus unmount after selection; restoring focus prevents keyboard users from landing on removed nodes.

5. **[Naming]** Section label nen giu `Advanced` hay doi?
   - Options: Giu `Advanced` de giam churn test/docs (Recommended) | Doi thanh `Interactive` | Doi trigger launcher thoi, section van `Advanced`
   - **Answer:** Giu `Advanced` de giam churn test/docs
   - **Rationale:** The UX fix is about visibility and clipping, not taxonomy.

#### Confirmed Decisions

- `RibbonFloatingOverlay` scope: migrate all ribbon popups currently using `absolute top-full` in this PR.
- Insert 1280px rule: zero overflow preferred; measured reachable scroll accepted only when no clipping/overlap and documented.
- Shape/Table/Games: mandatory overlay migration in this plan.
- Focus restore: return focus to the invoking trigger after close/selection.
- Naming: keep `Advanced`.

#### Action Items

- [x] Update Phase 04 to include all `absolute top-full` ribbon popup files.
- [x] Update Phase 05 regression tests for File, Design, Transitions, Animations, Paragraph compact controls, and Insert popup surfaces.
- [x] Update Phase 06 docs/final verification report to list every migrated popup surface.

#### Impact on Phases

- Phase 02: relax hard 1280px zero-overflow wording to match measured acceptance.
- Phase 04: broaden overlay migration scope from Insert-only to all ribbon popup surfaces using `absolute top-full`.
- Phase 05: add cross-tab popup geometry, keyboard, outside-click, and focus-return regression gates.
- Phase 06: document shared overlay standard and final covered surface list.

### Session 2 - 2026-05-22

**Trigger:** User requested `$ck:plan validate plans\260522-2013-insert-advanced-direct-actions-and-overlay-tdd\` after Session 1 updates.
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** Co cho phep tao shared primitive moi `ribbon-floating-overlay.jsx` khong?
   - Options: Co, tao shared primitive rieng cho portal overlay (Recommended) | Khong, nhung logic vao tung component hien co | Chi sua `RibbonDropdownMenuGroup`, cac popup khac giu nguyen
   - **Answer:** Co, tao shared primitive rieng cho portal overlay
   - **Rationale:** Shared primitive is warranted because clipping is a ribbon-wide popup contract, not a one-off Insert issue.

2. **[Behavior]** Khi trang/ribbon scroll hoac viewport resize trong luc popup dang mo, overlay nen xu ly the nao?
   - Options: Recompute vi tri theo anchor, clamp viewport (Recommended) | Dong popup ngay khi scroll/resize | Chi tinh vi tri luc mo, khong cap nhat
   - **Answer:** Recompute vi tri theo anchor, clamp viewport
   - **Rationale:** Recompute keeps open menus stable while preserving viewport clamping across responsive ribbon states.

3. **[Scope Control]** Voi pham vi ribbon-wide popup migration kha rong, cook nen thuc hien theo thu tu nao?
   - Options: Primitive + tests truoc, roi migrate tung surface mot voi test tuong ung (Recommended) | Migrate toan bo surface truoc, test cuoi | Chi migrate Insert-related surface truoc, phan con lai follow-up
   - **Answer:** Primitive + tests truoc, roi migrate tung surface mot voi test tuong ung
   - **Rationale:** Incremental migration lowers regression risk and makes failures attributable to one popup surface at a time.

4. **[Interaction]** Co can enforce "chi mot ribbon popup mo tai mot thoi diem" tren toan ribbon khong?
   - Options: Co, nhung dung state/local close don gian theo khu vuc, khong them global manager (Recommended) | Co, them global popup coordinator | Khong can, chi dam bao moi popup tu close dung
   - **Answer:** Co, nhung dung state/local close don gian theo khu vuc, khong them global manager
   - **Rationale:** Local close coordination is enough for this UX fix and avoids a global popup manager that the current scope does not need.

#### Confirmed Decisions

- Overlay architecture: create `RibbonFloatingOverlay` as a shared portal primitive.
- Open overlay behavior: recompute anchor position on scroll/resize and clamp to viewport.
- Migration order: add primitive/tests first, then migrate each popup surface with focused tests.
- Popup concurrency: keep at most one relevant popup open through local state coordination; do not add a global popup manager.

#### Action Items

- [x] Update Phase 04 architecture with recompute-on-scroll/resize and local-only popup coordination.
- [x] Update Phase 04 implementation order to require primitive/tests before surface migrations.
- [x] Update Phase 05 verification to validate recompute behavior and incremental migrated-surface coverage.

#### Impact on Phases

- Phase 04: clarify shared primitive is approved, scroll/resize recomputes position, and one-open-popup behavior stays local.
- Phase 05: add scroll/resize geometry regression coverage for migrated overlays.

## Cook Handoff

Cook command: `/ck:cook --auto C:\Work\NavSlidesEditor\plans\260522-2013-insert-advanced-direct-actions-and-overlay-tdd\plan.md`

## Completion Log

### Session 3 - 2026-05-22

- Completed TDD implementation for Insert Advanced direct actions and ribbon-wide portal overlay migration.
- Final report: [Final Verification Report](./reports/final-verification-report.md)
- Code review concerns resolved: vertical viewport clamp, initial hidden pre-measure render, and Insert 1280px overflow pressure via icon-only launcher.
- Post-fix review focus concern resolved: [Post-Review Focus Restore Resolution](./reports/post-review-focus-restore-resolution.md)
- Final focused review: [code-review-final-focus-restore-260522.md](./reports/code-review-final-focus-restore-260522.md) passed with no findings.
- Visual snapshots were not refreshed; semantic and geometry coverage passed without intentional snapshot updates.

## Unresolved Questions

- None.
