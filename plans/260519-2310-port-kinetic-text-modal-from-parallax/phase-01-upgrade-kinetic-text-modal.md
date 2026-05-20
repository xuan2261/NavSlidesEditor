# Phase 01: Upgrade KineticTextAnimationTemplateSelectorModal

Plan: `port-kinetic-text-modal-from-parallax-overview.md`
Status: pending
Priority: P2 (cherry-pick from sibling repo; UI quality uplift)
Effort: M (1 session)
Risk: 2/5

## Context Links

- Source: `jbirky/parallax-presentations` @ `ce548c5` -- `client/src/components/KineticTextModal.jsx` (464 LOC)
- Stashed source: `plans/reports/_source-KineticTextModal.jsx.tmp`
- Local stub: `client/src/components/kinetic-text-animation-template-selector-modal.jsx` (133 LOC)
- Local test: `client/src/components/kinetic-text-animation-template-selector-modal.test.jsx` (69 LOC, 7 cases)
- Sibling reference (port pattern to mirror):
  - `client/src/components/anime-js-animation-template-selector-modal.jsx`
  - `client/src/components/anime-js-animation-template-selector-modal.test.jsx` (15 cases)
  - `client/src/data/anime-js-animation-templates.js`
- Call site: `client/src/pages/EditorPage.jsx:1882-1887`
- Embed wiring: `EditorPage.jsx:608` (`insertEmbedHtml(html) -> addElement('html', { content: html })`)
- Render path: `shared/src/element-renderers.js:146 renderHtml`, `shared/src/element-renderers.js:499 html: renderHtml`
- Compare report: `plans/reports/xia-compare-260519-parallax-presentations.md`
- Sibling plan: `plans/260519-2114-port-three-modal-from-parallax/`

## Overview

Local has a working but bare stub (133 LOC) that emits an `html` element. The sibling Anime/Three ports established the canonical pattern: split into `data/<feature>-templates.js` + `<feature>-modal.jsx` (each under 200 LOC), use Tailwind, add live preview iframe with `sandbox="allow-scripts"`, AGPL/SPDX header on ported template strings, and 1-arg `onInsert(html)` collapsed from source's 3-arg signature.

This phase brings the kinetic-text modal up to that same bar.

## Key Insights

- **No call-site change.** `EditorPage.jsx:1882-1887` already wires `onInsert={insertEmbedHtml}` and `onClose={() => setShowKineticTextModal(false)}`. Sibling-aligned 1-arg `onInsert(html)` is the existing shape.
- **No new element type.** Output is `html` element, rendered via `shared/src/element-renderers.js renderHtml:146`. Offline export, share-link, PPTX, live viewer all already work.
- **Latent bug to remove.** Current `escapeCssValue()` strips quotes -- corrupts valid font names like `'Playfair Display', serif`. Inside `srcDoc` sandboxed iframe with `allow-scripts` only (no `allow-same-origin`), CSS injection cannot exfiltrate. Drop the helper.
- **AGPL header required.** Per sibling pattern, ported template strings carry `// SPDX-License-Identifier: AGPL-3.0-or-later` + `// Copyright (c) 2026 Jessica Birky` + adaptation note.
- **Pure CSS, no anime.js.** Source uses CSS keyframes only -- no JS animation library. Same applies here.
- **Google Fonts CDN.** Source `@import`s 13 Google Fonts at runtime in the iframe. Same external-dep trust model as Three.js/Anime.js CDN ports. Offline-first vendoring is out of scope (shared gap).

## Requirements

### Functional

- 11 templates: typewriter, word-reveal, revolve, wave, split-flap, fade-cascade, circular, glitch, bounce, stagger-center, custom.
- Each non-custom template renders distinct CSS keyframe animation (no aliasing -- 10 unique HTML outputs).
- Font selector with 13 Google Fonts (Barlow default).
- Weight selector with 9 weights (100-900).
- Bold / Italic / Underline toggle buttons (Lucide icons).
- Color picker for text color.
- Numeric inputs for font size (12-200) and duration (0.3-10s).
- Live preview pane: `<iframe srcDoc sandbox="allow-scripts">` reflects current params with debounced/keyed re-render.
- "Edit as code" button: copies generated HTML into custom-mode textarea, switches selected template to `custom`. Match sibling AnimeModal one-way pattern (not source's bidirectional toggle).
- Custom-mode textarea: `DEFAULT_CUSTOM` scaffold, monospace font, Tab-key inserts 2 spaces.
- Refresh Preview button in custom mode (match sibling).
- Insert button calls `onInsert(html)` (1-arg) and `onClose()`.
- Cancel + close (X) buttons call `onClose()`.

### Non-functional

- Modal file <= 200 LOC (split data into separate module).
- Templates module <= 350 LOC.
- Match Tailwind class naming with sibling `anime-js-animation-template-selector-modal.jsx`.
- All existing 7 test cases continue to pass.
- New test coverage matches sibling AnimeModal test depth (>=14 cases).

## Architecture

### File split

```
client/src/components/kinetic-text-animation-template-selector-modal.jsx    (modal shell -- ~180 LOC)
client/src/data/kinetic-text-animation-templates.js                          (TEMPLATES, FONTS, WEIGHTS, DEFAULT_CUSTOM, generateKineticHtml -- ~280 LOC)
client/src/components/kinetic-text-animation-template-selector-modal.test.jsx (extended -- ~150 LOC, ~14 cases)
```

### Data flow

```
User selects template/params
  v
useState (selected, params, customCode, isEditingCode)
  v
useMemo previewHtml = generateKineticHtml(selected, { ...params, customCode })
  v
<iframe key={previewKey} srcDoc={previewHtml} sandbox="allow-scripts" />
  v
[Insert] -> onInsert(previewHtml) -> EditorPage.insertEmbedHtml -> addElement('html', { content })
  v
shared/src/element-renderers.js renderHtml -> reveal.js iframe-wrapped html element
```

### Module exports (data/kinetic-text-animation-templates.js)

```js
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky
// Template HTML strings ported from parallax-presentations
// (jbirky/parallax-presentations @ ce548c5, AGPL-3.0-or-later).
// Adapted into a NavSlides data module; UI shell rewritten locally.

export const FONTS = [...]      // 13 entries
export const WEIGHTS = [...]    // 9 entries
export const TEMPLATES = [...]  // 11 entries with { id, name, desc }
export const DEFAULT_CUSTOM = `<!DOCTYPE html>...`
export function generateKineticHtml(templateId, params) { ... }
```

### Modal contract

```js
KineticTextAnimationTemplateSelectorModal({ onInsert, onClose, slideW = 960, slideH = 540 })
// onInsert(html: string): void
// onClose(): void
```

`slideW` / `slideH` used only to size the in-modal preview iframe (`slideW * 0.55` / `slideH * 0.55`). Defaulting to standard reveal.js dimensions; EditorPage call site does not need to pass them.

## Related Code Files

### To modify

- `client/src/components/kinetic-text-animation-template-selector-modal.jsx` -- replace stub with port
- `client/src/components/kinetic-text-animation-template-selector-modal.test.jsx` -- extend coverage

### To create

- `client/src/data/kinetic-text-animation-templates.js` -- AGPL-headed templates module

### To delete

(none)

### To verify untouched

- `client/src/pages/EditorPage.jsx` -- import + render call already correct (lines 81, 238, 1505, 1882-1887)
- `shared/src/element-renderers.js` -- `html` element render path unchanged
- `client/src/data/anime-js-animation-templates.js` -- sibling reference, not modified
- `client/src/components/anime-js-animation-template-selector-modal.jsx` -- sibling reference, not modified

## Implementation Steps

1. **Create `client/src/data/kinetic-text-animation-templates.js`:**
   1. Add SPDX + Copyright header.
   2. Export `FONTS` (13 entries, exact strings as source).
   3. Export `WEIGHTS` ([100..900]).
   4. Export `TEMPLATES` (11 entries: id, name, desc).
   5. Define `textStyle(params)` helper (font-weight, font-style, text-decoration assembly).
   6. Define and export `generateKineticHtml(templateId, params)` with switch over the 11 templates from source. Preserve source's exact keyframes for typewriter, word-reveal, revolve, wave, split-flap, fade-cascade, circular, glitch, bounce, stagger-center.
   7. Export `DEFAULT_CUSTOM` (~25 LOC pulse-animation scaffold from source).
   8. Drop `computeElementSize` (out of scope -- 1-arg onInsert).

2. **Rewrite `client/src/components/kinetic-text-animation-template-selector-modal.jsx`:**
   1. Import `TEMPLATES`, `FONTS`, `WEIGHTS`, `DEFAULT_CUSTOM`, `generateKineticHtml` from new data module.
   2. Import `Bold`, `Italic`, `Underline`, `Code2` from `lucide-react`.
   3. Add `slideW = 960, slideH = 540` props with defaults.
   4. State: `selected`, `customCode`, `isEditingCode`, `params` (text, fontFamily, fontSize, fontWeight, bold, italic, underline, color, duration, background).
   5. `useMemo` `previewHtml`. Compute `previewKey` for iframe re-render.
   6. Layout: header (title + Edit-as-code + close), body grid (left: 11 templates 2-col, right: preview iframe + controls).
   7. Controls panel: text input, font select, size number, weight select, duration number, color picker, B/I/U toggle row.
   8. Custom panel (when `isEditingCode || selected === 'custom'`): textarea with Tab handler + Refresh Preview button.
   9. Footer: Cancel + Insert buttons. Insert calls `onInsert(html)` then `onClose()` (match sibling AnimeModal).
   10. Tailwind classes -- mirror sibling's `bg-card`, `border-border`, `text-text-primary`, `bg-hover`, etc.
   11. Iframe `sandbox="allow-scripts"` (no `allow-same-origin`).

3. **Extend `client/src/components/kinetic-text-animation-template-selector-modal.test.jsx`:**
   1. Keep 7 existing assertions (renders templates, default text, calls onInsert/onClose, switches template, custom textarea visible, close X works).
   2. Add: every non-custom template id produces non-empty HTML (10 distinct outputs, no aliasing).
   3. Add: `DEFAULT_CUSTOM` returned verbatim when in custom mode.
   4. Add: Tab key in textarea inserts 2 spaces.
   5. Add: "Edit as code" button copies generated HTML into textarea and switches to custom.
   6. Add: iframe present with `sandbox="allow-scripts"` (no `allow-same-origin`).
   7. Add: bold/italic/underline toggles inject `font-weight`/`font-style:italic`/`text-decoration:underline` into emitted HTML.
   8. Add: font selector change reflects in emitted HTML's `font-family`.
   9. Add: weight selector change reflects in emitted HTML's `font-weight`.
   10. Add: data-module unit tests (mirror sibling): TEMPLATES length 11, custom returns customCode verbatim, DEFAULT_CUSTOM contains `pulse` keyframe, escape-amps-and-lt assertion for text containing `<`/`&`.

4. **Verify build + unit tests:**
   1. `npm run lint`
   2. `npm run build`
   3. `npx vitest run client/src/components/kinetic-text-animation-template-selector-modal.test.jsx`
   4. `npx vitest run client/src/components/anime-js-animation-template-selector-modal.test.jsx three-js-3d-scene-template-selector-modal.test.jsx` (regression check)

5. **Manual smoke (browser):**
   1. `npm run dev`
   2. Open editor, Insert -> Kinetic Text.
   3. Verify each of 11 templates renders distinctly in preview.
   4. Verify font/weight/B/I/U changes reflect in preview without reopening.
   5. Click "Edit as code" -- textarea populates with current generated HTML.
   6. Click Insert -- element appears in slide; in present mode the kinetic animation plays.

6. **Cleanup:**
   1. Remove stashed source: `plans/reports/_source-KineticTextModal.jsx.tmp`.
   2. (Sibling note: `plans/reports/_source-AnimeModal.jsx.tmp` is also stale -- can be removed in same commit if appropriate.)

## Todo List

- [ ] Create `client/src/data/kinetic-text-animation-templates.js` with FONTS/WEIGHTS/TEMPLATES/DEFAULT_CUSTOM/generateKineticHtml + AGPL/SPDX header
- [ ] Replace stub modal with sibling-aligned upgrade (live preview, font/weight/B-I-U toolbar, Edit-as-code, Tab handler, Refresh Preview, Tailwind shell, 1-arg onInsert)
- [ ] Drop the `escapeCssValue` helper (latent bug; not present in source)
- [ ] Extend test file to >=14 cases mirroring AnimeModal test depth (template-content + Edit-as-code + Tab-key + iframe sandbox + B/I/U + font + weight + data-module assertions)
- [ ] Run `npm run lint && npm run build` -- fix any errors
- [ ] Run targeted vitest on modal + sibling modals (regression)
- [ ] Manual browser smoke: each template renders distinct preview; font/weight/B/I/U live-update; Edit-as-code populates textarea; insert places element; present-mode plays animation
- [ ] Delete `plans/reports/_source-KineticTextModal.jsx.tmp`

## Success Criteria

- Modal file <= 200 LOC; templates module <= 350 LOC.
- 11 templates render distinct keyframe animations in preview iframe (verified by test assertion `new Set(htmls).size === 10` for non-custom).
- All 7 existing test assertions still pass.
- New tests bring total to >=14 cases matching sibling depth.
- `npm run lint` clean; `npm run build` clean.
- Manual smoke: kinetic text element inserts and animates in present mode.
- Preview iframe uses `sandbox="allow-scripts"` (no `allow-same-origin`) -- regression-asserted.
- AGPL/SPDX header present on data module.
- No EditorPage call-site change (`EditorPage.jsx:1882-1887` untouched).

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| File size creep beyond 200 LOC | M | Aggressive split: keep all template strings + helpers in data module; modal is shell only |
| Test fragility from element-text matching | L | Use `getByLabelText` / `getByRole` matching sibling pattern (not text-only matchers) |
| `<iframe srcDoc>` doesn't load Google Fonts in jsdom | L | Test asserts emitted HTML *contains* expected font CSS, not actual font rendering. Real-font verification is the manual smoke step |
| AGPL header missing on ported templates | L | Mirror sibling `client/src/data/anime-js-animation-templates.js:1-5` header verbatim |
| Sibling pattern drift if AnimeModal changes mid-port | L | Snapshot AnimeModal at port-start; do not touch it |
| Custom-code regression for users who already inserted kinetic-text elements | L | Output is still an `html` element; existing instances unaffected (their stored HTML is preserved verbatim) |

## Security Considerations

- Preview iframe uses `srcDoc` + `sandbox="allow-scripts"` only (no `allow-same-origin`, no `allow-popups`, no `allow-top-navigation`). User-authored CSS/JS in custom mode cannot escape the modal context or read the parent document.
- Per `README.md:117-130` security model: HTML embeds (including kinetic text output) are trusted author content. Same model applies to inserted slide element after `onInsert`.
- Removing `escapeCssValue` does not introduce new XSS surface: inside the sandboxed iframe, even script execution cannot reach the host document's cookies/localStorage/DOM.
- Google Fonts CDN trust is the same as existing sibling ports (Three.js, Anime.js CDN).
- No new server endpoint, no upload, no auth touch.

## Next Steps

After this phase ships:

1. Update CHANGELOG entry under v1.10.0-pending (bump version per release rules).
2. Optional follow-up: vendor Google Fonts locally for offline export -- shared with sibling Anime/Three modal CDN gap; tracked in a separate plan.
3. Optional follow-up: port `MathGridModal` from parallax-presentations (next xia run).

## Status

**DONE** -- plan ready for `/ck:cook`.
**Summary:** Upgrade the 133-LOC kinetic-text stub to match sibling Anime/Three modal port quality: split into Tailwind modal + AGPL-headed data module, add live preview iframe + font/weight/B-I-U toolbar + Edit-as-code + Tab handler, drop the latent `escapeCssValue` quote-stripping bug, extend tests to sibling depth.
**Concerns/Blockers:** None.
