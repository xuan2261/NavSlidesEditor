# Code Review — Group 2: UI Components + Properties Panels

**Reviewer:** Staff Engineer (code-reviewer)
**Date:** 2026-04-26
**Files:** 52 files — UI components, properties panels, modals, dashboard
**Scope:** Correctness, Performance, Security, Code Quality, Best Practices, Adversarial

---

## Summary

**Total issues: 27 (Critical: 3, High: 7, Medium: 9, Low: 8)**

| Category | Count |
|---|---|
| Security (XSS) | 8 |
| Correctness | 7 |
| Performance | 4 |
| React Patterns | 5 |
| Input Validation | 3 |

### Must-Fix Before Merge

1. **CRITICAL — XSS via `dangerouslySetInnerHTML` in TransitionPreview.jsx:30** — `el.content` from slide data concatenated into HTML string rendered as `srcDoc` iframe. Malicious scripts in slide text execute.
2. **CRITICAL — XSS via `dangerouslySetInnerHTML` in SlidePanel.jsx:248** — Text element content rendered directly without sanitization.
3. **CRITICAL — XSS via `srcDoc` iframe in SlideSorterView.jsx:263** — HTML embed element content set as `srcDoc` with `allow-scripts` sandbox.
4. **HIGH — NaN propagation in CommonElementControls.jsx** — `Number(e.target.value)` on empty input yields NaN, stored into element state. No validation guard.
5. **HIGH — `el.src` used directly in SlideThumbnail.jsx:28** as URL without validation/sanitization.

---

## Critical Issues

### 1. XSS — TransitionPreview.jsx:30
**SEVERITY:** Critical | **Category:** Security (XSS)
**File:** `client/src/components/TransitionPreview.jsx:30`

```js
if (el.type === 'text')
  return `<div style="${style}padding:8px 12px;color:white;">${el.content || ''}</div>`
```

`el.content` is HTML string from user data interpolated directly into an HTML string, then set as `srcDoc` on an iframe. Any script tag or event handler in slide text content will execute.

**Impact:** Malicious slide content can execute arbitrary JavaScript in the browser session.

**Fix:** Strip script tags and event handlers before rendering:
```js
const stripHtml = (html) => html
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/javascript:/gi, '')
```

Same pattern also affects `AnimationTimeline.jsx:35` (DOMParser strips tags but scripts may execute if re-parsed as HTML), `TemplatePreview.jsx:66` (dangerouslySetInnerHTML on text content).

---

### 2. XSS — SlidePanel.jsx:248
**SEVERITY:** Critical | **Category:** Security (XSS)
**File:** `client/src/components/SlidePanel.jsx:248`

```jsx
dangerouslySetInnerHTML={{ __html: el.content || '' }}
```

Text element content rendered directly from presentation JSON. If content contains malicious `<script>` or event handlers, they execute in the editor context.

**Impact:** Stored XSS — any user who opens a presentation with malicious slide text gets code executed.

**Fix:** Use DOMPurify or an allowlist-based sanitizer before rendering user-provided HTML.

---

### 3. XSS — SlideSorterView.jsx:263
**SEVERITY:** Critical | **Category:** Security (XSS)
**File:** `client/src/components/SlideSorterView.jsx:263`

```jsx
<iframe srcDoc={el.content} sandbox="allow-scripts" ... />
```

`allow-scripts` is explicitly set, permitting injected script execution in the iframe. User-controlled HTML rendered without sanitization.

**Impact:** HTML embed elements with malicious scripts can execute, potentially bypassing some iframe security boundaries.

**Fix:** Sanitize `el.content` before setting as `srcDoc`, or restrict the sandbox attribute.

---

## High Priority

### 4. NaN propagation — CommonElementControls.jsx + all properties files
**SEVERITY:** High | **Category:** Correctness
**Files:** `common-element-controls.jsx:25,34,44,54,63`, `shape-properties.jsx`, `table-properties.jsx`, `code-properties.jsx`, `media-properties.jsx`, `misc-properties.jsx`

```jsx
value={Math.round(element.x)}
onChange={(e) => onUpdate({ x: Number(e.target.value) })}
```

When input is empty, `Number('')` returns `NaN`. Stored as element value and persists across saves.

**Fix:**
```jsx
onChange={(e) => {
  const v = Number(e.target.value)
  if (!isNaN(v)) onUpdate({ x: v })
}}
```

---

### 5. Unvalidated `id` prop in SlideThumbnail — SlideThumbnail.jsx:28
**SEVERITY:** High | **Category:** Security (URL injection) + Correctness
**File:** `client/src/components/SlideThumbnail.jsx:28`

```jsx
src={`/api/presentations/${id}/present?preview=true`}
```

`id` from props used directly in URL without type check. If `undefined`, URL becomes `/api/presentations/undefined/present?preview=true`. Could be crafted for path traversal or injection.

**Fix:** Validate `id` is a valid non-empty string before URL construction.

---

### 6. Memory leak — SlideThumbnail.jsx:10-17
**SEVERITY:** High | **Category:** Performance
**File:** `client/src/components/SlideThumbnail.jsx:10-17`

```jsx
const observer = new ResizeObserver((entries) => {
  for (let entry of entries) {
    setScale(entry.contentRect.width / 1920)
  }
})
observer.observe(containerRef.current)
return () => observer.disconnect()
```

`ResizeObserver` created inside `useEffect` without a cleanup that disconnects the previous observer. Any remount or re-initialization creates multiple active observers on the same element.

**Fix:** Store observer in a ref and disconnect on cleanup:
```jsx
const observerRef = useRef(null)
useEffect(() => {
  if (!containerRef.current) return
  observerRef.current = new ResizeObserver(...)
  observerRef.current.observe(containerRef.current)
  return () => observerRef.current?.disconnect()
}, [])
```

---

### 7. Missing null-safety in DropdownMenu items — DropdownMenu.jsx:43
**SEVERITY:** High | **Category:** Correctness
**File:** `client/src/components/DropdownMenu.jsx:43`

```jsx
{items.map((item, idx) => {
  if (item.type === 'separator') { ... }
```

No null/undefined guard on `item`. If `items` contains `null`, the code crashes with "Cannot read property 'type' of null".

**Fix:**
```jsx
{items.map((item, idx) => {
  if (!item) return null
  if (item.type === 'separator') { ... }
```

---

### 8. Missing `handleContextMenu` useCallback optimization — SlidePanel.jsx:151
**SEVERITY:** High | **Category:** Performance
**File:** `client/src/components/SlidePanel.jsx:151`

```jsx
const handleContextMenu = useCallback((e, index) => {
  ...
}, [setCtxMenu])
```

`setCtxMenu` from `useState` is stable but listed as dependency. `handleContextMenu` is recreated on re-renders, causing child elements that receive it as prop to re-render unnecessarily.

**Fix:** Use `[]` as dependency (setState is stable by design).

---

### 9. Silent fetch errors — AnalyticsModal.jsx:16
**SEVERITY:** High | **Category:** Correctness
**File:** `client/src/components/AnalyticsModal.jsx:16`

```jsx
.catch(() => setLoading(false))
```

Network errors, 4xx, and 5xx silently swallowed. User sees "No analytics data yet" even when server is unreachable — no actionable feedback.

**Fix:** Store error state and display message:
```jsx
.catch((err) => {
  setError('Failed to load analytics')
  setLoading(false)
})
```

Same issue in SyncModal.jsx:22 (silent catch with empty block), MediaLibraryModal.jsx:47-49 (console.error only).

---

### 10. DOMParser per render — AnimationTimeline.jsx:35
**SEVERITY:** High | **Category:** Performance
**File:** `client/src/components/AnimationTimeline.jsx:35`

```js
const doc = new DOMParser().parseFromString(el.content || '', 'text/html')
```

Instantiated on every render for every text element. Allocation cost per frame.

**Fix:** Memoize with `useCallback` or replace with regex stripper:
```js
const getTextLabel = useCallback((el) => {
  if (el.type !== 'text') return el.type
  return (el.content || '').replace(/<[^>]+>/g, '').slice(0, 30) || 'Text'
}, [])
```

---

## Medium Priority

### 11. Canvas allocation per render — ColorPicker.jsx:31
**SEVERITY:** Medium | **Category:** Performance
**File:** `client/src/components/ui/ColorPicker.jsx:31`

```js
const ctx = document.createElement('canvas').getContext('2d')
ctx.fillStyle = color
const computed = ctx.fillStyle
```

Canvas created on every `parseColorToHex` call for named colors. `useMemo` caches results, but first render for each unique named color still allocates a canvas.

**Fix:** Cache named color results in a Map.

---

### 12. CSS injection risk — PropertiesPanel.jsx:226
**SEVERITY:** Medium | **Category:** Security (CSS injection)
**File:** `client/src/components/PropertiesPanel.jsx:226`

User-provided CSS injected into presentation. Malicious CSS can override all styles, use CSS keylogging (with contentEditable), or exfiltrate data via `background-image` URLs.

**Fix:** Warn users, or implement CSS allowlist/validation filter.

---

### 13. Missing input validation on URL fields — MediaProperties.jsx, ImageProperties.jsx
**SEVERITY:** Medium | **Category:** Input Validation
**Files:** `client/src/components/properties/media-properties.jsx:16`, `client/src/components/properties/image-properties.jsx`

`element.src`, `element.poster` accept arbitrary strings with no URL format validation.

**Fix:**
```js
const isValidUrl = (str) => {
  try { new URL(str); return true } catch { return false }
}
```

---

### 14. `window.confirm` dialogs — HistoryModal, MediaLibraryModal, ShareModal
**SEVERITY:** Medium | **Category:** UX / Correctness
**Files:** `HistoryModal.jsx:49`, `MediaLibraryModal.jsx:82`, `ShareModal.jsx:63`

Blocking `window.confirm` disrupts UX, cannot be styled, and blocks the event loop. Replace with inline confirmation UI.

---

### 15. Missing `aria-label` — SlideSorterView context menu buttons
**SEVERITY:** Medium | **Category:** Accessibility
**File:** `client/src/components/SlideSorterView.jsx:190-208`

Context menu buttons lack `aria-label`, inaccessible to screen readers.

---

### 16. Empty string sort inconsistency — TemplateGallery.jsx:201
**SEVERITY:** Medium | **Category:** Correctness
**File:** `client/src/components/dashboard/TemplateGallery.jsx:201`

```js
return b.id > a.id ? 1 : -1
```

Returns `-1` instead of `0` for equal IDs, causing inconsistent ordering.

**Fix:**
```js
return b.id.localeCompare(a.id) || 0
```

---

### 17. localStorage without try-catch — TemplateGallery.jsx:131
**SEVERITY:** Medium | **Category:** Correctness
**File:** `client/src/components/dashboard/TemplateGallery.jsx:131`

```js
const [favorites, setFavorites] = useState(() => {
  return JSON.parse(localStorage.getItem('navslides-favorite-templates') || '[]')
})
```

`localStorage` throws in private browsing mode (Firefox), embedded iframes, and quota exceeded scenarios.

**Fix:** Wrap in try-catch.

---

### 18. Unused string interpolation for action state — HistoryModal.jsx:157
**SEVERITY:** Medium | **Category:** Code Quality
**File:** `client/src/components/HistoryModal.jsx:157`

```js
{pendingAction === `restore:${snap.id}` ? ...}
```

String interpolation for action state is fragile. Consider discriminated union: `{ action: 'restore', id: string } | null`.

---

### 19. Hardcoded preview dimensions — TransitionPreview.jsx:57-58
**SEVERITY:** Medium | **Category:** Correctness
**File:** `client/src/components/TransitionPreview.jsx:57-58`

```js
width:960px;height:540px
```

Hardcoded 960x540 ignores `presentation.resolution`. Preview always shows 16:9 regardless of actual slide dimensions.

---

## Low Priority

### 20. Non-existent CSS class `btn btn-secondary` — misc-properties.jsx:13,28,281
**SEVERITY:** Low | **Category:** Code Quality
**File:** `client/src/components/properties/misc-properties.jsx:13,28,281`

```jsx
className="btn btn-secondary w-full ..."
```

Likely old Bootstrap-style classes. Component falls back to unstyled native button. Should use `Button` component or `buttonVariants` helper.

---

### 21. Emoji as accessibility barrier — SelectionPane.jsx:77, CommonElementControls.jsx:77
**SEVERITY:** Low | **Category:** Accessibility
**Files:** `client/src/components/SelectionPane.jsx:77`, `client/src/components/properties/common-element-controls.jsx:77`

```jsx
<span className="text-xs text-text-secondary">
  {element.locked ? '🔒' : '🔓'} Lock element
</span>
```

Emoji announced by screen readers. Use `aria-label` or visually hidden text.

---

### 22. `key` on non-list element — TemplateGallery.jsx:307
**SEVERITY:** Low | **Category:** React Patterns
**File:** `client/src/components/dashboard/TemplateGallery.jsx:307`

```jsx
<div key={group.label}>
```

`key` only meaningful on elements returned directly from `.map()`. Misleading here.

---

### 23. Magic number for thumbnail scale — TemplatePreview.jsx:268
**SEVERITY:** Low | **Category:** Code Quality
**File:** `client/src/components/dashboard/TemplatePreview.jsx:268`

```jsx
<div className="scale-[0.22] origin-top-left w-[960px] h-[540px]">
```

Hardcoded `0.22` breaks if container changes size. Derive from actual container width.

---

### 24. No debounce on auto-slide input — PropertiesPanel.jsx:166
**SEVERITY:** Low | **Category:** Performance
**File:** `client/src/components/PropertiesPanel.jsx:166`

Typing rapidly fires `onUpdatePresentation` on every keystroke, potentially triggering autosave on each digit. Consider debouncing.

---

### 25. Inconsistent icon strategy (SVG vs emoji)
**SEVERITY:** Low | **Category:** Code Quality
**Files:** Throughout codebase

`QuickAccessToolbar` uses SVG icons (good). `SelectionPane` and `CommonElementControls` mix emoji and lucide icons. Establish consistent icon strategy project-wide.

---

### 26. Redundant duplicate import — TableProperties.jsx:2
**SEVERITY:** Low | **Category:** Code Quality
**File:** `client/src/components/properties/table-properties.jsx:2`

```js
import { Button, Input, ColorPicker, Select } from '../../components/ui'
import { Button } from '../../components/ui'
```

`Button` imported twice. Minor.

---

### 27. Unused `pendingAction` guard — HistoryModal.jsx:157
**SEVERITY:** Low | **Category:** Code Quality
**File:** `client/src/components/HistoryModal.jsx:157`

```jsx
disabled={pendingAction !== ''}
```

Restore/delete buttons disabled when ANY pending action is in flight (save, restore, delete). User cannot restore a snapshot while another delete is in progress — which is reasonable but the UX is confusing. Consider per-item pending state.

---

## Positive Observations

- Consistent use of `isBackdropClick` + `useEscapeClose` utility across all modals — clean, maintainable pattern
- `forwardRef` used correctly in all UI primitives (Button, Input, Select, ColorPicker)
- `useCallback` used appropriately for async handlers and expensive callbacks
- Proper `aria-modal`, `aria-labelledby`, `aria-label` attributes on modals
- Context menu keyboard navigation with Arrow keys in SlidePanel
- `ResizeObserver` for dynamic thumbnail scaling — correct API choice
- DropdownMenu properly cleans up event listeners with `useEffect` cleanup
- Error boundaries implemented for crash recovery
- Consistent Tailwind utility patterns
- `useMemo` used in TemplateGallery for expensive filtering/sorting
- Good separation: type-specific property components are cleanly split
- Custom CSS editor textarea with Tab-key support (good detail)
- TransitionPreview sandboxed in iframe (correct approach, just needs content sanitization)

---

## Recommended Actions

| Priority | Action | Files |
|---|---|---|
| **MUST** | Sanitize `el.content` before `dangerouslySetInnerHTML` / `srcDoc` | SlidePanel, SlideSorterView, TransitionPreview, AnimationTimeline, TemplatePreview |
| **MUST** | Add NaN guards in all `Number(e.target.value)` handlers | All properties files |
| **MUST** | Validate `id` prop before URL construction | SlideThumbnail |
| **HIGH** | Add error state + user feedback to fetch calls | AnalyticsModal, SyncModal, MediaLibraryModal |
| **HIGH** | Add null guard in DropdownMenu `items.map` | DropdownMenu |
| **HIGH** | Fix ResizeObserver memory leak | SlideThumbnail |
| **MEDIUM** | Replace `window.confirm` with inline confirmation UI | HistoryModal, MediaLibraryModal, ShareModal |
| **MEDIUM** | Add `aria-label` to SlideSorterView context menu buttons | SlideSorterView |
| **MEDIUM** | Warn about CSS injection risk in custom CSS textarea | PropertiesPanel |
| **MEDIUM** | Add try-catch around localStorage reads | TemplateGallery |
| **MEDIUM** | Memoize `getElementLabel` / replace DOMParser with regex | AnimationTimeline |
| **LOW** | Fix `btn btn-secondary` class names | misc-properties |
| **LOW** | Replace emoji with accessible alternatives | SelectionPane, CommonElementControls |
| **LOW** | Derive thumbnail scale dynamically | TemplatePreview |
| **LOW** | Debounce auto-slide number input | PropertiesPanel |
| **LOW** | Remove duplicate import | TableProperties |

---

## Unresolved Questions

1. Should the `customCSS` textarea support a CSS linter/sanitizer, or is a warning sufficient?
2. Is DOMPurify or a similar library already available as a dependency? If not, should it be added?
3. The `Presentation` icon fallback in SlideThumbnail — is there a design spec for what constitutes a "failed to load" state?
