# Red-Team Security Adversary — Plan Review Report

**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Role:** Hostile security adversary (not collaborator)  
**Date:** 2026-07-09  
**Verdict:** **FAIL — do not cook as written**  
**Scope verified against:** plan + all `phase-*.md` + live `server/routes/pptx-import.js`, `pptx-import-job-manager.js`, `pptx-guards.js`, `media.js`, `mapper/*`, `sanitize.js`, `worker-runner.js`, `index.js`, `middleware/schemas.js`

Prior plan red-team (`red-team-and-validation.md`) treated security as a footnote (“disk fill”, “keep zip guards”). That is not a security review. Findings below are **attack-path real** against the plan’s *new* surface area.

---

## F-SEC-1

- **Severity:** Critical
- **Title:** Phase 07 EMF/WMF converter is untrusted-binary RCE with zero sandbox contract
- **Evidence:**
  - `phase-07-vector-media-emf-wmf-parity.md:21-22` — primary path is LibreOffice / ImageMagick / Inkscape CLI on EMF/WMF bytes
  - `phase-07-vector-media-emf-wmf-parity.md:30-31` — “Conversion in worker or subprocess with timeout” only
  - `phase-07-vector-media-emf-wmf-parity.md:37` — `emf/wmf bytes → convert subprocess → png/svg`
  - `phase-07-vector-media-emf-wmf-parity.md:59` — T7.6 only asserts “timeout kills hung converter”
  - `plan.md:164-167` — carry-forward lists zip/heap/SSRF media allowlist; **no** converter sandbox / argv / network isolation
  - Live pattern contrast: `server/routes/sync.js:40` uses `execFile` + timeout (still no sandbox, but argv-array); Phase 07 does not even mandate `execFile` over shell
- **Attack/Failure mode:**
  1. Attacker uploads PPTX with `ppt/media/evil.emf` (or WMF) crafted for known LO/ImageMagick parser bugs (historical RCE class).
  2. Import pipeline shells out to converter with that file as input.
  3. Converter process runs as the Node server user → arbitrary code, reverse shell, read `server/data/*`, steal GitHub tokens / AI keys from settings, pivot on Docker host if volume-mounted.
  4. Secondary: if implementation uses `shell: true` or string interpolation of paths/names, classic argv/shell injection even without parser bug.
  5. SVG conversion path can also produce hostile SVG that later hits editor/present (see F-SEC-5).
- **Why plan fails:**
  Timeout ≠ sandbox. “Worker or subprocess” reuses host UID, host FS, host network. EMF/WMF are **weaponized formats**; treating them like “just another image ext” is plan malpractice. No TDD case for: `execFile` only, fixed binary path allowlist, no shell, chroot/container, dropped caps, network-off, temp dir only, kill process group, reject converter stdout as executable. CI “install ImageMagick or LO” *increases* attack surface on the app host.
- **Suggested fix:**
  - **Default product path:** keep EMF/WMF as strict-fail unsupported unless conversion runs in a **disposable container/VM** with no mounts except input/output files, no network, CPU/mem/time hard limits, non-root.
  - If in-process CLI is unavoidable: `execFile(absoluteBinary, fixedArgv, { shell: false, timeout, killSignal })`, binary path from allowlist env, cwd = ephemeral dir, never pass user-controlled strings except the staged input path (UUID-only filename), never use ImageMagick `convert` policy-open defaults.
  - Add RED tests: shell metachar in filename rejected; converter not invoked with `shell:true`; network-blocked (mock); oversized/malformed EMF fails closed.
  - Prefer pure-JS EMF→SVG only if audited; still sanitize SVG before persist.

---

## F-SEC-2

- **Severity:** Critical
- **Title:** Plan expands unauthenticated job IDOR into durable original.pptx + full deck exfil; then scopes auth out
- **Evidence:**
  - `plan.md:160` — “Multi-tenant job auth (separate security plan)” **explicit out of scope**
  - `phase-01-zero-loss-package-and-sla-contract.md:26` — `GET` download original for presentation id
  - `phase-01-zero-loss-package-and-sla-contract.md:88` — route `GET /api/presentations/:id/pptx-original`
  - `server/routes/pptx-import.js:72-77` — admits jobs **not** bound to identity; hopes reverse proxy + UUIDv4
  - `server/routes/pptx-import.js:126-144` — `GET /jobs/:jobId` + SSE stream return `serializeJob` including **full `result`**
  - `server/services/pptx-import-job-manager.js:48-58` — serializes `result` to any poller
  - `server/services/pptx-import-job-manager.js:3` — `JOB_TTL_MS = 10 * 60 * 1000` (window for theft)
  - `server/index.js:101` — `/uploads` is world-static (extracted media already public by URL)
  - `server/index.js:69-81` — no app-level auth middleware on `/api/*` (rate limit only)
- **Attack/Failure mode:**
  1. **Job result theft (today, worsened by plan):** anyone who observes/guesses/leaks `jobId` (browser history, proxy logs, Referer, shared screen, XSS, LAN) polls `GET /api/pptx/jobs/:id` or hangs on SSE → full mapped presentation (text, notes, image URLs).
  2. **Phase 01 upgrade:** same presentation id (or new download route) yields **byte-identical original.pptx** — macros, embedded OLE, internal hyperlinks, author metadata, credentials in slides — not just the sanitized Nav model.
  3. **Presentation IDOR:** `GET /api/presentations/:id` + new `pptx-original` with no auth; id format is loose (`server/index.js:46-47` `[a-zA-Z0-9_-]+`), not even UUIDv4-only.
  4. Network-exposed Docker (`docker compose` port 3002) = multi-user in practice; “single-user model” is a fiction for self-host default.
- **Why plan fails:**
  Scoping multi-tenant auth out while **adding the highest-value downloadable artifact** is security scope fraud. Red-team table (`plan.md:173-183`) never lists IDOR/exfil. Comment in route file already documents the fix (“per-job secret”) and plan refuses to implement it. UUID opacity is not authorization.
- **Suggested fix:**
  - **Minimum before Phase 01 download ships:** bind job to unguessable **job secret** returned once at `202`; require `Authorization: Bearer <secret>` or query HMAC on status/SSE/cancel; do not put full presentation in job result over SSE if secret missing.
  - Presentation download: require same session/auth model as product will use in multi-user, **or** document “bind to localhost only” as hard deploy constraint + refuse to document public download API.
  - Prefer **server-side import→create transaction** so original never floats as unbound artifact id (also kills F-SEC-3).
  - Do not treat “separate security plan” as license to ship new confidential endpoints naked.

---

## F-SEC-3

- **Severity:** High
- **Title:** `pptxOriginal` client-bind path + `.passthrough()` schemas → path traversal / arbitrary file read via download
- **Evidence:**
  - `phase-01-zero-loss-package-and-sla-contract.md:20-24` — stores `pptxOriginal.filename` **or path under data dir**
  - `phase-01-zero-loss-package-and-sla-contract.md:42-45` — alternate path: job returns path/artifact; **HomePage createPresentation attaches**
  - `phase-01-zero-loss-package-and-sla-contract.md:73-74` — T1.2 only rejects `../` on **persist helper**, not on create/download route
  - `phase-01-zero-loss-package-and-sla-contract.md:77` — T1.5 “create with `pptxOriginal` stores metadata” (client-influenced)
  - `server/middleware/schemas.js:59-66` — `createPresentationSchema` is `.passthrough()` → arbitrary extra keys accepted today
  - `server/middleware/schemas.js:69-76` — update schema also `.passthrough()`
  - Live upload safety pattern exists (`presentations.js:503` `path.basename`) but plan does not require it for originals
- **Attack/Failure mode:**
  1. Attacker `POST /api/presentations` with `pptxOriginal: { filename: '../../settings.json' }` or absolute path (if plan stores path as given).
  2. `GET .../pptx-original` does `path.join(DATA_DIR, meta.filename)` without resolve+prefix check → **arbitrary file read** (settings AI keys, github-config token, other presentations).
  3. Or bind `originalArtifactId` from another user’s/job’s artifact if ids are enumerable and unbound.
  4. Symlink race: if persist allows following symlinks under data dir, delete-with-presentation can unlink outside tree.
- **Why plan fails:**
  Plan *knows* client-bind is risky (`phase-01:120`) but still leaves OR path and tests only helper-level `../`. Filename-or-path ambiguity (`filename` vs path) is classic traversal footgun. No requirement that download resolve realpath and assert `startsWith(pptxOriginalsRoot)`. No forbid of client-supplied absolute paths. `.passthrough()` means implementers can “just store req.body.pptxOriginal” and tests still green.
- **Suggested fix:**
  - **Server-only ownership:** import completion creates presentation row + original in one transaction; client never sends filesystem path.
  - Metadata stores **only** server-generated UUID basename; download = `join(root, basename(id+'.pptx'))` + `realpath` prefix check.
  - Strip `pptxOriginal` from client create/update schemas (reject if present) or allow only `originalArtifactId` redeemed server-side once, then invalidate.
  - TDD: create with `filename: '../settings.json'` → 400; download never leaves root; symlink escape rejected.

---

## F-SEC-4

- **Severity:** High
- **Title:** Plan claims “keep worker isolation” while Phase 03/07/02 force heavy untrusted work onto host process; zip/disk DoS under-specified
- **Evidence:**
  - `plan.md:164-166` — “Keep … worker heap/timeout”; “Scene graph parse: stay in worker **or** budget CPU”
  - `phase-03-ooxml-scene-graph-source-of-truth.md:28-30` — pure functions, “reuse zip already loaded”, **no worker mandate**
  - `phase-03:79-81` — “Wire into import after package validate” (main-process `importPptxFile` path)
  - Live main-process load: `pptx-guards.js:92-95` — `readFile` entire PPTX + `JSZip.loadAsync` on **host**
  - Live worker only wraps parser: `importer.js:34-40` validate on host → `runParserWorker` → `mapPptxOutput` on host
  - `pptx-guards.js:122-124` — `perEntryCap: maxDecompressedBytes` → **single entry may inflate to full 500MB budget**
  - `media.js:6` — `MAX_MEDIA_SIZE = 200MB` per media file (larger than upload intent confusion)
  - `phase-01` + `plan.md:179` — disk fill “lifecycle = presentation” only; **no aggregate quota**
  - `phase-07:30` — converter subprocess on host
  - `phase-02:23` — LibreOffice on corpus/import path (also host, also network-capable)
- **Attack/Failure mode:**
  1. **Event-loop / memory DoS:** attacker PPTX passes zip measured budget then forces Phase 03 full spTree/XML parse + theme/master walk on main thread → API freeze (live, share, games all share process).
  2. **Double inflate:** guards stream-count entries then mapper/`entry.async('nodebuffer')` materializes again (`media.js:126`) — peak RAM ≫ 100MB upload.
  3. **Disk DoS:** sequential imports (MAX_CONCURRENT=1 only limits parallel) store original (≤100MB) + extracted media (≤200MB each, many files) + uploads public; no `pptx-originals` volume cap; fill disk → crash all JSON storage.
  4. **Zip bomb regression risk:** Phase 03/08 re-read package parts for roundtrip; if new code paths call JSZip without `validatePptxPackage` first (export hybrid, oracle, CLI), guards bypassed.
  5. **SSRF via LO (Phase 02/07):** LibreOffice resolving external linked images in PPTX/EMF → cloud metadata SSRF; plan SSRF note (`plan.md:167`) only covers `MEDIA_URL_ALLOWLIST` for mapped http(s) media, not LO.
- **Why plan fails:**
  “Stay in worker **or** budget CPU” is an escape hatch — Phase 03 chooses pure-main. No RED test that scene graph runs under worker heap cap. No aggregate disk quota test. No LO `--nofirststartwizard` network isolation. Existing zip-bomb tests (`zip-bomb-guard.test.js`) only cover `validatePptxPackage`; plan does not require re-guard on new OOXML readers.
- **Suggested fix:**
  - **Hard requirement:** all untrusted XML parse + conversion in isolated worker/container with same heap/time kill as parser (`PARSER_MAX_OLD_SPACE_MB`, timeout).
  - Cap **per-entry** inflate far below total budget (e.g. 32MB XML / 50MB media); reject on second materialization over cap.
  - Global disk quota for `pptx-originals` + import media bucket; fail import 507 when exceeded.
  - LO/ImageMagick: network namespace off / `http_proxy=127.0.0.1:0` / container `--network=none`.
  - Any new ZIP open path must call shared `validatePptxPackage` or fail CI grep gate.

---

## F-SEC-5

- **Severity:** High
- **Title:** Untrusted PPTX colors/HTML/SVG XSS survives plan; Phase 04 partial sanitize is late and incomplete
- **Evidence:**
  - `mapper/utils-color.js:1-8` — `colorValue` returns **any non-empty string** (no CSS allowlist)
  - `mapper/map-shape.js:58,71-77,88-89` — fill/stroke from `colorValue`; SVG `fill="${svgAttr(fill)}"` embeds attacker color into HTML SVG
  - `mapper/map-presentation.js:129-132` — slide background color via `colorValue`
  - `mapper/map-table.js:107-108` — **raw** `cell.fontColor` / `cell.fillColor` into `cellStyles` (borders sanitized, cells not)
  - `mapper/map-table.js:157` — `headerBgColor = element.fill.value` unsanitized
  - `acceptance-criteria.js:64-109` — dangerous CSS checks only rich HTML strings, **not** `element.fill` / `stroke` / `cellStyles`
  - `phase-04-editable-primitives-parity.md:25,54-55` — `sanitizeCssColor` + T4.5 only in Phase **04** (after 01–03 ship)
  - `phase-07:24` — map EMF convert to `image` **or `svg`** with real `src`/content — **no SVG sanitize requirement**
  - Client: `canvas-element-wrapper.jsx:140,475` — `dangerouslySetInnerHTML` for content (rich text path sanitized; SVG/shape paths differ)
  - `sanitize.js` / `rich-text-style-sanitizer.js` good for HTML styles; **not applied** to shape fill fields
- **Attack/Failure mode:**
  1. PPTX shape fill `red; expression(alert(1))` or `url(javascript:...)` / broken-out CSS if client applies fill as style string.
  2. Table cell colors injected into DOM styles without `sanitizeCssColor`.
  3. Custom geometry SVG path content already entity-escaped, but **malicious fill/stroke** and future EMF→SVG can include `<script>`, event handlers, external refs if stored as `type:'svg'` content.
  4. Stored XSS in presentation JSON → hits every editor/present/share viewer (share links are public surface).
  5. Phase 08 original-part roundtrip may reintroduce macro-adjacent objects; combined with present HTML export increases blast radius.
- **Why plan fails:**
  Phase 04 T4.5 is necessary but: (a) **too late** for Phase 01–03 imports already persisting toxic fields; (b) table cell colors and gradients (`gradientBackground` concatenates `stop.color` raw at `utils-color.js:48`) not listed; (c) Phase 07 SVG output has **zero** sanitize/acceptance tests; (d) acceptance criteria still HTML-centric. Plan red-team never filed XSS.
- **Suggested fix:**
  - Promote **color sanitize to Phase 01/03 invariant** (or immediately in G0): reuse table’s `sanitizeCssColor` for all fill/stroke/textColor/gradient stops; reject non-hex/rgb/named-safe.
  - Runtime `assertPresentationAcceptance` must scan `fill`, `stroke`, `cellStyles.*`, backgrounds — not only HTML.
  - EMF→SVG: run through `sanitizeSvgHtml` (`shared/src/content-safety.js`) or force raster PNG only for untrusted convert output.
  - TDD adversarial fixtures: toxic fill, toxic table cell color, toxic SVG from converter mock → import strips or fails strict.

---

## Summary table

| ID | Sev | Title | Blocks cook? |
|----|-----|-------|--------------|
| F-SEC-1 | Critical | Phase 07 converter RCE | **Yes** — rewrite Phase 07 security contract before any CLI convert |
| F-SEC-2 | Critical | Job IDOR + original.pptx exfil; auth scoped out | **Yes** — auth/secret binding before download API |
| F-SEC-3 | High | Client `pptxOriginal` path traversal | **Yes** — server-only bind + realpath tests |
| F-SEC-4 | High | Worker isolation lie + zip/disk/SSRF DoS | **Yes** for Phase 03/02 wiring; amend isolation + quotas |
| F-SEC-5 | High | Color/SVG XSS incomplete & late | Amend Phase 01/03 gates; expand Phase 04/07 tests |

---

## What the plan’s own red-team missed

| Claimed amendment (`plan.md:173-183`) | Reality |
|---------------------------------------|---------|
| Disk filled by originals | Lifecycle only; no quota, no media double-count |
| Keep zip guards | Not re-applied to scene graph / LO / export hybrid |
| External media allowlist / no SSRF | LO/converter network not constrained |
| Multi-tenant out of scope | Still ships new confidential GET |
| (no XSS row) | `colorValue` still wild-west; Phase 04 partial |

**Inline red-team result `conditional-pass-with-amendments` is invalid for security.** Re-open plan frontmatter: `redTeamResult` must not pass until F-SEC-1..3 have phase-level requirements + TDD IDs.

---

## Recommended plan amendments (planner action)

1. **Phase 01 rewrite security section:** server-side import→create; UUID-only originals; realpath download; job secret; no client path fields; aggregate disk quota test T1.9+.
2. **Phase 03:** scene graph **must** run in worker; per-entry XML size cap; no main-thread multi-100MB parse.
3. **Phase 02/07:** converter/oracle **network-none** + `execFile` only + sandbox; or defer EMF convert to optional offline tool.
4. **Phase 04/07:** full CSS color + SVG sanitize in acceptance; toxic fixtures mandatory.
5. **Remove** “multi-tenant auth out of scope” as cover for new download endpoints — either implement minimal secret/auth or do not ship download outside localhost-only deploy mode documented as security boundary.

---

## Unresolved questions

1. Is production deploy model **localhost/Electron-only** or **network-exposed Docker**? Plan assumes former; default compose is latter — security bar changes completely.
2. Will product accept EMF/WMF as **permanent unsupported** rather than host-side LO convert? (Security-prefer yes.)
3. Is there a planned auth system timeline, or must import secrets be self-contained forever?

---

## Metrics (review process)

- Plan files read: `plan.md`, `phase-01`…`phase-08`, `red-team-and-validation.md`
- Code areas verified: routes, job manager, guards, media, mapper colors/tables, sanitize, worker, schemas, static uploads
- Findings returned: **5** (cap)
- Severity mix: 2 Critical, 3 High
)
