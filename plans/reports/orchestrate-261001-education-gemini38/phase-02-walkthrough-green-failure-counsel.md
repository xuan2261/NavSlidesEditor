## Decision: remove `language-*` from walkthrough `<code>` only

The vendored highlighter gives an explicit language class **precedence over `nohighlight`**. `data-noescape` protects the spans from Reveal’s initial escaping, but not from highlight.js subsequently replacing them. The previous counsel missed that precedence.

Read-only inspection; no edits, checks, browser reruns, delegation, or model switching. No Phase02 approval.

### Evidence: exact served plugin

The asset chain points to the inspected file:

- `shared/src/reveal-runtime-assets.js:3-11`: Reveal `6.0.2`; highlight asset `/vendor/reveal.js/dist/plugin/highlight.js`.
- `server/index.js:239`: `/vendor` serves `server/vendor`.
- `shared/src/htmlGenerator.js:412,426,433`: loads that asset, registers `RevealHighlight`, calls `Reveal.initialize(revealConfig)`.

In `server/vendor/reveal.js/dist/plugin/highlight.js:1`, bundled highlight.js `11.11.1` recognizes `nohighlight` through:

```js
noHighlightRe: /^(no-?highlight)$/i
languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i
```

However, its language-selection function first checks `languageDetectRe` against the code and parent classes. **If a registered explicit language is found, it returns that language immediately.** Only without that match does it scan class tokens for `nohighlight` or a registered language.

Thus the current renderer output:

```html
<code class="language-javascript nohighlight" data-noescape>
```

selects `javascript`, not `nohighlight`. Reordering those classes does not change the regex-first decision.

In `highlight.js:3`, `highlightElement` then:

1. Resolves the language.
2. Returns early only if the **resolved result** matches `noHighlightRe`.
3. Otherwise reads `textContent`.
4. Assigns highlighted output to `innerHTML`.

That assignment discards renderer-owned `[data-code-line]` spans and their active-line attributes/styles. Because `renderCodeLines` joins block spans with `''`, their extracted `textContent` also lacks newline separators.

**[INFERENCE]** This mutation explains the supplied GREEN failure’s zero line nodes; no new runtime observation was made here.

### Initialization semantics

`highlight.js:13` has two separate stages:

| Stage | Current walkthrough behavior |
|---|---|
| Reveal preprocessing of every `pre code` | `data-noescape` correctly skips HTML escaping; no `data-trim` means no trimming |
| Default on-load highlighting | Calls `highlightBlock`, which calls `highlightElement`; explicit `language-javascript` defeats the local skip class |

`highlightOnLoad` and `escapeHTML` both default to true. The inspected generated configuration does not override either. Neither initialization timing nor Reveal line-number conversion is the source-level cause: walkthrough output has no `data-line-numbers`, while `highlightElement` itself replaces the children.

### Smallest cause-directed repair

Change only class selection in `shared/src/element-renderers.js:355`:

```js
const codeClass = hasWalkthrough
  ? 'nohighlight'
  : `language-${escapeHtml(lang)}`
```

Retain:

- Walkthrough `data-noescape`.
- `renderCodeLines`, per-line `escapeHtml`, active-line styling and walkthrough metadata.
- Ordinary escaped raw source, exact whitespace, explicit language class and normal syntax highlighting.
- Existing print exclusion at `shared/src/htmlGenerator.js:718`.

With no explicit language class on walkthrough code or its current parent, highlight.js resolves `nohighlight` and returns **before reading/replacing the line content**. Reveal preprocessing still preserves the spans through `data-noescape`. Authored text remains escaped by the renderer.

No vendor patch, global disabling, highlighter configuration override, duplicate runtime, or post-initialization span reconstruction is needed.

### Next: parent verification, not phase approval

After that single repair, parent should run the existing actual Present + Export PDF regression. Required evidence:

- Ordinary exact source, whitespace, HTML literals and syntax highlighting still pass.
- Walkthrough line nodes survive Reveal readiness with the selected range’s styling intact.
- The test reaches and passes description/citation and print assertions.

The supplied failed run established only the preceding ordinary-code assertions; walkthrough, image and print completion remain unverified.