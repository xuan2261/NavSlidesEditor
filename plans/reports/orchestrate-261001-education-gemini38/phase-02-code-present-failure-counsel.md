## Decision: GO for scoped repair; Phase02 remains incomplete

Read-only counsel. No edits, checks, browser reruns, delegation, or model switching. Runtime evidence is the supplied actual-Present failure; diagnosis below is grounded in source inspection.

## 1. Code: renderer markup crosses Reveal’s source-code boundary

**Exact cause:**

- `shared/src/element-renderers.js:331-357` emits `<span data-code-line="…">` wrappers **for every code element**, including ordinary code without walkthrough steps.
- Ordinary code receives `language-javascript` and `data-trim`, without `data-noescape`.
- `shared/src/htmlGenerator.js:426` enables `RevealHighlight`.
- The served plugin, `server/vendor/reveal.js/dist/plugin/highlight.js:13`, defaults `escapeHTML` to true. Its `init` processes every `pre code`, escapes literal `<`/`>` in `innerHTML`, then invokes highlighting.

Thus the renderer’s line-wrapper tags become source text. Highlight.js subsequently tokenizes those tags as JavaScript. This directly explains the reported DOM.

**Important second defect:** walkthrough’s existing `nohighlight` does **not** protect its wrappers from Reveal’s initial escaping. Escaping happens before the highlighter decides whether to skip the block.

### Safest repair

Keep two explicit paths in `renderCode`:

| Path | Code body | Reveal handling |
|---|---|---|
| Ordinary code | Escaped authored source, retaining newline boundaries; no line-wrapper HTML | Normal syntax highlighting remains enabled |
| Walkthrough | Existing escaped per-line spans, active-line styling and metadata | Retain local `nohighlight`; add `data-noescape`; retain omission of `data-trim` |

If exact authored whitespace is required, omit `data-trim` from ordinary code too: it deliberately removes leading/trailing blank lines and common indentation.

`data-noescape` is safe on the walkthrough path only because authored line content still passes through `escapeHtml`; renderer-owned spans are the only intended markup.

**Reject:**

- Globally disabling `RevealHighlight` or `escapeHTML`.
- Adding `data-noescape` alone to ordinary wrapper-based code: highlighting consumes text and replaces the wrappers; the current `.join('')` also loses newline boundaries in that text.
- Recovering source from already-corrupted DOM.
- Replacing walkthrough with plain code or inventing a new walkthrough runtime.

Print shares this renderer. Its separate highlighting path is at `shared/src/htmlGenerator.js:717-718`; exercise it rather than assuming Present proves print behavior.

## 2. Image: missing hiding treatment, not another caption

- `shared/src/element-renderers.js:299-312` emits the long-description span outside the image’s clipping layer, followed by the citation.
- The outer wrapper has `overflow:visible`; citation placement is independently `position:absolute;top:100%` at `:268-277`.
- No `.ns-image-long-description` hiding rule exists in the inspected shared generator, editor stylesheet, or `client/public/reveal-overrides.css`.
- Canvas puts the description **inside** the clipping wrapper at `client/src/components/canvas/canvas-element-wrapper.jsx:550-580`. That wrapper normally uses `overflow:hidden`, but switches to `visible` during cropping at `:280-284`.

**Diagnosis:** the canvas screenshot does not prove deliberate visually-hidden styling; clipping can conceal the description accidentally. Generated output exposes it in normal flow below the full-height clip layer, where it can collide with the citation.

Historical intent is not explicitly documented as “visually hidden.” Nevertheless, `aria-describedby`, the separate citation API, and the reported canvas/Present discrepancy support treating this as a defect—not preserving it as an intentional caption.

### Safest repair

Apply a narrow visually-hidden treatment directly to the description spans in the shared renderer and canvas:

- Absolute positioning, 1px dimensions, zero padding/border, clipping, hidden overflow, no wrapping.
- Preserve the description ID and `aria-describedby`.
- Do not use `aria-hidden`, remove the description, or restore outer-wrapper clipping.
- Leave the crop layer and visible citation placement unchanged.

Inline treatment in generated markup covers Present and print without relying on an external stylesheet. No broad CSS refactor is needed.

## 3. Verification and regression to retain

Use the existing `launchPresentPopup` helper in `tests/e2e/education/present-offline-helpers.js`. **These are proposed checks, not executed results.**

After `Reveal.isReady()`:

1. **Ordinary code:** the reported two-line fixture has exact source `textContent`, separate rendered lines, and actual syntax-token styling; no literal wrapper tags appear. Include HTML-like source and a blank line to catch escaping/whitespace damage.
2. **Walkthrough:** actual line nodes survive initialization; their text matches authored lines; the selected default range alone carries active styling. Use a nonzero default step to catch selecting the wrong step.
3. **Image:** accessible description remains `Diagram detail`; description paints no visible text; `Source A` remains visible below the cropped image. Verify screenshot and geometry—not merely DOM presence.
4. **Generated print:** ordinary source and walkthrough lines remain readable; description stays hidden and citation remains visible.

Retain the actual-browser regression because Reveal mutation and painted layout are precisely the uncertainties that static DOM tests missed. Replace the affected source-string assertions in `shared/tests/element-renderers.test.js:183-221` and `shared/tests/htmlGenerator.test.js:112-132` with behavioral coverage; do not re-pin implementation strings.

**Next:** parent performs this bounded repair and captures fresh actual-Present evidence. No phase approval until both paths pass.