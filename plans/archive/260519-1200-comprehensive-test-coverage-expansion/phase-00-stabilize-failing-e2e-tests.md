---
phase: 0
title: "Stabilize 29 Failing E2E Tests + EditorPage POM Split"
status: completed
priority: P0
effort: "4-5d"
dependencies: []
tdd: true
completed: "2026-05-19"
---

# Phase 0 — Stabilize Failing E2E Tests + POM Split

## Overview
E2E baseline reports 35 fail / 1 flaky / 210 pass after ribbon refactor v1.9.0. Plan `260518-2245-ribbon-audit-gate-failures-fix-tdd` already covers Category B (6 a11y fails F1-F6). This phase handles **remaining 29 fails (Categories A, C-J)** + splits oversized `EditorPage.js` (565 LOC → ≤200 LOC modules).

## Cross-plan delegation
- **Category B (6 fails)** → handled by `260518-2245-ribbon-audit-gate-failures-fix-tdd`. Wait for that plan to merge before re-running full e2e baseline.
- If 2245 slips: temporarily `test.fixme` Category B specs with ticket reference; do not block this plan.

## Failure scope (29 fails)
| Cat | Tests | Root cause | Treatment |
|---|---|---|---|
| A | 12 ribbon-layout @ 768px | Real CSS overflow regression | `test.fixme` w/ ticket; user decision: 1024 = required; 768 = nightly warning |
| C | 3 AI modal flows | `.dropdown-item` selector dead | Fix POM helpers |
| D | 3 editor.spec | Same root + autosave selector | Fix selectors |
| E | 3 live modals | Share menu trigger selector | Fix `MenuBarHelper.openShareMenu` |
| F | 1 Share modal | Same as E | Same fix |
| G | 3 element insert | Table prompt + LineHeight tab path | Fix selectors |
| H | 2 coverage-gaps | Rulers + Custom CSS button moved | Fix selectors |
| I | 1 autosave retry | Save status DOM changed | Update assertion |
| J | 1 visual regression | Outdated baseline | Regenerate after A-I clean |

## Requirements

### Functional
- 32 e2e specs all pass (after 2245 plan merges Category B).
- 0 flaky.
- POM modules each ≤ 200 LOC.

### Non-functional
- No production code change unless failure confirms UI bug + user-approved.
- Public POM API backward-compatible.

## Architecture
Split `tests/e2e/pages/EditorPage.js` into:
- `EditorPage.js` (≤150 LOC, orchestrator)
- `RibbonHelper.js` (tab switch, layout metrics)
- `MenuBarHelper.js` (File / AI / Share dropdowns; replaces `.menu-trigger` + `.dropdown-item` selectors with current Radix Dropdown structure)
- Existing helpers preserved.

## Related Code Files
- **Modify:** `tests/e2e/pages/EditorPage.js`, `tests/e2e/pages/RibbonInsertHelper.js`, all spec files in `tests/e2e/` matching failure list, `tests/e2e/visual-regression.spec.js` snapshots
- **Create:** `tests/e2e/pages/RibbonHelper.js`, `tests/e2e/pages/MenuBarHelper.js`
- **Read-only:** `client/src/components/ribbon/**`, `client/src/pages/EditorPage.jsx`

## Implementation Steps (TDD)

### Step 1 — Red: confirm baseline failures
- Re-run `npx playwright test --reporter=list` to confirm 29 fails after 2245 plan merge.
- Save log: `reports/e2e-baseline-pre-phase00-{date}.log`.

### Step 2 — Diagnostic: confirm root cause per category
- Read 1-2 failing specs/category + corresponding ribbon component.
- Update `research/researcher-02-e2e-failure-categorization.md` with verified-cause column.

### Step 3 — Green: fix Category C/D/E/F (10 fails, 1 root cause)
- Replace `.dropdown-item` selector logic in `EditorPage.openAICopywriter`, `startBroadcast`, `openShareModal`, `openFileMenuItem` with new helpers in `MenuBarHelper.js`.
- Verify: re-run only those 4 spec files.

### Step 4 — Green: fix Category G/H/I (6 fails)
- Update Insert/Format tab selectors in `RibbonInsertHelper.js`, `coverage-gaps.spec.js`, `element-lifecycle.spec.js`.
- Verify: re-run those specs.

### Step 5 — Green: fixme Category A (12 fails)
- Mark 12 ribbon-layout @ 768px tests `test.fixme(true, '768px viewport: nightly soft-warning, see ticket #XXX')`.
- File ticket "Ribbon overflow at 768px viewport tier" in repo (Phase 9 will run as nightly job).

### Step 6 — Refactor: split EditorPage.js
- Move tab/layout helpers → `RibbonHelper.js`.
- Move dropdown menus → `MenuBarHelper.js`.
- Verify all helpers ≤ 200 LOC: `wc -l tests/e2e/pages/*.js`.
- All passing specs still pass.

### Step 7 — Green: regenerate Category J visual baseline
- After Steps 3-6 clean: `npx playwright test visual-regression --update-snapshots`.
- Review diff manually + commit baseline.

### Step 8 — Verify
- Full e2e run: `0 fail, 0 flaky` (allowing fixme).
- Save log: `reports/e2e-after-phase00-{date}.log`.

## Success Criteria
- [ ] 29 failures reduced to 0 (or 12 fixme + 17 fixed if Category A deferred).
- [ ] All POM files ≤ 200 LOC.
- [ ] No new `.skip()` introduced.
- [ ] Visual baseline regenerated + committed.
- [ ] `docs/testing-guide.md` updated with new POM module breakdown.

## Risk Assessment
- **R-01**: Splitting EditorPage breaks passing specs. Mitigation: refactor internals only first; preserve method signatures.
- **R-02**: 2245 plan slips → blocks Phase 0 close. Mitigation: temporarily fixme Category B with reference; do not block.
- **R-03**: Category A user-facing regression at 768px. Mitigation: ticket for follow-up; not blocker per user decision.
