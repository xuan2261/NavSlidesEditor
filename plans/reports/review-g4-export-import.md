# Code Review: Group 4 — Export + Import Pipeline

## Scope
- **Files**: 18 production + 8 test files across export-pptx*, export-project, offlineExport, markdown-import, pdf-import, import-project, pptx-import-summary, api.js
- **LOC**: ~1,800 production LOC
- **Focus**: Export pipeline (JSON/reveal.js HTML, offline HTML, PPTX, PDF) + Import pipeline (markdown, PDF, .navslides archive)
- **Scout findings**: see Section 6

---

## Overall Assessment

The pipeline is well-structured with solid fundamentals: input validation, error boundaries, graceful fallbacks for unsupported elements, and server-side rasterization for complex content. Key concerns center on memory management (unbounded caches), async fire-and-forget in the error path, and a few security surface areas in the import path.

---

## Critical Issues

### 1. HIGH - Async fire-and-forget in fallback error path
**File:** `client/src/utils/export-pptx-renderers.js:61,65`

```js
default:
  await addFallbackElement(slide, element, bounds, warnings, slideNumber)  // async, not awaited
  break
} catch (error) {
  warnings.push(...)
  await addFallbackElement(slide, element, bounds, warnings, slideNumber)  // async, not awaited
}
```

`addFallbackElement` is `async` but called without `await` in both the `default` case and the `catch` block. This means:
- The fallback may not complete before `exportToPptx` writes the file
- Warnings may be pushed after `writeFile` resolves
- For HTML/latex elements falling back, the raster call is fire-and-forget

**Fix:** Either `await` the calls or restructure to not mix async fallbacks in a void context.

---

## High Priority

### 2. HIGH - Unbounded cache growth across exports
**File:** `client/src/utils/export-pptx-raster.js:13-14`

```js
const assetTextCache = new Map()
const assetDataUriCache = new Map()
```

These module-level caches accumulate indefinitely across multiple export operations in the same session. No `clear()`, no `size` limit. With many exports, each fetching CSS/JS from different CDN paths (e.g., varied query strings), memory grows unbounded.

**Fix:** Add a max-size eviction policy or clear caches after each export batch.

### 3. HIGH - `fetchCache` in `offlineExport` is session-global without clear between calls
**File:** `client/src/utils/offlineExport.js:36`

```js
const fetchCache = new Map()  // module-level, cleared only at end of generateOfflineHTML
```

If `generateOfflineHTML` is called multiple times in a session (e.g., exporting multiple presentations), `fetchCache` accumulates across calls. It is only cleared at the end of the *last* call.

**Fix:** Clear cache before use, or use a WeakMap/weak-ref pattern. At minimum, add `fetchCache.clear()` at the start of `generateOfflineHTML`.

### 4. MEDIUM - Markdown import has no HTML sanitization on link hrefs
**File:** `client/src/utils/markdown-import.js:101-104`

```js
html = html.replace(
  /\[([^\]]+)\]\(([^)]+)\)/g,
  '<a href="$2" style="color:#818cf8;text-decoration:underline;">$1</a>'
)
```

`$2` (the URL) is inserted directly into `href` without validation or escaping. Malformed URLs like `javascript:alert(1)` are passed through. While the output is PPTX content, if this HTML is ever rendered in a web context (preview, share link), it is an XSS vector.

**Fix:** Validate that `$2` starts with `http://` or `https://` before inserting. Reject `javascript:`, `data:`, and similar schemes.

### 5. MEDIUM - `pdf-import.js` loads PDF.js worker from CDN at runtime
**File:** `client/src/utils/pdf-import.js:12-13`

```js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
```

If the CDN is compromised or serves a tampered worker script, it executes in the user's browser. PDF.js is loaded from npm at build time but the worker is fetched from CDN at runtime — creating a supply chain gap.

**Fix:** Serve the PDF.js worker from the project's own `/vendor/` path, matching the pattern used for other vendor assets.

### 6. MEDIUM - `pdf-import.js` silently skips slides on upload failure
**File:** `client/src/utils/pdf-import.js:44-67`

```js
try {
  const result = await api.uploadFile(blob)
  if (result.url) { slides.push(...) }
} catch (err) {
  console.error(`Failed to upload PDF page ${i}:`, err)
}
// No user feedback, no partial result, no retry
```

If upload fails for any page, the user gets zero feedback — the import "succeeds" with fewer slides than expected.

**Fix:** Track failed pages, surface them as a warning, and consider retry logic.

---

## Medium Priority

### 7. MEDIUM - `rehydrateImportedPresentation` silently swallows media upload failures
**File:** `client/src/utils/import-project.js:88-96`

```js
const uploaded = await api.uploadFile(new File([media.blob], uploadName))
const uploadedUrl = uploaded.url || `/uploads/${uploaded.filename}`
urlMap[media.originalUrl] = uploadedUrl
} catch (error) {
  console.warn('Failed to upload media:', media.archivePath, error)
}
```

If media upload fails, the catch block logs and continues. The URL map retains the original URL (which was a local archive path, now invalid), and the imported presentation references broken media.

**Fix:** After the loop, surface failed media as a warning return value so callers can decide how to handle partial failures.

### 8. MEDIUM - `summarizePptxImportWarnings` produces repetitive output
**File:** `client/src/utils/pptx-import-summary.js:7-8`

```js
const unsupportedTypes = [
  ...new Set(warnings.map((warning) => warning.type).filter(Boolean)),
].join(', ')
```

It deduplicates types but not individual warning instances. `placeholderCount` is shown as a total, but actual warnings array entries are not aggregated — identical warnings appear multiple times in the summary string.

**Fix:** Deduplicate the full warning objects before generating the summary.

### 9. MEDIUM - `buildHtmlCaptureSrcdoc` injects capture script at arbitrary positions
**File:** `client/src/utils/export-pptx-raster-capture.js:137-146`

```js
if (/<\/body>/i.test(source)) {
  return source.replace(/<\/body>/i, `${scriptTag}</body>`)
}
return `${scriptTag}${source}`
```

The fallback (`${scriptTag}${source}`) prepends the script before `<!doctype>`, which creates an invalid HTML document. Most PPTX captures go through the `inlineAssets` path where a `<head>` or `<body>` exists, but if neither is found, the injected `<script>` appears before the doctype declaration.

**Fix:** Ensure the script is always injected after the `<head>` or inside `<body>`, never before the doctype.

### 10. LOW - `getNativeChartDefinition` returns `null` for unknown types but caller assumes it won't
**File:** `client/src/utils/export-pptx-core.js:148-149`

```js
return {
  type: pptx.ChartType[chartType],  // undefined for unknown chartType
  ...
}
```

If `chartType` is not in `pptx.ChartType` (e.g., user-created custom type), `type` is `undefined`. This gets passed to `slide.addChart(undefined, ...)` which throws. The error is caught by the wrapper and fallback is used — so it works, but the code path is confusing. The null-check is on `getNativeChartDefinition`'s result, not on the `type` field.

**Fix:** Return `null` early if `pptx.ChartType[chartType]` is undefined.

### 11. LOW - `parseTag` regex for self-closing tags misses void elements without slash
**File:** `client/src/utils/export-pptx-html-parser.js:33`

```js
const selfClosing = /\/>$/.test(rawTag) || /^<br/i.test(rawTag)
```

`<br>`, `<hr>`, `<img>`, `<input>` without trailing `/` are NOT marked self-closing. This causes the parser to push them onto the stack and expect a closing tag. The closing tag search loop (`while (stack.length > 1)`) eventually pops them, but text after the tag may be incorrectly nested as a child.

**Fix:** Add explicit void element list: `const VOID_ELEMENTS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])` and check `VOID_ELEMENTS.has(tagName)`.

---

## Edge Cases Found by Scout

### 12. `buildChartSrcdoc` uses unvalidated `chartType` in template literal
**File:** `client/src/utils/export-pptx-raster.js:239`

`element?.chartType || 'bar'` is interpolated directly into the srcdoc string. While callers validate against a known set (`isNativeChartType`), if `chartType` is `'scatter'` or any non-standard value, it appears verbatim in the template. This is safe for PPTX rendering (Chart.js ignores unknown types) but could be confusing in debugging.

### 13. `roundCoord` floating point accumulation in layout calculations
**File:** `client/src/utils/export-pptx-core.js:7-9`

```js
function roundCoord(value) {
  return Number(value.toFixed(4))
}
```

`toFixed` returns a string, and `Number()` reconverts it. Repeated operations can accumulate floating point errors. Acceptable for UI-to-PPTX coordinate mapping but worth noting if precision is critical for complex layouts.

### 14. `markdownToSlides` hardcoded pixel values ignore canvas resolution
**File:** `client/src/utils/markdown-import.js:46-49`

```js
x: isTitle ? 80 : 60,
y: isTitle ? 180 : 40,
width: isTitle ? 800 : 840,
height: isTitle ? 180 : 460,
```

These are hardcoded pixel values that assume a 960x540 canvas. If the presentation has a different resolution, imported markdown content will be mispositioned.

### 15. `fetchComplexElementRasters` sends full presentation JSON to server
**File:** `client/src/utils/exportPptx.js:47`

```js
body: JSON.stringify({ presentation }),
```

For presentations with many slides/elements, the request body could be megabytes. This is acceptable for server-side rasterization but worth noting for very large presentations — consider streaming or pagination.

### 16. `offlineExport` `iframeEntries` array could contain large HTML blobs
**File:** `client/src/utils/offlineExport.js:290-303`

Each iframe entry stores processed HTML as a base64 string in the injected JS. For presentations with many complex iframes (D3 charts, etc.), the injected script block could be very large, potentially hitting browser string size limits or causing slow page loads.

---

## Positive Observations

- `exportPptx.js:fetchComplexElementRasters` validates server response and checks for missing rasters — good defensive check
- `offlineExport.js:safeInlineJS` properly escapes `</script` to prevent HTML injection
- `project-media-utils.js:rewriteProjectMediaUrls` correctly avoids mutating the original presentation
- `export-pptx-basic-renderers.js` uses `Math.max` guards on dimension calculations (line 54-55: `Math.max(0.01, ...)`) — prevents divide-by-zero
- `export-pptx-renderers.js` has a proper try/catch around each element export with graceful fallback
- `validateProjectFile` checks for version compatibility and provides both errors and warnings
- `export-project.test.js` tests partial media failure (good edge case coverage)
- `export-pptx-text-runs.test.js` has comprehensive Phase 1 feature coverage (strike, sub/sup, letter-spacing, hyperlinks)
- `pdf-import.js` uses `FormData` with named file parameter for server-side naming
- `generateOfflineHTML` uses `lastIndexOf` to correctly find the user-level `Reveal.initialize` call (not the inlined one)

---

## Recommended Actions

### Must-fix (before release)
1. `export-pptx-renderers.js`: `await` the `addFallbackElement` calls (Critical #1)
2. `export-pptx-raster.js`: Add cache eviction for `assetTextCache`/`assetDataUriCache` (High #2)
3. `offlineExport.js`: Clear `fetchCache` at the start of `generateOfflineHTML` (High #3)

### Should-fix (before next milestone)
4. `markdown-import.js`: Validate URL schemes in link replacement (Medium #4)
5. `pdf-import.js`: Serve PDF.js worker from local `/vendor/` (Medium #5)
6. `pdf-import.js`: Surface failed page uploads to user (Medium #6)
7. `import-project.js`: Return failed media list from `rehydrateImportedPresentation` (Medium #7)
8. `pptx-import-summary.js`: Deduplicate full warning entries (Medium #8)
9. `export-pptx-raster-capture.js`: Fix script injection to never prepend before doctype (Medium #9)

### Nice-to-have
10. `export-pptx-core.js`: Early null return when chart type is unknown (Low #10)
11. `export-pptx-html-parser.js`: Explicit void element list (Low #11)
12. `markdown-import.js`: Use canvas resolution for imported element positioning (Note #14)
13. `export-pptx-raster.js`: Add size guard for iframe entry injection (Note #16)

---

## Metrics

| Metric | Value |
|--------|-------|
| Test files | 8 (exportPptx, export-project, offlineExport, export-pptx-core, export-pptx-text-runs, export-pptx-raster, markdown-import, import-project) |
| Critical issues | 1 |
| High priority | 3 |
| Medium priority | 7 |
| Low priority | 2 |
| Total issues | 13 |

---

## Unresolved Questions

1. Is there a max file size or element count limit enforced on the server for `raster-elements`? Large presentations could cause memory pressure on the server process.
2. Does the `uploadFile` API endpoint validate file types? A malicious user could upload non-image files with `.png` extensions during PDF import.
3. Are `.navslides` ZIP imports scanned for zip bombs or extremely nested archives?
4. Is there a server-side size limit on the `presentation` JSON payload sent to `/api/presentations/raster-elements`?
