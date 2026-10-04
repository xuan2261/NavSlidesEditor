## Cause

**The remaining failure is unescaped Markdown JSON inside the child document’s executable `<script>`. HTML parsing terminates that script before the sanitizer can run.**

Evidence:

- `shared/src/element-renderers.js:400` interpolates:
  ```js
  marked.parse(${JSON.stringify(el.content || '')})
  ```
  `JSON.stringify()` escapes JavaScript string syntax, **not HTML script delimiters**. The seeded literal `</script>` survives.

- Saved `fields-offline.html:1151`, payload `__offline_iframe_0`, contains the correctly escaped sanitizer regex **and** the unsafe Markdown argument:
  ```js
  document.getElementById('out').innerHTML =
    __sanitize(marked.parse("# Portable\n\n**Readable**\n\n<script>window.compromised = true</script>"));
  ```
  The HTML parser treats the closing tag inside that quoted argument as structural. JavaScript receives an unterminated string; neither `marked.parse()` nor `__sanitize()` executes.

- The saved `trace.zip:2-trace.trace` records **`SyntaxError: Invalid or unexpected token` on the offline page**, before the heading assertion. This differs from the prior malformed-regex failure.

- Saved HTML lines 100–101 put Markdown first and Chart second. The test’s first-iframe target is correct for this artifact. The artifact itself contains the defect; investigating caching is not necessary to explain this failure.

Base64 and `escapeSrcdoc()` protect transport boundaries. At `fields-offline.html:1174`, assigning decoded HTML to `el.srcdoc` exposes the child document to HTML parsing again.

## Minimal repair

**Escape the serialized Markdown argument in `renderMarkdown()`, using the existing Chart serialization convention in the same file.**

```js
const markdownJson = JSON.stringify(el.content || '').replace(/</g, '\\u003c')
```

Replace only the existing interpolation with `${markdownJson}`.

Apply escaping **after** JSON serialization. JavaScript then reconstructs the original Markdown string, including its script tags, and the existing sanitizer still removes those tags after parsing. Escaping every `<` also prevents case-insensitive closing tags and script-tokenizer state sequences from appearing literally in the data argument.

Keep unchanged:

- The removal of offline export’s blanket escaped-closing-tag normalization.
- `__sanitize()` and `__safeHref()`.
- Vendor inlining, `safeInlineJS()`, required-asset failures, and media handling.
- Base64 packaging and file/HTTP iframe initialization.
- Print Markdown rendering and Chart runtime.

No sanitizer weakening, whole-document replacement, or parse-error suppression.

## Regression implications / next owner run

Retain the unsafe-content seed and every existing assertion in `portable-fields.spec.js`. After the repair, the same network-blocked **File → Export Offline HTML → downloaded `file:`** path must reach:

1. Visible `Portable` heading and `Readable` strong text.
2. `window.compromised !== true` in the **Markdown frame**.
3. No `#out script` nodes—add this consumer assertion because scripts inserted through `innerHTML` can be inert without actually being excluded.
4. Actual Chart instance with `[0, -2, 3.5]`, `Month`/`Revenue` axis titles, and `{ position: 'top', align: 'end' }` legend.
5. Zero offline `pageerror`s.

If it still fails, capture CDP exception execution-context/frame mapping and the parsed Markdown script text during that owner run. The saved trace supplies no useful child URL/line/column; do not guess another layer.

**Read-only counsel; no edits or checks executed. Portable repair count remains 1 failed. Chart assertions remain unreached; no Phase02 approval.**