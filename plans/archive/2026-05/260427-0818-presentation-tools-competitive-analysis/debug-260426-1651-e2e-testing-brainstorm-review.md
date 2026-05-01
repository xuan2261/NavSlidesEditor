# E2E Testing Brainstorm Review - Debug Report

## Executive Summary
- **Issue:** `brainstorm-260426-1547-e2e-testing-comprehensive.md` partly stale vs current repo.
- **Impact:** If used directly, plan may duplicate existing E2E coverage, add wrong test IDs, and introduce failing snippets.
- **Root cause:** Report claims not fully re-verified against current `tests/e2e`, `playwright.config.js`, and component selectors.
- **Status:** Investigated. No code changes.
- **Fix:** Revise roadmap before implementation. Keep valid direction, remove stale metrics and broken snippets.

## Evidence
- Playwright discovery: `npx playwright test --list` => **110 tests in 23 files**.
- Targeted verification: `npx playwright test tests/e2e/properties-panel.spec.js tests/e2e/coverage-gaps.spec.js --reporter=list` => **10 passed**.
- Report says `22 spec files + fixtures` and baseline total test count `~40`, target `~70`.
- `tests/e2e/pages/EditorPage.js` is confirmed **537 LOC** with **55 async methods**.
- Existing coverage already includes extended insert menu, align/distribute, group/ungroup, lock/shadow/rotation, resize handle, rulers/guides, and visual smoke.
- Current canvas test IDs are `slide-element-*`, `resize-handle-*`, `rotation-handle`, `top-ruler`, `persistent-guide-*`; report proposes different IDs: `canvas-resize-handle-se`, `canvas-rotation-handle`.
- Property panel controls currently have no `data-testid`; they use labels, input order, titles, and role/text selectors.

## Findings
1. **Stale inventory.**
   - Current repo: 23 spec files, 110 discovered tests.
   - Report roadmap still says verify 22 specs and grow from ~40 to ~70 tests.

2. **Some missing-coverage claims are overstated.**
   - `coverage-gaps.spec.js` already covers image/video/audio/QR/icon/drawing/SVG insertion, align/distribute, group/ungroup, lock, shadow, rotation, resize, rulers/guides, and visual smoke.
   - True gap remains: type-specific property behavior for Table, Chart, Code, Image, LaTeX, Shape is still thin.

3. **Selector plan needs reconciliation.**
   - Adding `data-testid` to property panel is useful.
   - But proposed names must match existing naming style or update tests consistently.
   - Do not introduce `canvas-resize-handle-se` / `canvas-rotation-handle` unless intentionally migrating from existing `resize-handle-se` / `rotation-handle`.

4. **Several example snippets are unsafe as implementation source.**
   - Context-menu delete captures `prev` after deletion, so expected count becomes wrong.
   - Cross-slide copy/paste snippet pastes on slide 1, then expects slide 2 to have the pasted element.
   - Rapid insert swallows errors with `.catch(() => {})`; bad for debug signal.
   - API failure test expects optimistic local insert rollback, but current autosave only logs failure and clears save status.

5. **POM split is reasonable but not P0 by itself.**
   - `EditorPage.js` size violates the repo's 200-line target.
   - However, existing targeted E2E subset passes. Split should be zero-behavior structural work, after selector map is agreed.

## Recommendations
### Immediate (P0)
- [ ] Update the brainstorm report metrics: 23 spec files, 110 discovered tests.
- [ ] Replace broken snippets before using as implementation plan.
- [ ] Build a selector inventory first: existing test IDs, role/label selectors, required new property test IDs.

### Short-term (P1)
- [ ] Add `data-testid` only to property controls that are hard to target accessibly.
- [ ] Add focused property tests for true gaps: Shape fill/stroke/radius, Image object-fit/filter/radius, Code language/font, Chart type/data, Table row/col/cell style, LaTeX edit/apply behavior.
- [ ] Split `EditorPage.js` into helpers only if done as behavior-preserving refactor with current tests passing before/after.

### Long-term (P2)
- [ ] Add real screenshot baselines with `toHaveScreenshot` after UI stabilizes; current screenshot-length check is only smoke.
- [ ] Shard only when CI time proves need. Test count already >80; runtime threshold matters more.
- [ ] Avoid `window.__store` E2E inspection unless a deliberate dev-only test bridge is exposed.

## Unresolved Questions
- Should property control selectors prefer accessible labels first, with `data-testid` only for ambiguous controls?
- Should existing canvas test IDs be kept stable or renamed under a broader convention?
- Is autosave failure intended to keep optimistic local state, or should failed persistence rollback/show visible error?
