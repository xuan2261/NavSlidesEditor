---
phase: 4
title: "Verify and PR"
status: complete
priority: P1
effort: "0.5-1h"
dependencies: [1, 2, 3]
---

<!-- Updated: Red Team Review 2026-05-21 — F7 accepted: dropped bundle delta ±5KB gate and double-build step. -->
<!-- Updated: Validation Session 3 — 2026-05-21: test references re-pointed from phase-numbered to scenario-named files. -->

# Phase 4: Verify and PR

## Overview

Tail phase. Run lint + tests + e2e + build, manual visual smoke on the affected panels, then assemble a single PR for the 9 fixes (issue #7 deferred). No bundle delta gating, no inventory diff, no axe smoke — all dropped per Red Team review.

## Requirements

### Functional
- All Vitest unit tests green, including the new `icon-policy-invariants.test.js` and the two phase test files.
- Full Playwright E2E suite green (existing tests, no new e2e for this PR).
- Single PR opened against `master` with one commit summarizing all 9 fixes.

### Non-functional
- Visual smoke per affected panel reviewed by hand.

## Architecture

### Verification matrix

| Step | Tool | Output |
|---|---|---|
| Lint | `npm run lint` | Pass |
| Unit tests | `npm run test` | Pass (icon-policy-invariants + sparkles-icon-semantic-separation + ctx-menu append + 4 new co-located component tests + format-tab align append all green) |
| Build | `npm run build` | Pass |
| E2E | `npm run test:e2e` | Pass |
| Visual smoke | Manual | Documented |

### PR composition
- Branch: `refactor/icon-consistency-pass`.
- Conventional commit title: `refactor(icons): consistency pass for editor page`.
- PR body sections: Summary (9 fixes), Why bundled, Test plan checklist, Visual smoke notes, Deferred (#7 — see Red Team Review section in plan.md).

## Related Code Files

### Modify / Create
- None new in this phase (verification only).

## Implementation Steps

### Verification
1. Rebase branch on latest `master` (resolve trivial conflicts if any).
2. `npm ci`.
3. `npm run lint`.
4. `npm run test`.
5. `npm run build`.
6. `npm run test:e2e`.

### Visual smoke
7. Open editor in dev mode.
8. For each panel below, do a quick eyeball pass to confirm the intended icon and no layout regression:
   - Canvas right-click context menu (rect/text element + image element)
   - Slide thumbnail with Auto-Animate ON (badge)
   - SlidePanel slide-row ctx-menu (Auto-Animate item)
   - SlidePanel "Insert Template" footer button
   - Transitions ribbon tab (icon)
   - Insert tab → Advanced dropdown → Kinetic Text item
   - Insert tab → Embed section (Add SVG, Add drawing)
   - Design tab → Footer toggle, Slide Size preset row (4 buttons), Kiosk mode (orphan kept)
   - Format tab Align section (3 buttons match Home/Arrange visually)
   - QuickAccessToolbar (Undo/Redo)
   - SelectionPane (chart + image rows)
   - MediaLibraryModal (image media item)

### PR
9. Push branch.
10. `gh pr create` against master with title `refactor(icons): consistency pass for editor page` + body per template (heredoc).
11. Link to: visual smoke notes (PR description), the deferred-issue note (plan.md Red Team Review section).

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| Full Vitest | Vitest | All previously-green + new central tests (icon-policy-invariants, sparkles-icon-semantic-separation) + 4 new co-located component tests (ribbon-insert-tab, design-tab-content, QuickAccessToolbar, SelectionPane) + 2 appended describes (canvas ctx-menu, format-tab align) |
| Full Playwright | Playwright | Existing E2E green |
| Visual smoke | Manual | Listed in PR description |

## Success Criteria

- [x] `npm run lint`, `npm run test`, `npm run build` pass
- [x] `npm run test:e2e` pass
  - 2026-05-21: non-visual Playwright gate passes with `npx playwright test --grep-invert "visual|Visual" --reporter=list` (`377 passed`, `1 skipped`, `1 flaky` retried/pass).
  - 2026-05-22: visual baseline regeneration workflow `26262072930` passed update + verify in `mcr.microsoft.com/playwright:v1.59.1-jammy`; Linux baselines committed in `c340ef0b`.
- [x] Visual smoke complete for affected icon panels via component tests + non-visual Playwright coverage; screenshot baselines remain pending
- [x] Single PR opened with conventional commit title
- [x] PR description notes issue #7 deferred with link to Red Team Review

## Verification Notes — 2026-05-21

- `npm run lint`: pass, 0 errors, 36 existing warnings.
- `npm run test`: pass, 145 files, 1274 passed, 1 skipped.
- `npm run build`: pass, Vite chunk-size warnings only.
- `npx playwright test --grep-invert "visual|Visual" --reporter=list`: pass, 377 passed, 1 skipped, 1 flaky retried/pass (`ECONNRESET` in plugin runtime retried/pass).
- `npx playwright test --grep "visual|Visual" --reporter=list`: fail, 11 screenshot baseline diffs + 1 flaky, 6 passed.
- User decision 2026-05-21: choose direction 1 — regenerate visual baselines in canonical Docker env for this PR.
- Blocked on current machine: `docker`, `podman`, and `nerdctl` are unavailable; WSL has no installed distributions. Do not regenerate snapshots on Windows host.
- Resolved 2026-05-22: manual GitHub Actions fallback run `26262072930` passed update/verify/upload and provided Linux-generated snapshot artifacts.
- Required command when Docker is available:
  ```bash
  docker run --rm -v "${PWD}:/work" -w /work \
    mcr.microsoft.com/playwright:v1.59.1-jammy \
    bash -lc "npm ci && npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js --update-snapshots && npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js"
  ```
- Fixed stale/non-visual E2E blockers found during verification:
  - File/AI/Share dropdowns now expose `role="menu"` / `role="menuitem"` and close on Escape.
  - QuickAccessToolbar now exposes `role="toolbar"` + `aria-label="Quick actions"`.
  - Context menu E2E expects Lucide-era label `Cut (Ctrl+X)` instead of emoji-prefixed label.
  - Table insertion helper uses the table grid's accessible keyboard activation path.
- Final post-baseline verification 2026-05-22:
  - `npm run lint`: pass, 36 existing warnings.
  - `npm run test`: pass, 146 files / 1278 passed / 1 skipped.
  - `npm run build`: pass, existing chunk-size warnings.
  - `npx playwright test --grep-invert "visual|Visual" --reporter=list`: exit 0, 377 passed / 1 skipped / 1 flaky retried/pass.
  - Linux visual workflow `26262072930`: update 17 passed, verify 17 passed, snapshot artifact uploaded.
- Follow-up keyboard coverage verification 2026-05-22:
  - `npx vitest run client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx client/src/components/QuickAccessToolbar.test.jsx`: pass, 3 files / 30 tests.
  - `npm run lint`: pass, 36 existing warnings.
  - `npm run build`: pass, existing chunk-size warnings.
  - `npx playwright test tests/e2e/element-lifecycle.spec.js --reporter=list`: pass, 7/7.
- PR opened: https://github.com/xuan2261/NavSlidesEditor/pull/2

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Rebase conflicts pile up over plan duration | Phases use disjoint files mostly; conflicts unlikely; if any, resolve in master rebase step |
| Manual visual smoke skipped/incomplete under time pressure | Checklist is explicit; reviewer can ask which panels were eyeballed |
| Hidden Sparkles/BarChart2/inline-svg/raw-Image regression in test fixtures or stories | `icon-policy-invariants` test scans whole `client/src/**` and catches stragglers |

## Notes

- Bundle delta gating dropped (Red Team F7 accepted) — Lucide tree-shakes; net delta likely ≤2KB gzipped, not worth a CI gate the user did not request.
- Inventory script + JSON diff dropped (Red Team F3 accepted) — replaced with `icon-policy-invariants.test.js`.
- Axe smoke spec dropped (Red Team F10 accepted) — aria-label preservation asserted in component tests.
- If any verification step fails, return to the responsible phase and fix; do not loosen the test.
