---
phase: 4
title: "Group Lock Feedback UX"
status: pending
priority: P2
effort: "0.5-0.75d"
dependencies: [1]
---

# Phase 4: Group Lock Feedback UX

## Overview

When `hasBlockedGroupMutation` or lock rules cause **silent no-ops** (drag, align, group, nudge, fan-out), surface a short, accessible notice so users know **why** the action failed.

## Requirements

- Functional:
  - Trigger notice on blocked paths:
    - pointer drag start blocked by group lock/hidden
    - align/distribute no-op due to block or sole free survivor policy (optional message differentiate)
    - keyboard nudge blocked by `hasBlockedGroupMutation`
    - `buildSelectionUpdates` returns [] due to blocked group (property edit)
  - Message examples:
    - "Cannot move: group contains locked or hidden members"
    - "Cannot edit selection: group contains locked or hidden members"
  - Auto-dismiss ~2.5s; replace message if new block.
  - `data-testid="editor-blocked-action-notice"` + `role="status"` / `aria-live="polite"`.
- Non-functional:
  - No new dependency.
  - Prefer small pure helper `getBlockedGroupNotice(reason)` for strings.
  - Do not spam notice on every mousemove — only on attempt start / key action / property apply.

## Architecture

Options (pick one — **Recommended A**):

**A. EditorPage local state**
```js
const [blockedNotice, setBlockedNotice] = useState(null)
// clear with useEffect timeout
// render near StatusBar or fixed bottom of editor chrome
```

**B. ui-store transient field**
```js
// ui-store.js: blockedActionNotice, setBlockedActionNotice
// better if multiple components fire
```

Wire points:
- `use-canvas-pointer-interaction.js` `startElementDrag` early returns — needs callback `onBlockedAction?.(reason)` prop from SlideCanvas ← EditorPage
- `use-slide-operations` align/group — return boolean or call notice callback
- `EditorPage` `onArrow` when `hasBlockedGroupMutation`
- `updateSelectedElements` when `buildSelectionUpdates` empty **and** block condition true (not when type-gate empty style)

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx` (notice UI + wire)
- Modify: `client/src/components/SlideCanvas.jsx` (pass callback)
- Modify: `client/src/components/canvas/use-canvas-pointer-interaction.js`
- Modify: `client/src/hooks/use-slide-operations.js` (optional return status)
- Optional: `client/src/stores/ui-store.js` if choosing B
- Create tests: `client/src/pages/__tests__/editor-blocked-action-notice.test.jsx` or extend characterization tests

## TDD — Tests First (RED)

```js
// pure helper if extracted
it('returns stable message for group-locked reason')

// component / hook
it('shows notice when startElementDrag hits hasBlockedGroup')
// mock slide with group A free + B locked; attempt move → notice text

it('does not show notice when free ungrouped element moves')

it('nudge path sets notice when group blocked') // EditorPage onArrow characterization if available
```

If full EditorPage mount is heavy, unit-test:
1. pure reason → message
2. pointer interaction invokes `onBlockedAction` once on blocked start
3. shallow render notice region when state set

## Implementation Steps

1. Choose storage A or B; implement notice component snippet.
2. Add `onBlockedAction` to pointer interaction early returns for locked element + blocked group.
3. Wire EditorPage arrow + updateSelectedElements (only when group block, not empty type-gate).
4. Optionally align/group ops.
5. Tests green; avoid notice on marquee empty selection.

## Success Criteria

- [ ] Blocked group drag shows notice once per attempt
- [ ] Free element drag silent success (no notice)
- [ ] `aria-live` polite status present
- [ ] Auto-clear works
- [ ] No notice spam on continuous drag

## VERIFY Gate

```bash
npx vitest run client/src/components/canvas/use-canvas-pointer-interaction.test.js
npx vitest run client/src/pages/__tests__/editor-blocked-action-notice.test.jsx
# or whichever test file created
npx vitest run client/src/utils/active-slide-selection.pointer-down.test.js
```

Manual: group two shapes, lock one, drag → see message.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Prop drilling pain | Option B ui-store |
| False positives on type-gated empty style update | Only fire when `hasBlockedGroupMutation` true |
| Concurrent UI plan touches StatusBar | Keep notice self-contained absolute overlay |

## Risk: Low | Blast: UX feedback only
