# Phase 04 - Modal Shell And Async Feedback

## Context Links

- [Plan](./plan.md)
- `client/src/components/AIGeneratorModal.jsx`
- `client/src/components/AICopywriterModal.jsx`
- `client/src/components/AITranslateModal.jsx`
- `client/src/components/ShareModal.jsx`
- `client/src/components/SyncModal.jsx`
- `client/src/components/HistoryModal.jsx`
- `client/src/components/MediaLibraryModal.jsx`
- `client/src/components/TemplatePickerModal.jsx`

## Overview

- Priority: P1
- Status: Complete
- Effort: 7h
- Goal: standardize modal layout, focus, scrim, and async feedback.

## Key Insights

- Many modals repeat `fixed inset-0 bg-black/50` and `shadow-2xl`.
- Some modals already have `role="dialog"` and labelled title.
- Shared shell is justified if it removes duplicated behavior.

## Requirements

- Functional:
  - Add a shared `ModalShell` only if it replaces duplicated markup.
  - Preserve inline rendering; no portal migration unless necessary.
  - Ensure Escape close, focus entry, focus return where current patterns allow.
  - Async buttons disabled while working.
  - Error text announced with `role="alert"` or `aria-live`.
- Non-functional:
  - No modal wider than viewport.
  - Header/action row wraps safely.
  - Scrim strong enough in both themes.

## Architecture

Possible new component:

```jsx
<ModalShell
  titleId="..."
  title="..."
  onClose={...}
  size="sm|md|lg|xl"
>
  {children}
</ModalShell>
```

If component creation is rejected, create shared class helpers in existing UI module.

## Related Code Files

- Create optional: `client/src/components/ui/ModalShell.jsx`
- Modify optional: `client/src/components/ui/index.js`
- Modify: modal components listed above, incrementally.
- Tests: existing modal tests and targeted new tests.

## Implementation Steps

1. Inventory modal props and close behavior.
2. Implement `ModalShell` with:
   - scrim click optional.
   - Escape close.
   - `role="dialog"`, `aria-modal`, `aria-labelledby`.
   - focus first close/action on mount if safe.
3. Migrate 2 low-risk modals first: History, Sync.
4. Add tests.
5. Migrate AI/share/template/media modals.
6. Replace error-only visual messages with alert/live region.

## Todo List

- [x] Modal inventory.
- [x] Implement shared shell or shared style helpers.
- [x] Migrate low-risk modals.
- [x] Add tests.
- [x] Migrate remaining modals.
- [x] Verify async states.

## Verify / Tests

- `npm run test -- --run client/src/components/AnimationPreviewModal.test.jsx`
- Add tests for `ModalShell` if created.
- `npm run test:e2e -- tests/e2e/settings.spec.js`
- `npm run test:e2e -- tests/e2e/sharing.spec.js`
- `npm run build`
- Manual: open/close each migrated modal with mouse, Escape, keyboard.

## Success Criteria

- Modals have consistent visual shell.
- No focus trap regressions.
- Async operations cannot double-submit.
- Errors are announced and placed near problem.

## Risk Assessment

- Risk: shared shell breaks a modal with custom layout.
- Mitigation: migrate in batches; keep escape hatch className/size props.

## Security Considerations

- Do not alter trusted content model.
- Keep sandbox/HTML editor behavior unchanged.
- Do not expose tokens or credentials in modal copy/logs.

## Next Steps

- Phase 05 editor chrome.

## Implementation Notes

- Added shared `ModalShell` with viewport-safe sizing, Escape/backdrop close, focus entry, focus trap, focus restore, ARIA dialog semantics, and close label.
- Migrated `SyncModal`, `HistoryModal`, Home create modal, and Home confirm dialog to the shell.
- Added `ModalShell` unit coverage.
- Added alert/status semantics to migrated modal error/result feedback.
- Migrated `AIGeneratorModal`, `AICopywriterModal`, `AITranslateModal`, `ShareModal`, `MediaLibraryModal`, and `TemplatePickerModal` to `ModalShell`.
- Added a `2xl` `ModalShell` size for viewport-safe wide product modals.
- Added alert/status semantics to migrated AI/share/media modal feedback.
- Addressed code-review feedback by replacing Share/Media async `alert()` / console-only error paths with inline `role="alert"` and `role="status"` feedback.
- Media remote fallback delays modal close briefly so the inline status can render before the inserted remote URL flow finishes.
- Fixed the shared Escape close hook to keep one stable document listener and call the latest close callback after modal rerenders.
- Added regression coverage for Escape close after `ModalShell` rerender.

## Unresolved Questions

- None.
