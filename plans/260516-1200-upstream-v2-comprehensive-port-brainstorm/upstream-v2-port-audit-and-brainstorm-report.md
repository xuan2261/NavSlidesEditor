# Fresh Audit: Upstream v2 Comprehensive Port — parallax-presentations → NavSlidesEditor

**Date:** 2026-05-16
**Status:** Complete — awaiting user approval
**Method:** Fresh code-level audit of ALL 142 upstream commits, verified against actual local codebase
**Scope:** Ignore all previous audit results — every commit verified from scratch

---

## 1. Problem Statement

NavSlidesEditor là fork từ `jbirky/parallax-presentations` với lịch sử git không liên quan. Previous audits có thể không chính xác — cần audit lại toàn bộ từ đầu bằng cách đọc actual code, không tin vào reports cũ.

---

## 2. Audit Methodology

4 parallel audit agents, mỗi agent xử lý 1 group:
- **Group A** (commits 1-40): Init, early features, CSS foundations
- **Group B** (commits 41-80): Media, LaTeX, shapes, animations
- **Group C** (commits 81-120): SaaS migration, storage, plugins
- **Group D** (commits 121-142): Timeline, citations, recent fixes

Mỗi agent: `git show <hash> --stat` + `git show <hash>` → then `grep`/`read` local files to verify.

---

## 3. Fresh Audit Results

### 3.1 CONFIRMED PORTED (7 features)

| # | Upstream Commit | Feature | Local Verification | Confidence |
|---|----------------|---------|-------------------|------------|
| 1 | `93816b88` | Copy URL context menu | `canvas-right-click-context-menu-for-slide-elements.jsx:97-188` — `clipboard.writeText()` + `getCopyableMediaUrl` | HIGH |
| 2 | `315eee97` | LaTeX font size control | `misc-properties.jsx:36-48` — `min="8" max="96"`, `value={element.fontSize \|\| 16}` | HIGH |
| 3 | `6d971eb0` | LaTeX font color picker | `misc-properties.jsx:52-58` — `value={element.textColor \|\| '#ffffff'}` | HIGH |
| 4 | `a388d35b` | Video trim controls | `media-properties.jsx:53-78` — start/end time inputs | HIGH |
| 5 | `f7a3a351` | Video playback speed | `media-properties.jsx:82-93` — playback rate input. **NOTE:** .ogv MIME type NOT ported | MEDIUM |
| 6 | `c679c416` | showTableMenu fix | `Toolbar.jsx` — table menu logic present | HIGH |
| 7 | `c9fec531` | Git history browser | Local has snapshot-based version history (different impl, equivalent功能) | HIGH |

### 3.2 CONFIRMED NOT PORTED — Present Mode CSS Fixes (11 commits, CRITICAL)

All affect `shared/src/htmlGenerator.js` lines 146-169. This is the **highest priority gap**.

| # | Commit | Fix | Current Local State | Impact |
|---|--------|-----|---------------------|--------|
| 1 | `5055f3ec` | Auto-animate leak fix: `data-auto-animate-unmatched="fade"` | MISSING — line 67 only has `data-auto-animate` | Auto-animate bleeds to non-auto-animate slides |
| 2 | `87bd4dff` | Cross-slide image bleed: `overflow:hidden` + `contain:paint` | MISSING — no `overflow:hidden` on section | Images visually bleed across slides |
| 3 | `a8bc9ad6` | Force fragments hidden until reveal.js triggers | MISSING — no `.fragment:not(.visible)` rule | Fragments visible before animation |
| 4 | `d800052a` | Fix overview mode: remove `contain:paint` that breaks it | N/A (depends on #2) | Overview mode broken if #2 applied naively |
| 5 | `40c3687b` | Fix edit vs present dimension mismatch | MISSING — no dimension sync CSS | Editor and present mode show different layouts |
| 6 | `af600bd8` | Match export CSS to editor CSS for text spacing | MISSING — export uses different spacing | PDF export doesn't match editor |
| 7 | `975bca4a` | Fix font spacing density and callout position | MISSING — still uses `margin: 0 0 6px` | Text too dense in present mode |
| 8 | `6ffa85ce` | Comprehensive reveal.js theme override | MISSING — no CSS variable resets (`--r-main-font-size`, etc.) | reveal.js themes override custom styles |
| 9 | `f5e6dcaa` | Fix present mode text density and callout alignment | MISSING — no `line-height: normal` on section | Line height inconsistent |
| 10 | `fc2d1c7c` | Fix dense text spacing: force `line-height:normal` | MISSING — still uses `line-height: 1.5` | Text spacing wrong |
| 11 | `1d6e1117` | Fix title slide spacing: remove `!important` from p | MISSING — p still has `!important` | Title slides have wrong spacing |

**Current local CSS state** (`shared/src/htmlGenerator.js:146-169`):
```css
/* Line 149 */ .reveal .slides section { padding: 0 !important; text-align: left !important; }
/* Line 153 */ .reveal .slides section * { text-transform: none !important; letter-spacing: normal !important; }
/* Lines 155-165 */ p: margin: 0 0 6px; padding-left: 24px; line-height: 1.5
/* MISSING: overflow:hidden, contain:paint, fragment visibility, CSS variable resets */
```

### 3.3 CONFIRMED NOT PORTED — Fragment Animations (1 commit)

| Commit | Feature | Current Local State |
|--------|---------|-------------------|
| `8050b08a` | `strike`, `slide-in`, `slide-out`, `flip-in`, `flip-out` fragment animations | `AnimationTimeline.jsx:5-18` only has: fade-in, fade-out, fade-up, fade-down, fade-left, fade-right, grow, shrink, zoom-in, highlight-red, highlight-green, highlight-blue — **NO strike, slide, flip variants** |

### 3.4 CONFIRMED NOT PORTED — Editor Canvas Fixes (2 commits)

| Commit | Feature | Current Local State | Fix Needed |
|--------|---------|-------------------|------------|
| `efcf2632` | Fix cropped images showing full image in editor | `canvas-element-wrapper.jsx:76` — single div, `overflow: hidden` on wrapper but no nested structure | Need nested wrapper divs with `position:relative` |
| `77f6b74b` | Fix iframes on animated slides | `element-renderers.js` — iframe attributes applied directly, no wrapping div | Need container div wrapper for animation compatibility |

### 3.5 CONFIRMED NOT PORTED — Features (6 commits)

| Commit | Feature | Effort | Notes |
|--------|---------|--------|-------|
| `ce548c53` | Line-arrow shape | 2-3h | Local has `line` element type with `LineArrowRenderer` — may be superset |
| `31d8ffbe` | Video from URL (no upload needed) | 3-4h | Need URL input in Toolbar + media properties |
| `edfc1ba5` | LaTeX direct KaTeX render (no iframe) | 3-4h | Upstream bypasses iframe, renders KaTeX directly — may break TikZ |
| `4e225d27` | SHA-256 upload deduplication | 3-4h | `server/routes/upload.js` has NO hash logic |
| `916a63df` | File browser in editor | 4-5h | Need media browser panel in EditorPage |
| `f7261b2c` | Include fonts in export | 2-3h | Feature expansion for PDF/PPTX export |

### 3.6 CONFIRMED NOT PORTED — High-Risk Items (3 groups)

| Group | Commits | Feature | Effort | Risk |
|-------|---------|---------|--------|------|
| Timeline | `9d3288ea` + 9 commits | Timeline element (new slide element type) | 16-23h | Schema change, new renderer, name collision with `AnimationTimeline` |
| Plugin | `e37311be` + 9 commits | Plugin architecture + Manim integration | 42-66h | Trust boundary change, storage rewrite, sandbox, export hooks |
| Citation | `0e7196b6` + 3 commits | Image citation controls | 8-12h | Schema extension needed for `ImageElement` |

### 3.7 NOT APPLICABLE (~60+ commits)

| Category | Commits | Reason |
|----------|---------|--------|
| Stripe billing | ~15 | Self-hosted, no billing |
| Clerk auth | ~5 | No Clerk auth system |
| Landing page | ~10 | Marketing page, not editor |
| VitePress docs | ~20 | Local uses docs/ markdown |
| SaaS migration | ~5 | Product mismatch |
| Merge commits | ~10 | No code changes |

### 3.8 PREVIOUS AUDIT DISCREPANCIES

| Previous Claim | Fresh Audit Finding | Severity |
|---------------|-------------------|----------|
| "px-based text spacing ported (`53173592`)" | **NOT PORTED** — local still uses `margin: 0 0 6px`, `padding-left: 24px`, `line-height: 1.5` | HIGH |
| "Fragment `strike` animation ported (`8050b08a`)" | **NOT PORTED** — `AnimationTimeline.jsx` has no `strike` type | MEDIUM |
| "Video trim + playback speed fully ported" | **PARTIALLY PORTED** — playback speed yes, .ogv MIME type no | LOW |
| "LaTeX font size/color ported" | **CONFIRMED PORTED** | OK |
| "Copy URL context menu ported" | **CONFIRMED PORTED** | OK |

---

## 4. Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| Total upstream commits | 142 | — |
| Not applicable (SaaS/billing/landing/docs) | ~60 | Skip |
| Confirmed ported | 7 | Done |
| Confirmed NOT ported — CSS fixes | 11 | **CRITICAL** |
| Confirmed NOT ported — features | 8 | Important |
| Confirmed NOT ported — high-risk | 3 groups | Deferred |
| Total porting candidates | 19 commits + 3 groups | — |

---

## 5. Proposed Approaches

### Approach A: CSS Fixes First (Recommended)

**Concept:** Fix the most impactful gap first — 11 present mode CSS commits.

**Why first:**
- 11 commits all touch same file (`shared/src/htmlGenerator.js` lines 146-169)
- Affects EVERY presentation in present mode and PDF export
- Low risk — CSS-only changes, no schema/architecture impact
- Can be done in 1 commit (gộp 11 CSS fixes thành 1 logical change)
- Estimated: 8-12h

**Scope:** `5055f3ec`, `87bd4dff`, `a8bc9ad6`, `d800052a`, `40c3687b`, `af600bd8`, `975bca4a`, `6ffa85ce`, `f5e6dcaa`, `fc2d1c7c`, `1d6e1117`

### Approach B: CSS + Canvas + Fragment Animations

**Concept:** CSS fixes + editor canvas fixes + fragment animations.

**Scope:** Approach A + `efcf2632`, `77f6b74b`, `8050b08a`
**Estimated:** 14-18h
**Risk:** Medium — canvas changes affect editor interaction

### Approach C: Full Low/Medium Port

**Concept:** All non-high-risk items.

**Scope:** Approach B + `ce548c53`, `31d8ffbe`, `edfc1ba5`, `4e225d27`, `916a63df`, `f7261b2c`
**Estimated:** 25-35h
**Risk:** Medium-High — server changes, new UI panels

### Approach D: Hybrid — Low/Medium Now + Plan High-Risk Separately

**Concept:** Approach C + deferred plans for Timeline, Plugin, Citation.
**Estimated:** 25-35h now + 70-100h later
**Risk:** Low immediate, high deferred

---

## 6. Risk Assessment

### Risk khi KHÔNG port CSS fixes

| Risk | Severity |
|------|----------|
| Present mode text spacing sai lệch editor | HIGH |
| Auto-animate leak to non-auto-animate slides | HIGH |
| Cross-slide image bleed | MEDIUM |
| Fragments visible before animation trigger | MEDIUM |
| PDF export doesn't match editor | MEDIUM |
| reveal.js themes override custom styles | MEDIUM |

### Risk KHI port

| Risk | Mitigation |
|------|------------|
| CSS regression | Test present mode + PDF export after each batch |
| Merge conflict (manual port) | Upstream monolithic, local decomposed — adapt, don't cherry-pick |
| Breaking tests | Run full test suite after each batch |

---

## 7. Unresolved Questions

1. **CSS consolidation**: 11 upstream CSS commits chồng chéo — gộp thành 1 commit hay giữ riêng?
2. **Line-arrow**: Local đã có `line` element type với `LineArrowRenderer` — upstream `line-arrow` có cần port không?
3. **LaTeX direct render**: Upstream bypass iframe — có ảnh hưởng TikZ support không?
4. **File browser vs Media library**: Local đã có `MediaLibraryModal.jsx` — upstream file browser thay thế hay bổ sung?
5. **Auto-animate fix vs overview fix**: `d800052a` removes `contain:paint` mà `87bd4dff` thêm — cần apply theo đúng thứ tự upstream

---

## 8. Recommended Next Steps

1. **User approves approach** (A, B, C, or D)
2. **Create implementation plan** với `/ck:plan --tdd`
3. **Phase 1**: Safety baseline (backup branch, verify tests pass)
4. **Phase 2**: CSS fixes batch (highest priority)
5. **Phase 3+**: Additional batches per approved approach
6. **Phase Final**: Regression sweep + docs update
