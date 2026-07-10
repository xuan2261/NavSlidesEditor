---
phase: 3
title: "Themed Dialog And Feedback System"
status: pending
priority: P1
dependencies: [1, 2]
---

# Phase 3: Themed Dialog And Feedback System

## Overview

Replace native blocking `alert()` / `confirm()` calls in user-facing flows with themed app feedback and confirmation surfaces.

## Requirements

- Functional: import/export/delete/share/live/AI errors and confirmations render as app UI, not native dialogs.
- Non-functional: maintain focus management, keyboard escape behavior, and screen-reader announcements.

## Architecture

Create or extend a centralized feedback primitive using existing `ModalShell`, `Button`, and theme tokens. Prefer a lightweight provider/hook if many pages need feedback; otherwise keep a small shared confirm/notice component with local state in `MainLayout` or near affected flows. Hooks such as `use-export-actions.js` and `use-ai-actions.js` must receive a feedback callback/adapter or be wired through a provider boundary rather than importing UI directly when provider access is unclear.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/pages/ExplorePage.jsx`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/hooks/use-export-actions.js`
- Modify: `client/src/hooks/use-ai-actions.js`
- Modify: `client/src/components/ShareModal.jsx`
- Modify: `client/src/components/MediaLibraryModal.jsx`
- Modify: `client/src/components/HistoryModal.jsx`
- Modify: `client/src/components/file-browser-modal-to-select-and-insert-media.jsx`
- Create/Modify: shared feedback component under `client/src/components/ui/` if needed.
- Test: `client/src/utils/native-dialog-audit.test.js`
- Test/Extend: `client/src/components/ui/ModalShell.test.jsx`
- E2E: `tests/e2e/dashboard.spec.js`, `tests/e2e/version-history-ui-restore.spec.js`, `tests/e2e/export.spec.js`

## Implementation Steps

1. Confirm `native-dialog-audit.test.js` fails on current production calls.
2. Inventory native calls and classify:
   - Error notice: import/export/live/AI failures.
   - Confirmation: delete share link, restore snapshot, delete media/file.
   - Warning summary: PPTX warnings.
3. Implement a reusable themed notice/confirm pattern with:
   - `role="alert"` for urgent errors and `aria-live="polite"` for non-urgent notices/status.
   - `aria-modal="true"` for modal confirmations.
   - Focus trap and focus restore for confirmation dialogs.
   - Background non-interaction while modal confirm is open.
   - Fallback focus target when the original trigger unmounts.
   - Primary/secondary/destructive button variants.
4. Add a minimal feedback API contract before migrating hooks:
   - notice/error method,
   - confirm method that resolves or calls exactly once,
   - testable adapter for hooks.
5. Migrate high-value flows first: Home imports, Editor live/AI, Share/History/Media confirmations.
6. Remove or shrink native-dialog allowlist until static test passes.

## Tests And Verification

```bash
npx vitest run client/src/utils/native-dialog-audit.test.js client/src/components/ui/ModalShell.test.jsx
npx vitest run client/src/hooks/use-export-actions.test.js client/src/hooks/use-ai-actions.test.js
npx playwright test tests/e2e/dashboard.spec.js tests/e2e/version-history-ui-restore.spec.js tests/e2e/export.spec.js
npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js
```

## Success Criteria

- [ ] No production `alert()` / `confirm()` remains unless explicitly justified by a tiny allowlist.
- [ ] Confirmation dialogs support Escape, cancel, confirm, and focus restore.
- [ ] Escape and Cancel never execute destructive callbacks.
- [ ] Confirm executes the callback exactly once.
- [ ] Modal confirmations isolate the background from keyboard/click interaction.
- [ ] Destructive actions have specific accessible names, not generic `OK`.
- [ ] Error notices explain what happened and the recovery path when available.
- [ ] Existing import/export/delete/share/live flows still function.

## Risk Assessment

- Risk: replacing alerts changes async flow timing. Mitigation: keep callbacks explicit and cover with flow tests.
- Risk: provider integration becomes over-engineered. Mitigation: choose the smallest shared primitive that removes duplication.
