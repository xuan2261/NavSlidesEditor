# Code Review — Pending Changes (Master Branch)

**Date:** 2026-04-27
**Reviewer:** 4-agent parallel code review (client components, hooks/stores, server/shared, export/import)
**Scope:** 304 files changed, ~37K additions/~273K deletions
**Lint:** 0 errors, 63 warnings (fixable via `--fix`)

---

## Spec Compliance

Verified against `plans/260427-0900-deep-feature-hardening-master-plan/plan.md`:

| Phase | Item | Status |
|-------|------|--------|
| P0 | Command layer unification (Phase 1) | ✅ |
| P0 | Canvas decomposition 2759→841 LOC (Phase 2) | ✅ 841 LOC confirmed |
| P0 | Chrome/interaction extraction (Phase 3) | ✅ |
| P1 | Shortcut registry + localStorage (Phase 4) | ✅ |
| P1 | PPTX import fidelity (Phase 5) | ✅ 5555 LOC test suite |
| P1 | Docs/changelog (Phase 9) | ✅ |

---

## Critical Issues (Must Fix)

### C1 — Ruler axis bug: wrong guide direction on ruler click
**File:** `client/src/components/canvas/canvas-rulers.jsx:74-76`
**Severity:** Critical — functional regression
**Reviewer:** Client Components

```js
const pos = axis === 'x'
  ? (me.clientX - rect.left) / scale      // ← WRONG
  : (me.clientY - rect.top) / scale
```

When clicking the **X ruler** (top, horizontal), the code creates a guide at `clientX`. But dragging from the X ruler should create a **horizontal guide** (a horizontal line across the slide at some Y position). `clientX` is the horizontal pixel position, giving a vertical guide position instead. The Y ruler click has the inverse problem.

**Fix:** Swap the axis mapping — X ruler click uses `clientY`, Y ruler click uses `clientX`.

---

### C2 — `performDuplicate` doesn't update clipboard — Ctrl+D breaks subsequent Ctrl+V
**File:** `client/src/hooks/use-clipboard.js:180-196`
**Severity:** Critical — UX regression
**Reviewer:** Hooks/Stores

`performDuplicate` adds elements to the slide but never calls `setClipboard`. After `Ctrl+D`, the clipboard store remains empty. A subsequent `Ctrl+V` receives `null` clipboard and silently no-ops. The `createDuplicateOperation` helper already computes `clipboardData` — it's computed but discarded.

**Fix:** Call `setClipboard(clipboardData)` in `performDuplicate` before returning.

---

### C3 — `performDuplicate` bypasses locked-element guard
**File:** `client/src/hooks/use-clipboard.js:180-196`
**Severity:** Critical — inconsistent behavior
**Reviewer:** Hooks/Stores

`createDuplicateOperation` (exported, tested) correctly guards against duplicating locked elements. But `performDuplicate` (the actual hook function) never calls it — it directly adds all `clipboardElements` without filtering. So `Ctrl+C`+`Ctrl+V` strips locked elements, but `Ctrl+D` duplicates everything including locked ones.

**Fix:** Filter out locked elements from `toAdd` before adding to the slide.

---

## High Priority Issues

### H1 — `performPaste` selects only the last pasted element
**File:** `client/src/hooks/use-clipboard.js:153`
**Reviewer:** Hooks/Stores

After pasting multiple elements, only `lastId` is selected. Standard UX expects all pasted elements to be selected. Regression from the old inline behavior.

**Fix:** Select all pasted element IDs, not just `lastId`.

---

### H2 — Dead canvas hook files: not wired into SlideCanvas
**Files:**
- `client/src/components/canvas/use-canvas-pointer-interaction.js`
- `client/src/components/canvas/use-canvas-rubber-band-drag-selection.js`
- `client/src/components/canvas/use-canvas-resize-rotate.js` (partially used — only constants imported)
**Reviewer:** Client Components

Phase 3 created these files but SlideCanvas still uses its original inline mouse handlers. These hooks will silently rot and diverge from active code.

**Fix:** Either wire them in (Phase 2 of canvas decomposition) or delete to prevent confusion.

---

### H3 — `useKeyboard` doesn't re-read localStorage overrides after mount
**File:** `client/src/hooks/use-keyboard.js:66-69`
**Reviewer:** Hooks/Stores

```js
const shortcuts = useMemo(() => {
  const overrides = loadOverrides()
  return getShortcuts(overrides)
}, [])
```

Empty dependency array freezes `shortcuts` at mount. A user changes a shortcut in SettingsPage → `localStorage` is updated → EditorPage's keyboard handler still uses the old shortcuts until remount.

**Fix:** Remove the `useMemo` guard (localStorage reads are fast), or subscribe to changes via a context/signal.

---

### H4 — CSS injection surface in share view via `customCSS`
**File:** `server/index.js:148-155`
**Reviewer:** Server/Shared

DOMPurify was removed from share view to keep HTML embeds trusted. Only `customCSS` gets partial sanitization (regex blocks `expression()`, `javascript:`, `url(javascript:)`). But `customCSS` is injected directly into `<head>` without sandboxing, meaning it can override layout, hide elements, or exfiltrate data (CSS keyloggers, click metrics).

**Fix:** Sandbox `customCSS` into an iframe with `sandbox=""`, or apply strict CSS allowlist parsing.

---

### H5 — `withFileLock` has fragile read-modify-write pattern
**File:** `server/services/storage.js:22-41`
**Reviewer:** Server/Shared

If the callback throws after mutating data but before `writeJson`, the lock is released and the next operation proceeds with stale data. The sequential promise chaining is correct but the implementation is fragile.

**Fix:** Wrap the entire read-modify-write in a single atomic try/finally. Consider a proper mutex library.

---

## Medium Priority Issues

### M1 — Ordered lists in markdown-import not wrapped in `<ol>`
**File:** `client/src/utils/markdown-import.js:125-127`
**Reviewer:** Export/Import

```js
// Ordered lists
html = html.replace(/^\d+\. (.+)$/gm, '<li ...>$1</li>')
// Missing: wrap in <ol> (unordered lists correctly use <ul> above)
```

Ordered list items become `<li>` without a parent `<ol>`, rendering as plain paragraphs.

**Fix:** Add a second-pass regex to wrap consecutive `<li>` elements in `<ol>` tags.

---

### M2 — `createDuplicateOperation` exported but never used in `performDuplicate`
**File:** `client/src/hooks/use-clipboard.js:57`
**Reviewer:** Hooks/Stores

`createDuplicateOperation` is exported and has 7 test cases, but `performDuplicate` never calls it. The locked-element guard inside it is dead code. Either integrate it or remove the export.

---

### M3 — `sanitizeDiagnostic` may leak file system paths
**File:** `server/routes/pptx-import.js:49`
**Reviewer:** Server/Shared

The sanitizer strips emails/XML/Base64 but passes raw file paths (e.g., `/tmp/pptx-imports/uuid.pptx`) unchanged.

**Fix:** Add path stripping regex for Unix/Windows path patterns.

---

### M4 — `incrementShareViews` not self-contained-safe
**File:** `server/index.js:170-181`
**Reviewer:** Server/Shared

The function doesn't check `expiresAt` before incrementing views. Both current call sites guard this upstream, but the function itself would happily increment expired tokens.

**Fix:** Add expiry check inside `incrementShareViews`.

---

### M5 — PDF import lacks file-type validation
**File:** `client/src/utils/pdf-import.js:23`
**Reviewer:** Export/Import

`file.arrayBuffer()` is called unconditionally. If the file is not a PDF, pdfjs-dist throws a cryptic error with no user-facing message distinguishing "not a PDF" from "corrupted PDF."

**Fix:** Check `file.type === 'application/pdf'` before calling pdfjs.

---

### M6 — Missing `onUpdateElement` in useEffect dependency array
**File:** `client/src/components/SlideCanvas.jsx:247-345`
**Reviewer:** Client Components

`onUpdateElement` is called in the mouse move handler but not listed in the dependency array. Violates React's exhaustive-deps rule.

**Fix:** Add `onUpdateElement` to the dependency array.

---

## Low Priority Issues

### L1 — Misleading test file name: `shortcut-registry-unit-tests-for-lookup-override-merge.test.js`
Tests `default-keyboard-shortcut-definitions-registry.js` but the file is named for a non-existent `shortcut-registry.js`.

### L2 — `createKeyboardHandler` missing `isReservedChord` guard
Registry has `isReservedChord` but handler never calls it. Manual localStorage edit bypasses SettingsPage warnings.

### L3 — `performCut` receives unused `idsToDelete` parameter
Signature includes `idsToDelete` but the function uses `idsToDelete` from `createCutOperation` instead.

### L4 — macOS `Cmd` key not normalized to `Ctrl`
`normalizeKey` returns `Cmd+C` for macOS meta key but default shortcuts use `Ctrl+C`. Platform gap.

### L5 — `pdf-import.test.js` doesn't assert slide content shape
Tests check `slides.length` but never verifies properties of `slides[0].elements[0]`.

### L6 — Unused `useCallback` imports in 4+ component files
`InsertMenu.jsx`, `EditorMenuBar.jsx`, `SlideSorterView.jsx`, `canvas-rulers.jsx`, `canvas-element-wrapper.jsx`.

### L7 — `uuidValidate` imported but unused in `server/index.js`
Dead import.

### L8 — Orphan `use-autosave.js` hook never imported
Defined but never wired into `EditorPage`. Either use it or delete it.

### L9 — `copySelected`/`cutSelected` in `editor-store.js` are dead code
Never called (clipboard uses `useClipboard` hook instead).

### L10 — Rate limit missing on `/api/live/room`
An attacker could spam the endpoint to fill the in-memory `rooms` Map.

### L11 — `mailto:javascript:` bypasses `isSafeHref`
`mailto:` is in `SAFE_SCHEMES`, so `mailto:javascript:alert(1)` passes URL parsing. Low risk (email clients don't execute JS) but defense-in-depth gap.

### L12 — `addLineElement` silent on zero-dimension line
No guard when `x1===x2 && y1===y2` after scaling — pptxgen receives zero-dimension shape.

### L13 — Duplicate `SNAP_REF_OPTIONS` in two canvas files
Defined in both `use-canvas-snapping-helpers` and `canvas-right-click-context-menu`.

---

## False Positives / Not Issues

1. **Icon paths cache stores full module object** — `m.default || m` is correct for JSON imports (Vite/Webpack set `__esModule: true` + `default: JSON content`). Not a bug.
2. **`useAutosave` orphan** — If it's intended as a future extraction target, keeping it is fine. Flag for decision.
3. **`performPaste` selects only last element** — May be intentional UX (paste drops you at the last item). Flag for decision, not a clear bug.

---

## Positive Observations

- **Command layer refactor** (`use-clipboard.js`): pure-function helpers (`createCopyOperation`, `createPasteOperation`, etc.) are excellent — highly testable, no context coupling.
- **Presentation store regression test**: explicitly tests that removed CRUD actions are gone — strong safeguard.
- **Presenter token security** (`live-rooms.js`): SHA-256 hashing of cryptographically random tokens, validated on every join.
- **SSRF guard** (`ai-provider.js`): comprehensive — IPv4 RFC1918/CGNAT/loopback, IPv6 link-local/ULA/multicast, DNS rebinding.
- **PPTX import defense-in-depth**: magic byte verification, ZIP entry count limit, decompressed size budget, required entries check.
- **Locked element guard** in `deleteSelectedElements` is comprehensive — filters locked, handles all-locked edge case.
- **`loadOverrides`** has thorough error handling (invalid JSON, null, non-object).
- **E2E test coverage**: 127 Playwright tests with stable selectors, page object helpers, visual regression baselines.

---

## Summary

| Severity | Count | Must Fix? |
|----------|-------|-----------|
| Critical | 3 | Yes |
| High | 5 | Yes |
| Medium | 6 | Recommended |
| Low | 13 | Optional |

**Bottom line:** The decomposition (2759→841 LOC) is solid and architecturally sound. The 3 critical bugs (ruler axis, Ctrl+D clipboard, locked element bypass) are functional regressions that affect core UX. The 2 high-priority security/architecture issues (CSS injection surface, fragile file lock) need addressing before public deployment. The ordered list bug is a simple one-liner fix.

**Recommended fix order:**
1. C1 (ruler) — one-liner axis swap
2. C2 + C3 + H1 (clipboard) — fix `performDuplicate` to set clipboard and filter locked elements
3. H4 + H5 (server security) — sandbox CSS, fix file lock
4. M1 (ordered lists) — one-liner `<ol>` wrap
5. H2 (dead hooks) — wire or delete
6. H3 (stale shortcuts) — remove `useMemo` guard
7. Remaining L/M issues as time permits

---

## Unresolved Questions

1. Was `use-canvas-*.js` extraction meant to be wired in a follow-up phase, or was it exploratory?
2. Should `performPaste` select all pasted elements or just the last one? (UX decision)
3. Is `customCSS` user-editable in share view? Affects CSS injection severity assessment.
4. Is there a hard cap on live rooms in the in-memory `Map`? Without one, sustained attack could exhaust memory.
