# Code Review: Server & Electron

## Executive Summary

Reviewed: `server/index.js`, `electron/main.js`, `electron/preload.js`, 15 route files, 3 service files, middleware, and package.json. The codebase is generally well-structured with good security hygiene in several areas (UUID validation on all ID params, Zod schema validation, file locking, rate limiting). However, there are critical gaps: no authentication on any endpoint, sandbox disabled in Electron, SVG upload is an XSS vector, and several data-boundary issues.

---

## Critical Security Issues (Must Fix)

### 1. SVG Upload XSS Vector
**File:** `server/routes/upload.js:33` (`ALLOWED_UPLOAD_EXTENSIONS` includes `.svg`)

SVG files can embed JavaScript (`<script>`, event handlers like `onload`). These files are served statically at `/uploads/`. When a presentation embeds an SVG uploaded via this route, the JS executes in the viewer's browser.

**Evidence:** `.svg` is in the allowlist with magic-byte detection limited to MIME prefixes `image/`, `video/`, `audio/`, `application/pdf`. SVG served from `/uploads/` with `Content-Type: image/svg+xml` will execute embedded scripts.

**Fix:** Either block SVG uploads entirely, or sanitize SVG content server-side to strip `<script>` tags and event handler attributes (onload, onerror, etc.) before saving, and serve SVG with `Content-Disposition: attachment` to prevent inline execution.

---

### 2. Electron Sandbox Disabled
**File:** `electron/main.js:2,8`
```js
process.env.ELECTRON_DISABLE_SANDBOX = '1'
app.commandLine.appendSwitch('no-sandbox')
```

Disabling Chromium's security sandbox removes a critical defense layer. While `nodeIntegration: false` and `contextIsolation: true` are correctly set, the sandbox also mitigates renderer process exploits (e.g., out-of-bounds memory reads, UXSS). In an Electron app that loads external URLs via `shell.openExternal`, this is a compounded risk.

**Fix:** Remove both sandbox-disabling lines. If sandbox causes issues (e.g., when loading `file://` URLs or certain dev tools), address the root cause rather than disabling the sandbox globally.

---

### 3. No Authentication on Any Server Route
**File:** `server/index.js` (all routers)

Every API endpoint is unauthenticated. Any client that can reach the server port can create, read, update, and delete any presentation, template, share token, or setting. This is a complete authorization bypass. For a self-hosted personal tool this may be acceptable, but it must be documented. If multi-user or public hosting is ever intended, this is a foundational security flaw.

**Evidence:** Zero middleware checking identity or permissions. `PUT /api/presentations/:id` at `server/routes/presentations.js:204` accepts any request body and overwrites presentation fields.

**Fix:** Either (a) add an explicit "no auth" comment in the README and server code, or (b) implement basic auth middleware (e.g., API key header check) before any production deployment.

---

### 4. Settings PUT Allows Arbitrary Field Injection
**File:** `server/routes/settings.js:27`
```js
const updated = { ...existing, ...req.body }
```

No schema validation on `PUT /api/settings`. The client can inject any top-level key into the settings object, including nested objects. While `ai.apiKey` is protected by the `***configured***` sentinel, other fields are not.

**Fix:** Add Zod schema validation for settings update, whitelist allowed fields: `ai`, `defaultTheme`, `defaultTransition`, etc.

---

### 5. Templates POST/PUT Lack Schema Validation
**File:** `server/routes/templates.js:29-46, 61-77`

Templates are created and updated with raw `req.body` spread into the object. No validation ensures `slides` is an array, `id` is a valid UUID, or fields conform to expected shapes. Malformed templates could corrupt the templates storage file.

**Fix:** Apply `validate(createPresentationSchema)` or a dedicated template schema to POST and PUT handlers in the templates router, matching what is done for presentations.

---

### 6. Share Token Deletion Has No Authorization
**File:** `server/index.js:119-129`
```js
app.delete('/api/shares/:token', async (req, res) => {
  // deletes any token regardless of ownership
  delete tokens[req.params.token]
```

Any client can delete any share token by guessing the token UUID. There is no check that the requester owns the associated presentation.

**Fix:** Require presentation ownership check (by checking if the requesting client has the right to delete shares for that presentation), or scope deletion to the authenticated user's tokens.

---

## High Priority Issues

### 7. Incomplete HTML/CSS Sanitization in Share View
**File:** `server/index.js:150-155`
```js
sanitized.customCSS = sanitized.customCSS
  .replace(/expression\s*\(/gi, '/* blocked */(')
  .replace(/javascript\s*:/gi, '/* blocked */:')
  .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
```

Only CSS expression and javascript: URL patterns are blocked. Data URLs (which can encode arbitrary content), `@import`, and other CSS-based injection vectors are not handled. The main presentation HTML body content is not sanitized at all.

**Evidence:** `generateRevealHTML(sanitized)` at line 157 receives the full presentation object including arbitrary HTML in text elements, code blocks, etc. DOMPurify is available as a dependency (`server/package.json`) but not used server-side for share view rendering.

**Fix:** Use DOMPurify on the generated HTML before serving it, or sanitize each element's `content` field before HTML generation.

---

### 8. Custom AI Endpoint SSRF Gap — IPv6 Loopback Not Fully Blocked
**File:** `server/services/ai-endpoint-guard.js:27-37`

IPv6 loopback (`::1`) is blocked, but IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) are handled via mapped address check. However, other IPv6 addresses in private ranges (`fc00::`, `fd00::`) are blocked, but the block for `fe80::` (link-local) only covers `fe80-fe8b` which is incomplete (link-local spans `fe80::/10`). Also, the allowlist check is a simple string equality — not a suffix match, so `evil.example.com` won't match `example.com`.

**Fix:** Block all of `fe80::/10` (not just `fe80-fe8b`). Implement allowlist as suffix match or hostname comparison.

---

### 9. Socket.IO Room Codes Are Enumerable
**File:** `server/services/live-rooms.js:28-32`
```js
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes, (value) => chars[value % chars.length]).join('')
}
```

6 random bytes with 36-character alphabet = ~2.8 billion possibilities. While not trivially guessable, room codes are shown to viewers and could be harvested, enabling a determined attacker to predict or brute-force codes for meeting hijacking. No rate limiting on Socket.IO connection attempts.

**Fix:** (a) Use `crypto.randomBytes(10)` for room codes (36^10 ~ 3.6e15 combinations), or (b) add a per-IP Socket.IO connection rate limiter, or (c) add room passwords.

---

### 10. Rate Limiting Is Per-IP, Not Per-User
**File:** `server/index.js:69-88`

All rate limiters use `express-rate-limit` defaults, which key by IP address. In scenarios with shared IPs (NAT, corporate networks, proxy), legitimate users are penalized. For unauthenticated endpoints this is acceptable but worth noting.

**Fix:** If authentication is added, key rate limiters by user ID instead of IP.

---

## Medium Priority Issues

### 11. Error Messages Leak Internal Stack Traces
Multiple routes return `err.message` directly to clients:
- `server/routes/github.js:19,41,215`
- `server/routes/sync.js:47,72`
- `server/routes/share.js:37`
- `server/routes/presentations.js:35,145,199,220,237,255,291,315,331,371,396`
- etc.

While most errors are descriptive strings, the server also exposes `err.message` which may include file paths, function names, or database query fragments in edge cases.

**Fix:** Replace `err.message` in 5xx responses with generic messages like "Internal server error". Pass detailed errors to `console.error` for logging. Keep structured error detail for 400/404/403 responses.

---

### 12. Settings Sentinel Value Can Be Abused
**File:** `server/routes/settings.js:30-31`
```js
if (updated.ai && updated.ai.apiKey === '***configured***') {
  updated.ai.apiKey = existing.ai?.apiKey
}
```

If an attacker somehow gains write access to settings, they could send `ai.apiKey: "***configured***"` to preserve the existing key while modifying other AI fields. This is low severity because it requires write access.

---

### 13. Media Delete Uses Only path.basename
**File:** `server/routes/media.js:101`
```js
const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename))
```

`path.basename` correctly prevents directory traversal, but if `req.params.filename` is empty or just an extension, unexpected behavior may occur. No check that the file actually exists in the media DB before deletion.

**Fix:** Add explicit existence check and validate filename matches a known media record.

---

### 14. Share View HTML Is Served with Full User HTML Content
**File:** `server/index.js:157`

`generateRevealHTML(sanitized)` produces HTML containing all user-supplied content (text elements, code blocks, embedded media URLs). This is served as `Content-Type: text/html` at `/share/:token`. Any stored XSS in a presentation's text element will execute for anyone viewing the shared link.

**Fix:** See issue #7. Server-side HTML sanitization with DOMPurify before serving share views.

---

### 15. Express URL-encoded Body Parsing Has `extended: false`
**File:** `server/index.js:66`
```js
app.use(express.urlencoded({ extended: false }))
```

This is correct — `extended: false` prevents the `qs` library parsing CVE risks. No action needed, just confirming awareness.

---

### 16. Soft Delete Is Not Really Soft — No Permanent Delete Confirmation
**File:** `server/routes/presentations.js:225-238`

DELETE sets `deletedAt` timestamp. However, if `PUT /api/presentations/:id` is called after soft delete (restoring is only via `/restore` endpoint), the deleted presentation can be updated directly. A permanently deleted presentation (via `/permanent` endpoint) is gone without a confirmation dialog.

**Fix:** Consider adding a confirmation step for permanent deletion in the client.

---

## Low Priority / Informational

### 17. No CSP Header
The server sets no Content-Security-Policy header. For a self-hosted app, CSP is less critical but would still harden against XSS.

### 18. File Lock Uses Promise Chain (Not True Mutex)
**File:** `server/services/storage.js:22-41`

`withFileLock` chains promises rather than using a true mutex. If two concurrent requests both call `withFileLock`, the second will wait for the first's promise chain, but during that wait, both have already set `fileLocks.set(filePath, ...)`. This works in practice because the function awaits the previous lock before proceeding, but it is not a true atomic mutex.

**Evidence:** Line 35 `await prev` ensures sequential execution, but if `prev` resolves and `lockPromise` resolves in the same event loop tick, there is a race. More importantly, the `finally { releaseLock() }` pattern can have timing issues if the lock holder crashes.

**Severity:** Low — in practice, Node.js single-threaded event loop makes this work, but a dedicated mutex library would be more robust.

### 19. Marketplace Template Search Is Case-Sensitive
**File:** `server/routes/marketplace.js:93-95`

Search converts query to lowercase but element titles/descriptions may not be normalized. Minor UX issue.

### 20. PPTX Import Timeout Kills Child Process
**File:** `server/services/pptx-import/constants.js:7-8`

`PARSER_TIMEOUT_MS = 60s` and `PARSER_KILL_GRACE_MS = 2000ms`. The 2-second grace period before SIGKILL is reasonable.

---

## Per-File Findings

| File | Finding |
|------|---------|
| `server/index.js` | UUID param validation, rate limiting, CORS config, file lock, sanitization gaps (#7, #14) |
| `server/routes/github.js` | Good: Zod validation, no shell git commands, only API calls. Issue: err.message leaks |
| `server/routes/sync.js` | Good: `execFile` (not `exec`), `RCLONE_CONFIG` env var isolation. Issue: err.message leaks |
| `server/routes/upload.js` | Good: magic-byte MIME validation, uuid filenames, 100MB limit. Issue: SVG XSS (#1) |
| `server/routes/share.js` | Good: password hashing with bcrypt, no password in response. Issue: no auth on delete (#6) |
| `server/routes/presentations.js` | Good: Zod schema validation, soft delete, cascade cleanup. Issues: err.message leaks, no auth |
| `server/routes/live.js` | Thin router — delegates to `live-rooms.js` |
| `server/routes/templates.js` | Issue: no schema validation on POST/PUT (#5) |
| `server/routes/settings.js` | Issue: arbitrary field injection (#4), sentinel value trick (#12) |
| `server/routes/media.js` | Good: path.basename traversal protection. Issue: weak validation |
| `server/routes/ai.js` | Good: schema validation, error masking. Issues: SSRF via custom endpoint (#8) |
| `server/routes/analytics.js` | Good: token ownership check on analytics access |
| `server/routes/explore.js` | Good: password check for fork |
| `server/routes/history.js` | Good: snapshot isolation per presentation |
| `server/routes/marketplace.js` | Simple read-only marketplace with TTL cache |
| `server/routes/pptx-import.js` | Good: multer file size limits, temp file cleanup |
| `server/services/socket-handler.js` | Good: presenter token verification, role-based access |
| `server/services/live-rooms.js` | Good: SHA-256 hashed tokens, random room codes. Issue: 6-byte room codes (#9) |
| `server/services/storage.js` | Good: file locking, path isolation. Issue: promise-chain lock (#18) |
| `server/services/ai-endpoint-guard.js` | Good: private IP/hostname blocking. Issue: IPv6 gap (#8) |
| `server/services/ai-provider.js` | Clean: no shell commands, fetch-based API calls |
| `server/middleware/validate.js` | Good: Zod-based, structured error responses |
| `server/middleware/error-handler.js` | Good: centralizes error handling, maps multer codes |
| `electron/main.js` | Good: nodeIntegration=false, contextIsolation=true, safeStorage. Issues: sandbox disabled (#2), shell.openExternal |
| `electron/preload.js` | Good: minimal IPC surface, contextBridge only |

---

## Dependency Audit

### Server package.json — notable dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `express` | ^4.18.2 | Stable. No known RCE in 4.x (CVE-2022-24999 patched in 4.17.x) |
| `socket.io` | ^4.8.3 | Stable |
| `bcryptjs` | ^3.0.3 | No major vulnerabilities |
| `zod` | ^4.3.6 | Latest major version |
| `multer` | ^1.4.5-lts.1 | Current stable |
| `jszip` | 3.10.1 | CVE-2023-30534 (libzip < 1.9.2), 3.10.1 is patched |
| `dompurify` | ^3.4.0 | Latest, but NOT used server-side despite being a dependency |
| `jsdom` | ^25.0.1 | Latest |
| `file-type` | ^16.5.4 | Known: `file-type` v15+ removed `fromFile` (breaking change) — but code uses dynamic `import()` at `server/routes/upload.js:61`, which handles the newer API |
| `pptxgenjs` | 4.0.1 | Pinned to exact version |
| `playwright` | in server deps | Should be in devDependencies |
| `pptx2json`, `pptxtojson` | old packages | No known CVEs but unmaintained; consider migrating to `pptx2json` alternatives |

### Root package.json — devDependencies in production
- `electron`, `electron-builder`, `eslint`, `prettier`, `vitest`, `playwright` are in root devDependencies — correct.

### No .env or .env.example files found
This means no documented required environment variables. `PORT`, `NODE_ENV`, `SLIDES_DATA_DIR`, `SLIDES_UPLOADS_DIR`, `AI_CUSTOM_ENDPOINT_ALLOWLIST` are all runtime env vars with no schema.

---

## Summary Statistics

- Files reviewed: 26 (3 main + 16 routes + 5 services/middleware + 2 package.json)
- Critical: 6 (SVG XSS, Electron sandbox, no auth, settings injection, template no-validation, share token no-auth)
- High: 4 (HTML sanitization, SSRF IPv6 gap, room code enumeration, rate limit keying)
- Medium: 6 (error message leaks, sentinel abuse, media delete, share HTML XSS, body parser, soft delete)
- Low: 5 (CSP, file lock, marketplace search, PPTX timeout, informational)

### Positive Observations
- UUID param validation on all `:id`, `:snapshotId`, `:presId` routes is comprehensive
- File locking in storage prevents JSON corruption from concurrent writes
- Rate limiting on API, upload, and share routes
- bcrypt for password-protected shares
- Presenter token hashing with SHA-256 in live rooms
- Zod schema validation for AI and presentation routes
- `express.urlencoded({ extended: false })` prevents qs parsing exploits
- Electron: `nodeIntegration: false`, `contextIsolation: true`, safeStorage for credentials
- No shell `exec` commands — GitHub uses API calls, rclone uses `execFile`
- AI custom endpoint SSRF protection with private IP/DNS blocking
- multer magic-byte MIME verification on uploads
- `ALLOWED_UPLOAD_EXTENSIONS` as a Set for O(1) lookup

### Recommended Actions (Priority Order)
1. **Block SVG uploads** or sanitize server-side before saving
2. **Remove Electron sandbox disable** (`ELECTRON_DISABLE_SANDBOX`, `no-sandbox` switch)
3. **Add authentication middleware** or document "no auth" explicitly
4. **Add Zod schema validation** to `PUT /api/settings`
5. **Add Zod schema validation** to `POST/PUT /api/templates`
6. **Add presentation ownership check** to `DELETE /api/shares/:token`
7. **Sanitize HTML** in share view rendering (use DOMPurify server-side)
8. **Fix AI endpoint guard** IPv6 link-local block range and allowlist matching
9. **Increase Socket.IO room code entropy** to 10 bytes
10. **Replace `err.message` with generic messages** in 5xx responses

### Unresolved Questions
1. Is the app intended for multi-user or public hosting? If yes, authentication is a hard blocker.
2. Are SVG uploads a genuine feature requirement, or can they be blocked?
3. Should the Electron sandbox disable be temporary (dev-only) or permanent?
4. Is there a planned migration path from unmaintained `pptx2json`/`pptxtojson` packages?
