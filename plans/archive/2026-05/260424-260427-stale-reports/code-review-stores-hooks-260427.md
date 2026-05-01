# Code Review: Stores, Hooks & Pages

## Executive Summary

Reviewed 11 files spanning Zustand stores, React hooks, pages, and keyboard shortcut infrastructure. The codebase shows good practices in immutability, hook cleanup, and state separation, but contains several correctness bugs and architectural inconsistencies from the recent -23K line refactoring. Most critical: dead store state, recursive API call, and missing Socket.IO error handling.

---

## Critical Issues (Must Fix)

### 1. Dead store state: `currentSlideIndex` never updated from production code
- **Files:** `client/src/stores/presentation-store.js:27,33`, `client/src/stores/presentation-store.js:33`
- **Evidence:** `grep -n "setCurrentSlide\|usePresentationStore.getState()" client/` shows `setCurrentSlide` is called only in test files. All `setCurrentSlideIndex` calls in production code reference the hook prop passed from EditorPage, not the store action. The store maintains `currentSlideIndex` in its own state but this is never updated. Meanwhile, `updateSlide`, `updateElement`, `addElement`, `deleteElement` all read `state.currentSlideIndex` from the store.
- **Impact:** All element operations targeting "current slide" in the presentation store read a stale `currentSlideIndex` (always 0). Element operations on non-first slides via the presentation store will mutate the wrong slide.
- **Fix:** Either wire the store's `setCurrentSlide` to EditorPage's `setCurrentSlideIndex` (via a subscription), or remove the store's `currentSlideIndex` state entirely since the hook owns this value.

### 2. Recursive unnecessary API call in `handleTestConnection`
- **File:** `client/src/pages/SettingsPage.jsx:206-218`
- **Evidence:**
  ```javascript
  const handleTestConnection = async () => {
      // ...
      await handleSave()  // <-- calls handleSave() which calls PUT /api/settings
      await testAIConnection()
  }
  ```
- **Impact:** Clicking "Test Connection" always saves settings first (another PUT /api/settings), even if the user just saved and nothing changed. Extra round-trip latency on every test.
- **Fix:** Remove `await handleSave()` from `handleTestConnection`. If the user needs to save before testing, show a warning that unsaved changes exist.

### 3. Missing Socket.IO `connect_error` handler
- **File:** `client/src/hooks/use-live-presentation.js:42`
- **Evidence:** `grep "connect_error" client/` returns zero matches. The socket at line 42 (`io({ path: '/ws' })`) has no error handler. `connect_error` is not listened to. Similarly in `LiveViewPage.jsx:23`.
- **Impact:** Network failures, invalid server URLs, or CORS issues silently fail without user feedback. `joinError` state is set only on `join-error` socket event, but if the socket never connects, no error is shown.
- **Fix:** Add `activeSocket.on('connect_error', (err) => { setJoinError(err.message) })` in both hooks.

---

## High Priority Issues

### 4. `addSlide` off-by-one: always appends, ignores `afterIndex`
- **File:** `client/src/hooks/use-slide-operations.js:227-262`
- **Evidence:**
  ```javascript
  const newSlide = { id: crypto.randomUUID(), elements: baseElements, notes: '', background: inheritedBg }
  setPresentation((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }))  // always pushes to end
  setCurrentSlideIndex(presentation.slides.length)  // closure reads stale `presentation`
  ```
  `afterIndex` parameter is accepted but never used. `presentation.slides.length` is read from the closure variable (stale) rather than `prev.slides.length`.
- **Impact:** Inserting a slide always appends to the end. If user inserts slide between slides 0 and 1, it appears last.
- **Fix:** Use `splice`-style insertion and read `prev.slides.length` for the index.

### 5. `duplicateSlide(index)` ignores its `index` parameter
- **File:** `client/src/hooks/use-slide-operations.js:276-286`
- **Evidence:**
  ```javascript
  const duplicateSlide = useCallback(
    (index) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(prev.slides, [index])  // uses index
        setCurrentSlideIndex(result.currentSlideIndex)  // but result.currentSlideIndex from helper
        return { ...prev, slides: result.slides }
      })
    },
    [setPresentation, setCurrentSlideIndex]  // missing currentSlideIndexRef
  )
  ```
  The helper `duplicateSlidesAtIndices` does use `index`, but `currentSlideIndexRef` is not in the deps array, and the dependency array is incomplete. The result index is computed by the helper, so this is less broken than `addSlide`, but `currentSlideIndexRef` should still be in deps.
- **Impact:** If `currentSlideIndexRef` changes (user navigates slides while operation is in flight), the callback may use stale ref for other operations that depend on it.
- **Fix:** Add `currentSlideIndexRef` to deps. Confirm the helper's index computation is correct.

### 6. `presenterSecret` closure staleness in Socket.IO effect
- **File:** `client/src/hooks/use-live-presentation.js:17-76`
- **Evidence:** `presenterSecret` is initialized from the prop at line 15 (`useState(presenterToken)`). Inside the effect, `activeSocket.emit('join-room', { ..., presenterToken: role === 'presenter' ? presenterSecret : undefined })` reads `presenterSecret` from state. If the prop `presenterToken` changes after the initial render, the effect won't re-run (because the state `presenterSecret` only updates when `setPresenterSecret` is called inside the effect itself), so the stale closure value is used.
- **Impact:** If a presenter token is passed as a prop after the initial mount, the socket is never recreated with the new token.
- **Fix:** Use the prop `presenterToken` directly in the emit, or include it in the dependency array (with proper guard to avoid infinite loops).

### 7. Dead store actions: `copySelected` and `cutSelected` never called
- **File:** `client/src/stores/editor-store.js:24-35`
- **Evidence:** `grep -n "copySelected\|cutSelected" client/src/` shows these are defined in the store and referenced in the test file, but never called from any production component. The store action `clipboard` is the actual mechanism used elsewhere.
- **Impact:** Dead code. Confusing for future developers. `clipboard` state is directly set via `setClipboard` in EditorPage's copy/cut handlers.
- **Fix:** Remove `copySelected` and `cutSelected` from the store, or wire them up in EditorPage if they were intended to replace direct `setClipboard` calls.

### 8. Duplicate `isEditing` guard in two places
- **Files:** `client/src/hooks/use-keyboard.js:18`, `client/src/pages/EditorPage.jsx:799`
- **Evidence:** Both the keyboard handler created by `createKeyboardHandler` (line 18: `if (isEditing) return`) and the EditorPage's own `handleGlobalKeyDown` callback (line 799: `if (editingElementId) return`) check the same `editingElementId` state. The keyboard hook's `isEditing` guard is redundant with EditorPage's guard.
- **Impact:** Wasted CPU cycles. More importantly, if EditorPage's guard is removed or bypassed in the future, the keyboard hook's guard becomes the sole safeguard. But `isEditing` is not passed as `true` during TipTap's contenteditable editing unless `editingElementId` is set — which depends on `startEditingElement` being called first.
- **Fix:** Consolidate into one guard. The keyboard hook should be the single source of shortcut blocking.

---

## Medium Priority Issues

### 9. No localStorage error handling in shortcut persistence
- **File:** `client/src/utils/shortcut-local-storage-persistence.js:28-31`
- **Evidence:**
  ```javascript
  export function saveOverride(id, key) {
    const overrides = loadOverrides()
    overrides[id] = key
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))  // can throw
  }
  ```
  `localStorage.setItem` can throw `QuotaExceededError` (storage full) or `NS_ERROR_FILE_CORRUPTED` (corrupted). Called during keyboard shortcut recording (SettingsPage, line 147), so user gets no feedback on failure.
- **Impact:** Silent failure if localStorage is full or corrupted. User remaps a shortcut but it doesn't save.
- **Fix:** Wrap `localStorage.setItem` in try/catch, show a toast/alert on failure.

### 10. `loadData` not memoized, causes re-renders
- **File:** `client/src/pages/HomePage.jsx:241`
- **Evidence:** `loadData` is a plain `async function` defined inside the component. It is called in the `useEffect` at line 237 and also manually (line 326 after duplicate, line 341 after delete, etc.). Being re-defined on every render means the effect's empty deps array still works, but each manual call re-invokes `setLoading(false)` which triggers a re-render of the whole dashboard.
- **Impact:** Dashboard flashes loading state when user-triggered operations complete.
- **Fix:** Wrap `loadData` in `useCallback` and extract the loading-state-managing logic. Consider separate `loadWithoutLoadingState` for user-initiated refreshes.

### 11. Race condition: `checkRoom` API call overlaps socket join
- **File:** `client/src/pages/LiveViewPage.jsx:72-85`
- **Evidence:** `checkRoom` is called immediately after socket `connect`. Both run concurrently. If `checkRoom` returns `roomNotFound = true` but the socket's `join-room` event succeeds, the UI shows "Room not found" while the socket has already joined. The socket `join-error` event also sets `roomNotFound`, creating two competing state updates.
- **Impact:** Conflicting UI states if the API and socket disagree on room existence.
- **Fix:** Wait for the socket's `join-error` event rather than making a separate REST call, or make the REST call first and only connect the socket if the room exists.

### 12. `useKeyboard` useMemo deps include entire `shortcuts` object
- **File:** `client/src/hooks/use-keyboard.js:71-101`
- **Evidence:** `shortcuts` (an array of ~10 items) is in the `useMemo` deps. Every time a single override changes, the entire array changes and the handler is recreated. This is acceptable for 10 shortcuts but inefficient.
- **Impact:** Minor perf cost. The 10-item array copy is negligible.
- **Fix:** Consider using `shortcuts.length` or a stable reference. Not urgent.

### 13. `setupSocket` async function never awaited
- **File:** `client/src/hooks/use-live-presentation.js:20`
- **Evidence:** `const setupSocket = async () => { ... }; setupSocket()` — the async function is called without `await`. This is technically fine (the async is for the `await fetch` inside it), but it means errors thrown inside `setupSocket` (before the return) will be unhandled promise rejections rather than caught by the caller's try/catch.
- **Impact:** Unhandled rejection if room creation fails in a way that throws synchronously.
- **Fix:** `await setupSocket()` inside the effect, wrapped in try/catch.

---

## Low Priority / Informational

### 14. `alignElements` has 8 levels of nested `if/else`
- **File:** `client/src/hooks/use-slide-operations.js:142-223`
- **Evidence:** The `alignElements` function has deeply nested if/else chains for each alignment type. This is verbose but correct.
- **Impact:** Readability only. Consider extracting each alignment type into a named helper function.

### 15. Dead refs in HomePage
- **File:** `client/src/pages/HomePage.jsx:207-211`
- **Evidence:** `let pdfInputRef = null` and `let mdInputRef = null` with `// eslint-disable-next-line unused-imports/no-unused-vars` comments. These are never assigned or used.
- **Impact:** Clutter. ESLint comment masks the unused variable warnings.
- **Fix:** Remove these dead refs.

### 16. `alert()` used for user feedback in HomePage
- **File:** `client/src/pages/HomePage.jsx:460,476,489,505,517,544,553,573`
- **Evidence:** `alert('No pages found in PDF')`, `alert('Failed to import PDF: ' + err.message)`, etc.
- **Impact:** Blocks the main thread and bypasses the app's design system. Minor UX degradation.
- **Fix:** Replace with a toast notification component.

### 17. `handleTestConnection` in SettingsPage not wrapped in `useCallback`
- **File:** `client/src/pages/SettingsPage.jsx:206`
- **Evidence:** `handleTestConnection` is a plain async function re-defined on every render. Not critical since it captures stable state, but inconsistent with the codebase's `useCallback` patterns.
- **Fix:** Wrap in `useCallback`.

### 18. `allTemplates` recreated on every render
- **File:** `client/src/pages/HomePage.jsx:618`
- **Evidence:** `const allTemplates = [...PRESET_THEMES, ...templates.map((t) => ({ ...t, isUser: true }))]` is computed inline. `filteredPresets` is correctly memoized with `useMemo`, but `allTemplates` is used in the modal template grid.
- **Impact:** Unnecessary array copies on every render.
- **Fix:** Memoize `allTemplates` with `useMemo`.

---

## Per-File Findings

### `presentation-store.js`
- Immutability: Correct spread-operator usage throughout. No immer, no mutations.
- `currentSlideIndex` is dead state (critical issue #1).
- `addSlide` ignores `afterIndex` (critical issue via high priority #4).
- No undo/redo — expected for this store.

### `editor-store.js`
- Immutability: Correct.
- No selectors — default zustand selector pattern used everywhere.
- `copySelected` and `cutSelected` are dead code (high priority #7).
- All other actions (`setSelectedElementIds`, clipboard, canvas controls, panel state) are clean and correctly implemented.

### `ui-store.js`
- Clean and minimal. Dynamic modal access via computed property names (`openModal`, `closeModal`) is idiomatic.
- No issues.

### `use-keyboard.js`
- Event listener cleanup: correct (`useEffect` return removes listener).
- No multiple registration issue — hook registers once per mount.
- `isEditing` guard exists but has a gap: contenteditable elements (TipTap) are not automatically detected unless `editingElementId` is set.
- Duplicate guard with EditorPage (high priority #8).
- `shortcuts` object in useMemo deps is slightly wasteful (medium priority #12).

### `use-slide-operations.js`
- `addSlide` off-by-one bug (high priority #4).
- `duplicateSlide` missing `currentSlideIndexRef` in deps (high priority #5).
- `deleteSlide` at line 264 uses `index` parameter but internally calls `deleteSlidesAtIndices(prev.slides, [index], currentSlideIndexRef.current)` — correct, but confusing parameter name.
- `updateElements`, `deleteSelectedElements`, `alignElements` are well-implemented with proper locking checks.

### `use-live-presentation.js`
- Missing `connect_error` handler (critical #3).
- `presenterSecret` closure staleness (high priority #6).
- `setupSocket` not awaited (medium priority #13).
- Socket cleanup on unmount: correct.

### `use-reveal-preview-frame.js`
- Clean implementation. Proper interval cleanup on unmount and on new `htmlContent`. `deckRef` and `revealCheckRef` correctly managed. No issues found.

### `HomePage.jsx`
- `loadData` not memoized (medium priority #10).
- Dead refs `pdfInputRef`, `mdInputRef` (low priority #15).
- `alert()` used for feedback (low priority #16).
- `allTemplates` not memoized (low priority #18).
- `confirmDialog` pattern is good: renders a single dialog with dynamic content.
- Marketplace lazy loading is good.
- Import handlers (PDF, Markdown, Project, PPTX) have proper error handling and progress tracking.

### `SettingsPage.jsx`
- `handleTestConnection` recursively calls `handleSave` (critical #2).
- `handleSave` and `handleTestConnection` not wrapped in `useCallback` (low priority #17).
- Keyboard shortcut recording UI is well-designed with conflict detection and reserved chord warnings.
- Settings merge with `DEFAULT_SETTINGS` on load/save is correct.

### `LiveViewPage.jsx`
- Missing `connect_error` handler (critical #3 via Socket.IO).
- Race condition between `checkRoom` REST call and socket join (medium priority #11).
- Cursor, laser, annotation overlays are well-implemented as inline styles (dynamic positions require inline).
- Good UX with connection status, presenter-left, and room-not-found states.

### `element-defaults.js`
- Correct and comprehensive. No issues. Defaults for all 16 element types including the extended table schema.

### `default-keyboard-shortcut-definitions-registry.js`
- Clean registry pattern. `getShortcuts(overrides)` correctly merges with defaults.
- `getShortcutById` and `getShortcutByKey` are well-designed utility functions.
- No issues.

---

## Summary Statistics

| File | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| presentation-store.js | 1 | 1 | 0 | 0 |
| editor-store.js | 0 | 1 | 0 | 0 |
| use-live-presentation.js | 1 | 1 | 1 | 0 |
| use-slide-operations.js | 0 | 2 | 0 | 0 |
| use-keyboard.js | 0 | 1 | 1 | 0 |
| HomePage.jsx | 0 | 0 | 1 | 3 |
| SettingsPage.jsx | 1 | 0 | 0 | 1 |
| LiveViewPage.jsx | 1 | 0 | 1 | 0 |
| shortcut-local-storage-persistence.js | 0 | 0 | 1 | 0 |
| **Totals** | **4** | **6** | **5** | **5** |

**Files reviewed:** 11
**Critical:** 4, **High:** 6, **Medium:** 5, **Low:** 5

---

## Unresolved Questions

1. Was `currentSlideIndex` in `presentation-store.js` intentionally kept as dead state during the refactoring, or should it be removed or wired up?
2. Are `copySelected`/`cutSelected` in `editor-store.js` intended to replace the direct `setClipboard` calls in EditorPage? If so, they need to be wired up; if not, they should be removed.
3. Is `afterIndex` in `addSlide` expected to work, or was it always intended to just append? The parameter exists but is unused.
4. The `shortcut-normalizer.js` `normalizeKey` uses `e.key` which can vary by browser — is this intentional for cross-browser shortcut detection, or should `e.code` be preferred for consistency?
