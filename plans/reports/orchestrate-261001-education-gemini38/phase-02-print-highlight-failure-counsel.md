## Decision: fix the print highlighter’s API receiver, not its assets

Current `shared/src/htmlGenerator.js:718` already calls **`hljs.highlightElement`**, not `highlightBlock`. The loaded script exports **`RevealHighlight`, a factory**, rather than a standalone `hljs` global.

### Evidence

- `shared/src/reveal-runtime-assets.js:11` resolves the print script to:
  **`/vendor/reveal.js/dist/plugin/highlight.js`**
- That browser bundle’s wrapper assigns `RevealHighlight`.
- Its readable companion, `server/vendor/reveal.js/dist/plugin/highlight.mjs`, establishes the API:
  - `:18835`: the plugin object exposes `hljs: Q`.
  - `:18954-18956`: the default export is a factory, `() => $`.
  - `:824-825`: the embedded engine still implements **both** `highlightElement` and deprecated `highlightBlock`.

Consequently, neither `hljs.highlightElement(...)` nor `RevealHighlight.hljs.highlightElement(...)` is the correct receiver for this vendored runtime.

**[INFERENCE]** In the failed print popup, the unbound `hljs` reference throws `ReferenceError`; `catch(e) {}` suppresses it. This explains preserved raw source with absent syntax tokens. The popup’s exception was not observed during this read-only counsel.

### Minimal cause-directed correction

Inside the existing print `load` handler, replace only its highlighting initialization:

```diff
       // Highlight code blocks
-      document.querySelectorAll('pre:not([data-code-walkthrough]) code').forEach(function(el) { try { hljs.highlightElement(el); } catch(e) {} });
+      var printHighlighter = RevealHighlight().hljs;
+      document.querySelectorAll('pre:not([data-code-walkthrough]) code').forEach(function(el) {
+        printHighlighter.highlightElement(el);
+      });
```

Use the embedded engine directly. Do **not** initialize Reveal for print, alias a global `hljs`, load another highlighter, or retain a swallowed exception.

This preserves the existing walkthrough exclusion. The embedded `highlightElement` reads `textContent` and writes highlighted markup (`highlight.mjs:733-735`); it does not invoke Reveal’s trimming/preprocessing.

### Assets and competing explanations

Examine these exact print resources in the actual popup:

- `/vendor/reveal.js/dist/plugin/highlight.js` — executable highlighter.
- `/vendor/highlight.js/styles/${codeTheme}.min.css` — token appearance only; missing CSS cannot explain absent `.hljs-keyword` elements.

The generator uses synchronous script tags before registering its `load` handler (`htmlGenerator.js:709-718`). Its `<base>` resolves Blob-relative assets to the editor origin. `/vendor` is proxied by Vite (`client/vite.config.js:39`) and served locally by Express (`server/index.js:239`). **No external syntax-highlighting dependency appears in this path.** Runtime response status remains unobserved here.

### Required browser proof

After an authorized correction and forced refresh of the owned Vite optimized dependency, run the unchanged regression:

```text
npx playwright test tests/e2e/education/generated-code-image.spec.js --config=.playwright/phase02-manual.config.cjs --project=chromium --workers=1 --retries=0
```

For that same run, capture popup `pageerror` events and the highlight-script response; attach capture before clicking Export PDF. Required evidence:

- Print highlight script returns successfully.
- No highlighter runtime exception.
- Existing exact-source and `const` syntax-token assertions pass.
- Print walkthrough styling and accessible cropped-image citation assertions are reached and pass.
- Present remains passing.

No edits, checks, browser reruns, delegation, or model switching performed. No Phase02 approval. If print repair attempts have reached three failures, retain the human architecture checkpoint; the separate stale-cache repair does not reset that count.