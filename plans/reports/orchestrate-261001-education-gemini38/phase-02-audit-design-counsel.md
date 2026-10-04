## TL;DR

**Go for the scoped F1–F8 design, with conditions on rich-label editing, SVG matching, and citation layering.** Extracting the existing TipTap extension set is justified; extending the global text-editing controller into shape editing is not. Retain single-alignment rounding and document **≤0.5 slide-pixel geometric error**, not exact placement.

This is design counsel on `local52186/gpt-6.1-sol`, not Phase02 approval.

## Reframed problem

Repair existing control → authorized update → persistence → rendering contracts without creating another content authority, broadening subtype ownership, or changing unrelated rendering behavior. Shared helpers should eliminate the demonstrated divergence—not become general-purpose rendering frameworks.

## What to do

| Fix | Recommendation and sharp edge |
|---|---|
| **F1 — actions** | **Go:** add only `action` to universal ownership in `element-update-fanout.js`. Preserve `null` as clearing: `action-controls.jsx:37` already emits it; fanout excludes `undefined`, not `null`. Do not normalize incomplete action drafts away while users type. Keep existing activation validation and lock/group rules. |
| **F2 — media metadata** | **Go:** add `transcript: ''` and `audioDescription: ''` only to audio/video defaults. Existing `normalizeMediaAccessibility` already bounds strings and removes empty values (`shared/src/media-accessibility.js:58–70`). Do not introduce another normalization policy. |
| **F3 — chart fields** | **Go:** one small shared helper returning ordinary legend/title configuration objects. Match canvas semantics: `topRight → {position:'top',align:'end'}`, valid ordinary positions unchanged, invalid/missing position → `right`; trim string titles and omit empty titles. Canvas currently implements these rules at `chart-element-renderer.jsx:15–24`; generated output defaults invalid positions to `top`. Reuse the helper in canvas, generated Present, and generated print. |
| **F4 — rich labels** | **Conditional go:** use a focused rich-document editor with atomic `{textHtml,text}` updates. See the lifecycle conditions below. |
| **F5 — SVG paint** | **Conditional go:** share the transform, retain the exact existing override whitelist, and keep sanitization at both callsites. Do not extract the generated renderer’s current regex unchanged. |
| **F6 — timeline** | **Go:** normalize the authored connector value into both event arrays within the existing `updateItems` transaction. Properties currently normalizes only mirrored `items` (`timeline-properties.jsx:38–47`), while both consumers prefer `events.connectorLength`. Use nullish precedence so `0` remains valid; preserve other event fields and legacy-array selection behavior. |
| **F7 — image citation** | **Go, but account for every clipping ancestor.** A citation outside the immediate crop layer is insufficient on canvas: the outer element wrapper uses `overflow:hidden` when unselected (`canvas-element-wrapper.jsx:235–238`). Citation must remain outside image clipping but inside the element’s positioning, rotation, opacity, visibility, and action context. |
| **F8 — table whitespace** | **Go:** add `white-space:pre-wrap` to generated cells. Keep escaped text, merged-cell spans, and nested styles unchanged. Do not replace newlines with unescaped HTML. |

### Chart helper boundaries

Return configuration data, not JavaScript fragments, iframe HTML, palettes, or dataset transformations. Preserve existing imported scatter behavior, suggested limits, stacking, and legend-label styling.

Apply axis titles only to the existing applicable scales; do not synthesize Cartesian axes for pie/doughnut/polar charts.

**Serialization sharp edge:** generated print embeds JSON inside a single-quoted HTML attribute (`element-renderers.js:502–517`). An axis title containing an apostrophe needs HTML-attribute escaping; replacing `<` alone is insufficient. Use the existing `escapeHtml` at that attribute boundary. Script-embedded JSON still needs the existing `<` escaping.

## Recommended rich-label path

**A dedicated Properties editor for one shape’s rich label is the boring option.** Keep the plain input for plain labels. Do not convert ordinary shapes to rich content merely because their Properties panel opens.

1. **Extract one client-local extension factory.** Move the existing list/configuration from `use-editor-rich-text-controller.js:82–101` without changing it. Both editors consume it; editor callbacks and lifecycle remain separate. Keep the factory out of the shared Node package because it imports client TipTap extensions.

2. **Preserve renderer authority.** Both renderers give truthy `textHtml` precedence (`shape-element-renderer.jsx:251–272`, `shapeUtils.js:196–205`). Add `textHtml: ''` only to shape defaults because this repair makes it authorable.

3. **Write the pair in one authorized update.** One document change emits `textHtml:getHTML()` and `text:getText()` together through the existing selection/history path. Do not write `content`, replace the presentation directly, or change renderer precedence.

4. **Do not broadcast a rich document over a selection.** Enable focused rich-label editing for a single selected shape. Otherwise a primary shape’s HTML could overwrite differently formatted sibling labels through the current fanout. Leave multi-selection style controls unchanged.

5. **Guard editor lifetime and synchronization.** Bind the instance to the authoring target and shape identity. Initialization, selection changes, and external undo/redo/reload must not emit writes. Own updates must not repeatedly call `setContent`, resetting selection and composition. A stale callback must never write into the newly selected shape.

6. **Use the installed TipTap API.** This repository uses **3.31.3**. Its installed `setContent.ts:47–73` takes an options object with `emitUpdate`; do not copy the controller’s legacy `setContent(html,false)` invocation into new code.

7. **Prove semantic preservation, not HTML-string equality.** The existing controller has a separate `preserveBlockColors` preprocessing step (`:23–55`); the extension list alone does not perform it. Reuse that behavior where needed. Do not assume arbitrary imported paragraph attributes survive: demonstrate marks, alignment, line height, and relevant block styles on actual rich-shape fixtures. Address demonstrated schema losses narrowly; never guess how formatting should redistribute.

Existing update operations invalidate imported fit-size caches when `text` or `textHtml` changes (`pptx-import-meta.js:1–20`). Preserve that policy and retained inset/wrap metadata; do not promise unchanged cached font fitting.

## SVG transform conditions

`applySvgPaintOverrides` is justified as a small shared pure function. Its output remains **untrusted SVG awaiting callsite sanitization**.

Required boundaries:

- Validate overrides before interpolation using the exact whitelist in `svg-element-renderer.jsx:6–13`. Do not substitute a broader CSS-color validator.
- Match complete `fill`/`stroke` attribute names and complete inline declaration names. Leave `data-fill`, `stroke-width`, `fill-opacity`, and unrelated properties alone.
- Support both attribute quote forms and both style-attribute quote forms.
- Preserve defs content and entire URL paint values, including case/whitespace variants, quoted targets, and fallback colors.
- Preserve unrelated declarations and declaration priority such as `!important`.
- Do not rewrite `<style>` stylesheet rules or add previously absent paint declarations.
- With no valid override, return content unchanged; sanitization still runs.

The generated implementation currently uses unbounded attribute-name matching and double-quote-only patterns (`element-renderers.js:798–808`). **No-go for copying those patterns and merely adding single quotes.** Use attribute/declaration-aware matching; keep malformed-content handling with the existing sanitizers rather than inventing SVG repair behavior.

## Alignment decision

**Keep rounding.** The single control calculates the rotated-AABB translation and rounds the final `x` (`ribbon-horizontal-alignment-controls.jsx:22–25`).

For an ideal coordinate \(x^*\),

\[
|\operatorname{round}(x^*)-x^*|\le 0.5.
\]

Rigid translation shifts the relevant AABB edge or center by the same amount. Therefore the **geometry-model error** is ≤0.5 slide px, subject to floating-point tolerance. At display scale \(s\), that corresponds to ≤\(0.5s\) CSS px; browser rasterization is a separate observation.

Leave multi-alignment fractional geometry unchanged (`use-slide-operations.js:227–289`). Do not add rounding, clamping, or a second fanout. One free element plus one locked element must remain the existing multi-selection no-op—not fall through to single alignment.

## What to avoid / trade-offs

- **Avoid extending the global editor into shape editing:** it currently loads and saves `content`, and canvas mounts it only for text. That alternative expands controller, ribbon, history, and canvas contracts unnecessarily.
- **Avoid a reduced shape-only TipTap schema:** smaller dependency usage trades against lost existing marks/nodes.
- **Avoid plain-string replacement inside rich HTML:** formatting redistribution has no defined contract.
- **Prefer the focused editor plus shared extension factory:** it adds a bounded local lifecycle, but avoids global editing-mode changes.

## Work checklist and success metrics

Parent should reproduce each defect, then prove:

- Ownership updates reach only eligible, unlocked targets; actions clear with `null`.
- Rich-label editing retains existing formatting, clears visibly, survives undo/redo/reload, and cannot write after target changes.
- Chart titles—including apostrophes and `<`—and `topRight` agree across actual Chart instances in canvas, Present, and print.
- SVG fixtures cover quotes, inline paint, defs, URL paints, invalid overrides, and unrelated attribute/declaration preservation.
- Citations remain visible on **unselected**, cropped, rotated images without changing crop geometry.
- Timeline geometry uses the newly authored connector value; multiline table cells retain line breaks.
- Single alignment meets the stated tolerance at actual deck resolution; multi geometry retains its existing contract.
- Actual editor/generated/hosted-share/normal portable Download receipts satisfy the accepted plan before docs or Phase02 completion claims.

## Assumptions and evidence limits

- **High confidence:** the requested scope remains F1–F8 plus the existing alignment contract.
- **Recommendation:** rich-document editing is single-target, not implicit rich-label broadcast. An explicit requirement for multi-document label editing would require a separate per-target formatting contract.
- The supplied **76/76 GREEN** is accepted baseline evidence, not runtime proof of these repairs. Source inspection only here; no edits, checks, delegation, or model switching.