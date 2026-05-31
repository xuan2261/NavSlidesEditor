---
phase: 5
title: "Media hardening: SHA256 dedup + extension allowlist + magic bytes"
status: complete
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 5 — Media Hardening: SHA256 Dedup + Extension Allowlist + Magic Bytes

`media.js` has no SHA256 dedup (P1-H), no extension allowlist (S2 — `image1.html` could become served XSS), and only partial magic-byte sniffing. Reuse the established pattern from `server/routes/upload.js` which already does all three correctly.

## Context Links

- Brainstorm: P1-H, S2
- Pattern reference: `server/routes/upload.js` (139 LOC) — SHA256 dedup + `ALLOWED_UPLOAD_EXTENSIONS` + `file-type` magic-byte verification
- Source: `server/services/pptx-import/media.js:75` (persistImageBuffer), :93 (persistMediaBlob), :99 (extension extraction)

## Overview

- Priority: P1
- Brief: Three independent hardening edits to `media.js`. (a) SHA256 dedup — if same hash exists in `uploads/`, return existing UUID. (b) Extension allowlist — reject `.html`/`.js`/`.exe`/etc. (c) Magic-byte verification for media (not just images) using `file-type` package already in deps.

## Key Insights

- `upload.js` is the proven pattern; do NOT invent new dedup scheme.
- **Red-team verified:** Dedup table = existing `server/data/upload-hashes.json` maintained by `withUploadHashes(...)` in `upload.js:104-133`. Reuse this lookup; do NOT scan `server/uploads/` filesystem (2,865+ files → O(N²) per import).
- **Red-team verified:** `file-type@22.0.0` is ESM-only since v17 — `require('file-type')` throws `ERR_REQUIRE_ESM`. `upload.js:93` uses `await import('file-type')`. Mirror exactly.
- **Red-team verified:** Use `<uuid>.<ext>` filename (same as `upload.js:69`) — do NOT use `<hash>.<ext>` because public share routes expose `/uploads/<filename>` and hash names enable URL enumeration / content guessing. Dedup is a separate lookup table, not a filename convention.
- Allowlist must include video/audio formats too: `png|jpg|jpeg|gif|webp|bmp|mp4|mp3|wav|ogg|webm`.
- `.svg` deliberately excluded — SVG can contain `<script>`.
- **Red-team verified:** `mapVideo`/`mapAudio` at `mapper.js:436-448, 466-477` pass external `https?://` URLs through verbatim. Tracking-pixel domains leak importer IP/UA/referer on first render. Add same-origin/allowlist gate for external media in this phase.
- **Red-team verified:** `media.js:99` uses `split('.').pop()` for extension — fails on dotless filenames (returns full name) and on `..exe` (returns `exe`). Switch to `path.extname(name).toLowerCase().slice(1)`; reject empty string.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/media.js` | Modify | +60/-10 |
| `server/services/pptx-import/media-dedup.js` | Create | +68 |
| `server/services/pptx-import/media.test.js` | Modify | +140 |
| `server/services/pptx-import/constants.js` | Modify | +10 (export `ALLOWED_MEDIA_EXTENSIONS` + URL allowlist builder) |
| `server/services/pptx-import/mapper.js` | Modify (mapVideo, mapAudio external URL gate at :436-448, :466-477) | +20/-4 |
| `server/routes/upload.js` | Read-only reference (pattern for `await import('file-type')`, `withFileLock`, `withUploadHashes`) | 0 |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `media.test.js` (56 LOC + Phase 2 additions) | Yes | Add dedup/allowlist/magic cases |
| `pptx-import-e2e-flow.test.js` | Verify still green | E2E must work with new persistence |
| `mapper-golden-master.test.js` | Re-baseline | UUIDs in snapshots already stripped; should not change |

New tests: +6-8 cases.

## Function/Interface Checklist

- `persistImageBuffer(buffer, hintedMime)` — add SHA256 dedup (reuse upload-hashes index):
  ```js
  const { fileTypeFromBuffer } = await import('file-type')  // ESM-only since v17
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const indexedUrl = await lookupHash(hash)  // reads upload-hashes.json
  if (indexedUrl) return { url: indexedUrl }
  ```
- `persistMediaBlob(zipEntry, ...)`:
  - Add extension allowlist check BEFORE persist using `path.extname`:
    ```js
    const ext = path.extname(zipEntry.name).toLowerCase().slice(1)
    if (!ext || !ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
      return { url: null, warning: { code: 'media-extension-rejected', ext } }
    }
    ```
  - Add magic-byte verification via `file-type` package (dynamic import):
    ```js
    const { fileTypeFromBuffer } = await import('file-type')
    const detected = await fileTypeFromBuffer(buffer)
    if (!detected || !ALLOWED_MEDIA_EXTENSIONS.has(detected.ext)) {
      return { url: null, warning: { code: 'media-magic-mismatch', claimed: ext, sniffed: detected?.ext } }
    }
    ```
  - Add SHA256 dedup via `lookupHash` + `withFileLock(hash)` (same pattern as `persistImageBuffer`).
- New `lookupHash(hash)` helper — reads `server/data/upload-hashes.json` (existing index maintained by `withUploadHashes` in `upload.js:104-133`). Returns existing `/uploads/<uuid>.<ext>` URL if hash present, else null.
- New `registerHash(hash, url)` helper — wraps `withFileLock(hash)` from `upload.js:25-32` to serialize concurrent writes; appends to `upload-hashes.json`. **Required** to prevent TOCTOU race on concurrent imports of identical media.
- Filenames remain `<uuid>.<ext>` (NOT `<hash>.<ext>`) — share-link URL enumeration mitigation.
- **External URL hardening for video/audio (mapper.js:436-448, 466-477)**:
  ```js
  // Validation-session decision: localhost + same-origin (via process.env.PUBLIC_HOST / HOST).
  function buildMediaUrlAllowlist() {
    const list = new Set(['localhost', '127.0.0.1'])
    const sameOrigin = process.env.PUBLIC_HOST || process.env.HOST
    if (sameOrigin) {
      const host = sameOrigin.replace(/:\d+$/, '').toLowerCase()  // strip port if present
      if (host) list.add(host)
    }
    return list
  }
  const MEDIA_URL_ALLOWLIST = buildMediaUrlAllowlist()
  function gateExternalMediaUrl(url, warnings) {
    if (!/^https?:/i.test(url)) return url  // relative/data refs OK
    const host = new URL(url).hostname
    if (MEDIA_URL_ALLOWLIST.has(host)) return url
    warnings.push({ code: 'media-external-url-blocked', host })
    return null  // mapper drops to media-missing placeholder
  }
  ```
  Wire into `mapVideo`/`mapAudio` before returning the element. Settings-page-driven allowlist deferred to follow-up plan.
- New constant `ALLOWED_MEDIA_EXTENSIONS = new Set(['png','jpg','jpeg','gif','webp','bmp','mp4','mp3','wav','ogg','webm'])` in `constants.js`.

## Dependency Map

- Blocks: Phase 9 (security gates may be added to acceptance)
- Blocked by: Phase 1 (baseline)

## Tests Before (Characterization Gate)

- [x] Confirm `npm test` green
- [x] `npx vitest run server/services/pptx-import/media.test.js` — green (with Phase 2 additions)
- [x] Read `server/routes/upload.js` for reference pattern; note `file-type` package usage at upload.js:~40

## Refactor / Implement

- [x] Add `ALLOWED_MEDIA_EXTENSIONS` Set to `constants.js`.
- [x] In `media.js`, add hash lookup/register helpers — implemented in `media-dedup.js` to keep `media.js` below the 200 LOC hard limit. Reuses `server/data/upload-hashes.json`; does not scan `server/uploads/`.
- [x] Use `await import('file-type')` (NOT `require`) — package is ESM-only since v17; `upload.js:93` already does this.
- [x] Modify `persistImageBuffer`:
  1. Compute SHA256.
  2. `lookupHash(hash)` → if exists, return `{ url }`.
  3. Otherwise generate UUID filename (NOT hash filename), wrap persist + `registerHash` in `withFileLock(hash)` from upload.js:25-32 to prevent TOCTOU.
- [x] Modify `persistMediaBlob`:
  1. Extract extension via `path.extname(zipEntry.name).toLowerCase().slice(1)`; reject empty / not-in-allowlist (return warning, null url).
  2. Sniff magic bytes via dynamic import; reject if mismatch with claimed.
  3. Compute SHA256, dedup + persist as above with `withFileLock`.
- [x] Add `gateExternalMediaUrl` helper used by `mapVideo`/`mapAudio`: block external URLs not in allowlist; push warning; return null to surface as `media-missing` placeholder.
- [x] Verify no other call site assumes filename equals UUID — share routes serve `/uploads/<filename>` so dedup preserves the existing UUID-named URL when found.

## Tests After (New Unit Tests)

- [x] `media.test.js`:
  - `it('returns existing URL when buffer hash matches via upload-hashes.json')`
  - `it('rejects .html extension in zip entry')`
  - `it('rejects .svg extension')`
  - `it('rejects empty/dotless extension (path.extname returns "")')`
  - `it('rejects when magic bytes mismatch extension')`
  - `it('allows mp4 magic bytes through')`
  - `it('writes file with uuid-based name (not hash-based)')`
  - `it('returns warning when extension rejected')`
  - `it('serializes concurrent identical-content writes via withFileLock')` (use Promise.all to simulate race)
- [x] `mapper.test.js` additions:
  - `it('mapVideo blocks external https URL not in allowlist')`
  - `it('mapAudio passes localhost URL through unchanged')`
  - `it('passes PUBLIC_HOST same-origin URL refs through unchanged')`
- [x] Verify `file-type` package available: `server/package.json` shows `"^22.0.0"` (ESM-only); confirm `await import` in upload.js works.

## Regression Gate

- [x] `npm test` — full suite green (`171 passed | 1 skipped`, `1470 passed | 9 skipped`)
- [x] `npm test -- --coverage` — final plan coverage gate passed after Phase 9: 182 files passed, 1521 tests passed, thresholds preserved.
- [x] LOC budget: `media.js` is 186 LOC and `media-dedup.js` is 68 LOC; under the 200 LOC hard limit.
- [x] `npm run test:corpus` — 4/4 passed, avg semantic fidelity 100.0%, avg round-trip stability 99.0%.

## Completion Notes

- Added SHA256 dedup for imported images and media blobs through `server/data/upload-hashes.json`.
- Reuses existing UUID filenames from the hash index and writes new media as `<uuid>.<ext>`.
- Rejects `.html`, `.svg`, dotless refs, disallowed extensions, and magic-byte mismatches before writing.
- Allows `mp4`, `mp3`, `wav`, `ogg`, and `webm` when magic bytes match; `file-type`'s `ogx` result is normalized for claimed `.ogg`.
- Blocks external `http(s)` video/audio URLs except localhost, `127.0.0.1`, and same-origin hosts from `PUBLIC_HOST`/`HOST`.
- Code review completed with concerns; follow-up concerns were addressed except git staging. `server/services/pptx-import/media-dedup.js` is a new file and must be included when committing.

## Success Criteria

- Re-importing same PPTX twice does NOT duplicate `uploads/` files.
- Embedding `image1.html` in a synthetic PPTX fixture is rejected with warning.
- Magic-byte mismatch (e.g., `.png` extension on `.exe` content) rejected.

## Risk Assessment

- Risk: `upload-hashes.json` grows unbounded as imports accumulate. Mitigation: existing `upload.js:104-133` index handles this for the upload route already; no new growth path introduced.
- Risk: `file-type` package version mismatch between ESM imports. Mitigation: pin version in `package.json`; verify ESM interop (upload.js:93 already uses it, so it works).
- Risk: external-URL allowlist too narrow (legitimate self-hosted media on non-localhost host). Mitigation: extend `MEDIA_URL_ALLOWLIST` via settings; defer to user config in follow-up.
- Risk: LOC budget overflow on `media.js`. Mitigation: extract `lookupHash`/`registerHash` to `media-dedup.js` if needed.

## Rollback Plan

- Revert `media.js`, `constants.js`, `mapper.js` (mapVideo/mapAudio gate). Existing `upload-hashes.json` index is untouched (additive only); no migration needed.

## Completion Notes

1. Final reviewer-fix validation added cleanup for newly written upload files when cancellation arrives before or after hash-index persistence.
2. Media abort cleanup is covered by `server/services/pptx-import/media.test.js` and passed with full `npm test`.
