# Brainstorm: Slide Menu Tools + Quarto Clean Template

**Date:** 2026-04-16
**Slug:** slide-menu-tools-quarto-template
**Context:** 2 concerns: (1) verify Slide Menu Tools handlers work, (2) add Quarto clean template to library

---

## 1. Slide Menu Tools — Handlers Analysis

### Current Implementation (presenterTools.js:95-102)

```js
'<li class="slide-menu-item" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()"><span class="km">f</span>Fullscreen</li>' +
'<li class="slide-menu-item" onclick="window.open(location.href.split(\'?\')[0]+\'?receiver\',\'_blank\')"><span class="km">s</span>Speaker View</li>' +
'<li class="slide-menu-item" onclick="Reveal.toggleOverview()"><span class="km">o</span>Slide Overview</li>' +
'<li class="slide-menu-item" onclick="window.open(location.href.split(\'?\')[0]+\'?print-pdf\',\'_blank\')"><span class="km">e</span>PDF Export Mode</li>' +
'<li class="slide-menu-item" onclick="Reveal.configure({view:\'scroll\'})"><span class="km">r</span>Scroll View Mode</li>' +
'<li class="slide-menu-item" onclick="Reveal.toggleHelp()"><span class="km">?</span>Keyboard Help</li>'
```

### Quarto Demo Handlers (extracted from https://grantmcdermott.com/quarto-revealjs-clean-demo/template.html)

Quarto clean theme uses same reveal.js-menu plugin with identical handlers — **verified match**:
- `f` → `document.documentElement.requestFullscreen()` ✅
- `s` → `window.open(location.href.split('?')[0]+'?receiver','_blank')` ✅
- `o` → `Reveal.toggleOverview()` ✅
- `e` → opens `?print-pdf` window ✅
- `r` → `Reveal.configure({view:'scroll'})` ✅
- `?` → `Reveal.toggleHelp()` ✅

### Icon — Fixed
`<i class="fas fa-gear">` (Font Awesome) → inline SVG gear icon (done in commit `6bd6447b`). No external dependency.

### Verdict: ✅ Handlers chính xác, match Quarto demo. Icon đã fix. Cần test thực tế trong browser.

---

## 2. Quarto Clean Template — Analysis

### Theme Characteristics (from markdown + page source analysis)

| Element | Value |
|---------|-------|
| Font (body) | Palatino / Source Sans 3 (via Google Fonts fallback chain) |
| Font (headings) | Palatino / Source Sans 3 bold |
| Background | Dark `#1a1a2e` title slides, white `#f5f5f5` content slides |
| Accent color | `#2980b9` (Quarto blue) |
| CSS variables | Uses `reveal.js` default `--r-*` vars with minimal overrides |
| Aspect ratio | 16:9 |
| Progress bar | 3px, bottom position |
| Slide number | Bottom-right, gray pill background |
| Menu | reveal.js-menu with custom Tools panel (exact same 6 items above) |

### Slide Structure (from markdown extraction)
29 slides total, covers: title, components (lists, alerts, citations, math, columns), appendix.

---

## 3. Proposed Solution

### Task A — Verify Slide Menu Tools (no code change needed)
Current implementation is correct. Only needs browser verification:
1. Enable "Slide Menu & Tools" in Settings
2. Present → open hamburger menu → click Tools tab → test each item

If any handler fails in testing → fix in `shared/src/presenterTools.js`.

### Task B — Add Quarto Clean Template
Create new template entry in `server/data/built-in-templates.json` with:
- **id:** `quarto-clean`
- **category:** `academic`
- **title:** "Quarto Clean Theme"
- **theme:** `white` (base, with custom CSS for dark title slides)
- **customCSS:** Palatino font, dark title slide backgrounds, Quarto blue accents
- **presenterTools:** enabled with all 4 options (mimics Quarto demo)
- **Slides:** copy structure from Quarto demo (title slide, 6-8 content slides showing components)

### Scope Assessment

| Task | Effort | Files |
|------|--------|-------|
| A — Verify Tools (no code) | 10 min test | 0 |
| B — Add Quarto template | 1-2h | 1 (`built-in-templates.json`) |

Two independent tasks → can proceed independently.

---

## 4. Approach for Task B (Template)

### Approach 1 — Copy exact slides from Quarto demo
- Extract 29 slide content from markdown
- Convert to NavSlides JSON format
- Replicate exact typography and colors
**Pros:** Pixel-perfect match
**Cons:** Requires extracting full slide content from 2.4MB markdown file; Quarto-specific features (R code blocks, BibTeX) may not translate well

### Approach 2 — New template with same style (Recommended)
- Create 8-10 representative slides with Quarto clean aesthetic
- Use Palatino/Source Sans fonts, dark title slide, light content slides
- Include same component types: title, lists, alerts, math, columns, appendix
- Enable presenter tools (dark/light toggle, font zoom, slide menu, chalkboard)
**Pros:** Clean, maintainable, showcases all editor features
**Cons:** Not pixel-perfect from original demo

---

## 5. Implementation Plan

### Phase 1: Browser Test Slide Menu Tools
- [ ] Run `npm run dev`
- [ ] Create new presentation → Settings → enable Slide Menu & Tools
- [ ] Present → open hamburger → Tools tab → test all 6 items
- [ ] Fix any broken handler

### Phase 2: Create Quarto Clean Template
- [ ] Add template to `built-in-templates.json`
- [ ] Custom CSS for Palatino font + dark title / light content
- [ ] Create 10-slide structure (title, example slide, components, appendix)
- [ ] Enable all presenter tools as default
- [ ] Verify in browser

### Phase 3: Update docs
- [ ] Update `docs/codebase-summary.md` if template infrastructure changed
- [ ] Add journal entry

---

## 6. Unresolved Questions

1. **Font availability:** Palatino is a system font — Windows/macOS have it, Linux may not. Use Palatino → fallback to Georgia → serif chain?
2. **Quarto-specific content:** The Quarto demo has R code blocks, BibTeX citations, LaTeX tables. Should these be included as-is, or simplified?
3. **Template ID conflict:** If `quarto-clean` already exists in built-in-templates.json → use different ID?

---

**Recommendation:** Approve Approach 2 for template (new, Quarto-style, not copy), proceed with Phase 1 (test) and Phase 2 (add template) as separate work items. Want me to create a plan?