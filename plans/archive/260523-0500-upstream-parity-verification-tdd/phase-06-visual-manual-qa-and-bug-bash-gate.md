---
phase: 6
title: "Visual Manual QA And Bug Bash Gate"
status: pending
priority: P1
effort: "2-3d"
dependencies: [4, 5]
---

# Phase 6: Visual Manual QA And Bug Bash Gate

## Context Links

- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- `plans/visuals/`
- `plans/260522-1339-qa-confidence-uplift-5-phase-tdd/phase-03-manual-smoke-checklist-and-bug-bash-process.md`

## Overview

Add visual and manual proof for areas automation misses: layout polish, canvas feel, popup clipping, drag/resize UX, touch gestures, and end-to-end user confidence.

## Requirements

<!-- Updated: Validation Session 1 - manual signoff ownership confirmed -->

**Functional:**
- Run visual regression in canonical Linux Playwright environment or GitHub manual workflow.
- Create/update parity-focused MVP manual checklist with 10-15 scripted checks.
- Keep exhaustive exploratory bug bash separate from the release gate.
- Run bug-bash and classify issues P0/P1/P2.
- Produce go/no-go report.
- Assign a named DRI/signoff role before executing go/no-go.
- Treat Phase 6 as blocked until the named DRI/signoff owner is recorded.

**Non-functional:**
- Do not regenerate visual snapshots on Windows/macOS.
- Manual checklist must be executable in 45-90 minutes.
- Snapshot update requires visual diff artifact, linked matrix row, and named approval.
- P0 visual diffs require pass or signed waiver; baseline regeneration alone is not approval.

## Architecture

```text
automated pass -> visual baseline -> manual checklist -> bug bash report -> release decision
```

## Related Code Files

**Read:**
- `tests/e2e/visual/`
- `tests/e2e/visual-regression.spec.js`
- `docs/manual-smoke-checklist.md` if created by MVP QA plan

**Create/Modify:**
- `docs/upstream-parity-manual-checklist.md`
- `plans/.../reports/manual-bug-bash-report.md`

## Implementation Steps

1. Run visual suite:
   ```powershell
   npx playwright test tests/e2e/visual tests/e2e/visual-regression.spec.js --project=chromium
   ```
2. If snapshots need update, use Docker/Linux workflow only:
   ```powershell
   gh workflow run manual-update-playwright-visual-baselines.yml --ref <branch>
   ```
   Require uploaded diff artifacts, linked matrix row, and named signoff before accepting new baselines.
3. Execute MVP manual checklist:
   - editor load/create/save/reload
   - representative insert tabs and element categories
   - properties panel
   - presentation/live/share
   - export/import
4. Run optional exploratory bug bash separately if time remains.
5. Record bugs with severity, owner, waiver status, and release decision.

## TDD / Tests

- Red: identify one matrix-derived MVP P0 manual flow without an executable checklist row.
- Green: add a concise manual checklist row with expected result and owner.
- Refactor: align checklist row IDs with matrix row IDs.

## Todo List

- [ ] Run visual suite.
- [ ] Create/update manual checklist.
- [ ] Execute bug bash.
- [ ] Write manual bug-bash report.
- [ ] Update matrix final status.

## Success Criteria

- Visual suite passes or intentional diff approved.
- Manual checklist has 0 open P0/P1 before release.
- Bug-bash report has clear go/no-go.
- Go/no-go has named signoff and waiver decisions for any accepted P0/P1 risk.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Visual baseline drift | High | Linux-only snapshot workflow |
| Manual QA too broad | Medium | Use matrix P0/P1 only for release gate |
| Snapshot update blesses regression | High | Require diff artifact, matrix link, and named signoff |
| Manual signoff dispute blocks release | Medium | Assign DRI and waiver/downgrade rules before execution |

## Security Considerations

- Manual share/cloud/GitHub tests use dummy/local data only.
- Do not upload traces/screenshots containing canary secrets or private deck data.

## Red Team Adjustment

- Manual QA is now a bounded MVP gate. Exhaustive bug bash is optional and separately reported.
- Visual baseline updates require evidence and named approval; regenerating snapshots is not sufficient.

## Next Steps

- Wire final CI/docs gate.

## Unresolved Questions

- Named DRI still must be recorded before Phase 6 execution.
