# Code Review — Group 6: Shared Package + Electron

**Reviewer:** code-reviewer
**Scope:** shared/src/* + shared/tests/* + electron/*
**Files:** 18 source + 3 test files
**Focus:** Correctness, security (XSS/injection), Electron sandbox, shared contracts, performance

---

## Summary

**Total: 17 issues** (Critical: 2, High: 3, Medium: 8, Low: 4)

Must-fix: 5 | Nice-to-have: 12

Overall the shared package is well-structured with good separation of concerns. The HTML generation pipeline is solid. Key concerns are: (1) missing iframe sandbox attributes enabling navigation/form-submission from injected content, (2) KaTeX content bypassing HTML escaping in iframe srcdoc, and (3) Electron sandbox disabled.

---

## Critical Issues

### 1. Missing iframe sandbox attributes — HTML/Markdown/Chart/LaTeX/QR renderers
**File:** `shared/src/element-renderers.js`
**Lines:** 124, 133, 183, 229, 354

All iframes are created without a `sandbox` attribute. While `srcdoc` prevents JS execution in modern browsers, the iframe CAN:
- Navigate its own browsing context (`top.location`, `window.open`)
- Submit forms to arbitrary origins
- Open popups
- Enable CSS injection attacks

```js
// Current — no sandbox
`<iframe${wrap} srcdoc="${escapeSrcdoc(wrappedContent)}" ...>`

// Should be
`<iframe${wrap} sandbox="allow-same-origin" srcdoc="${escapeSrcdoc(wrappedContent)}" ...>`
```

For the KaTeX iframe (`renderLatex`), `sandbox` alone may break KaTeX. Use `sandbox="allow-same-origin allow-scripts"` — but since KaTeX HTML is rendered via `.innerHTML`, scripts won't run. However, adding `allow-scripts` would re-enable script execution if KaTeX output ever contains `<script>` tags. A safer approach is to use `sandbox="allow-same-origin"` for KaTeX iframes.

**Impact:** Stored HTML content can perform actions (navigation, form submission) from within the presentation iframe context.

---

### 2. KaTeX LaTeX content bypasses HTML escaping in iframe srcdoc
**File:** `shared/src/element-renderers.js`
**Lines:** 224-228

```js
const bodyContent = hasTikz
  ? `<script type="text/tikz">${content}</script>`
  : `<div id="m"></div><script>try{katex.render(${JSON.stringify(content)},document.getElementById('m'),{displayMode:true,throwOnError:false})}catch(e){document.getElementById('m').textContent=e.message}</script>`
```

`content` (user-provided LaTeX) is embedded directly into a `<script>` tag via template literal. `JSON.stringify` escapes the content for the JS string context, but the script tag itself is created via HTML template. If `content` contains `</script>`, it closes the script tag prematurely.

Example: `\x3cscript\x3ealert(1)\x3c/script\x3e` closes the script block and injects arbitrary HTML.

Additionally, the KaTeX JS block uses `.innerHTML` to render the output:
```js
document.getElementById('m').innerHTML = katex.render(...)
```
If KaTeX ever outputs HTML (it uses text nodes, but this is an assumption), this could be XSS.

**Fix:** Escape `content` before embedding in HTML:
```js
const safeContent = escapeSrcdoc(content)
// Then use safeContent in the srcdoc template
```

Or move KaTeX rendering to the outer page (like the existing `Reveal.on('ready')` pattern at `htmlGenerator.js:204-211`) and use the existing `data-math-latex` span approach instead of an iframe.

---

## High Priority

### 3. customCSS injection — partial server-side sanitization, no client-side sanitization
**Files:** `shared/src/htmlGenerator.js:170, 464`; `server/index.js:163-169`

`customCSS` is injected directly into `<style>` tags without HTML escaping:

```js
// htmlGenerator.js:170
`${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}`
```

Server-side sanitization exists but is incomplete:
```js
// server/index.js:163-169
sanitized.customCSS = sanitized.customCSS
  .replace(/expression\s*\(/gi, '/* blocked */(')
  .replace(/javascript\s*:/gi, '/* blocked */:')
  .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
```

**Gaps:**
- `@import` directive not blocked — attacker can `@import` an external stylesheet
- `data:` URL in CSS `background` not blocked — can be used for data exfiltration
- CSS selector-based data theft not blocked (e.g., `[data-secret] { background: url(/exfil?c=1) }`)
- Client-side calls (`downloadHTML`, `exportPDF`, `presentInWindow`, `AnimationPreviewModal`, `export-project.js`) bypass server sanitization entirely

**Fix:** Add server-side sanitization for `@import` and `data:` URLs. Consider moving client-side sanitization into `element-renderers.js` or `htmlGenerator.js` as a shared sanitizeCSS function.

---

### 4. Electron sandbox disabled
**File:** `electron/main.js`
**Lines:** 2, 8

```js
process.env.ELECTRON_DISABLE_SANDBOX = '1'
app.commandLine.appendSwitch('no-sandbox')
```

Both the env var and CLI switch disable Chromium's process sandbox. If a malicious page loaded in the renderer exploits a browser vulnerability, the attacker gains full process access without sandbox restrictions.

**Justification:** Electron docs explicitly warn this is only for testing. The `webPreferences` settings (`nodeIntegration: false`, `contextIsolation: true`) are correct, so the primary attack surface is removed. However, renderer process exploits still have fewer protections.

**Recommendation:** Remove `ELECTRON_DISABLE_SANDBOX` and `appendSwitch('no-sandbox')`. If sandbox is required for specific features (e.g., file access), use the `--no-sandbox` flag per-user or for CI only, not globally.

---

### 5. KaTeX content stored in HTML attribute (data-math-latex)
**File:** `shared/src/element-renderers.js`
**Line:** 215

```js
`<span data-math-latex="${escapeHtml(content)}" ...>`
```

`escapeHtml` prevents attribute breakout, but if `escapeHtml` is ever removed or bypassed, LaTeX stored in an HTML attribute can be extracted and re-rendered via `el.getAttribute('data-math-latex')` followed by KaTeX's HTML output. KaTeX itself uses text nodes (safe), but this is a defense-in-depth concern.

**Note:** The existing `Reveal.on('ready')` block at `htmlGenerator.js:204-211` correctly uses `el.getAttribute()` and KaTeX renders to text nodes. This is actually fine, but the pattern of storing user content in HTML attributes should be minimized.

---

## Medium Priority

### 6. KaTeX content not escaped in print LaTeX iframe srcdoc
**File:** `shared/src/element-renderers.js`
**Line:** 212

```js
const wrappedContent = `<!doctype...><script type="text/tikz">${content}</script></body></html>`
```

Same issue as #2 but for the print-path TikZ iframe. No `escapeSrcdoc` wrapping.

---

### 7. element-renderers exports `getBackgroundAttrs: null`
**File:** `shared/src/element-renderers.js:425`

```js
getBackgroundAttrs: null, // will be set from htmlGenerator
```

This is exported as `null` then overwritten in `htmlGenerator.js` via a direct require. Confusing circular dependency. Either remove from exports or import `getBackgroundAttrs` properly.

---

### 8. TEXT_COLORS / BG_COLORS duplicated with different values
**Files:**
- `shared/src/index.js:12-39` — 36 text colors, 8 gradient presets, 12 bg colors
- `shared/src/shared-toolbar-text-bg-color-palette-gradient-presets-config.js:4-29` — 40 text colors, 6 gradient presets, 12 bg colors

Different values: `index.js` has cyan colors (#67e8f9 etc.) that the toolbar config doesn't have. The toolbar config has 6 gradients vs 10 in index. Consumer code using the wrong import gets inconsistent palettes.

**Fix:** Single source of truth in the config file; index.js imports from it.

---

### 9. No DOMPurify sanitization in client-side HTML element rendering
**File:** `shared/src/element-renderers.js`
**Lines:** 110, 118-119

Server-side sanitizes HTML element content with DOMPurify (`server/index.js:155-160`), but client-side `renderHtml` (`element-renderers.js:110`) uses raw `el.content` without sanitization. This means offline exports, PDF exports, and preview modes are unprotected.

```js
const content = el.content || ''  // no DOMPurify
const wrappedContent = `<!doctype...><body>${content}</body></html>`
```

---

### 10. Markdown in print mode rendered as raw text
**File:** `shared/src/element-renderers.js`
**Line:** 129

```js
return `<div...>${el.content || ''}</div>`
```

Print-mode markdown renders the markdown source as plain text instead of parsing it. Contrast with the iframe srcdoc path (line 132) which correctly uses `marked.parse`.

---

### 11. Shape text content unescaped in SVG
**File:** `shared/src/shapeUtils.js`
**Line:** 102

```js
textEl = `<text...>${el.text}</text>`
```

User-controlled `el.text` injected directly into SVG `<text>` element. SVG text elements parse HTML entities, so `<` and `>` are fine, but the text is not HTML-escaped, meaning HTML tags in shape text would render as elements.

---

## Low Priority

### 12. NaN possible in SVG output when width/height undefined
**File:** `shared/src/shapeUtils.js`
**Lines:** 20-21, 32, 43, 63, 102

```js
const w = el.width, h = el.height  // could be undefined
inner = `<line x1="${lw}" y1="${h / 2}" ...`
```

If `el.width` or `el.height` is `undefined`, arithmetic produces `NaN` in SVG attributes. SVG renders NaN as the string "NaN", which is visually broken but not a security issue.

---

### 13. Icon path data not validated — relies on trusted JSON
**File:** `shared/src/element-renderers.js`
**Lines:** 193-202

```js
const path = ICON_PATHS[iconKey] || ICON_PATHS['Star'] || ''
return `<svg...>${path}</svg>`
```

Paths loaded from `../data/icon-paths.json`. If that file is compromised, arbitrary SVG content (including scripts in `<script>` tags, event handlers) could be injected. Currently low risk since the JSON is a committed artifact.

---

### 14. JSDoc typedef 'qr' vs RENDERERS 'qrcode' mismatch
**File:** `shared/src/types/presentation.js:14`

```js
@typedef {'text'|...|'qr'|'divider'|...} ElementType
```

RENDERERS in `element-renderers.js` uses `'qrcode'` not `'qr'`. Also 'divider' is in the typedef but has no RENDERER entry.

---

### 15. generatePrintHTML not re-exported to client
**File:** `client/src/utils/generateHTML.js`

`generatePrintHTML` exists in the shared package but is not in the client re-export. Only `generateRevealHTML`, `downloadHTML`, `exportPDF`, `presentInWindow` are forwarded. If a client component needs print HTML, it can't use the wrapper.

---

### 16. Missing `generateRevealHTML` test for client-side offline export path
**File:** `shared/tests/htmlGenerator.test.js`

Tests cover server-side HTML generation. No tests for `downloadHTML`, `exportPDF`, or `presentInWindow` (client-side functions that call `generateRevealHTML`/`generatePrintHTML` directly with unsanitized data).

---

### 17. No shared-pptx-utils unit test file
**File:** `shared/tests/shared-pptx-utils.test.js`

Exists but is empty (only imports, no test cases). The `shared-pptx-core.js` is tested indirectly through `htmlGenerator.test.js` and `shared-pptx-utils.test.js`.

---

## Positive Observations

1. **Good IPC design** in Electron: `contextIsolation: true`, `nodeIntegration: false`, minimal preload API, invoke/handle pattern — best practice.
2. **`safeStorage` usage** for credential encryption — appropriate for OS keychain integration.
3. **KaTeX in main reveal HTML** uses `el.getAttribute()` + `throwOnError: false` — safe pattern.
4. **Code block escaping** (`element-renderers.js:104`) — `escapeHtml(el.content)` correctly applied.
5. **`absoluteSrc` blocks javascript:/data: in standard HTML attributes** — good URL scheme validation.
6. **Good test coverage** on HTML generation, background attrs, footer modes, fragment expansion.
7. **Slide notes normalization** handles both `notes` and `speakerNotes` legacy field — good backward compat.
8. **Fragment expansion in print mode** correctly handles per-slide fragment indices.

---

## Must-Fix Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | element-renderers.js:124,133,183,229,354 | Missing iframe sandbox attributes |
| 2 | Critical | element-renderers.js:228 | KaTeX content closes script tag in srcdoc iframe |
| 3 | High | htmlGenerator.js:170,464 | customCSS injection — incomplete server sanitization, no client-side |
| 4 | High | electron/main.js:2,8 | Electron sandbox disabled globally |
| 5 | High | element-renderers.js:215 | KaTeX content in HTML attribute (defense-in-depth) |

## Nice-to-Have Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 6 | Medium | element-renderers.js:212 | Print LaTeX iframe srcdoc missing escapeSrcdoc |
| 7 | Medium | element-renderers.js:425 | Exports getBackgroundAttrs: null — confusing |
| 8 | Medium | index.js:12-39 + toolbar-config | TEXT_COLORS/BG_COLORS duplicated, values differ |
| 9 | Medium | element-renderers.js:110 | Client-side HTML content not DOMPurify'd |
| 10 | Medium | element-renderers.js:129 | Markdown print mode renders raw text |
| 11 | Medium | shapeUtils.js:102 | Shape text unescaped in SVG |
| 12 | Low | shapeUtils.js:20-21 | NaN in SVG if dimensions undefined |
| 13 | Low | element-renderers.js:202 | Icon path data from JSON not validated |
| 14 | Low | types/presentation.js:14 | 'qr' vs 'qrcode' typedef mismatch |
| 15 | Low | client/src/utils/generateHTML.js | generatePrintHTML not re-exported |
| 16 | Low | shared/tests/htmlGenerator.test.js | No client-side export path tests |
| 17 | Low | shared/tests/shared-pptx-utils.test.js | Empty test file |

---

## Unresolved Questions

1. Is disabling the Electron sandbox intentional for a specific feature? If so, what is the minimum scope for `--no-sandbox`?
2. Should the shared package export a `sanitizePresentation` utility that both server and client can call, to ensure consistent sanitization?
3. Is the KaTeX iframe approach (`renderLatex` normal mode) intended to be replaced by the `data-math-latex` span approach (already used in `htmlGenerator.js:204-211`)?
