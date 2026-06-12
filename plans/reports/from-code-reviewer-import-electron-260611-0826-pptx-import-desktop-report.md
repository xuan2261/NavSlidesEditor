# Code Review — R6: PPTX Import + Shared Utils + Electron Shell

Date: 2026-06-11
Reviewer: code-reviewer
Scope: `server/services/pptx-import/**`, `server/routes/pptx-import.js`, `server/services/pptx-import-job-manager.js`, client import utils (markdown/project/pptx), `shared/src/shared-slide-notes.js`, `shared/src/slideNotes.js`, `shared/src/shared-*.js`, `electron/main.js`, `electron/preload.js`.
Posture: READ-ONLY. Untrusted-input lens on PPTX archive content.

## Severity counts
- Critical: 2
- High: 3
- Medium: 4
- Low: 3

---

## Critical

### C1 — Markdown link `href` allows attribute/tag breakout → stored XSS
File: `client/src/utils/markdown-import.js:110-116`

`simpleMarkdownToHtml` escapes `&`, `<`, `>` at the top (lines 75-77), but the link rule runs a regex capture for `href` **after** escaping and interpolates it raw into the `<a href="...">` attribute without quote-escaping. The `isSafeHref` gate (`client/src/utils/url-safety.js:3`) short-circuits to `true` for any href starting with `#`, `/`, `./`, or `../` — these never reach URL parsing.

Because `>` was already escaped to `&gt;` in the body but the captured href is the *raw section text* sliced by the regex `\(([^)]+)\)`, an attacker-controlled markdown link can inject a literal `"` to break out of the attribute. Verified:

```
input:    [t](/x"><img src=x onerror=alert(1)>)
captured: /x"><img src=x onerror=alert(1
isSafe:   true   (starts with '/')
emitted:  <a href="/x"><img src=x onerror=alert(1" style="color:#818cf8">t</a>
```

The injected `<img onerror>` survives into `element.content`. Also reproduces with `onmouseover` on a closed anchor. Impact: importing a crafted `.md` file (HomePage import flow, `HomePage.jsx:534`) plants HTML into slide content.

Mitigating factor: the canvas render path runs `sanitizeRichTextHtml` (`content-safety.js:75`, strips `on*` and re-validates href) before `dangerouslySetInnerHTML`, so live editor preview is defended. BUT the raw unsanitized `content` is what gets **persisted** and is fed to other consumers (PPTX export reads stored HTML; `shared/src/element-renderers.js:141` sanitizes, but any consumer that does not — e.g. plain-text extraction, search indexing, or a future renderer — inherits the payload). Defense-in-depth is broken at the source: the importer should never emit attribute-breaking HTML.

Fix direction: HTML-escape the captured `href` (`"` → `&quot;`, `>` → `&gt;`) before interpolation, and tighten `isSafeHref` so `/`, `./`, `../`, `#` prefixes still reject values containing `"`, `<`, `>`, or whitespace. Better: build the anchor via a templating helper that escapes attribute values.

### C2 — Decompression budget is computed from attacker-declared ZIP sizes (zip-bomb bypass)
File: `server/services/pptx-import/pptx-guards.js:19-21,67-70`

`getUncompressedSize` reads `entry._data.uncompressedSize` (the value stored in the ZIP central directory), and `validatePptxPackage` sums those to enforce `MAX_DECOMPRESSED_BYTES` (500MB). The declared uncompressed size is part of the untrusted archive and is **not verified against actual inflation**. A malicious PPTX can declare a small uncompressed size while the deflate stream expands far larger; JSZip honors `loadAsync` lazily, so the guard passes, then `entry.async('nodebuffer')` in `media.js:122/131` inflates the real payload into a single Buffer with no per-entry cap beyond `MAX_MEDIA_SIZE` (200MB) which only applies to media entries, not to the slide/XML entries the parser worker reads (`parse-worker.js:41` reads the whole file then `pptxtojson.parse` inflates internally).

Confirmed `_data.uncompressedSize` is the field populated (`entry.uncompressedSize` is `undefined`), so the only signal used is the declared one.

Impact: memory exhaustion / DoS on the server (and the embedded Electron server) from a single crafted upload under the 100MB on-disk limit. The 60s parser timeout (`constants.js:7`) bounds time but not peak memory before the OOM.

Fix direction: do not trust the declared size. Either (a) cap the on-disk compressed size more aggressively and rely on the worker's memory ceiling, (b) stream-inflate each entry with a running byte counter and abort when the real inflated total exceeds the budget, or (c) enforce a compression-ratio check (declared/compressed) and reject suspicious ratios. At minimum, document that the current check is advisory only.

---

## High

### H1 — Imported slide background `src` is un-gated; external-media allowlist bypassed for backgrounds
File: `server/services/pptx-import/mapper/map-presentation.js:123-130`

`mapVideo`/`mapAudio` route external `http(s)` refs through `gateExternalMediaUrl` (`map-media.js:8`) which enforces `buildMediaUrlAllowlist()`. But `mapSlideBackground` takes `slide.fill.value.src` directly into `{ type:'image', src, image }` with **no allowlist gate and no protocol check**. If pptxtojson surfaces an external/remote URL (or a `javascript:`/`data:` value) for a slide background fill, it is persisted verbatim.

Downstream `htmlGenerator.js:402-404` emits it as `data-background-image="${absoluteSrc(imageSrc)}"` with no attribute escaping — a `"`-containing value enables attribute breakout in exported HTML, and a remote `http` URL causes the viewer's browser to fetch attacker-chosen hosts (privacy/SSRF-adjacent on the client; tracking beacon).

Fix direction: route background image refs through the same media-persistence / allowlist path used for `<img>` elements; reject non-`/uploads/` and non-allowlisted external URLs, and escape before HTML emission.

### H2 — `persistMediaBlob` / `persistImageBuffer` inflate full entry into memory with weak ceiling
File: `server/services/pptx-import/media.js:97-99,122,131-134`

Each media entry is fully inflated via `entry.async('nodebuffer')` *before* the `MAX_MEDIA_SIZE` (200MB) check — the size guard runs on the already-materialized buffer (`media.js:132`), so the 200MB allocation happens regardless. With `MAX_ZIP_ENTRIES = 5000` and media processed per-element, a deck with many large media entries can drive peak RSS well beyond a safe bound even though each individual entry is "allowed". Combined with C2 this is the practical OOM vector.

Fix direction: check declared entry size before inflating where possible; cap cumulative media bytes per import (a running total in the mapping context), not just per-file.

### H3 — Parser worker `NODE_PATH` injection allows arbitrary module resolution if env is attacker-influenced
File: `server/services/pptx-import/worker-runner.js:17-34,108-113`

`buildParserWorkerEnv` spreads `process.env` into the forked worker and prepends repo `node_modules` to `NODE_PATH`. This is fine for a trusted parent env, but note the worker is `fork`ed with `silent:true` and the child `require`s `pptxtojson` / `pptx2json` resolved through that `NODE_PATH`. If the process environment is ever influenced by request data (it is not today, but `ELECTRON_RUN_AS_NODE='1'` is set unconditionally when `process.versions.electron` is truthy — `worker-runner.js:29`), the Electron child runs as a plain Node process with full module-resolution power. Lower severity because env is not request-derived; flagged for the Electron packaging trust boundary.

Fix direction: pin worker module resolution to absolute `require` paths rather than `NODE_PATH`, and avoid blanket `ELECTRON_RUN_AS_NODE` if the packaged app can be invoked with a poisoned env. Verify `pptxtojson` resolves from a known absolute path inside the asar/resources.

---

## Medium

### M1 — `sanitizeHtml` href post-processing has a regex gap (multi-attribute anchors)
File: `server/services/pptx-import/sanitize.js:37-50`

After DOMPurify (which is the real defense and is correctly configured with `FORBID_ATTR` for `on*`), the code re-parses `<a ...>` with `/<a\s+([^>]*href=[^>]*)>/gi` and only strips href on invalid protocol. DOMPurify already drops `javascript:` hrefs by default, so this post-pass is redundant and the hand-rolled regex (`href=["']([^"']+)["']`) will not match unquoted or entity-encoded hrefs. Not exploitable given DOMPurify runs first, but it is dead/confusing defense that could mask a regression if DOMPurify config changes. Recommend relying on DOMPurify's `ALLOWED_URI_REGEXP` instead.

### M2 — Job manager is a module-global singleton: cross-request state + no auth
File: `server/services/pptx-import-job-manager.js:5,14-15`; `server/routes/pptx-import.js:112-137`

`jobs` is a process-global Map and `MAX_CONCURRENT_RUNNING = 1`. Any client that can guess/obtain a `jobId` (UUIDv4, validated at `pptx-import.js:38`) can `GET /jobs/:jobId` to read another user's import **result** (full presentation JSON) or `DELETE` to cancel it. There is no ownership binding or auth check on the job routes. In a multi-user deployment this is an IDOR exposing imported content. UUIDv4 is unguessable in practice, so severity is Medium, but the result payload is sensitive (entire deck).

Fix direction: bind jobs to a session/user and authorize on fetch/cancel, or document the single-tenant assumption explicitly.

### M3 — `runImport` is fire-and-forget; `res.status(202)` returns before the try/catch can catch sync throws
File: `server/routes/pptx-import.js:87-110`

`runImport(...)` is invoked without `await` (intentional, async job model) and `res.status(202).json({ jobId })` runs immediately. The surrounding `try/catch` therefore cannot catch anything from the import itself — all import errors are handled inside `runImport`'s own catch via `jobManager.failJob`. The outer catch only guards the synchronous `runImport` call setup. This works, but the dead outer catch (lines 103-109) implies error handling that does not exist for the async path. Confirm temp-file cleanup: `runImport`'s `finally` unlinks `filePath` (line 60), good. Low functional risk; flagged for clarity.

### M4 — Table merged-cell detection treats `vMerge===0 || hMerge===0` as empty, but truthy non-1 spans not normalized
File: `server/services/pptx-import/mapper/map-table.js:100,121-123`

`cell.vMerge === 0 || cell.hMerge === 0` marks continuation cells empty, while `rowSpan/colSpan > 1` pushes merge anchors. If pptxtojson emits `vMerge`/`hMerge` as booleans or as the span count (varies by version), the `=== 0` strict check may misfire, silently dropping cell content or producing overlapping merges. Worth verifying against the 2.0.2 fixture (`__fixtures__/pptxtojson-2.0.2-output.fixture.js`) which the memory note says encoded older conventions.

---

## Low

### L1 — `parseDataUrl` decodes base64 without length cap before sniff
File: `server/services/pptx-import/media.js:55-60,95-99`

`parseDataUrl` does `Buffer.from(match[2], 'base64')` on element-embedded base64 with no size pre-check; `persistImageBuffer` checks `MAX_MEDIA_SIZE` only after allocation. Same pattern as H2 but for inline base64. Minor since pptxtojson already parsed it into memory.

### L2 — `normalizeFontFamily` allows family names that are valid CSS but unusual; acceptable
File: `server/services/pptx-import/mapper/mapper/utils-text.js:31-43` (`utils-text.js`)

Strong allowlist (`/^[a-zA-Z0-9 _.-]+$/`) and keyword blocklist — looks correct and defends against CSS injection via font name. No action; noted as a positive.

### L3 — Electron `setWindowOpenHandler` default-allows non-http schemes
File: `electron/main.js:127-136`

The handler allows `blob:` and localhost, opens external `http*` in the system browser (good), but the final `return { action: 'allow' }` (line 135) allows **any other scheme** to open a new Electron window — including `file:`, `data:`, custom protocols. With `nodeIntegration:false` + `contextIsolation:true` (correctly set, lines 118-119) the blast radius is limited, but `file:` navigation in a new window is undesirable. There is no `will-navigate` handler, so the main window itself could be navigated away by in-page content (it loads trusted localhost, so low risk today). Recommend defaulting to `deny` for unknown schemes and adding a `will-navigate` guard pinning to `http://localhost:PORT`.

---

## Positive observations (risk calibration)
- ZIP magic-byte signature check before parse (`pptx-guards.js:44`), entry-count cap, and required-entry check are solid first-line defenses.
- Media persistence uses magic-byte sniffing + `file-type` cross-check with extension (`media.js:140-155`), rejecting MIME/extension mismatches — good defense against polyglots and path-extension spoofing.
- No path traversal in media writes: filenames are server-generated UUIDs (`media-dedup.js:52`), archive names are never used for the output path. The `ppt/media/` index uses normalized keys for lookup only.
- Parser runs in a forked worker with timeout + SIGKILL grace (`worker-runner.js:50-55,95-104`) — isolates parser crashes/hangs from the main event loop.
- Electron preload exposes a minimal, purpose-specific credential bridge (`preload.js`) with `contextIsolation:true`; no `nodeIntegration`, no broad `ipcRenderer` exposure. Good.
- Diagnostics sanitizer (`diagnostics.js:12-25`) strips XML, long base64 blobs, and emails from error messages before they reach the client — prevents internal-content leakage in error responses.
- AbortSignal threaded through validate → worker → mapper → media persistence for cooperative cancellation.

---

## Recommended actions (priority order)
1. C1: Escape markdown link href into the anchor attribute and harden `isSafeHref` against quote/angle-bracket payloads in relative hrefs. (importer must not emit breakable HTML)
2. C2/H2: Stop trusting declared uncompressed sizes; enforce a real cumulative inflated-byte ceiling during extraction.
3. H1: Gate imported slide-background image refs through the media-persistence/allowlist path and escape on HTML emission.
4. M2: Add ownership/auth to job fetch+cancel routes, or document single-tenant.
5. M4: Verify table merge-flag semantics against the pptxtojson 2.0.2 fixture.
6. L3: Default-`deny` unknown schemes in Electron window-open handler; add `will-navigate` pin.

## Unresolved questions
- Is the PPTX import endpoint exposed in multi-user deployments, or only single-tenant/desktop? (Determines M2 severity.)
- Does any persisted-content consumer render `element.content` WITHOUT `sanitizeRichTextHtml`? (Determines whether C1 is exploitable beyond defense-in-depth — PPTX export reader and any server-side HTML path should be audited.)
- Confirm pptxtojson 2.0.2 emits `vMerge`/`hMerge` as `0`/`1` integers vs booleans (M4).
