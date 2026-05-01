# Deep Feature Analysis: Full Synthesis Report

**Date:** 2026-04-26
**Scope:** 18 features across 6 research reports
**Base:** 6 deep-dive agents (ppt-master, PPTAgent, banana-slides, + 50+ similar repos)

---

## PART 1: FEATURE-BY-FEATURE DEEP DIVE

### Feature 1: Phase C — SlideCanvas Decomposition

**Current state:** `SlideCanvas.jsx` = ~2722 LOC, `EditorPage.jsx` = ~1609 LOC. 1 file làm quá nhiều việc.

**Root causes identified:**
- Clipboard tồn tại ở 3 nơi (editor-store.js, SlideCanvas inline, use-clipboard.js = dead code đã xóa)
- 14 element renderers là local functions — không test, không reuse được
- CanvasElement (391 LOC) — styling + event routing + selection UI + 14-way type dispatch trong 1 file
- Canvas chrome (rulers, grid, footer, zoom, context menu) — hoàn toàn inline
- 4 interaction modes xử lý trong 1 useEffect 185 dòng

**Proposed new structure:**
```
client/src/components/canvas/
├── slide-canvas.jsx          (~400 LOC — thin orchestrator)
├── slide-canvas-utils.js     (pure math functions)
├── canvas-rulers.jsx
├── canvas-grid-overlay.jsx
├── canvas-rubber-band.jsx
├── canvas-zoom-controls.jsx
├── canvas-context-menu.jsx
├── canvas-footer-overlay.jsx
├── canvas-drop-zone.jsx
├── canvas-element.jsx        (~200 LOC — cắt từ 391)
├── crop-overlay.jsx          (~80 LOC — cắt từ 138)
└── element-renderers/
    ├── shape-renderer.jsx
    ├── table-renderer.jsx
    ├── text-renderer.jsx
    ├── image-renderer.jsx
    ├── code-renderer.jsx
    ├── chart-renderer.jsx
    ├── latex-renderer.jsx
    ├── markdown-renderer.jsx
    ├── callout-renderer.jsx
    ├── icon-renderer.jsx
    └── video-renderer.jsx
```

**5-phase migration plan:**

| Phase | Action | Effort |
|---|---|---|
| 1 | Extract 11 element renderers → `element-renderers/*.jsx` | 4-6h |
| 2 | Extract CanvasElement + CropOverlay | 2-3h |
| 3 | Extract 7 canvas chrome components | 3-4h |
| 4 | Extract 3 interaction hooks (use-canvas-interaction, use-canvas-keyboard, use-clipboard-canvas) | 6-8h |
| 5 | Group 30+ props → ~15, simplify SlideCanvas orchestrator | 2-3h |

**Total: ~17-24h | Target: SlideCanvas.jsx ~400 LOC**

**Key insight:** `markdownToHtml` nên di chuyển vào `shared/src/` để element renderers có thể import được. 3 clipboard implementations cần unify TRƯỚC khi decompose.

**Verdict: MUST DO.** Unblocks every other Phase C/D/E/F work.

---

### Feature 2: Custom Keyboard Shortcuts

**Current state:** `use-keyboard.js` = 146 LOC. 10 hardcoded shortcuts, switch-based, no registry, no conflict detection, no customization.

**Gap analysis:**
- No extensible registry — adding new shortcut = modify hook
- No custom shortcut support
- No conflict detection
- No shortcuts help dialog
- No per-context shortcuts (canvas vs. slide sorter)
- Toolbar button titles reference shortcuts as hardcoded strings, not bound to registry

**Research findings:**
- `hotkeys-js` (15KB): tldraw uses it — powerful but adds bundle
- **DIY approach (0KB):** Enough for ~33 shortcuts, pattern well-documented
- Figma uses custom system; Notion uses `useHotkey` pattern

**Proposed data model:**
```js
// Shortcut schema
{
  id: 'copy',
  label: 'Copy',
  category: 'clipboard',      // clipboard | editing | navigation | canvas | presentation
  defaultKey: 'Ctrl+C',
  userKey: null,              // null = use default
  scope: 'canvas',            // canvas | sorter | all
  when: '!isEditing'          // guard condition
}
```

**Storage:** Only user overrides in localStorage. Defaults in code.

**Key decision:** Use `e.code` (physical key) over `e.key` (character) for international keyboard support.

**UI:** New section in SettingsPage — tabs by category, recording mode (press key to capture), platform-aware display (Ctrl vs Cmd), import/export JSON, reset to defaults.

**Verdict: WORTH DOING.** ~3-5 days. Zero new dependencies. DIY registry pattern.

---

### Feature 3: Slide Master / Reusable Layout Templates

**Current state:** 19 built-in templates in `slide-templates.js`. No user-defined masters. `showMasterPanel` state already reserved at `EditorPage.jsx:187` — confirms prior design intent.

**What is a Slide Master?**
- Master slide = template defining default layouts, colors, fonts, backgrounds, placeholders
- Layout = specific arrangement of placeholders on a master
- Theme = collection of masters + colors + fonts

**3 options analyzed:**

| | Option A: Simple Template | Option B: Full Master | Option C: Hybrid |
|---|---|---|---|
| User creates master | No | Yes | Yes |
| Layout inheritance | No | Yes | Yes |
| Override master per-slide | N/A | Hard | Soft (break-tie) |
| Complexity | Low | High | Medium |
| Effort | 1 week | 4 weeks | 2-3 weeks |

**Recommended: Option C — Hybrid**

**Data model:**
```js
// SlideMaster
{
  id: 'uuid',
  name: 'Corporate Blue',
  background: { type: 'solid', color: '#1E3A5F' },
  defaultElements: [...],        // placeholder elements
  layouts: ['title', 'content', 'two-column', 'blank'],
  createdAt: timestamp
}

// Slide (extend)
{
  ...existing fields...,
  masterId: 'uuid|null',        // null = standalone
  layoutKey: 'content|null',    // which layout variant
  overrides: {                  // slide-specific overrides
    background: null,            // null = inherit from master
    elements: [...]             // slide-specific elements (z-index 1000+)
  },
  brokenFromMaster: false       // true = no longer inherits
}
```

**Z-index strategy:** Master elements get z-index 1-999, slide-specific elements get 1000+. Prevents overlap conflicts.

**Core functions:**
- `resolveSlideContent(slide)` — merges master + overrides
- `breakFromMaster(slideId)` — converts to standalone slide
- `applyMaster(slideId, masterId)` — re-link to master

**UI design:**
- Slide Master Panel (new panel in Properties sidebar)
- Master Edit Mode (edit master → all slides update)
- Layout tab bar (title/content/blank variants)
- Slide-level controls: "Edit Master", "Break from Master", "Reset to Layout"
- Visual indicators: chain icon (linked), broken chain (broken)

**Impact on export:**
- PPTX: LOW — masters are metadata, export unaffected
- HTML: MEDIUM — reveal.js renders merged content, masters transparent
- PDF/SaveLoad: transparent

**Effort: ~5 weeks (23 days)**

**Verdict: WORTH DOING.** First-in-reveal.js-space. True differentiation. Low-medium risk with Option C.

---

### Feature 4: Advanced PPTX Import Fidelity (Phase E)

**Current pipeline:**
```
Upload (.pptx) → server (multer) → worker (fork child) → pptxtojson → mapper → NavSlides schema
```

**What Phase 1 maps successfully:**

| Element | Status | Notes |
|---|---|---|
| Text | Full | Font, color, bold/italic, alignment, hyperlinks |
| Images | Full | Base64 extracted by pptxtojson |
| Shapes | Full | All 16 shape types |
| Tables | Full | Column widths, row spans, styling |
| Charts | **Placeholder** | Type mapped, data NOT extracted |
| SmartArt | **Placeholder** | Completely skipped |
| Equations | **Placeholder** | OMML not converted |
| Groups | **Flat** | Hierarchy lost |
| Animations | **Ignored** | No reveal.js equivalent |

**Critical gap found:** Charts embed Excel data inside `.xlsx` files. `pptxtojson` does NOT extract the embedded spreadsheet data. Charts render as placeholder with only the chart TYPE known (bar, line, pie, etc.), not the actual DATA.

**OOXML structure insight:** PPTX is a ZIP file. Charts live at `ppt/charts/` with embedded `.xlsx` files at `ppt/embeddings/`. We need to extract the embedding, parse the Excel sheet, convert data to Chart.js format.

**Enhancement architecture (hybrid):**
```
Simple elements (text, images, shapes, tables)
  → pptxtojson + enhanced mapper (JS side)
  → Enhanced fidelity (better styling mapping)

Complex elements (charts, SmartArt, equations)
  → Playwright rasterization (existing endpoint)
  → Image element with data table below
  → OR: Server-side Python (python-pptx + openpyxl) → REST API
```

**For charts specifically:**
- Option A: Extract via JSZip + custom xlsx parser (no new deps) → Chart.js recreation
- Option B: Playwright screenshot + tabular data below
- Option C: Locked placeholder with original chart image

**Recommendation: Option A (JSZip xlsx parser)** — no new dependencies, works in Node.js, extracts embedded Excel data.

**For SmartArt:** Always rasterize via Playwright — too complex to parse XML.

**For equations (OMML → LaTeX):** Use `omml2mathml` library or convert to image.

**Effort: 15-24h across 5 sub-tasks**

**Verdict: HIGH PRIORITY.** Top user request. Charts as data (not just image) is the key enhancement.

---

### Feature 5: PDF Import

**Current state:** `pdf-import.js` uses `pdfjs-dist` for rasterization — converts each PDF page to canvas image, creates one slide per page. **Lossless visual, no text editing possible.**

**Library comparison:**

| Library | Layout Analysis | OCR | Text Extraction | Images | Tables | Best For |
|---|---|---|---|---|---|---|
| pdfjs-dist | No | No | Yes (no layout) | Yes | No | Current (raster mode) |
| pymupdf (Python) | Yes | Yes | Yes (layout-aware) | Yes | Yes | **Gold standard** |
| pdfminer | No | No | Yes | Yes | Partial | Text-heavy PDFs |
| camelot | No | No | No | No | Yes | Tabular PDFs |
| pdfplumber | No | No | Yes | Yes | Yes | Tables |

**Key insight:** `pdfjs-dist` (current) CANNOT do layout analysis. It extracts raw text streams with positional data, but the user must reconstruct layout from coordinates.

**Proposed: Two-mode system**

```
PDF Upload
  → User chooses: "Visual (fast)" or "Editable (slow)"
  
  VISUAL MODE (current, improved)
  → pdfjs-dist canvas render
  → Per-page slide with image element
  → Instant, lossless, no text editing
  
  EDITABLE MODE (new)
  → pymupdf server-side (Python runtime)
  → Extract text blocks with coordinates
  → Detect tables via camelot
  → Extract images
  → Convert to NavSlides elements
  → Send JSON to client
  → Tesseract.js for OCR on scanned pages
```

**Key decisions:**
- **Server-side Python** (pymupdf + camelot + tesseract): Better layout analysis than any JS library
- **Python bundled with Electron?** Decision needed — affects app size
- **Per-page vs. per-block:** Per-page = simpler, one slide per PDF page; Per-block = more granular
- **Table detection threshold:** Need to define acceptable accuracy

**Effort: 14-21h across 5 sub-tasks**

**Verdict: WORTH DOING.** Complements PPTX import. Users consistently ask for PDF import.

---

### Feature 6: Presentation Analytics

**Current state (partial):**
- Backend: records totalViews + events[] in `analytics.json`
- API: GET `/api/analytics/:id`
- Frontend: AnalyticsModal shows total views, daily bar chart, by-token breakdown
- **Critical gap:** Live session events (slidechanged, fragmentshown, time-on-slide) are broadcast via Socket.IO but NEVER persisted

**Data pipeline — proposed 3-source system:**

```
1. SHARE LINK VIEWS (existing, extend)
   → Record: timestamp, referrer, token
   → Extend: user agent, country (if geoip available)

2. LIVE SESSION TRACKING (new)
   → Socket.IO events: join, slidechange, fragment, end, disconnect
   → Persist per session: { sessionId, viewerId, joinTime, events[], dropOffSlide }
   → Track: navigation order, time-per-slide, drop-off points

3. STANDALONE HTML (new)
   → Inject analytics beacon in exported HTML
   → POST to /api/analytics/beacon with slide view data
   → Requires: presentation ID in exported HTML
```

**Data model extension:**
```js
// analytics.json schema extension
{
  id: 'presentation-id',
  totalViews: 142,
  sessions: [
    {
      id: 'session-uuid',
      token: 'share-token',
      joinTime: '2026-04-26T10:00:00Z',
      endTime: '2026-04-26T10:15:00Z',
      duration: 900,           // seconds
      viewedSlides: [1, 2, 3, 4, 5],  // navigation order
      slideTime: { 1: 30, 2: 15, 3: 20, 4: 25, 5: 10 },  // seconds per slide
      lastSlide: 5,
      dropOff: false          // true if < 50% viewed
    }
  ]
}
```

**UI enhancement (AnalyticsModal):**
- Current: total views, daily chart, by-link breakdown
- Add: Average watch time, drop-off chart (which slides lose viewers), session timeline

**Effort: 1.5-2 weeks**

**Verdict: MEDIUM PRIORITY.** UI already exists, just needs backend data collection. Low complexity incremental addition.

---

### Feature 7: Per-Element Animations

**Current state:** Fragment animations only (reveal.js built-in). One "step" = entire slide elements appear/disappear together. No per-element control.

**Research findings:**
- reveal.js supports CSS animation classes via plugins
- GSAP is powerful but adds ~60KB bundle
- **CSS @keyframes approach** (recommended): no new deps, leverage existing reveal.js infrastructure
- Web Animations API: modern, native, good for emphasis animations

**Animation taxonomy (21 types catalogued):**

| Category | Types |
|---|---|
| Entrance | fade-in, slide-up, slide-down, slide-left, slide-right, zoom-in, bounce-in |
| Exit | fade-out, slide-up-out, zoom-out |
| Emphasis | pulse, shake, wiggle, spin |
| Motion paths | fly-in, fly-out |
| Text | type-writer, highlight |

**Technical approach:**
```js
// CSS injection — no GSAP needed
// shared/src/animation-css.js
export const KEYFRAMES = {
  'slide-up': `@keyframes animSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
  'fade-in': `@keyframes animFadeIn { from { opacity: 0; } to { opacity: 1; } }`,
  'zoom-in': `@keyframes animZoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`,
  // ... etc
};

// Usage in reveal.js export:
// <section>
//   <p class="fragment" data-animate="slide-up" data-animate-delay="200">Content</p>
// </section>
```

**Data model:**
```js
// Element extension
{
  type: 'text',
  animation: {
    type: 'slide-up',         // 'none' | animation type
    delay: 200,               // ms
    duration: 400,            // ms
    easing: 'ease-out'
  }
}
```

**UI:** Extend AnimationTimeline — 3 columns (element, animation type, timing). Show per-element animation below fragment timeline.

**Reveal.js integration:** Custom plugin that reads `data-animate` attributes and applies CSS classes at correct fragment step.

**Effort: 2 weeks**

**YAGNI risk: MEDIUM-HIGH.** Most presentations don't use complex animations. Recommend building animation infrastructure first (CSS library + data model), then defer UI to later phase.

**Verdict: DEFER.** Build infrastructure in Phase C (extract element renderers), add animation support later.

---

### Feature 8: MCP Server Integration

**Current state:** None. Zero MCP infrastructure.

**What MCP offers:**
```
MCP Server (NavSlides)
├── Tools
│   ├── create_slide(presentationId, content, position)
│   ├── update_element(elementId, changes)
│   ├── delete_element(elementId)
│   ├── export_pptx(presentationId)
│   ├── import_pptx(filePath)
│   ├── generate_outline(topic, slideCount)
│   ├── apply_theme(themeId)
│   ├── add_element(type, properties)
│   └── get_presentation(id)
├── Resources
│   ├── presentation://{id}      (full JSON)
│   ├── slides://{id}/{n}        (specific slide)
│   ├── templates://             (template gallery)
│   └── themes://                (theme list)
└── Prompts
    ├── create_presentation(topic) → slides + elements
    └── improve_slide(slideId)    → suggestions
```

**Architecture options:**

| Option | Approach | Effort | Complexity |
|---|---|---|---|
| A | `packages/mcp/` npm package (Streamable HTTP) | 1-2 weeks | Medium |
| B | MCP server proxy via existing Express (stdio) | 3-4 days | Low |
| C | Separate process, dedicated MCP server | 2 weeks | High |

**Recommended: Option B** — add MCP endpoint to existing Express server using `@modelcontextprotocol/sdk`. Minimal new infrastructure.

**Audience:** Developers building AI agents on top of NavSlides. Very niche.

**Effort: 1.5-2 weeks**

**Verdict: SKIP for v1.x.** Too niche. Revisit only if enterprise interest emerges. MCP infrastructure is easy to add later.

---

## PART 2: FEATURES TO SKIP (DEEP REASONING)

### Real-time Multi-user Collaboration
**Technical reality:** NOT just "add WebSockets." Requires Yjs/Automerge migration of entire Zustand store, custom bindings for all 17 element types, persistence provider, awareness protocol. Complexity: 3-6 months minimum.

**Why skip:**
1. File-lock persistence cannot support distributed writes
2. 17 element types × 10-20 mutable properties = massive state model
3. Identity conflict: "no-account, privacy-first" vs. multi-user requires accounts
4. No open-source slide editor has solved this well (Strut revival is unknown)

**Moderate alternative:** Async collaboration via shareable edit tokens — changes sync on page reload.

**Verdict: SKIP indefinitely.**

---

### AI "Vibe Editing"
**Technical reality:** LLM must understand full slide state, generate valid data model edits, preserve layout integrity, handle undo. Non-deterministic output means users can't predict results.

**Why skip:**
1. Non-deterministic UX — undo complexity multiplies
2. Data model coupling — any refactor breaks AI layer
3. banana-slides does it better with Gemini integration
4. Half-baked integration = confusion, not value

**Moderate alternative:** Add a simple AI assistant panel (sidebar) that generates slide CONTENT (text, outline) that user manually inserts — not autonomous editing.

**Verdict: SKIP.**

---

### Zone-Based AI Redraw
**Technical reality:** Requires Gemini image gen API, zone detection (DOM parsing + bounding boxes), structured data vs. raster mismatch, high cost per call ($0.01-0.05 per slide region).

**Why skip:**
1. Banana-slides is the only tool doing this — unproven user demand
2. Structured presentation data (JSON elements) doesn't map cleanly to raster zones
3. User editing is faster than AI redraw for most changes
4. API cost + complexity + latency

**Verdict: SKIP.**

---

### Plugin/Extension Marketplace
**Technical reality:** Requires sandboxing (iframe or Web Workers), security review pipeline, version compatibility matrix, discovery UI, plugin API surface. This is a separate product, not a feature.

**Why skip:**
1. Security minefield (XSS in user-submitted plugins)
2. Versioning nightmare (plugin vs. app version compatibility)
3. No open-source presentation editor has this
4. Would split development into "core" + "platform" teams

**Verdict: SKIP.**

---

### Mobile/Tablet Editing
**Technical reality:** WYSIWYG touch editing requires completely different interaction layer (touch gestures, no hover states, different resize/rotate UX). All canvas interaction code would need mobile-specific rewrite.

**Why skip:**
1. Desktop is where presentations are CREATED; mobile is for viewing
2. Figma/Canva struggle with mobile editing parity
3. Explicitly non-roadmap per project identity
4. Focus on desktop PRESENTATION quality instead

**Moderate alternative:** Improve mobile PRESENTATION experience (swipe navigation, presenter notes view).

**Verdict: SKIP.**

---

### TypeScript Full Migration
**Technical reality:** 4-8 months for 20% benefit. JSDoc + IDE support covers 80% of type safety.

**Why skip:**
1. No user-facing benefit — only contributor experience
2. Full migration = months of churn with no feature progress
3. JSDoc + `ts-check` provides most compile-time safety incrementally
4. Phase C decomposition is prerequisite anyway

**Moderate alternative:** Add `ts-check` to key files (stores, utils) incrementally — gradual type adoption without full rewrite.

**Verdict: SKIP for now.**

---

### Cloud SaaS
**Technical reality:** gamma.app and Tome are venture-backed with massive teams. Self-hostable + SaaS = two products to maintain.

**Why skip:**
1. Brand suicide — "self-hostable, no tracking" is the identity
2. Server costs, uptime SLA, auth system, billing integration
3. Crowded market with well-funded incumbents
4. Docker + Electron cover 95% of hosting needs

**Verdict: SKIP.**

---

### Multi-Format Canvas (WeChat, Xiaohongshu, etc.)
**Technical reality:** Each format = different dimensions, different element sizing, different export pipeline. 10 formats = 10× export testing burden.

**Why skip:**
1. Turns presentation editor into graphic design tool
2. Niche market (China-focused)
3. No user demand data for Vietnam market
4. Bloat codebase + UI with options 95% never touch

**Verdict: SKIP.**

---

### Presentation Recording
**Technical reality:** MediaRecorder API limitations (audio sync issues, cross-browser differences), file storage (large video files), quality inferior to OBS, no editing capability.

**Why skip:**
1. OBS, Loom, Screencastify do this free and better
2. MediaRecorder has fundamental quality limitations
3. File storage on server = cost + cleanup + abuse
4. Not a core editing feature

**Verdict: SKIP.**

---

## PART 3: DECISION MATRIX

| Feature | Verdict | Effort | Impact | YAGNI Risk | Priority |
|---|---|---|---|---|---|
| Phase C: SlideCanvas Decomposition | **DO** | 17-24h | Unblocks all | ZERO | P0 |
| Custom Keyboard Shortcuts | **DO** | 3-5 days | Medium | LOW | P1 |
| Slide Master | **DO** | ~5 weeks | High | MEDIUM | P1 |
| Advanced PPTX Import (Charts) | **DO** | 15-24h | High | LOW | P1 |
| PDF Import (Editable Mode) | **DO** | 14-21h | Medium | LOW | P2 |
| Presentation Analytics | **DO** | 1.5-2 weeks | Medium | MEDIUM | P2 |
| Per-Element Animations | **DEFER** | 2 weeks | Medium | MEDIUM-HIGH | P3 |
| MCP Server Integration | **SKIP v1.x** | 1.5-2 weeks | Low | MEDIUM-HIGH | Later |
| Real-time Collaboration | **SKIP** | 3-6 months | High | HIGH | Never |
| AI Vibe Editing | **SKIP** | 3+ months | High | HIGH | Never |
| Zone-Based AI Redraw | **SKIP** | 3+ months | Medium | HIGH | Never |
| Plugin Marketplace | **SKIP** | 2+ months | Medium | HIGH | Never |
| Mobile Editing | **SKIP** | 2+ months | Medium | HIGH | Never |
| TypeScript Migration | **SKIP** | 4-8 months | Low | LOW | Later |
| Cloud SaaS | **SKIP** | 6+ months | High | HIGH | Never |
| Multi-Format Canvas | **SKIP** | 2+ weeks | Low | MEDIUM | Never |
| Presentation Recording | **SKIP** | 3+ weeks | Low | MEDIUM | Never |

---

## PART 4: STRATEGIC SYNTHESIS

### NavSlidesEditor's Position

**The unique combination** (no competitor has all of these):
```
WYSIWYG + reveal.js + PPTX export + PPTX import + Live presentation
+ Electron desktop + Self-hostable + Privacy-first + 17 element types
```

**Strategic moats to build:**
1. **PPTX round-trip fidelity** — closer to native PowerPoint = harder to switch away
2. **Slide Master** — first in reveal.js ecosystem
3. **Template ecosystem** — community templates = natural lock-in
4. **Electron packaging quality** — native feel = competitive with desktop apps

### Recommended Implementation Order

```
IMMEDIATE (0-2 weeks):
  1. Phase C: SlideCanvas Decomposition (unblocks everything)
  2. Custom Keyboard Shortcuts (quick win, high satisfaction)

SHORT-TERM (2-6 weeks):
  3. Advanced PPTX Import Fidelity (charts, SmartArt, equations)
  4. Slide Master (Option C — Hybrid)
  5. PDF Import (Editable Mode)

MEDIUM-TERM (6-12 weeks):
  6. Presentation Analytics (extend existing)
  7. Phase D: CI/CD Expansion (Linux + macOS builds)

LATER (post-1.x):
  8. Per-Element Animations (build infrastructure in Phase C)
  9. MCP Server (if enterprise interest emerges)
  10. Gradual TypeScript (add ts-check to stores/utils)
```

### Open Questions (Unresolved)

1. **Slide Master:** Does the user base actually want it, or are built-in templates sufficient?
2. **PDF Import:** Is server-side Python runtime acceptable for the Electron app?
3. **PPTX Charts:** Does pptxtojson already extract some chart data we missed? Need to test with a chart-heavy deck.
4. **Multi-format canvas:** Is there Vietnamese/Chinese market demand for WeChat/Xiaohongshu formats?
5. **TypeScript:** Should we add `ts-check` to key files incrementally, or wait until after Phase C?

---

**Status:** COMPLETE
**Reports compiled from:** 6 deep-dive agents + 1 synthesis report
**Total research time:** ~3.5 hours agent compute
**Files generated:** 6 deep-dive reports + 1 synthesis + 5 agent reports = 12 total
