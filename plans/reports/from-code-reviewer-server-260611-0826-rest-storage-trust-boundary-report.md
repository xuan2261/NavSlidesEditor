# Code Review — R5: Server REST API + Storage + AI/Sync/Share

Date: 2026-06-11
Reviewer: code-reviewer (read-only)
Scope: server/index.js, server/routes/*, server/services/{storage,ai-provider,ai-endpoint-guard,plugin-runtime}.js, server/middleware/*
Security model: single-user self-hosted, trusted-author HTML/CSS/JS intentional. Flagged only real trust-boundary / data-integrity / correctness defects.

## Summary counts
- Critical: 1
- Important: 5
- Medium: 6
- Low: 4

---

## CRITICAL

### C1. Soft-deleted (trashed) presentations stay publicly readable + still served on share links
Files:
- `server/routes/presentations.js:249-258` (`GET /:id` — no `deletedAt` filter)
- `server/index.js:153-173` (`renderShareView` — finds by id, no `deletedAt` check)
- `server/routes/presentations.js:282-296` (`DELETE /:id` soft-delete: sets `deletedAt`, does NOT revoke share tokens)
- `server/routes/explore.js:63-66` (fork finds original with no `deletedAt` filter)

Problem: `DELETE /api/presentations/:id` is a soft delete (sets `deletedAt`). Share-token cascade revoke only runs on the *permanent* delete path (`presentations.js:328-339`). So after a user "deletes" a deck:
- its public `/share/:token` link keeps rendering it (`renderShareView` has no `deletedAt` guard),
- `GET /api/presentations/:id` still returns full content,
- `/api/explore/:token/fork` still clones it.

Impact: data the user believes is deleted remains exposed to anyone holding the share URL. Trust-boundary + data-exposure defect.

Fix: in `renderShareView`, `GET /:id`, present/export, and explore fork, treat `presentation.deletedAt` as not-found (404). Optionally revoke/disable share tokens on soft delete too.

---

## IMPORTANT

### I1. Non-atomic read-modify-write on share tokens → lost updates / revoke can silently undo
File: `server/routes/share.js:50-92` (`POST /:id/share`), `:103-119` (`DELETE /:id/share`)
Problem: these handlers call `readShareTokens()` then `writeShareTokens()` as two separate locked ops, instead of the provided atomic `withShareTokens()` (storage.js:160-167). Two concurrent requests — e.g. a share-create racing a revoke, or racing `incrementShareViews` (index.js:183-194, which *does* use the atomic helper) — interleave read/modify/write and lose one side's change.
Impact: a revoked token can reappear, or a freshly created token can vanish. For share tokens this is a security-relevant lost update (revoke not honored).
Fix: wrap both in `withShareTokens((tokens) => { ... })`.

Same lost-update pattern (lower security weight) in:
- `server/routes/templates.js` POST/PUT/DELETE (read+writeTemplates, lines 39-41, 63-72, 82-87)
- `server/routes/presentations.js:435-453` (`save-as-template`, read+writeTemplates)
- `server/routes/explore.js:63-76` (fork: readPresentations + writePresentations)
- `server/routes/history.js:64-72` (restore: readPresentations + writePresentations)
Storage already exposes `withPresentations`/`withTemplates`-style helpers; `withTemplates` atomic wrapper is missing but `withFileLock(TEMPLATES_FILE,…)` could wrap read+mutate+write.

### I2. Settings PUT: shallow merge wipes AI credentials; no validation
File: `server/routes/settings.js:24-46`
Problem: `updated = { ...existing, ...req.body }` is a top-level shallow merge. If the client sends `{ ai: { provider: 'openai', model: 'x' } }` (no apiKey), the whole `ai` object is replaced and the stored `apiKey` is lost. The restore guard only fires when `updated.ai.apiKey === '***configured***'` (line 30); if apiKey is simply omitted, `updated.ai.apiKey` is `undefined` and the real key is silently dropped. No Zod schema → arbitrary keys writable.
Impact: credential/data loss on a partial settings update; unvalidated writes.
Fix: deep-merge `ai` (preserve existing apiKey when incoming is undefined or the mask sentinel), add a Zod schema.

### I3. History restore overwrites current state with no safety snapshot
File: `server/routes/history.js:58-77`
Problem: restore replaces `presentations[index]` with `snapshot.data` and immediately persists. No automatic pre-restore snapshot of the current deck.
Impact: an accidental restore is unrecoverable; current edits lost.
Fix: take an auto-snapshot of current state before applying restore (or keep a single "pre-restore" backup).

### I4. Public, unauthenticated write endpoint: explore fork creates server-side presentations
File: `server/routes/explore.js:45-82`
Problem: `POST /api/explore/:token/fork` lets anyone holding a (non-password) share token write a new full presentation into `presentations.json`. Only bounded by the global `/api/` rate limiter (300/15min prod). No size cap, no auth.
Impact: anonymous storage growth / abuse vector on a multi-user-via-proxy deployment; also forks trashed decks (see C1).
Fix: gate forking behind an explicit "allow fork" flag on the token, exclude `deletedAt`, and consider a dedicated tighter rate limit.

### I5. SSRF guard is DNS-resolve TOCTOU and easily skipped via allowlist; only custom provider guarded
Files: `server/services/ai-endpoint-guard.js:47-84`, `server/services/ai-provider.js:67-88`
Problem: `assertSafeAiEndpoint` resolves the hostname, checks the IPs, then returns the *hostname* URL; `fetch` re-resolves DNS independently → classic DNS-rebinding TOCTOU (first lookup public, fetch lookup internal). Allowlist entries bypass all IP checks (`:66`). `redirect:'manual'` (provider.js:79) correctly blocks redirect-based SSRF — good. Guard is applied only to `custom`; openai/gemini are hardcoded hosts, so acceptable there.
Impact: a malicious custom endpoint host can target internal services via rebinding. Lower likelihood on single-user self-host, but it is the explicit SSRF boundary.
Fix: resolve once and connect to the validated IP (pin), or re-validate the socket's remote address; document allowlist as fully-trusting.

---

## MEDIUM

### M1. Unbounded history snapshot growth
File: `server/routes/history.js:10-30`
No cap on snapshot count per presentation; each is a full deep copy. Disk grows without bound. Add a retention cap (e.g. keep N most recent).

### M2. rclone error stderr returned to client
Files: `server/routes/sync.js:40-45`, `:99-102`, `:134`
`runRclone` rejects with raw `stderr`, surfaced via `res.json({ error: err.message })`. Password is obscured (good), but remote names/paths/config diagnostics leak to the API caller. Prefer a generic message + server-side log.

### M3. `POST /api/presentations/:id/raster-elements` unbounded work, no validation
File: `server/routes/presentations.js:233-246`
Accepts an arbitrary `presentation` payload (50mb json limit) and runs `rasterizeComplexElements` (headless render). No element-count/size cap → CPU/memory DoS. Only the 50mb body limit + global limiter apply. Add input bounds.

### M4. GitHub branch/ref values interpolated into API paths unescaped
File: `server/routes/github.js:88-124,200-208`
`branch` (from repo default_branch) and `folderName` are interpolated into `gh()` endpoint paths. `folderName` is sanitized to `[a-z0-9_-]` (`:81-83`); `branch` comes from GitHub so trusted. Low real risk, but README `viewUrl` uses `encodeURIComponent(folder)` while tree paths don't — inconsistent. Not a security hole given the source, noted for correctness.

### M5. media.js: sync fs in request path + DB-filter param inconsistency
File: `server/routes/media.js:19-70` (sync `readdirSync`/`statSync` block event loop), `:99-111` (DELETE filters DB by raw `req.params.filename` but deletes file by `path.basename(...)` — if param contained path segments, file and DB entry use different keys → orphaned DB record). DELETE file path uses `path.basename` so no traversal. Normalize both to basename; use async fs.

### M6. `GET /api/presentations/:id` leaks raw `err.message` (and most routes 500 with `err.message`)
Files: pervasive — e.g. `presentations.js:92,202,256…`, `share.js`, `history.js`, `templates.js`.
Internal error strings (incl. fs paths) returned to clients. error-handler.js masks for thrown errors, but these routes catch and echo `err.message` directly, bypassing it. Low data-sensitivity here but inconsistent with the central handler. Prefer generic message + log, or `next(err)`.

---

## LOW

### L1. `POST /share/:token` throws 500 when token has no password but `pwd` posted
File: `server/index.js:266-277` — `bcrypt.compare(pwd, tokenData.password)` with `tokenData.password === undefined` throws (verified: "Illegal arguments: string, undefined") → 500 instead of graceful redirect. Guard `if (!tokenData.password) return …render directly`.

### L2. SVG uploads bypass magic-byte check (file-type can't sniff SVG)
File: `server/routes/upload.js:91-102` — falls back to extension allow. SVG can carry scripts; served from `/uploads` static (app origin). Acceptable under trusted-author model, but note: share viewers loading author SVGs run in app origin. Consider sanitizing or serving uploads with `Content-Disposition`/sandboxed origin.

### L3. `upload-hashes.json` written without atomic temp+rename
File: `server/routes/upload.js:20-23` and `server/routes/presentations.js:65-73` — both write the hash index via plain `fs.writeFile`/`fs.writeJson` (locked, but not atomic). A crash mid-write corrupts the dedup index. Use the storage `writeJsonAtomic` pattern.

### L4. Two independent hash-index writers for the same file
Files: `server/routes/upload.js:9` (`HASHES_FILE`) and `server/routes/presentations.js:21` (`UPLOAD_HASHES_FILE`) both target `DATA_DIR/upload-hashes.json` with separate `withUploadHashes` wrappers. They share `withFileLock(filePath)` keyed by the same absolute path, so locking is consistent — but the duplicated logic is a drift hazard (one uses atomic, neither does here). Consolidate into storage.js.

---

## Positive observations (risk calibration)
- storage.js uses a real promise-chained per-file lock + atomic temp+rename with Windows EPERM/EBUSY retry and stale-tmp cleanup scoped to other PIDs — solid foundation. The bugs above are routes *bypassing* it, not the primitive.
- Share password uses bcrypt; password never placed in URL (POST form), `Referrer-Policy` set on share view, customCSS `expression()`/`javascript:` stripped.
- Upload: extension allow-list + file-type magic-byte verification + uuid filenames + per-presentation SHA-256 dedup under lock; multer 100MB cap. `:id` param regex-validated globally (index.js:47-54).
- AI provider failures return 502 with generic message and log internally (ai.js); custom endpoint uses `redirect:'manual'`.

## Unresolved questions
1. Is multi-user-behind-proxy a supported deployment? If yes, C1 + I4 (public fork / trashed-deck exposure) rise in severity.
2. Intended behavior of soft-delete vs share links — should trashing revoke/suspend shares, or keep links alive until permanent delete?
3. Should settings PUT accept partial nested updates (deep merge) or full replacement? Current shallow merge is the root of I2.
