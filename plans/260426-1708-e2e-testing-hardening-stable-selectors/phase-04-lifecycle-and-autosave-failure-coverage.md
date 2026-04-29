---
phase: 4
title: "Lifecycle And Autosave Failure Coverage"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [3]
---

# Phase 4: Lifecycle And Autosave Failure Coverage

## Context Links
- `tests/e2e/keyboard-shortcuts.spec.js`
- `tests/e2e/undo-redo.spec.js`
- `tests/e2e/editor.spec.js`
- `client/src/pages/EditorPage.jsx`
- `client/src/components/EditorMenuBar.jsx`
- `client/src/components/QuickAccessToolbar.jsx`
- `client/src/utils/api.js`

## Overview
Priority P1. Cover element lifecycle and autosave failure behavior with correct product semantics: keep optimistic local edits, show save error, allow retry.

## Key Insights
- Current autosave catch only logs `Auto-save failed` and clears status.
- Rollback would be hostile for an editor and can lose user work.
- Existing keyboard tests cover simple copy/paste/delete, but not cross-slide correctness or locked negative paths.
- Existing undo/redo has 1-step tests. Add one bounded stress test, not a broad stress suite.

## Requirements
- Functional: visible autosave error state, retry path, lifecycle coverage for delete/copy/paste/duplicate/lock.
- Non-functional: deterministic tests, no silent catch, no external network.
- UX: local unsaved edits remain visible after failed PUT.

## Architecture
Autosave state proposal:
- Extend save status from `'' | 'saving' | 'saved'` to include `'error'`.
- Store `lastSaveError` string in `EditorPage.jsx`.
- `EditorMenuBar` shows `Save failed` and a retry control.
- Retry uses the same save function as manual save/autosave.
- Do not revert `presentation` state on failed save.

## Related Code Files
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/components/EditorMenuBar.jsx`
- Optional modify: `client/src/components/QuickAccessToolbar.jsx`
- Create or modify: `tests/e2e/element-lifecycle.spec.js`
- Modify: `tests/e2e/keyboard-shortcuts.spec.js` if extending existing lifecycle tests is cleaner.
- Modify: `tests/e2e/undo-redo.spec.js`
- Delete: none.

## Implementation Steps
1. Extract local save function in `EditorPage.jsx` to avoid duplicating autosave/manual save error handling.
2. On save start:
   - set `saveStatus` to `saving`
   - clear previous `lastSaveError`
3. On save success:
   - set `saveStatus` to `saved`
   - update `lastSavedAt`
   - clear status after existing delay
4. On save failure:
   - set `saveStatus` to `error`
   - set `lastSaveError` from API error/message
   - keep local `presentation` unchanged
5. Add retry UI:
   - button label can be `Retry`
   - accessible role/name required for Playwright
   - optional `data-testid="save-retry-btn"` if role is ambiguous
6. Add lifecycle tests:
   - Delete via keyboard.
   - Delete via context menu: capture `prev` before clicking delete.
   - Delete via properties panel `prop-delete`.
   - Locked element blocks delete and duplicate.
   - Copy/paste same slide preserves type/properties.
   - Copy/paste to different slide: paste after selecting target slide, then assert target slide has copied element.
7. Add undo/redo bounded stress:
   - 10 sequential adds.
   - Undo 10 times with polling.
   - Redo 10 times with polling.
   - No `.catch(() => {})`.
8. Add autosave failure tests:
   - Route first PUT to 500 for exact presentation URL.
   - Add/update element.
   - Assert element remains visible locally.
   - Assert save failed UI visible.
   - Let next PUT continue or fail only once.
   - Click Retry.
   - Assert saved API state contains change.

## Todo List
- [ ] Shared save function implemented.
- [ ] Save error UI implemented.
- [ ] Retry UI implemented.
- [ ] Lifecycle tests added/fixed.
- [ ] Autosave failure/retry test added.
- [ ] Undo/redo stress test added.

## Verification & Tests
- `npx playwright test tests/e2e/element-lifecycle.spec.js --reporter=list`
- `npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/undo-redo.spec.js --reporter=list`
- `npx playwright test tests/e2e/editor.spec.js --grep "Version History|Sync|toolbar" --reporter=list`
- `npm run build`
- `npm test`

## Success Criteria
- [ ] Save failure is visible to user.
- [ ] Retry works and persists data.
- [ ] Failed autosave does not rollback local editor state.
- [ ] Lifecycle tests pass without swallowed failures.
- [ ] Existing keyboard/undo tests still pass.

## Risk Assessment
- Risk: status auto-clear hides error too quickly.
- Mitigation: never auto-clear `error`; clear only on retry success or next save start.
- Risk: route interception catches GET and breaks setup.
- Mitigation: intercept only PUT for exact presentation URL.

## Security Considerations
- Do not expose raw stack traces in UI. Show concise error.
- Do not log presentation content or tokens in failure UI.

## Next Steps
- Phase 5 can refactor POM safely after behavior coverage is stronger.

