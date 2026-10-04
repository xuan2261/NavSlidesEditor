## Decision: force-rebuild the owned Vite dependency cache; no source edit

The inspected optimized `revealjs-shared` bundle is stale. Its old renderer removes literal newline boundaries before print highlighting. Current source already contains the cause-directed repair.

Read-only counsel. No edits, checks, browser reruns, delegation, or model switching. No Phase02 approval.

### Evidence: stale renderer explains the exact failure

| Current source | Vite’s optimized dependency |
|---|---|
| `shared/src/element-renderers.js:355-358`: ordinary code uses escaped raw source; walkthrough uses `nohighlight`, `data-noescape`, and line spans | `client/node_modules/.vite/deps/revealjs-shared.js:5541-5559`: **all code** uses `renderCodeLines`; walkthrough retains `language-* nohighlight`; ordinary code retains `data-trim` |
| Current image description has the applied hiding treatment | Optimized renderer at `:5520` still emits an unstyled description span |

The stale bundle’s transform is:

```js
String(el.content || '').split('\n')
  .map(line => /* span containing escapeHtml(line || ' ') */)
  .join('')
```

For the regression fixture, blank lines become single spaces, and adjacent spans contain **no newline separators**. Their combined `textContent` is:

```js
'   const label = "<strong>literal</strong>";   console.log(label); '
```

That matches the supplied failure’s shape. Print highlighting subsequently replaces the ordinary spans with syntax-token markup; it cannot recover the deleted newlines.

**[INFERENCE]** The failed popup consumed this stale optimized dependency. Browser requests were not inspected here, but the on-disk bundle contains the exact obsolete transform that explains the observed output.

### Why Present passed while print failed

- `client/src/utils/generateHTML.js:1,20-21` imports `revealjs-shared` and forwards PDF export to `shared.exportPDF`.
- `shared/src/htmlGenerator.js:772-776` generates print HTML **in the client**, then opens its Blob URL.
- Existing-deck Present opens the API endpoint instead (`htmlGenerator.js:780-789`).
- `server/routes/presentations-extras.js:97-104` generates Present HTML using the server’s loaded shared module.
- `client/vite.config.js:57-59` explicitly prebundles `revealjs-shared`. Cache metadata at `client/node_modules/.vite/deps/_metadata.json:205-209` resolves it to `shared/src/index.js`.

An API restart therefore does not refresh the client’s optimized renderer.

### Generator, sanitization, and print highlighting

No current print whitespace-cleanup defect was found in the inspected path:

- `generatePrintHTML` passes `forPrint: true` to `renderSlideElements` (`htmlGenerator.js:604-609`).
- The dispatcher forwards those options; code rendering has no print-specific content transformation or rich-text sanitization (`element-renderers.js:1019-1056`).
- Ordinary code escapes the original source without trimming or splitting (`:357`).
- Print highlighting targets only `pre:not([data-code-walkthrough]) code` (`htmlGenerator.js:718`); it does not initialize Reveal’s `data-trim` preprocessing.

The newline-loss transform is in the **obsolete optimized renderer**, not current `generatePrintHTML`.

### Smallest repair

Parent should stop and restart **only its owned Vite process**, retaining its existing startup environment and arguments, with `--force` added. Preserve port `55173` and `VITE_API_PROXY_TARGET=http://127.0.0.1:34102`.

Do not edit renderer code, disable ordinary highlighting, weaken exact-source assertions, patch vendor code, or clear unrelated caches. Reload the editor through the fresh test browser context after the forced rebuild.

### Exact verification scope

Run the unchanged regression after that cache repair:

```text
npx playwright test tests/e2e/education/generated-code-image.spec.js --config=.playwright/phase02-manual.config.cjs --project=chromium --workers=1 --retries=0
```

Retain the existing API/client URL environment for `34102`/`55173`.

Required evidence: both actual Present and File → Export PDF pass ordinary exact source—including blank lines, indentation, HTML literals, and syntax tokens—plus walkthrough nodes/active styling and hidden accessible description/visible cropped citation. Print walkthrough and image assertions remain unverified because the supplied run stopped at print’s first source assertion.