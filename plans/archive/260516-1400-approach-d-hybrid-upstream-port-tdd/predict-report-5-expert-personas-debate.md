# Predict Report: 5 Expert Personas Debate — Upstream Port

**Date:** 2026-05-17
**Context:** Approach D hybrid upstream port — 19 low/medium commits + 3 deferred groups

---

## Persona 1: Security Engineer

**Top 3 Risks:**
1. Iframe wrapping changes expand attack surface — fragment class injection could bypass sandbox
2. LaTeX direct-render removes iframe sandbox — KaTeX `\htmlClass`/`\href` macros emit raw HTML
3. `window.prompt()` video URL — no URL scheme validation, `javascript:` URLs possible

**Key Recommendation:** Audit KaTeX extensions before porting direct-render. Keep iframe sandbox for client renderer if `\htmlClass`/`\href` active.

**Red Flag:** `content-safety.js` has no KaTeX-specific sanitization. Blocking concern if client renderer loses iframe sandbox.

**Test Strategy:** Unit tests for iframe sandbox attributes. LaTeX XSS test with `\href{javascript:alert(1)}{click}`.

---

## Persona 2: Performance Engineer

**Top 3 Risks:**
1. CSS specificity wars from 11 overlapping commits — more `!important` = fragile cascade
2. Iframe overhead — 6 iframes per slide with 3 charts + 2 HTML + 1 LaTeX
3. SHA-256 dedup on 100MB files — full file read into memory

**Key Recommendation:** Batch 11 CSS into single atomic commit. Create snapshot test for CSS output.

**Red Flag:** `--font-zoom` used in 14 places. Changing base from `16px` to `42px` breaks entire font scaling system. NOT a CSS-only change.

**Test Strategy:** Snapshot test for `generateRevealHTML()` CSS output. k6 load test for upload dedup.

---

## Persona 3: UX/Accessibility Engineer

**Top 3 Risks:**
1. 24 fragment animations in flat dropdown — no visual distinction between slide-up/flip-up/fade-up
2. `window.prompt()` video URL — inaccessible, blocks main thread, no ARIA
3. CSS changes shift text layout — `0.4em` at `2.5em` heading = 16px vs old 6px (2.67x increase)

**Key Recommendation:** Replace flat dropdown with grouped select. Use properties panel URL input, NOT `window.prompt()`.

**Red Flag:** `window.prompt()` video URL input MUST NOT be ported. Existing `MediaLibraryModal` is strictly superior.

**Test Strategy:** Playwright e2e for animation dropdown (24 options), video URL via properties panel.

---

## Persona 4: DevOps/Reliability Engineer

**Top 3 Risks:**
1. No rollback for CSS changes — affects every presentation, no feature flag
2. No test coverage for CSS output path — regressions only visible in browser
3. 19 sequential commits in shared file — failure at #15 requires rebasing #1-14

**Key Recommendation:** Port all 11 CSS as single atomic commit with golden-file test. Use worktree.

**Red Flag:** `shared/` changes take effect in both client and server immediately. CSS break halts both dev workflows.

**Test Strategy:** Vitest `html-generator-css.test.js` with CSS property assertions. Playwright pixel-position test.

---

## Persona 5: Architecture/Tech Lead

**Top 3 Risks:**
1. Client/shared renderer divergence — different DOM structures for same element type
2. LaTeX split-brain — client uses CDN iframe, shared uses local vendor paths
3. Deferred items have hidden dependencies — Timeline/Plugin/Citation code already exists locally

**Key Recommendation:** Dependency map before porting. Order commits by renderer function to avoid conflicts.

**Red Flag:** `element-renderers.js` is 350+ lines, 17 element types. Two ports modifying `renderLatex` will conflict.

**Test Strategy:** Matrix test — render each element type through client AND shared, assert structural equivalence.

---

## Cross-Cutting Consensus

1. **CSS block = highest risk** — golden-file snapshot test mandatory
2. **Do NOT port `window.prompt()`** — use properties panel URL input
3. **Batch into 3-5 atomic commits** — not 19 cherry-picks
4. **Deferred items need dependency audit** — not truly independent
5. **`--font-zoom` system is fragile** — test end-to-end, not just CSS
