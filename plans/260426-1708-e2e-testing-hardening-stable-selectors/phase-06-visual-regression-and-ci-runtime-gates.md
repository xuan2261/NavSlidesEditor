---
phase: 6
title: "Visual Regression And CI Runtime Gates"
status: completed
priority: P2
effort: "0.75-1d"
dependencies: [5]
---

# Phase 6: Visual Regression And CI Runtime Gates

## Context Links
- `playwright.config.js`
- `tests/e2e/coverage-gaps.spec.js`
- `tests/e2e/animation-preview.spec.js`
- `.github/workflows/*` if present
- `plans/reports/researcher-260426-1552-e2e-testing.md`

## Overview
Priority P2. Add one deterministic visual regression path and CI runtime decision gates. Do not shard or raise workers without runtime evidence.

## Key Insights
- Current visual smoke checks screenshot byte length only.
- Built-in Playwright screenshots are enough for this project.
- Test count alone is not enough to justify sharding. Runtime threshold matters.
- `playwright.config.js` currently uses CI workers 2 and local workers 4.

## Requirements
- Functional: add deterministic screenshot baseline for editor chrome/canvas.
- Non-functional: stable on CI, animations disabled, seeded content, chromium only.
- CI: preserve current behavior unless runtime data justifies changes.

## Architecture
Visual test approach:
- Create seeded presentation through API.
- Open editor.
- Disable animations/transitions for screenshot.
- Hide or mask volatile timestamps/status text if needed.
- Use `await expect(page).toHaveScreenshot('editor-canvas-basic.png', { maxDiffPixelRatio: 0.01 })`.

CI gate approach:
- Add docs/script note for collecting runtime.
- Sharding only if full E2E runtime exceeds 15 minutes or CI failure rate requires isolation.
- Worker increase only after memory/runtime benchmark on target runner.

## Related Code Files
- Create or modify: `tests/e2e/visual-regression.spec.js`
- Modify: `playwright.config.js` only if needed for snapshot stability or reporter output.
- Modify: `.github/workflows/*` only if CI workflows exist and runtime data supports changes.
- Modify: `docs/deployment-guide.md` or `docs/code-standards.md` for visual snapshot maintenance.
- Delete: none.

## Implementation Steps
1. Add `visual-regression.spec.js` with one seeded editor scenario:
   - shape + text + chart/table enough to catch chrome/canvas regressions.
   - no external images.
2. Disable animations:
   - `page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' })`
   - apply before screenshot.
3. Stabilize dynamic UI:
   - avoid waiting until "Saved" timestamp appears, or mask status area with Playwright screenshot mask.
4. Use Playwright screenshot assertion:
   - `toHaveScreenshot()`, not custom length checks.
5. Add snapshot update instructions:
   - `npx playwright test tests/e2e/visual-regression.spec.js --update-snapshots`
6. Measure full suite runtime:
   - `Measure-Command { npx playwright test --reporter=list }` on Windows if running locally.
   - Or collect CI job duration.
7. Decide CI changes:
   - If runtime <= 15 min: no sharding.
   - If runtime > 15 min: plan 2 or 4 shards in a follow-up PR.
   - If memory issues occur: keep workers at 2 on CI.

## Todo List
- [ ] Visual regression spec added.
- [ ] Screenshot baseline committed.
- [ ] Snapshot update command documented.
- [ ] Runtime measurement captured.
- [ ] CI sharding decision documented.

## Verification & Tests
- `npx playwright test tests/e2e/visual-regression.spec.js --reporter=list`
- `npx playwright test tests/e2e/animation-preview.spec.js tests/e2e/coverage-gaps.spec.js --reporter=list`
- `npx playwright test --list`
- Optional runtime check: `Measure-Command { npx playwright test --reporter=list }`

## Success Criteria
- [ ] Visual screenshot test passes repeatedly on same environment.
- [ ] Snapshot is deterministic and does not include volatile text.
- [ ] CI worker/shard config only changes with evidence.
- [ ] Existing visual smoke remains or is replaced by stronger screenshot baseline.

## Risk Assessment
- Risk: screenshot flakes from fonts/rendering differences.
- Mitigation: chromium only, seeded local content, mask volatile UI, avoid external assets.
- Risk: snapshots become high-churn noise.
- Mitigation: keep one baseline initially; expand only after value proven.

## Security Considerations
- Screenshots must not include real user data, tokens, or local paths.
- Use seeded presentation content only.

## Next Steps
- Phase 7 runs final full verification and docs updates.

