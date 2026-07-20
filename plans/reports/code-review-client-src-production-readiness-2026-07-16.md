## Code Review Summary

### Scope
- Files reviewed: `client/src` (pages, stores, hooks/editor-controller, hooks/use-live-*, canvas render path, content-safety, url-safety, plugins, App/ErrorBoundary)
- Lines of code analyzed: ~focused scan of XSS/state/leak surfaces + giant page files (~4k+ LOC hot path)
- Review focus: production-readiness of `client/src` only
- Updated plans: none (no given plan file)

### Overall Assessment
Client has real security work in `content-safety` / `url-safety` for rich text and media — **undermined by intentional HTML embed sandbox that is a full XSS primitive**. Live viewer compounds this. Giant legacy pages still dominate maintainability. Autosave teardown is carefully designed but concurrent route races remain. Zustand editor selection is module-global and not fully reset on deck switch.

---

### Critical Issues

#### 1. HTML embed iframe: `allow-scripts` + `allow-same-origin` + raw `srcDoc` = parent-origin XSS
**Severity:** Critical  
**Evidence:**
```590:601:client/src/components/canvas/canvas-element-wrapper.jsx
            if (element.type === 'html') {
              const srcDoc =
                element.embedKind === 'mermaid'
                  ? buildMermaidEmbedContent(element.mermaidSource || element.content || '')
                  : element.content || ''
              return (
                <iframe
                  srcDoc={srcDoc}
                  style={htmlFrameStyle}
                  sandbox="allow-scripts allow-same-origin"
                  title={element.embedKind === 'mermaid' ? 'Mermaid diagram preview' : 'HTML embed'}
                />
              )
```
Test **locks in** the insecure combo:
```461:469:client/src/components/canvas/canvas-element-wrapper.test.jsx
  it('renders html embed iframe with allow-same-origin so CDN scripts can load', () => {
    ...
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-same-origin')
```
**Impact:** With both flags, `srcdoc` scripts run as **parent origin**. Malicious (or imported) presentation HTML can read editor state, call APIs as the app origin, steal share/live tokens from memory, rewrite the SPA.  
**Fix:** Drop `allow-same-origin` for untrusted content (plugin-sandbox already does `sandbox="allow-scripts"` only — `plugin-sandbox.jsx:84`). Proxy CDN assets via same-origin `/vendor` if needed. Prefer CSP `sandbox` + opaque origin. Never put author HTML in parent-origin iframe.

#### 2. Live/Speaker preview: full deck HTML in same broken sandbox + open postMessage bridge
**Severity:** Critical  
**Evidence:**
```409:415:client/src/pages/LiveViewPage.jsx
      <iframe
        ref={iframeRef}
        ...
        sandbox="allow-scripts allow-same-origin"
      />
```
```22:22:client/src/hooks/use-reveal-preview-frame.js
    iframeRef.current.srcdoc = htmlContent
```
HTML arrives untrusted over socket:
```112:114:client/src/pages/LiveViewPage.jsx
    socket.on('presentation-data', (data) => {
      if (data.html) setHtmlContent(data.html)
    })
```
Speaker view same sandbox: `SpeakerViewPage.jsx:45-46`.  
Timer bridge accepts **any** message (no `origin` / `source` check):
```226:236:client/src/pages/LiveViewPage.jsx
    const handler = (event) => {
      if (!socketRef.current?.connected) return
      const [type, data] = event.data || []
      if (type === '__timer-event' && data) {
        socketRef.current.emit(data.event, data.payload)
      }
    }
```
Also hangs privileged helpers on `window`:
```239:245:client/src/pages/LiveViewPage.jsx
    window.__emitTimerEvent = (event, payload) => { ... socketRef.current.emit ... }
```
**Impact:** Compromised deck HTML (or same-origin breakout) → socket emit as viewer, parent DOM access, timer/game event injection.  
**Fix:** `allow-scripts` only; validate `event.source === iframe.contentWindow`; remove `window.__emitTimerEvent` / `__timerStates` globals; strict message schema.

---

### High Priority Findings

#### 3. Template thumbnail XSS: unsanitized `dangerouslySetInnerHTML`
**Severity:** Important  
**Evidence:**
```57:62:client/src/components/dashboard/TemplateSlideThumbnail.jsx
          {element.type === 'text' && (
            <div
              ...
              dangerouslySetInnerHTML={{ __html: element.content || '' }}
            />
```
Canvas/slide-thumb path **does** sanitize (`slide-thumbnail-preview.jsx:36`, `canvas-element-wrapper.jsx:493`). Dashboard does not.  
Also `url(${background.image})` without `sanitizeMediaSrc` (line 8).  
**Impact:** Marketplace/user template content → stored XSS on Home.  
**Fix:** Reuse `sanitizeRichTextHtml`; sanitize media URLs.

#### 4. CSS `backgroundImage: url(${...})` without media sanitizer (multi-file)
**Severity:** Important  
**Evidence:**
- `SlideCanvas.jsx:50` — `backgroundImage: \`url(${bg.image})\``
- `SlideSorterView.jsx:11`
- `slide-thumbnail-preview.jsx:10`
- `design-tab-content.jsx:229,329`
- `TemplateSlideThumbnail.jsx:8`

`sanitizeMediaSrc` exists and is used for video/img (`canvas-element-wrapper.jsx:612-620`) but **not** backgrounds.  
**Impact:** CSS breakout / tracking / unexpected schemes via crafted `background.image` (import/PPTX/share).  
**Fix:** Always `sanitizeMediaSrc` before CSS `url()`; reject non-http(s)/data-image.

#### 5. Zustand selection not cleared on presentation route change
**Severity:** Important  
**Evidence:** Selection is global store (`editor-store.js:5-18`). Clear only on **slide index** change:
```235:243:client/src/pages/EditorPage.jsx
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    ...
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps
```
No `presentationId` dependency. Navigating `/editor/A` → `/editor/B` while both start at index `0` **keeps** A’s selection IDs.  
**Impact:** Ghost selection, wrong property panel targets, accidental mutate/delete against missing IDs until user clicks.  
**Fix:** Clear selection/editing/clipboard UI on `presentationId` load epoch; call `clearSelection()` in persistence load success.

#### 6. Save controller race: `inFlightRef` force-cleared on route change while PUT may still run
**Severity:** Important  
**Evidence:**
```152:160:client/src/hooks/editor-controller/use-editor-save-controller.js
  const resetForRoute = useCallback(() => {
    flush()
    inFlightRef.current = false
    queueRef.current = null
    failedEntryRef.current = null
    attemptRef.current += 1
    routeEpochRef.current += 1
    acceptedGenerationRef.current = null
  }, [flush])
```
`processQueue` only serializes via `inFlightRef` (lines 73–86). Force-false allows overlapping PUTs for old/new decks. `routeEpoch` only protects **failed requeue**, not in-flight network completion side effects.  
**Impact:** Concurrent saves, noisy 409s, possible status flicker; less likely data corruption if server generation checks hold.  
**Fix:** Don’t clear `inFlightRef` until request settles; cancel token / ignore non-matching epoch in `persist` finally.

#### 7. Unload flush body ceiling 60KB — large decks fall to sync XHR; silent catch
**Severity:** Important  
**Evidence:**
```17:17:client/src/hooks/use-editor-save-queue.js
export const KEEPALIVE_MAX_BYTES = 60 * 1024
```
```139:147:client/src/hooks/editor-controller/use-editor-save-controller.js
      sendSync: (url, body) => {
        try {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', url, false)
          ...
        } catch {
          // Browser teardown offers no further recovery path.
        }
      },
```
Debounced autosave (1500ms) + tab close → depends on this path. Base64 backgrounds easily exceed 60KB.  
**Impact:** Lost edits on unload for media-heavy decks (partially mitigated by intentional design, still prod risk).  
**Fix:** Raise cap where browsers allow; warn “unsaved” via `beforeunload` returnValue when queue non-empty; avoid inlining huge data URLs in snapshot.

#### 8. Giant files vs 200 LOC rule — quantified
**Severity:** Important (maintainability / defect density)  
**Evidence (actual EOF lines):**

| File | LOC | × over 200 |
|------|-----|------------|
| `pages/HomePage.jsx` | **1878** | **9.4×** |
| `components/SlideCanvas.jsx` | **714** | **3.6×** |
| `components/canvas/canvas-element-wrapper.jsx` | **702** | **3.5×** |
| `pages/EditorPage.jsx` | **646** | **3.2×** |
| `components/PropertiesPanel.jsx` | **492** | **2.5×** |
| `pages/LiveViewPage.jsx` | **420** | **2.1×** |

Project rule: `CLAUDE.md` / `docs/code-standards.md` — files under 200 LOC.  
**Impact:** Hard reviews, high regression risk (EditorPage is a composition root of 10+ controllers). HomePage is a dump of presets + dashboard + import.  
**Fix:** Continue extraction (HomePage presets → data module; canvas element switch → full registry; already partial for EditorPage).

---

### Medium Priority Improvements

#### 9. Dual / dead autosave state paths (AI-slop)
**Severity:** Medium  
**Evidence:** Production path: local `useState` presentation + `useEditorPersistenceController` / `useEditorSaveController`.  
`usePresentationStore.presentation` **not** set by load path; only `saveConflict` + `adoptAggregateGeneration` touch store.  
Dead legacy hook never imported:
```5:42:client/src/hooks/use-autosave.js
export function useAutosave(isTemplate = false) {
  const presentation = usePresentationStore((s) => s.presentation)
  ...
}
```
Grep: only definition, zero call sites.  
**Impact:** Misleading architecture; future contributor wires wrong store → silent non-save or double-save.  
**Fix:** Delete `use-autosave.js` or wire single source of truth; document store owns only conflict/generation.

#### 10. Error boundary recovery is cosmetic
**Severity:** Medium  
**Evidence:**
```31:33:client/src/components/ErrorBoundary.jsx
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
```
Single root boundary in `App.jsx:77`. “Try Again” remounts same broken tree without key/reset of Zustand/React state.  
**Impact:** Infinite error loop UX; no per-route isolation (editor crash takes entire app).  
**Fix:** Nested boundaries around Editor/Home; remount via `key={errorCount}`; hard navigate home on recover.

#### 11. Rich-text sanitizer allowlist is incomplete
**Severity:** Medium  
**Evidence:**
```54:55:client/src/utils/content-safety.js
const BLOCKED_HTML_TAGS = ['script', 'iframe', 'object', 'embed']
```
Blocks tags by denylist only; leaves `form`, `base`, `meta`, `link`, `svg`/`math`, `style` elements, etc. Style attr is scrubbed; element-level vectors remain.  
**Impact:** Residual XSS/CSS if browser quirks + incomplete denylist (lower than raw HTML embed, still not defense-in-depth).  
**Fix:** Tag allowlist (p, span, strong, em, a, br, …) not denylist.

#### 12. Client-bundled third-party API keys
**Severity:** Medium  
**Evidence:**
```2:2:client/src/services/unsplash.js
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY || ''
```
```2:2:client/src/services/giphy.js
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_KEY || ''
```
**Impact:** Any `VITE_*` key is public in the JS bundle; quota theft.  
**Fix:** Proxy search via server; keep secrets server-side.

---

### Low Priority Suggestions

#### 13. Live presentation socket cleanup OK; minor leak vectors
**Severity:** Minor  
**Evidence:** `use-live-presentation.js:91-95` disconnects; `use-annotation-sync.js:112-119` offs handlers; LiveView keydown cleaned (`LiveViewPage.jsx:61-62`).  
`use-reveal-preview-frame.js` clears intervals on unmount (64-68) but `iframe.onload` not nulled — minor.  
`use-live-presentation` does **not** include `presenterToken` in deps (line 96) — token updates after connect ignored (may be intentional via ref).

#### 14. A11y: canvas elements ok; pages sparse
**Severity:** Minor  
Canvas: `role="group"`, `tabIndex={0}`, `aria-label` (`canvas-element-wrapper.jsx:461-463`).  
`EditorPage.jsx`: no `aria-*` / `role` in page root (delegated to chrome). Live “Room not found” link is fine. Not a regression hotspot vs security items.

#### 15. Silent empty catches scatter operational signal
**Severity:** Minor / Suggestion  
Examples: `canvas-element-wrapper.jsx:186` (katex), `exportPptx.js:74`, many `catch {}` in export/raster. Prefer `console.debug` or metrics for non-teardown paths.

---

### Positive Observations
- Rich text path uses `sanitizeRichTextHtml` + style allowlist + href checks (`content-safety.js`, `url-safety.js`) with tests for `javascript:`.
- Markdown renderer sanitizes after convert (`markdown-element-renderer.jsx:6`).
- Chart/latex iframes use `sandbox="allow-scripts"` **without** same-origin (`chart-element-renderer.jsx:66`, `latex-element-renderer.jsx:60`) — correct pattern.
- Plugin sandbox checks `event.source` (`plugin-sandbox.jsx:48`).
- Autosave has generation/409 conflict UX, debounce skip on load identity, and keepalive PUT design with tests.
- EditorPage partially decomposed into `use-editor-*-controller` hooks (still fat composition root).

---

### Recommended Actions
1. **P0:** Remove `allow-same-origin` from HTML embeds + live/speaker preview iframes; update tests that require it.
2. **P0:** Harden LiveView postMessage (`source` + schema); remove `window.__emitTimerEvent`.
3. **P0:** Sanitize `TemplateSlideThumbnail` HTML + all CSS background URLs.
4. **P1:** Clear editor store selection on `presentationId` change / load.
5. **P1:** Fix save `inFlightRef` reset race; improve unload UX for oversize snapshots.
6. **P1:** Delete or wire `use-autosave.js`; single presentation source of truth.
7. **P2:** Split HomePage / SlideCanvas / canvas-element-wrapper under 200 LOC guideline.
8. **P2:** Tag allowlist sanitizer; server-proxy Unsplash/Giphy keys; nested error boundaries.

---

### Metrics
- Type Coverage: N/A (JS-first client; light JSDoc only)
- Test Coverage: not measured this pass; XSS tests exist for sanitized paths but **encode insecure iframe policy**
- Linting Issues: not run this pass
- 200 LOC violations (sample hot files): **6** listed above; HomePage worst at **1878 LOC**
- `dangerouslySetInnerHTML` call sites: **10** (1 clearly unsanitized template path; code/hljs + static icons lower risk)

### Unresolved questions
- Is HTML-embed CDN loading with same-origin a deliberate product requirement, or can all embeds go through `/vendor` opaque-origin iframes?
- Are templates treated as fully trusted first-party content only, or can users/marketplace inject slide JSON?
- Target browser keepalive body limit for raising `KEEPALIVE_MAX_BYTES`?

### Plan status
- No given plan file → no TODO checklist update.
- Related existing plan (not updated): `plans/260716-1125-p0-unload-persistence-reconciliation/plan.md` may touch finding #7.
