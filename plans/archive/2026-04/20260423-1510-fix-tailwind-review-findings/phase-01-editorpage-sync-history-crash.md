---
phase: 1
title: "Fix EditorPage Sync/History Runtime Crash"
status: completed
priority: P1
effort: "15m"
dependencies: []
---

# Phase 01: Fix EditorPage Sync/History Runtime Crash

## Overview

Remove dead setter calls (`setSyncStatus`, `setSyncResult`, `setSnapshots`) from `EditorPage.jsx` that reference undefined variables, causing runtime crashes when users click Sync or Version History buttons.

## Root Cause

During the Tailwind migration refactor, state management for `SyncModal` and `HistoryModal` was moved inside the modals themselves (they now self-fetch data via `useEffect`). The parent `EditorPage` no longer declares `syncStatus`, `syncResult`, `snapshots` state — but the `onSync` and `onHistory` callback handlers still reference these removed setters.

## Requirements

- Functional: Clicking Sync and Version History must open their modals without throwing
- Non-functional: Zero ESLint `no-undef` warnings on `EditorPage.jsx`

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx` (lines 1009-1023)
- Reference: `client/src/components/SyncModal.jsx` (self-contained, fetches own data in `useEffect` line 16-21)
- Reference: `client/src/components/HistoryModal.jsx` (self-contained, fetches own data in `useEffect` line 10-15)

## Evidence

ESLint confirms the issue:
```
1012:15  warning  'setSyncStatus' is not defined    no-undef
1014:15  warning  'setSyncStatus' is not defined    no-undef
1016:13  warning  'setSyncResult' is not defined    no-undef
1021:13  warning  'setSnapshots' is not defined     no-undef
```

## Implementation Steps

### 1. Simplify `onSync` handler (EditorPage.jsx:1009-1018)

**Before:**
```jsx
onSync={async () => {
  try {
    const s = await api.getRcloneStatus()
    setSyncStatus(s)        // ← UNDEFINED
  } catch {
    setSyncStatus({ installed: false })  // ← UNDEFINED
  }
  setSyncResult(null)       // ← UNDEFINED
  setShowSyncModal(true)
}}
```

**After:**
```jsx
onSync={() => setShowSyncModal(true)}
```

**Rationale:** `SyncModal` already fetches its own `rcloneStatus` via `useEffect` (line 16-21 of SyncModal.jsx) and manages its own `syncResult` state (line 13). The parent does not need to pre-fetch anything.

### 2. Simplify `onHistory` handler (EditorPage.jsx:1019-1023)

**Before:**
```jsx
onHistory={async () => {
  const snaps = await api.getSnapshots(presentationId)
  setSnapshots(snaps)       // ← UNDEFINED
  setShowHistoryModal(true)
}}
```

**After:**
```jsx
onHistory={() => setShowHistoryModal(true)}
```

**Rationale:** `HistoryModal` already fetches snapshots via `useEffect` (line 10-15 of HistoryModal.jsx) with `presentationId` dependency. The parent does not need to pre-fetch.

## Verification

### Automated

```bash
# 1. Lint — removed setters no longer produce no-undef warnings
npx eslint client/src/pages/EditorPage.jsx --no-warn-ignored
# Result: 11 pre-existing warnings remain, 0 no-undef hits for setSyncStatus/setSyncResult/setSnapshots

# 2. Browser regression coverage
npx playwright test tests/e2e/editor.spec.js
# Result: 2 passed

# 3. Unit tests
npm run test
# Result: 55 passed

# 4. Build
npm run build
# Result: success
```

### Browser Coverage

```
Playwright test `opens Sync and Version History without runtime errors` now verifies:
- Sync modal opens from File menu without `pageerror`
- Version History modal opens from File menu without `pageerror`
- Both paths render before assertion timeout
```

## Success Criteria

- [x] `setSyncStatus`, `setSyncResult`, `setSnapshots` removed from EditorPage
- [x] ESLint `no-undef` count for EditorPage drops by 4
- [x] `npm run build` passes
- [x] Sync modal opens and functions correctly
- [x] History modal opens and functions correctly

## Risk Assessment

**Risk:** Very low. The setters are completely dead code — `SyncModal` and `HistoryModal` already self-manage their state. Removing them is a pure cleanup with no behavioral change.
