# Code Review: Client Components
## Executive Summary

18 client components reviewed after the Phase 1 "command layer unification" refactor. The codebase is in solid shape overall — SlideCanvas was reduced from ~3522 lines to ~842 lines, logic is cleanly extracted into helpers, and the properties panel is well-organized with small, focused files. However, there are several correctness and robustness issues: unsafe URL construction in TransitionPreview, missing error handling in InsertMenu's media upload, incorrect presenterToken transmission in LivePresentationModal, and a Toolbar that should be split given its 1186-line size.

---

## Critical Issues (Must Fix)

### 1. TransitionPreview — Unsanitized `presentation.theme` in External CDN URL
**File**: `client/src/components/TransitionPreview.jsx:43-45`
```js
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${presentation.theme || 'black'}.css">
```
`presentation.theme` is user-controlled (stored in presentation JSON). An attacker who can set their presentation theme to a malicious domain (e.g., `"https://evil.com/white.css"`) causes the TransitionPreview iframe to load external CSS from an arbitrary domain. While sandboxed, CSS can exfiltrate data via URL-based resource loading.
**Fix**: Validate `presentation.theme` against the known allowlist (`['black','white','league','beige','sky','night','serif','simple','solarized','moon','dracula']` — already defined in `EditorMenuBar.jsx:26-38`) before inserting into the HTML string:
```js
const SAFE_THEMES = ['black','white','league','beige','sky','night','serif','simple','solarized','moon','dracula']
const safeTheme = SAFE_THEMES.includes(presentation.theme) ? presentation.theme : 'black'
// then use safeTheme in the href
```

### 2. LivePresentationModal — PresenterToken Not Properly Transmitted; onClose Fires Even on Popup Block
**File**: `client/src/components/LivePresentationModal.jsx:85-96`
```js
const presenterWindow = window.open(
  `/api/presentations/${presentationId}/present?live=${roomCode}`,
  '_blank'
)
if (presenterWindow) {
  presenterWindow.name = JSON.stringify({ roomCode, presenterToken: presenterToken || '' })
}
onClose()  // fires unconditionally
```
Three problems:
1. `presenterToken` is passed as a prop but never sent to the server — only stored in `window.name`, which is readable by the opened window and has size/format limitations
2. `onClose()` fires even when `window.open` returns `null` (popup blocker), closing the modal with no user feedback
3. `window.name` containing auth data can be read by any page at the same origin
**Fix**: Send `presenterToken` via an HTTP-only cookie or as a POST body; move `onClose()` inside the `if (presenterWindow)` block.

### 3. InsertMenu — Missing Error Handling for Media Upload
**File**: `client/src/components/InsertMenu.jsx:251-267`
```js
const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
if (res.url) {
  if (f.type.startsWith('video/')) onAddVideo?.(res.url)
  else onAddAudio?.(res.url)
}
```
No try-catch. If the upload fails (network error, server 500, etc.), `r.json()` throws or returns an error object — no feedback to the user, no error state, no retry option.
**Fix**:
```js
try {
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.url) {
    if (f.type.startsWith('video/')) onAddVideo?.(data.url)
    else onAddAudio?.(data.url)
  } else {
    console.error('Upload failed:', data)
  }
} catch (err) {
  console.error('Upload failed:', err)
} finally {
  setOpen(false); setSubMenu(null)
}
```

---

## High Priority Issues

### 4. SlideCanvas — `setTimeout(0)` Click Suppression Anti-pattern
**File**: `client/src/components/SlideCanvas.jsx:332-334`
```js
setTimeout(() => {
  suppressCanvasClickRef.current = false
}, 0)
```
Using `setTimeout(0)` to suppress the next click event after a drag operation is unreliable — some browsers allow the click to fire after the timeout.
**Fix**: Set `suppressCanvasClickRef.current = false` synchronously in `onMouseUp` before `forceUpdate`, or use a CSS class to disable pointer-events during the suppression window.

### 5. SlideCanvas — Global Document Mouse Listeners with No Early-Exit
**File**: `client/src/components/SlideCanvas.jsx:171-344`
```js
document.addEventListener('mousemove', onMouseMove)
document.addEventListener('mouseup', onMouseUp)
```
These fire on every mouse move across the entire document, not just over the canvas. The `onMouseMove` handler processes crop drags, rubber-band selection, pending-to-active drag promotion, and element drag/resize/rotate — but does not short-circuit early when no interaction is active.
**Fix**: Add an early-exit guard at the top of `onMouseMove`:
```js
const onMouseMove = (e) => {
  if (!cropDragRef.current && !rubberBandRef.current && !pendingDragRef.current && !draggingRef.current) return
  // ...
}
```

### 6. Toolbar — TOO LARGE (1186 lines), Should Split
**File**: `client/src/components/Toolbar.jsx`
At 1186 lines, Toolbar is now the largest component and the Phase 1 refactor's unfinished business. It contains three logical groups that should be extracted:
- **Background menu** (lines 276-508, ~230 lines): color picker, gradient presets, image URL upload, position/size controls — extract to `ToolbarBackgroundMenu.jsx`
- **Text formatting bar** (lines 608-1171, ~560 lines): font family/size selects, formatting buttons, color palettes, table menu — extract to `ToolbarTextBar.jsx`
- **Remaining toolbar** (~400 lines): insert integration, grid/guides/ruler toggles, alignment/group buttons

### 7. SlideCanvas — `forceUpdate` Anti-pattern
**File**: `client/src/components/SlideCanvas.jsx:107, 211, 336`
```js
const [, forceUpdate] = useState(0)
```
Using `forceUpdate` bypasses React's reconciliation and can cause unexpected behavior with concurrent rendering. Used here for drag promotion (line 211) and post-interaction cleanup (line 336).
**Fix**: Track drag promotion state in a ref (`dragPromotionRef`) and use a single `setState` trigger (e.g., a `renderVersion` counter) at the end of `onMouseUp`.

### 8. DropdownMenu — Missing ARIA Attributes for Accessibility
**File**: `client/src/components/DropdownMenu.jsx:32-38`
```jsx
<button className={`menu-trigger ...`} onClick={onToggle}>
  {label} <ChevronDown size={14} ... />
</button>
```
Missing `aria-expanded={isOpen}` and `aria-haspopup="menu"`. The menu's open/closed state is not communicated to screen readers.
**Fix**: Add `aria-expanded={isOpen}` and `aria-haspopup="menu"` to the trigger button. Also consider adding `aria-controls` pointing to the menu panel ID.

### 9. InsertMenu — SVG File Read Without Sanitization at Call Site
**File**: `client/src/components/InsertMenu.jsx:322-331`
```js
reader.onload = (ev) => onAddSvgElement?.(ev.target.result)
reader.readAsText(f)
```
Raw SVG text goes directly to `onAddSvgElement`. While `sanitizeSvgContent` exists in the codebase, it's the responsibility of `onAddSvgElement` to call it. If that handler is missing a sanitization call, the SVG is rendered unsanitized.
**Fix**: Sanitize before passing in `InsertMenu`:
```js
reader.onload = (ev) => {
  const sanitized = sanitizeSvgContent(ev.target.result)
  onAddSvgElement?.(sanitized)
}
```

### 10. SlidePanel — `dangerouslySetInnerHTML` SVG-onload Risk
**File**: `client/src/components/SlidePanel.jsx:249`
```js
dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(el.content || '') }}
```
`sanitizeRichTextHtml` (content-safety.js) uses `DOMParser` and removes `<script>`, `<iframe>`, `<object>`, `<embed>` tags plus `on*` attributes. However, `<svg onload=...>` event handlers on SVG elements are caught by the `on*` attribute removal (line 35-36 in content-safety.js). More exotic vectors like `<svg><use href="x" ...>` or CSS `@import` exfiltration are not blocked.
**Risk**: Low (the sanitizer is decent), but verify server-side sanitization is also applied before presentation storage for defense in depth.
**Fix**: Add `svg` to `BLOCKED_HTML_TAGS` array in content-safety.js, or ensure the SVG sanitization function is also applied here.

### 11. SlidePanel — Missing `stopPropagation` in `onDrop`
**File**: `client/src/components/SlidePanel.jsx:180-186`
```js
onDrop={(e) => {
  e.preventDefault()
  setDragOverIndex(null)
  const from = dragIndexRef.current
  if (from !== null && from !== index) onMove(from, index)
  dragIndexRef.current = null
}}
```
No `e.stopPropagation()` — drop events can bubble up to parent handlers.
**Fix**: Add `e.stopPropagation()` as the first line of the handler.

### 12. LivePresentationModal — `onClose` Fires Even When Popup Blocked
**File**: `client/src/components/LivePresentationModal.jsx:95-96`
```js
if (presenterWindow) { /* ... */ }
onClose()
```
`onClose()` runs unconditionally. If `window.open` is blocked, the modal closes with no indication that the presenter window failed to open.
**Fix**: Move `onClose()` inside the `if (presenterWindow)` block, or add an `else` branch that shows a warning.

### 13. FindReplaceBar — `handleReplace` / `handleReplaceAll` Not Wrapped in `useCallback`
**File**: `client/src/components/FindReplaceBar.jsx:67-119`
Both functions read `matches` from a closure (which is stable via `useMemo`) but are not themselves memoized. This works correctly but is fragile — a future change to add `matches` as a dependency would be non-obvious.
**Fix**: Wrap in `useCallback` with `[matches, currentMatchIdx, presentation, searchTerm, replaceTerm, matchCase]` as dependencies.

---

## Medium Priority Issues

### 14. Toolbar — Unused State Variables
**File**: `client/src/components/Toolbar.jsx:101-110`
```js
const [showShapeMenu, setShowShapeMenu] = useState(false)      // never referenced
const [showIconPicker, setShowIconPicker] = useState(false)    // never referenced
const [iconSearch, setIconSearch] = useState('')              // never referenced
```
Declared but never used. The linter already flags these (eslint-disable comments present). These were likely for features moved to InsertMenu.
**Fix**: Remove all three.

### 15. InsertMenu — Icon Filter Computed Twice Per Render
**File**: `client/src/components/InsertMenu.jsx:356-391`
The icon filter runs once for the grid render (line 356) and again in the pagination IIFE (line 377-380) to compute `total`.
**Fix**: Extract to `useMemo`:
```js
const filteredIcons = useMemo(() =>
  ICON_NAMES.filter(n => !iconSearch || n.toLowerCase().includes(iconSearch.toLowerCase())),
  [iconSearch]
)
// Then use filteredIcons.length and filteredIcons.slice() in both places
```

### 16. SlidePanel — `selectedIndices` Can Desync from `currentIndex`
**File**: `client/src/components/SlidePanel.jsx:133`
`selectedIndices` state and `currentIndex` prop can get out of sync when `currentIndex` changes externally (e.g., keyboard navigation). The `onClick` handler at line 191 syncs them, but if `currentIndex` changes without a click event, the selection highlight lags.
**Risk**: Low — this is an edge case in multi-select mode.

### 17. SlideSorterView — Context Menu Z-Index Inconsistent
**File**: `client/src/components/SlideSorterView.jsx:182`
Uses `z-[100]` for context menu, while `SlidePanel` uses `z-[9999]`. If both overlays are open simultaneously, the SlideSorter context menu may appear below other elements.
**Fix**: Use a consistent z-index scale across all overlays.

### 18. common-element-controls.jsx — Inline Function Recreated on Every Render
**File**: `client/src/components/properties/common-element-controls.jsx:16-19`
```js
const updateFinite = (key, value, min = null, max = null) => {
  const next = clampNumber(value, min, max, null)
  if (next === null) return
  onUpdate({ [key]: next })
}
```
Recreated on every render. Should be wrapped in `useCallback` with `[onUpdate]` as dependency.

### 19. chart-properties.jsx — `updateDataset` Recreated on Every Render
**File**: `client/src/components/properties/chart-properties.jsx:11-14`
Same pattern as above — should be `useCallback`.

---

## Low Priority / Informational

### 20. InsertMenu — `subMenu` State Not Reset on All Close Paths
**File**: `client/src/components/InsertMenu.jsx:120-124`
`doAction` resets `subMenu`, but the video prompt cancel (line 523) and other early-return paths may not reset it consistently.

### 21. TransitionPreview — Hardcoded Reveal.js Version 5.1.0 in CDN URLs
**File**: `client/src/components/TransitionPreview.jsx:43-45, 63`
If a newer Reveal.js version is deployed server-side, the preview iframe shows a different version than the actual presentation. Version pinning is reasonable for stability but could cause visual discrepancies.

### 22. DropdownMenu — No Keyboard Arrow Navigation Within Menu
Standard accessible dropdown menus support arrow key navigation. Currently only Tab/Escape are handled.

### 23. SlidePanel — Magic Number `4` for Element Preview Limit Not Documented
**File**: `client/src/components/SlidePanel.jsx:42`
```js
const els = (slide.elements || []).slice(0, 4)
```
Only first 4 elements shown in thumbnail. The limit is arbitrary and not explained in a comment.

### 24. Toolbar — Background Menu IIFE Pattern
**File**: `client/src/components/Toolbar.jsx:277-508`
The entire background menu is an IIFE rendering inside JSX. This is a code smell — it should be a proper sub-component. This reinforces the high-priority split recommendation.

### 25. AnalyticsModal — Token Partial Display
**File**: `client/src/components/AnalyticsModal.jsx:158, 184`
Tokens shown as `...${token.slice(-8)}` and `...${token.slice(-6)}`. Acceptable for a self-hosted tool, but ensure analytics data is not accessible to unauthorized users.

### 26. common-element-controls.jsx — Rotation Normalization Good
**File**: `client/src/components/properties/common-element-controls.jsx:54-57`
`((value % 360) + 360) % 360` correctly handles negative numbers. Well done.

### 27. EditorMenuBar — Custom Size Parsing Silently Fails
**File**: `client/src/components/EditorMenuBar.jsx:408-411`
Invalid input (e.g., "960xabc") silently does nothing. Could show a brief error message.

### 28. SlideCanvas — `commitCropRef` Pattern Is Correct
**File**: `client/src/components/SlideCanvas.jsx:121, 508-543`
Using a ref to expose `commitCrop` (a `useCallback`-wrapped function) to non-React event handlers (crop handle mouse events) is the correct pattern. Well implemented.

### 29. Properties Panel — Excellent File Organization
All 8 property files are small (50-250 lines), focused, and consistent. `common-element-controls.jsx` provides good DRY for shared controls. This is a clear win from the Phase 1 refactor.

---

## Per-File Findings Summary

| File | LOC | Assessment |
|------|-----|------------|
| SlideCanvas.jsx | 842 | Strong after refactor; forceUpdate/setTimeout issues are the main concern |
| InsertMenu.jsx | 529 | Feature-rich; missing error handling on upload and SVG sanitization at call site |
| EditorMenuBar.jsx | 420 | Clean, declarative; needs ARIA attributes |
| FindReplaceBar.jsx | 219 | Well-structured; useCallback gaps on handlers |
| DropdownMenu.jsx | 125 | Clean reusable component; missing ARIA |
| Toolbar.jsx | 1186 | TOO LARGE — must split; three unused state vars |
| LivePresentationModal.jsx | 105 | Token transmission and popup blocker issues |
| SlidePanel.jsx | 588 | Feature-rich; dangerouslySetInnerHTML risk, stopPropagation missing |
| SlideSorterView.jsx | 209 | Clean; inconsistent z-index on context menu |
| TransitionPreview.jsx | 128 | Great feature; theme injection XSS risk |
| AnalyticsModal.jsx | 196 | Solid async patterns; token exposure acceptable |
| chart-properties.jsx | 116 | Good; updateDataset should be useCallback |
| code-properties.jsx | 100 | Clean; no issues |
| common-element-controls.jsx | 235 | Good DRY; inline function recreated each render |
| image-properties.jsx | 97 | Clean; no issues |
| misc-properties.jsx | 312 | Handles 9 types well; borderline size |
| shape-properties.jsx | 187 | Clean; no issues |
| table-properties.jsx | 193 | Full-featured cell editor; correct logic |

---

## Summary Statistics
- Files reviewed: 18
- Critical issues: 3
- High priority: 10
- Medium: 6
- Low/Info: 9
- **Total issues: 28**

## Recommended Actions (Priority Order)

1. **[Critical]** Fix TransitionPreview theme injection — validate against allowlist
2. **[Critical]** Fix LivePresentationModal presenterToken transmission and popup blocker handling
3. **[Critical]** Add try-catch to InsertMenu media upload
4. **[High]** Replace `setTimeout(0)` in SlideCanvas with synchronous click suppression
5. **[High]** Add early-exit guard in SlideCanvas global mouse handlers
6. **[High]** Split Toolbar into 3 sub-components (background menu, text bar, toolbar)
7. **[High]** Add ARIA attributes to DropdownMenu trigger button
8. **[High]** Sanitize SVG in InsertMenu before passing to `onAddSvgElement`
9. **[High]** Add `stopPropagation` to SlidePanel `onDrop`
10. **[Medium]** Remove unused state vars from Toolbar
11. **[Medium]** Extract icon filter to `useMemo` in InsertMenu
12. **[Medium]** Wrap `updateFinite` in `useCallback` (common-element-controls.jsx)
13. **[Medium]** Wrap `updateDataset` in `useCallback` (chart-properties.jsx)
14. **[Medium]** Add `useCallback` to `handleReplace`/`handleReplaceAll` (FindReplaceBar.jsx)
15. **[Medium]** Fix inconsistent z-index for SlideSorter context menu
16. **[Low]** Document the 4-element limit in SlidePanel MiniPreview
17. **[Low]** Add keyboard arrow navigation to DropdownMenu
18. **[Low]** Show error for invalid custom size in EditorMenuBar

## Unresolved Questions
1. **Toolbar unused state**: Are `showShapeMenu`, `showIconPicker`, `showIconSearch` intentionally kept for future use, or dead code from the InsertMenu migration?
2. **TransitionPreview theme validation**: Does the server validate `presentation.theme` before serving presentations? If so, client-side XSS risk is mitigated by server trust.
3. **LivePresentationModal presenterToken**: Is `window.name` the intended mechanism for passing the presenter token, or a leftover from an earlier approach?
4. **SlidePanel dangerouslySetInnerHTML**: Is `sanitizeRichTextHtml` the primary defense, or does server-side sanitization also occur before storage?
