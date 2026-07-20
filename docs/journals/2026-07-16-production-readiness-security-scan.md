## Code Review Summary

### Scope
- Files reviewed: `shared/src/content-safety.js`, `rich-text-style-sanitizer.js`, `element-renderers.js`, `htmlGenerator.js`, `design-tokens.js`, `shapeUtils.js`, `types/ai-slide-contract.js`, `electron/main.js`, `electron/preload.js`, `server/index.js` (share render), `server/services/pptx-import/{pptx-guards,xml-safety,media,media-dedup,package-store/raw-zip,sanitize,constants}.js`, related tests
- Lines of code analyzed: ~3.5k primary + spot checks
- Review focus: content-safety effectiveness, HTML export XSS, element-renderers sinks, Electron hardening, PPTX zip/XXE/path, shared corruption risks
- Updated plans: none (no plan file provided)

### Overall Assessment
PPTX package admission is mature (zip path validation, measured zip-bomb, DTD/ENTITY/XInclude reject, media magic + UUID writes). Export/share HTML pipeline is **not** production-safe against hostile presentation JSON: intentional raw HTML embeds, weak regex sanitizers, and unescaped deck metadata create stored XSS on `/share/:token`, live HTML, and Electron (compounded by sandbox-off).

---

### Critical Issues

#### 1. HTML elements execute arbitrary attacker content on share/export (stored XSS by design)
**Severity:** Critical  
**Evidence:**
- `shared/src/element-renderers.js:328-352` — `renderHtml` puts raw `el.content` into iframe body / `data:` URL; no sanitization, no `sandbox`.
- `server/index.js:167-177` — share path: comment *“Keep html embeds trusted and programmable in share mode too”*; only weak `customCSS` filter; then `generateRevealHTML(sanitized)`.
- Same generator used by live sockets / GitHub export (`server/services/socket-handler.js`, `server/routes/github.js`).

**Impact:** Anyone who can save a presentation (or poison shared JSON) can run JS in viewers of public share links and present mode. Self-host multi-user or shared links = cross-user XSS.

**Fix direction:** Policy split: block `type:'html'` on public share / untrusted imports; or force `sandbox="allow-scripts"` **without** `allow-same-origin`, strip external network, CSP on share responses. Never ship raw author HTML as first-party page script capability without explicit “advanced / unsafe” flag.

#### 2. Editor HTML iframe: `allow-scripts` + `allow-same-origin` = parent-origin script
**Severity:** Critical  
**Evidence:**
- `client/src/components/canvas/canvas-element-wrapper.jsx:590-601` — `srcDoc={element.content}` + `sandbox="allow-scripts allow-same-origin"`.
- Test locks this in: `canvas-element-wrapper.test.jsx:461-469` (requires both tokens “so CDN scripts can load”).

**Impact:** `srcdoc` + `allow-same-origin` inherits parent origin. Malicious embed (imported deck, collaborative save, malicious template) can read same-origin storage, call `/api/*` on localhost, and invoke `window.electronAPI` credential APIs in desktop builds.

**Fix:** Drop `allow-same-origin` from HTML embeds; load CDNs only via controlled proxy/null-origin data URL; never give embeds parent origin.

#### 3. Electron: Chromium sandbox disabled; credentials + full local API adjacent to XSS
**Severity:** Critical (desktop)  
**Evidence:**
- `electron/main.js:1-8` — `ELECTRON_DISABLE_SANDBOX='1'` + `app.commandLine.appendSwitch('no-sandbox')` before window create.
- `electron/main.js:117-121` — `nodeIntegration:false`, `contextIsolation:true` (good) but no `sandbox:true` / no `webSecurity` explicit policy.
- `electron/main.js:37-61` + `preload.js:7-34` — IPC `save/get/delete-credential` with **no key allowlist**, no value type check, any renderer invoke.
- `electron/main.js:90-103,124` — Express server required into main; UI loads `http://localhost:3002` with full REST surface.

**Impact:** Renderer compromise (findings 1–2, 4–6) → steal `safeStorage` secrets, hit local API unrestricted, process-level risk elevated by no OS sandbox.

**Fix:** Remove sandbox disable unless documented hard requirement; enable `webPreferences.sandbox`; allowlist credential keys (`github-token` etc.); validate `typeof value === 'string'` + max length; consider `senderFrame` checks; prefer separate backend process.

---

### High Priority Findings

#### 4. `content-safety.js` is regex hygiene, not an HTML sanitizer — multiple bypass classes
**Severity:** Important  
**Evidence:** `shared/src/content-safety.js:14-76`
- Strips only closed `<script>...</script>`, event attrs matching `\son...`, URL attrs, allowlisted styles.
- Does **not** remove `iframe|object|embed|form|base|meta|link|svg|math|style|template`.
- Event strip requires whitespace before `on` → classic bypass: `<svg/onload=alert(1)>` (no `\s` before `on`).
- `sanitizeStyleAttributes` only matches quoted `style="..."` / `style='...'` → unquoted `style=...` survives.
- Contrast: PPTX import uses DOMPurify allowlist (`server/services/pptx-import/sanitize.js:21-34`).

**Used at XSS-relevant sinks:**
- `element-renderers.js:226` text content
- `shapeUtils.js:198` `foreignObject` XHTML (HTML execution context in SVG)
- AI contract (`ai-slide-contract.js:82`) — excludes html/svg/code types (good) but still trusts this sanitizer for text

**Fix:** Shared DOMPurify (or isomorphic) with tag/attr allowlists for rich text; keep regex only as defense-in-depth. Add adversarial tests for `/onload`, unquoted styles, nested script, `foreignObject`.

#### 5. `htmlGenerator` injects unsanitized deck fields into HTML/JS/CSS
**Severity:** Important  
**Evidence:**
| Sink | Line | Issue |
|------|------|--------|
| `transition` JS string | `htmlGenerator.js:283` | `transition: '${presentation.transition}'` — breakout `');alert(1)//` |
| `navigationMode` JS | `:289` | same |
| `theme` / `codeTheme` href | `:230-231` | path/attr injection; no theme allowlist |
| `customCSS` raw | `:259`, `:638` | full CSS/HTML breakout; share only neuters `expression`/`javascript:` (`server/index.js:170-175`) |
| footer CSS | `:257`, `:114-115` | `footerFontFamily` / `footerColor` unescaped into CSS |
| `tokensToCssVars` | `design-tokens.js:102-114` → style block | raw color/font into `:root{...}` — `</style><script>` possible |
| bg color attr | `htmlGenerator.js:422` | `data-background-color="${bg.color}"` unescaped |

**Impact:** Hostile presentation JSON → full first-party XSS on share/live/export without needing HTML element type.

**Fix:** Allowlist theme/codeTheme/transition/navigationMode; `escapeHtml` / `JSON.stringify` for JS config; CSS-escape token values; treat `customCSS` as untrusted (strip or isolate).

#### 6. Element attribute / style injection outside content-safety
**Severity:** Important  
**Evidence:**
- `element-renderers.js:276-278` — `alt="${el.alt || ''}"` not `escapeHtml` → attr breakout.
- `element-renderers.js:218` — `font-family:${el.fontFamily}` without `safeCssFontFamily` (helper exists at `:105-111` but unused here).
- `element-renderers.js:190-201` — `buildBaseStyle` interpolates numeric fields and `shadowColor` without `safeCssColor`.
- Timeline images: `:816` `href="${escapeHtml(item.image)}"` — escapes quotes but does not run `sanitizeMediaSrc` → `javascript:` / `data:text/html` possible in SVG image.

**Fix:** Escape all attr sinks; funnel colors/fonts through safe helpers; media URLs through `sanitizeMediaSrc`.

#### 7. Markdown present iframe uses weak inlined sanitizer; export HTML iframe has no sandbox
**Severity:** Important  
**Evidence:**
- `element-renderers.js:364` — `marked.parse` + regex `__sanitize` (script/on/href only); same gaps as #4.
- `renderHtml` present/export iframes (`:351-352`) — **no** `sandbox` attribute (unlike plugin iframe at `:873` which has `sandbox="allow-scripts"` only).
- Print path encodes raw HTML into `data-pdf-iframe` (`:341`) for later blob activation.

**Fix:** Prefer server-side safe markdown (already `renderSafeMarkdownHtml` for print — use for present too); add `sandbox` on all author-content iframes.

---

### Medium Priority Improvements

#### 8. SVG sanitizer incomplete vs active SVG vectors
**Severity:** Minor → Important when inline in parent DOM  
**Evidence:** `content-safety.js:82-88`
- Removes `script|foreignObject|iframe|object|embed` + events + href/src rewrite to `#`/data-image.
- Leaves arbitrary tags (`animate`, `set`, `use` local, `style` blocks), unsanitized `style=` attributes.
- `renderSvg` paint rewrite (`element-renderers.js:694-709`) injects `fillOverride`/`strokeOverride` before sanitize — trust boundary is the regex sanitizer only.

**Fix:** DOM-based SVG sanitizer or allowlist elements/attrs; sanitize style on SVG; reject non-color overrides.

#### 9. Credential store: unvalidated keys / values
**Severity:** Minor (elevates with XSS)  
**Evidence:** `electron/main.js:37-61` — `creds[key] = encryptString(value)` with no key regex, no string length limit.

**Fix:** `^[a-z0-9-]{1,64}$` keys; string-only values; max size.

---

### Low Priority / Positive

#### 10. PPTX import package safety — solid (positive)
**Severity:** n/a (strength)  
**Evidence:**
- Path: `package-store/raw-zip.js:10-23` rejects `..`, absolute, drive letters, control chars, case collisions, local/central name mismatch.
- Zip bomb: `pptx-guards.js:113-133` declared + **measured** inflate budgets; tests in `zip-bomb-guard.test.js`.
- XXE: `xml-safety.js:74-114` forbids DOCTYPE/ENTITY/XInclude; depth/attr/text budgets.
- Media write: `media-dedup.js:68-72` UUID filenames only; index limited to `ppt/media/` (`media.js:47-49`); magic sniff + ext allowlist.

No path-traversal write or classic XXE found on this path. Residual: any code path that `JSZip.loadAsync` without `validatePptxPackage` must stay gated (several internal re-loads after validated bytes — OK if inputs already validated).

#### 11. Mermaid isolation is better than raw HTML; still host-relative vendor scripts
**Severity:** Minor  
**Evidence:** `element-renderers.js:184-185` escapes mermaid source, `securityLevel:'strict'`. Good. Chart/QR iframes inject colors into CSS/JS with only partial escaping (`:436`, `:725`).

#### 12. Shared correctness: shape `foreignObject` + incomplete rich-text sanitize
**Severity:** Minor (corruption / XSS hybrid)  
**Evidence:** `shapeUtils.js:195-199` embeds `sanitizeRichTextHtml` into SVG foreignObject — XSS if #4 bypasses; also style allowlist may drop legitimate PPTX rich styles (fidelity loss), while import path uses different sanitizer → roundtrip asymmetry.

---

### Positive Observations
- AI slide contract explicitly bans `html`/`code`/`svg` (`ai-slide-contract.js:30-45`).
- Media URL policy rejects `javascript:`, `file:`, `data:text/html` (`content-safety.js:21-35`, tests).
- PPTX import DOMPurify path is the right model — shared export should match.
- Electron contextIsolation + no nodeIntegration + navigation pin to app origin (`main.js:128-150`) are correct baseline choices undermined by sandbox-off + same-origin embeds.
- Plugin export iframe uses `sandbox="allow-scripts"` only (`element-renderers.js:873`) — better pattern than HTML embeds.

---

### Recommended Actions (priority order)
1. **Kill share/live XSS surface:** strip or sandbox `html` embeds; escape JS config fields; allowlist theme/transition; isolate/remove raw `customCSS` on public views.
2. **Fix editor iframe sandbox:** remove `allow-same-origin` from HTML embeds; re-test CDN/mermaid loading via null origin.
3. **Replace `content-safety` regex with DOMPurify-equivalent** for all rich-text/SVG sinks (shared package so client/server/export match import).
4. **Re-enable Electron sandbox**; allowlist credential IPC keys; document why sandbox was disabled if must stay.
5. Escape `alt`, `fontFamily`, colors, timeline image URLs; use existing `safeCss*` helpers consistently.
6. Keep PPTX guards; audit any zip load that skips `validatePptxPackage`.

### Metrics
- Type Coverage: N/A (JS packages)
- Test Coverage: content-safety tests cover happy-path only; **no** adversarial bypass suite (`shared/tests/content-safety.test.js`). PPTX zip-bomb/XML safety well tested.
- Linting Issues: not re-run (static review only)
- Findings: 3 Critical, 4 Important, 3 Minor/positive notes (12 max)

### Unresolved questions
- Is multi-tenant / multi-user deployment in scope, or single-operator self-host only? (drives share XSS severity for product risk)
- Why is Electron sandbox forced off (`ELECTRON_DISABLE_SANDBOX`)? Packaging constraint vs leftover?
- Is `type:'html'` considered a trusted-author-only power feature with UI warnings, or available to all templates/imports?
