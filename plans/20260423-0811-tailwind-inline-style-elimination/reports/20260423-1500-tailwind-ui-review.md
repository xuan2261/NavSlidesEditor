# Tailwind UI/UX Refactor Review

Date: 2026-04-23 15:00
Scope: review working tree after UI/UX restructure and Vanilla CSS -> Tailwind CSS migration
Repo: `Projects/NavSlidesEditor/repo`
Reviewer: Codex

## Summary

I reviewed the current frontend diff for the Tailwind migration, with focus on:

- UI regressions
- modal/control behavior
- Tailwind class validity after build
- editor workflow continuity
- tests and verification status

Result:

- 4 concrete findings
- 2 High
- 1 Medium
- 1 Low

Build currently passes.
Lint currently passes with warnings.
Unit test suite currently fails 1 test.
E2E suite not rerun in this review pass.

## Verification Run

Commands executed:

```bash
npm run build
npm run lint
npm run test
npx vitest run client/src/components/ProductTour.test.js client/src/utils/tailwind-inline-style-audit.test.js
```

Observed status:

- `npm run build`: pass
- `npm run lint`: pass with warnings
- `npm run test`: fail, 1 failing test
- focused `vitest` run: same `ProductTour.test.js` failure reproduced

## Findings

### 1. High - Sync and History actions call undefined setters and can crash at runtime

Location:

- `client/src/pages/EditorPage.jsx:1009-1023`
- `client/src/components/SyncModal.jsx:6-18`
- `client/src/components/HistoryModal.jsx:6-20`

Problem:

`EditorPage.jsx` still calls:

- `setSyncStatus(...)`
- `setSyncResult(...)`
- `setSnapshots(...)`

These setters are not defined in `EditorPage` anymore.

Current code:

```jsx
onSync={async () => {
  try {
    const s = await api.getRcloneStatus()
    setSyncStatus(s)
  } catch {
    setSyncStatus({ installed: false })
  }
  setSyncResult(null)
  setShowSyncModal(true)
}}
onHistory={async () => {
  const snaps = await api.getSnapshots(presentationId)
  setSnapshots(snaps)
  setShowHistoryModal(true)
}}
```

Impact:

- clicking `Sync` can throw before modal opens
- clicking `Version History` can throw before modal opens
- this is not cosmetic; it breaks core editor controls

Why this is a real bug:

- lint reports `no-undef` on these exact identifiers
- `SyncModal` and `HistoryModal` already manage their own internal state and fetch data themselves
- the parent page no longer owns corresponding state, so these calls are stale leftovers from pre-refactor flow

Recommended fix:

- remove the dead setter calls from `EditorPage`
- open the modal directly with `setShowSyncModal(true)` / `setShowHistoryModal(true)`
- let each modal keep fetching its own data, as currently implemented

Severity rationale:

- direct runtime break on user action
- affects non-edge editor functionality

### 2. High - Template picker modal closes when clicking inside the modal body

Location:

- `client/src/components/TemplatePickerModal.jsx:87-135`

Problem:

The overlay closes on click:

```jsx
<div className="fixed inset-0 ..." onClick={onClose}>
```

but the inner modal container no longer stops propagation.

The previous implementation had:

```jsx
onClick={(e) => e.stopPropagation()}
```

That handler is now gone.

Impact:

- clicking inside the modal can bubble to overlay and close it
- selecting, browsing, or even interacting with content becomes unreliable
- this is especially bad for a template picker because most clicks happen inside the modal

How to reproduce:

1. open `Add Slide`
2. click inside modal body outside a button that synchronously closes it
3. overlay close handler receives bubbled click

Recommended fix:

- restore `onClick={(e) => e.stopPropagation()}` on the inner modal container

Severity rationale:

- direct UX/control regression
- affects a primary slide creation workflow

### 3. Medium - Product tour implementation and test suite are out of sync

Location:

- `client/src/components/ProductTour.jsx:123-209`
- `client/src/components/ProductTour.test.js:37-70`

Problem:

`ProductTour.jsx` was migrated to a new Joyride v3-style API and delayed startup model:

- `run` starts as `false`
- `useEffect` flips it after `MOUNT_DELAY_MS = 800`
- component uses `onEvent`
- config moved into `options`
- steps use `skipBeacon`, not `disableBeacon`

But the test still asserts the old behavior:

- `props.run === true` immediately during render
- `hideCloseButton`, `disableCloseOnEsc`, `disableOverlayClose`, `showProgress` as top-level props
- `stepIndex` undefined
- every step has `disableBeacon === true`
- canvas step placement expected as `top`

Actual failure reproduced:

- `client/src/components/ProductTour.test.js`
- assertion failing at `expect(props.run).toBe(true)`

Impact:

- CI/test signal is now red even though build passes
- team cannot trust test results for this migration branch
- onboarding logic is now under-tested because the assertions no longer match the actual API used

Recommended fix:

- update the test to the current Joyride v3 contract
- if SSR render is kept for this test, assert `run === false` before effect/timer
- or switch test strategy to a mounted environment and advance timers
- align assertions with:
  - `onEvent`
  - `options.showProgress`
  - `options.overlayClickAction`
  - `options.dismissKeyAction`
  - `skipBeacon`
  - current placements actually defined in component

Severity rationale:

- not a direct runtime editor break
- but it is an active verification failure and blocks trustworthy review status

### 4. Low - Dashboard modals use animation classes that are not generated by current Tailwind config

Location:

- `client/src/components/dashboard/TemplateGallery.jsx:242`
- `client/src/components/dashboard/TemplatePreview.jsx:165`
- `client/tailwind.config.js:58-70`

Problem:

These components use:

- `animate-in`
- `fade-in`
- `zoom-in-95`

But current Tailwind config only defines:

- `animate-fade-in`
- `animate-zoom-in`

There is no plugin or custom extension adding:

- `animate-in`
- `fade-in`
- `zoom-in-95`

Build artifact check confirms:

- `.animate-in`: missing
- `.fade-in`: missing
- `.zoom-in-95`: missing
- `.animate-fade-in`: found
- `.animate-zoom-in`: found

Impact:

- modal open animation silently does nothing
- visual polish regresses without causing compile errors
- easy to miss in code review because class names look valid

Recommended fix:

Choose one:

1. replace with existing classes already supported:
   - `animate-fade-in`
   - `animate-zoom-in`
2. or add matching utilities/plugin support if the `animate-in fade-in zoom-in-95` syntax is intentional

Severity rationale:

- visual polish issue only
- no direct interaction break

## Other Areas Reviewed

I reviewed these changed areas and did not find additional release-blocking issues in this pass:

- `client/src/components/Toolbar.jsx`
- `client/src/components/SlidePanel.jsx`
- `client/src/components/PropertiesPanel.jsx`
- `client/src/components/SelectionPane.jsx`
- `client/src/components/InsertMenu.jsx`
- `client/src/components/AnimationTimeline.jsx`
- `client/src/components/MiniToolbar.jsx`
- `client/src/components/SlideSorterView.jsx`
- `client/src/components/LivePresentationModal.jsx`
- `client/src/pages/HomePage.jsx`
- `client/src/pages/LiveViewPage.jsx`
- `client/src/pages/SpeakerViewPage.jsx`
- `client/src/pages/ExplorePage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/components/properties/*` files touched in this migration

Notes:

- several remaining inline styles are still present, but many are valid dynamic/runtime exceptions
- no additional breakage was confirmed from those remaining dynamic styles in this review pass
- `QuickAccessToolbar` present button removal looks intentional, not a confirmed regression, because present action still exists in `EditorMenuBar`

## Recommendation

Priority order:

1. fix `EditorPage` runtime crashes for Sync/History
2. restore click containment in `TemplatePickerModal`
3. repair `ProductTour` test so the branch returns to a trustworthy test state
4. normalize dashboard modal animation classes

## Current Ship Readiness

Current status: not ready to merge as-is

Blocking reasons:

- runtime break risk on Sync/History controls
- modal interaction regression in template picker
- failing unit test suite

## Unresolved Questions

None.
