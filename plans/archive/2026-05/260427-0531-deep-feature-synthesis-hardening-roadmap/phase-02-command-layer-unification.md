---
phase: 2
title: "Command Layer Unification"
status: pending
priority: P0
effort: "2-3d"
dependencies: [1]
---

# Phase 2: Command Layer Unification

## Context Links

- Audit finding: P0 clipboard/keyboard duplication must be fixed before large canvas refactor.
- Code: `client/src/hooks/use-keyboard.js`, `client/src/hooks/use-clipboard.js`, `client/src/stores/editor-store.js`
- Code: `client/src/components/SlideCanvas.jsx`, `client/src/pages/EditorPage.jsx`
- Tests: `client/src/hooks/use-keyboard.test.js`, `client/src/stores/editor-store.test.js`, `tests/e2e/keyboard-shortcuts.spec.js`

## Overview

Make one command path for copy, cut, paste, duplicate, delete, escape, undo,
redo, select all, and find. This reduces regression risk before decomposing the
canvas.

## Key Insights

- `useKeyboard()` exists but `SlideCanvas.jsx` still registers a separate `keydown` listener.
- `useClipboard()` exists but `SlideCanvas.jsx` has inline copy/cut/paste/duplicate and context-menu clipboard code.
- Store has `copySelected`/`cutSelected`, but deletion/paste selection behavior is split.
- `EditorPage.jsx` handles global shortcuts and comments that clipboard is handled by SlideCanvas.

## Requirements

- Functional: one canonical command layer dispatches keyboard and context-menu actions.
- Functional: paste works with no current selection after slide change.
- Functional: multi-select copy/cut/paste/duplicate preserves element properties and creates fresh IDs.
- Functional: text editing and form fields still receive normal typing/formatting shortcuts.
- Non-functional: no behavior changes visible to users except removal of duplicate handling bugs.
- Non-functional: no new shortcut customization UI in this phase.

## Architecture

Prefer a small command boundary over another large hook:

```text
use-keyboard.js
  -> normalized shortcut event
  -> command callbacks
use-clipboard.js
  -> canonical element clone/paste/cut/duplicate operations
SlideCanvas context menu
  -> calls same command callbacks
EditorPage
  -> wires command callbacks once
```

Batch element insertion should happen through one store/page action so paste and
duplicate do not diverge.

## Related Code Files

- Modify: `client/src/hooks/use-keyboard.js` - keep event normalization, remove hardcoded drift where possible.
- Modify: `client/src/hooks/use-clipboard.js` - become canonical clipboard command implementation.
- Modify: `client/src/stores/editor-store.js` - keep clipboard state minimal; remove unused duplicate command methods if replaced.
- Modify: `client/src/stores/presentation-store.js` - add focused batch add action only if needed.
- Modify: `client/src/components/SlideCanvas.jsx` - remove inline keyboard listener and inline clipboard command bodies.
- Modify: `client/src/pages/EditorPage.jsx` - own command wiring across canvas/global shortcuts.
- Modify: `client/src/hooks/use-keyboard.test.js`
- Modify/Create: `client/src/hooks/use-clipboard.test.js`
- Modify: `tests/e2e/keyboard-shortcuts.spec.js`
- Delete: none unless a dead helper is fully unused after refactor.

## Implementation Steps

1. Add tests first for current shortcut behavior: copy, cut, paste, duplicate, delete, escape, undo/redo, find.
2. Add clipboard unit tests for fresh IDs, offset paste, multi-select, cut deletes originals, and no-op empty clipboard.
3. If needed, add `addElements(elements)` to `presentation-store.js` for atomic multi-element paste.
4. Update `useClipboard()` so it owns copy/cut/paste/duplicate semantics.
5. Update `useKeyboard()` to dispatch callbacks only; do not mutate canvas state directly.
6. Wire `EditorPage.jsx` to pass command callbacks into `SlideCanvas` and global keyboard handling.
7. Replace `SlideCanvas.jsx` inline clipboard keyboard code with calls to command callbacks.
8. Replace context menu copy/cut/paste/duplicate bodies with the same command callbacks.
9. Remove duplicated document `keydown` listener from `SlideCanvas.jsx` after tests prove coverage.
10. Re-run targeted tests and inspect that TipTap formatting shortcuts are not blocked.

## Todo List

- [ ] Tests before refactor for keyboard and clipboard behavior.
- [ ] Single command wiring point in `EditorPage.jsx` or a focused hook.
- [ ] `SlideCanvas.jsx` no longer owns clipboard command logic.
- [ ] Context menu and keyboard share same command implementation.
- [ ] No shortcut customization added yet.

## Verification & Tests

```bash
npm run test -- client/src/hooks/use-keyboard.test.js client/src/hooks/use-clipboard.test.js client/src/stores/editor-store.test.js client/src/stores/presentation-store.test.js
npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/element-interactions.spec.js
npm run lint
npm run build
```

Manual smoke:

- Copy/paste one element, multi-select, grouped element, locked element.
- Paste after slide change with no selection.
- Confirm Ctrl+B/Ctrl+I inside TipTap still formats text, not canvas commands.

## Success Criteria

- [ ] Exactly one active clipboard command implementation.
- [ ] `SlideCanvas.jsx` has no standalone clipboard `keydown` implementation.
- [ ] Existing keyboard shortcuts still work in E2E.
- [ ] Paste/duplicate IDs are unique and selection is deterministic.
- [ ] No regression in undo/redo/find/delete behavior.

## Risk Assessment

- Risk: moving paste from canvas loses local coordinate context.
- Mitigation: pass paste origin/context explicitly or keep origin math in a pure helper tested in isolation.
- Risk: form fields/text editing intercept rules regress.
- Mitigation: unit-test `getActiveElement()` guards and TipTap smoke.

## Security Considerations

- Do not read/write system clipboard outside existing in-app element clipboard scope.
- Do not serialize trusted HTML embeds into browser clipboard in this phase.

## Next Steps

Proceed to Phase 3 after command duplication is removed.

## Unresolved Questions

- Should paste offset be fixed `+20/+20`, pointer-based, or context-menu-origin based? Default: preserve current offset behavior unless tests show otherwise.
