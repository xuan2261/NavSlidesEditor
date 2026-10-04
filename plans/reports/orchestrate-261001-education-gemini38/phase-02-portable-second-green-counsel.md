## Finding

**The Markdown JSON repair is present in source but absent from the failed export. The optimized Vite module still contains the old renderer.** This GREEN failure did not exercise the repaired serialization.

### Evidence

All saved artifacts below are under  
`test-results/education-portable-fields--9a489-ut-network-or-script-errors-chromium/`.

| Boundary | Observed evidence |
|---|---|
| Source | `shared/src/element-renderers.js:399-400` computes `JSON.stringify(el.content || '').replace(/</g, '\\u003c')` and interpolates `markdownJson`. |
| Optimized module | `client/node_modules/.vite/deps/revealjs-shared.js:5577` still interpolates `${JSON.stringify(el.content || "")}` directly. No `<` escaping on that payload. |
| Failed run’s module request | `trace.zip → 2-trace.network:84` records HTTP 200 for `/node_modules/.vite/deps/revealjs-shared.js?v=4d4a5b7f`, requested by `/src/utils/generateHTML.js`. |
| Actual export | `fields-offline.html:1151`, the Base64 payload for `__offline_iframe_0`, encodes the old call shown below—with literal `<script>` and `</script>` inside the Markdown string. |
| Browser outcome | `trace.zip → 2-trace.trace:107` records an offline-page `SyntaxError: Invalid or unexpected token`. Line 111 shows the 450×300 Markdown frame with empty `#out` and trailing text `"));`. |

The exported payload contains:

```js
document.getElementById('out').innerHTML =
  __sanitize(marked.parse("# Portable\n\n**Readable**\n\n<script>window.compromised = true</script>"));
```

That literal `</script>` terminates the enclosing HTML script before JavaScript can finish parsing. The empty output and exposed `"));` suffix match this failure.

Vite configuration explicitly optimizes `revealjs-shared`; `_metadata.json:205-209` maps it to `shared/src/index.js`.

**Evidence limit:** the trace did not retain the served module’s response body (`size: -1`, no resource file). Nevertheless, the actual export contains the old serialization, and the on-disk optimized renderer matches it. Stale optimized code is the evidence-backed explanation; successful behavior after cache refresh remains unverified.

## Next minimal intervention

**Refresh the client’s optimized dependency; do not change application code again.**

Owner action—not executed here:

1. Restart only the existing Vite client with **`--force`**, retaining port, host, and `VITE_API_PROXY_TARGET`.
2. Before another GREEN attempt, inspect the **served** `revealjs-shared.js` renderer—not merely workspace source. Confirm the Markdown serialization escapes `<`.
3. Confirm the regenerated Markdown iframe payload contains `\u003cscript>` and `\u003c/script>`, rather than literal delimiters inside `marked.parse(...)`.
4. Then run the unchanged portable-fields scenario.

If the served module is repaired but the generated payload remains old, use the previously suggested CDP loaded-script mapping to locate the generator actually used. That diagnostic is not needed before the targeted optimizer refresh.

Keep the sanitizer, hostile Markdown seed, `#out script` assertion, and prior blanket-replacement removal unchanged. Chart assertions were never reached.

**Repair count remains 2. Phase02 remains unapproved.** No edits, commands/checks, browser, or delegation performed. `artifact://315` and `artifact://325` were unavailable; conclusions use the saved local HTML, trace, failure context, source, and optimizer files.