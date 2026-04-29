# Red Team And Validation

## Summary
- Plan mode: `ck:plan --hard`
- Scope: E2E hardening with stable selectors
- Status: reviewed before implementation
- Decision: proceed, but keep scope narrow and phase gates strict

## Red Team Findings
1. **Selector churn risk**
   - Risk: adding many `data-testid` values can become another maintenance burden.
   - Guard: Phase 1 requires selector contract. Phase 2 adds IDs only for ambiguous controls.

2. **Canvas regression risk**
   - Risk: brainstorm report proposed `canvas-resize-handle-se` and `canvas-rotation-handle`; adopting those would break existing tests.
   - Guard: plan explicitly preserves `resize-handle-*` and `rotation-handle`.

3. **Autosave semantics risk**
   - Risk: rollback on failed save would surprise users and lose work.
   - Guard: Phase 4 mandates optimistic local state plus visible error and retry.

4. **Test bloat risk**
   - Risk: adding broad duplicate insertion specs creates slow suite with low signal.
   - Guard: Phase 3 excludes duplicate insertion coverage and targets property persistence only.

5. **Visual regression flake risk**
   - Risk: screenshots can flake due fonts, timestamps, animations.
   - Guard: Phase 6 uses one seeded chromium baseline, disables animation, masks volatile UI if needed.

6. **POM refactor timing risk**
   - Risk: splitting `EditorPage.js` before coverage would create hidden behavior regressions.
   - Guard: Phase 5 depends on Phases 2-4 and must preserve public API.

## Validation Answers
- **Use label/role or test IDs?** Role/label/text first. `data-testid` only where ambiguous.
- **Rename canvas test IDs?** No. Keep current IDs.
- **Autosave failed save rollback?** No rollback. Keep local state, show error, retry.
- **Visual regression API?** Use Playwright `toHaveScreenshot()`.
- **Undo/redo stress YAGNI?** One bounded 10-operation test is useful. More is deferred.
- **Zustand direct inspection?** No `window.__store`. Use API persistence and DOM.
- **Table merge test?** Not in this plan. UI is not present.

## Recommended Execution Order
1. Phase 1 first. Do not skip.
2. Phase 2 IDs.
3. Phase 3 property tests.
4. Phase 4 lifecycle/autosave behavior.
5. Phase 5 POM split only after tests pass.
6. Phase 6 visual/CI gates.
7. Phase 7 final verification/docs.

## Unresolved Questions
- None blocking. Implementation may discover missing pass-through support in UI components; handle inside Phase 2.
