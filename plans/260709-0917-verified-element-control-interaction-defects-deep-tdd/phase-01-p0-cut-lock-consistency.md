---
phase: 1
title: "P0 Cut Lock Consistency"
status: pending
priority: P1
effort: "0.5-1d"
dependencies: []
---

# Phase 1: P0 Cut Lock Consistency

## Overview

Make **Cut** honor the same lock policy as **Delete** and **Duplicate**: skip locked elements; cut free members only; no-op when every selected element is locked. Fix pure functions first, then wire `performCut` / `handleCut` so the UI path cannot delete locked IDs.

## Requirements

- Functional:
  - Mixed selection (locked + free): cut free only; clipboard contains free only (IDs stripped); locked remain on slide and stay selected (or selection = remaining locked — match delete behavior).
  - All locked: no clipboard change, no deletion, selection unchanged.
  - All free: current behavior (clipboard + delete all selected).
  - Slide locked: still no-op (existing `handleCut` guard).
  - Group containing locked: cut must not leave inconsistent state; skip locked, free cut; groupId of remaining locked members unchanged.
- Non-functional:
  - Pure functions unit-tested without React.
  - No change to Copy (may still copy locked) or Paste (preserves locked flag).

## Architecture

```
createCutOperation({ slideElements, selectedElementIds })
  → filter selected
  → free = selected.filter(!locked)
  → if free empty → { clipboardData: null, idsToDelete: [] }
  → else clipboard from free, idsToDelete = free ids

performCut(slideElements, selectedIds)
  → MUST use createCutOperation result idsToDelete
  → NOT delete raw selectedIds blindly (current bug)
  → after delete, selection = remaining selected locked ids (mirror deleteSelectedElements)
```

**Current bug:** `performCut` deletes all `idsToDelete` param (= selection) even if pure op later filtered; pure op also does not filter locked.

## Related Code Files

- Modify: `client/src/hooks/use-clipboard.js` (`createCutOperation`, `performCut`)
- Modify: `client/src/hooks/use-clipboard.test.js`
- Modify: `client/src/pages/EditorPage.jsx` only if `handleCut` must pass slide elements correctly (likely no change if performCut fixed)
- Optional: `client/src/editor-interaction-bug-repro.test.js` (add cut-lock cases)

## TDD — Tests First (RED)

### Unit: `use-clipboard.test.js`

```js
describe('createCutOperation lock policy', () => {
  it('skips locked members and cuts free only (mixed selection)')
  it('returns empty when every selected element is locked')
  it('cuts all when none locked')
  it('strips ids from clipboard payload of free elements only')
  it('preserves locked property when free element somehow has locked false only')
})
```

### Integration: `performCut` via `useClipboard` hook

```js
it('performCut does not remove locked elements from the slide')
it('performCut leaves selection on remaining locked ids when mixed')
it('performCut does not overwrite clipboard when all selected locked')
```

### Optional harness extension

```js
// editor-interaction-bug-repro.test.js
describe('cut leaves locked elements in place', () => { ... })
```

**RED proof:** Current `createCutOperation` returns locked in `idsToDelete` → new tests fail.

## Implementation Steps

1. Write failing unit tests for `createCutOperation` lock policy (copy patterns from `createDuplicateOperation` tests ~L266+).
2. Implement filter in `createCutOperation`.
3. Change `performCut` to:
   - call `createCutOperation`
   - delete only `idsToDelete` from pure result
   - set clipboard only if `clipboardData`
   - set selection to locked survivors (import `setSelectedElementIds` / clearSelection logic aligned with delete).
4. If hook lacks selection-after-cut API, extend `performCut` signature or handle survivor selection in `EditorPage.handleCut` after operation — prefer keeping logic in hook for one chokepoint.
5. Green tests; run clipboard + interaction harness.

## Success Criteria

- [ ] Mixed cut: locked remain on slide
- [ ] All-locked cut: no-op
- [ ] Free-only cut: unchanged success path
- [ ] `performCut` never deletes IDs not returned by pure op
- [ ] Unit tests green; no regression in paste/dup group remap tests
- [ ] `npx vitest run client/src/hooks/use-clipboard.test.js client/src/editor-interaction-bug-repro.test.js` pass

## VERIFY Gate

```bash
npx vitest run client/src/hooks/use-clipboard.test.js
npx vitest run client/src/editor-interaction-bug-repro.test.js
```

Manual smoke (optional, 2 min): lock shape → Ctrl+X → still present; select free+locked → Ctrl+X → free gone, locked remains.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Users relied on cut-to-delete locked | Product decision: lock means protect; document in Phase 6 |
| performCut API change breaks callers | Grep all `performCut` / `createCutOperation` call sites |
| Selection UX after mixed cut | Mirror `deleteSelectedElements` exactly |

## Risk: Low–Medium | Blast: Clipboard + selection only
