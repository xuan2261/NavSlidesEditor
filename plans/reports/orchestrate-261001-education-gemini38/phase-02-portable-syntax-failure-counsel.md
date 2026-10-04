## Diagnosis

**The portable export corrupts the Markdown iframe’s sanitizer regex. This is a real script parse failure, not a missing-chart diagnosis.**

Evidence chain:

1. `shared/src/element-renderers.js:399` generates a valid sanitizer expression inside the Markdown document:
   ```js
   .replace(/<script[\s\S]*?<\/script>/gi, '')
   ```
   Its template literal correctly preserves the regex’s escaped slash.

2. `client/src/utils/offlineExport.js:193`, in `inlineSrcdocDeps()`, rewrites **the entire iframe document**, including executable JavaScript:
   ```js
   inner = inner.replace(/<\\\//g, '</')
   ```
   That turns the expression into:
   ```js
   .replace(/<script[\s\S]*?</script>/gi, '')
   ```

3. The saved `.playwright/phase02-manual/all19-portable.html:1190` contains this broken expression in the Base64 payload for `__offline_iframe_0`—the Markdown frame. A targeted encoded-byte search matched the malformed regex sequence.

4. When the bootstrap assigns that document to `el.srcdoc` on `file:` (`all19-portable.html:1215-1219`), the HTML parser encounters the newly introduced literal `</script>` and terminates the script **inside its regex**. JavaScript receives an unterminated regex, explaining `Invalid regular expression: missing /`.

Base64 protects the **parent** script during storage, not the **child** script when its document is parsed. The reported `Reveal.isReady() === true` is consistent with a child-frame parse failure.

## Smallest bounded repair

**Remove the blanket normalization and its comment at `offlineExport.js:192-193`.**

The vendor-script matchers at lines 198 and 213 already accept escaped or ordinary closing-script tags. They can consume those structural tags without modifying regexes or strings elsewhere in the document.

Keep unchanged:

- Markdown sanitizer and content escaping.
- Vendor inlining and required-asset failure behavior.
- Base64 packaging.
- `file:` → `srcdoc` and HTTP(S) → Blob initialization.
- `safeInlineJS()` protections.

No error suppression, Markdown special case, or chart-runtime rewrite is warranted.

## Chart evidence

`canvas[data-chart-config]` is the **print renderer’s** selector (`element-renderers.js:499-514`).

Present/offline instead emit a chart **iframe** containing `canvas#c` and `new Chart(...)` (`element-renderers.js:517-524`). The saved artifact has:

- Chart iframe: `all19-portable.html:113`, `data-offline-id="__offline_iframe_1"`.
- Corresponding embedded Chart.js payload: line 1191.

Thus, `[]` from the parent-document print selector does **not** establish a missing chart. Actual offline plotting remains unverified. The saved offline screenshot shows the first slide, not the chart slide.

## Repair-owner verification scope — not executed

- Regress through the real generator → offline-export path with a Markdown element. Parse the resulting child HTML before checking its script; compiling the unparsed document’s script text alone can miss HTML-parser truncation.
- Confirm rendered Markdown content and sanitizer behavior, rather than pinning generated source strings.
- Regenerate through **File → Export Offline HTML**; open the new file with HTTP(S) blocked and require zero `pageerror`s.
- Navigate to the chart slide. Inspect `iframe[data-offline-id="__offline_iframe_1"]`, then its `canvas#c` and child-window `Chart.getChart(canvas)`. Verify plotted values `0, -2, 3.5`, axis titles `Month`/`Revenue`, and the expected top-right legend placement.
- If exact browser attribution is needed, capture CDP `Runtime.exceptionThrown.exceptionDetails` URL, line, column, and execution context, mapped to the frame. No browser line/column was captured here; parent payload line 1190 is not the child exception location.

**Read-only inspection only. No edits, checks, browser reruns, delegation, or user-data changes. Phase02 portable acceptance remains failed pending repair and runtime proof; no graph/bootstrap/playability claim or Phase02 approval.**