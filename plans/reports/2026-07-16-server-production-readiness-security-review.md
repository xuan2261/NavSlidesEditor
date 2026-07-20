# Code Review Summary — server/ production-readiness security scan

**Date:** 2026-07-16  
**Scope:** `server/` only (Express + Socket.IO + services)  
**Model context:** App is intentionally single-user / no built-in auth (`docs/code-standards.md` L530–538, `docs/deployment-guide.md` L324). Findings below focus on **trust-boundary breaks**, **defense-in-depth gaps**, and **mis-deployment residual risk** — not “missing OAuth” as a product bug.

---

## Scope

| Item | Detail |
| --- | --- |
| Files reviewed | `server/index.js`, `middleware/*`, `routes/{presentations,share,upload,github,sync,live,ai,media,settings,games-rest-api-handler,history,plugins,analytics}`, `services/{socket-handler,live-rooms,storage,ai-provider,ai-endpoint-guard,game-*}`, related shared HTML sinks |
| Review focus | Authz gaps, injection, XSS sinks, rate limits, uploads, races, error leakage, secrets, WS auth |
| Plan updates | None (scan only; no implementation plan file given) |

---

## Overall Assessment

Solid **local hardening** in places: Zod validation on many routes, in-process file locks + atomic JSON writes, PPTX zip/XML budgets, AI custom-endpoint SSRF pin, live **presenter** token hashing, share password bcrypt, upload MIME/extension checks.

**Not production-safe on a shared network without an external auth boundary.** Within the live/game subsystems, **controller/host trust is weaker than presenter auth** and is exploitable with only a room/game id.

---

## Critical Issues

### 1. Live `controller` role has no secret — remote-control takeover by room code

**Evidence**

```62:87:server/services/live-rooms.js
function joinRoom(roomId, socketId, role, options = {}) {
  const { presenterToken } = options
  // ...
  } else if (role === 'controller') {
    if (!room) {
      return { ok: false, error: 'room-not-found' }
    }
    if (!room.controllers.includes(socketId)) {
      room.controllers.push(socketId)
    }
  } else {
    // Viewer — allow joining pre-registered rooms even without presenter
```

```174:177:server/services/live-rooms.js
function canControlRoom(roomId, socketId) {
  const room = rooms.get(roomId)
  return !!room && (room.presenterId === socketId || room.controllers.includes(socketId))
}
```

Controller-gated events: `control-navigate`, `laser`, `annotation:*`, `game-timer-*` in `server/services/socket-handler.js` (e.g. L216–224, L243–248, L285–290).

**Impact:** Anyone who learns `roomCode` (short 6-char alphabet code, L37–40) joins as `controller` and steers slides / annotations / timers for all viewers. Presenter token only gates `role === 'presenter'`.

**Fix:** Issue a `controllerToken` (or reuse presenter token with scoped capability) at `POST /api/live/room`; require it in `joinRoom` for `controller`. Optionally separate remote vs speaker tokens. Do not grant `canControlRoom` on bare room membership.

---

### 2. Games REST API has zero host auth — socket host checks bypassed

**Evidence**

```65:101:server/routes/games-rest-api-handler.js
router.post('/:gameId/next', (req, res) => {
  const room = GameEngine.nextQuestion(gameId)
  // ...
})
router.post('/:gameId/random', ...)
router.post('/:gameId/end', ...)
router.delete('/:gameId', ...)
```

Socket path correctly gates host:

```42:47:server/services/game-socket-handler.js
const requireHost = (gid) => {
  if (GameEngine.isHost(gid, currentPlayerId)) return true
  socket.emit('game-error', { message: 'Not authorized: host only' })
  return false
}
```

**Impact:** Unauthenticated HTTP client advances questions, ends game, deletes room, spoofs answers via `{ socketId }` body. Breaks “host only” model entirely for any client that uses REST or for attackers who probe `/api/games`.

**Fix:** Remove privileged REST mutations **or** require `hostToken` (minted at create) on next/random/end/delete. Never trust client-supplied `socketId` as identity without binding to a secret.

---

### 3. Game host claim is first-writer-wins with no host secret

**Evidence**

```321:328:server/services/game-room-manager-singleton-service.js
  if (options.role === 'host' && !room.hostExplicit) {
    room.hostPlayerId = playerId
    room.hostExplicit = true
  } else if (!room.hostPlayerId) {
    room.hostPlayerId = playerId
  }
```

Create path: `game-join` with `role === 'host'` auto-creates room (`game-socket-handler.js` L55–57). REST `POST /api/games` creates room with no host token.

**Impact:** Race: attacker joins as host before legitimate presenter (or first player becomes host). Combined with #2, full game control.

**Fix:** Mint `hostToken` at room create (mirror live `presenterToken`); require it for host role claim and privileged ops. Refuse `role:'host'` without token.

---

## High Priority Findings

### 4. Credential plane fully open if perimeter fails (settings / GitHub / rclone)

**Evidence**

- `PUT /api/settings` merges and persists AI keys — no auth (`server/routes/settings.js` L27–45).
- `POST /api/github/config` writes token plaintext (`server/routes/github.js` L38–47); stored in `github-config.json` (`storage.js` L9, L186–189).
- `POST /api/rclone/config` accepts username/password, writes `rclone.conf` (`server/routes/sync.js` L81–105).
- Documented: “no built-in authentication” (`docs/deployment-guide.md` L324–326).

**Impact:** Single reverse-proxy misconfig (e.g. only SPA protected, `/api` open) → steal/overwrite AI + GitHub + cloud sync credentials, push all decks to attacker-controlled repo, sync all presentations + uploads off-box.

**Fix (defense in depth):** Optional `NAVSLIDES_ADMIN_TOKEN` / mutual TLS for `/api/*` mutate routes; encrypt secrets at rest; never commit `server/data/{settings,github-config}.json` (sample tokens currently in tree: `github-config.json` has `ghp_phase5SecretToken` fixture-like value — scrub from deploy images).

---

### 5. AI proxy: cost abuse + only global rate limit

**Evidence**

- `/api/ai/*` uses stored keys (`server/routes/ai.js` rewrite/outline/translate).
- Rate limit: only `apiLimiter` 300/15min prod on `/api/` (`server/index.js` L81–86). No `aiLimiter`. Upload limiter exists; AI does not.

**Impact:** Network-local or perimeter-bypass attacker burns OpenAI/Gemini quota; custom provider SSRF largely mitigated (`ai-endpoint-guard.js`).

**Fix:** Dedicated AI rate limit (e.g. 20/15min); optional max tokens; require admin token for AI routes even in single-user mode when bound non-localhost.

---

### 6. SVG upload is active content at same origin — trust-boundary violation for files

**Evidence**

- `.svg` allowed (`server/routes/upload.js` L14–21).
- Content check only `/<svg[\s>]/i` on first 2KB (L81–88) — **no** `sanitizeSvgHtml`, scripts allowed.
- Served as static same-origin: `app.use('/uploads', express.static(UPLOADS_DIR))` (`server/index.js` L106).
- Contrast: element SVG sink strips script/foreignObject (`shared/src/content-safety.js` L82–88); **file path does not**.

**Impact:** Per `code-standards.md` L500–502, untrusted upload executing outside author intent is in-scope. Opening/navigating `/uploads/<uuid>.svg` runs JS as the app origin → can call open APIs (settings, presentations, github push).

**Fix:** Disallow SVG upload **or** strip active content on write; serve uploads with `Content-Disposition: attachment` / `X-Content-Type-Options: nosniff` / separate origin; never inline untrusted SVG as document.

---

### 7. Error responses leak internals widely

**Evidence**

```5:14:server/middleware/error-handler.js
function errorHandler(err, req, res, _next) {
  console.error('[Server Error]', err.message || err)
  // ...
  res.status(status).json({ error: err.message || 'Internal server error' })
}
```

Same pattern: `presentations.js` (many `err.message`), `share.js`, `index.js` share handlers L146/223/269/304, `sync.js` L147–149, etc. AI routes mostly redacted (good). GitHub uses `redactSecretLikeValues` (good).

**Impact:** Stack-ish messages, paths, provider errors aid attackers; possible secret echo if not redacted.

**Fix:** Central helper `publicError(err)` → generic client message + log server-side with request id. Apply to all 500s.

---

### 8. Missing security headers on HTML/share + static surfaces

**Evidence**

Share render sets only:

```177:180:server/index.js
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.send(html)
```

No CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors` on app or `/uploads`.

**Impact:** Amplifies #6 and clickjacking of password share form; share XSS harder to contain if author content is intentionally executable.

**Fix:** Helmet defaults; CSP for share view (knowing reveal plugins need script); `X-Content-Type-Options: nosniff` on `/uploads`.

---

## Medium Priority Improvements

### 9. Share management endpoints unauthenticated (capability by presentation id)

**Evidence:** `POST/GET/DELETE .../share`, `GET .../shares` (`server/routes/share.js`); `DELETE /api/shares/:token` (`index.js` L135–147). Presentation ids are UUID-ish but enumerable once known; list shares returns full tokens (L21–36).

**Impact:** With API open, mint/revoke shares for any deck; token leak via list.

**Fix:** Same admin boundary as other mutators; do not return raw tokens in list without proof of ownership.

---

### 10. Rate-limit coverage gaps (beyond AI)

**Evidence:** `uploadLimiter` on `/api/upload` + `/api/pptx`; `shareLimiter` on `/share/` only (`index.js` L88–101). **Not** on: share mint (`/api/presentations/:id/share`), live room create (`POST /api/live/room`), rclone sync, games create.

**Impact:** Room/share spam, rclone CPU/IO, disk fill via large JSON (50mb body limit L77).

**Fix:** Per-route limits for mint room, share create, rclone, AI; lower JSON limit for non-deck routes.

---

### 11. In-process file locks only — multi-instance race

**Evidence:** `fileLocks` Map in process (`storage.js` L21–41). Atomic rename good for single writer; two Node processes / multiple replicas → lost updates on `presentations.json`.

**Impact:** Data loss under horizontal scale or multi-worker without sticky single writer.

**Fix:** Document single-instance requirement (if not already) or external lock (fs flock / SQLite).

---

### 12. Docs drift: CORS “open” vs production code

**Evidence:** `docs/deployment-guide.md` L327 says CORS open; prod uses `origin: false` (`index.js` L75, Socket.IO L340).

**Impact:** Operators may misconfigure based on stale docs.

**Fix:** Update deployment guide to match code.

---

## Low Priority Suggestions

### 13. Gemini model path interpolation

`ai-provider.js` L46–47: ``models/${model}:generateContent`` — validate model against `/^[a-zA-Z0-9._-]+$/` to avoid path weirdness.

### 14. Password share: JSON verify ≠ session

`POST /share/:token/verify` returns `{ verified: true }` with no cookie (`index.js` L205–221). Form POST re-renders once (OK). Ensure clients never treat verify as lasting auth without cookie/HMAC ticket.

### 15. `express.json({ limit: '50mb' })` global

DoS amplification for non-presentation endpoints. Prefer route-specific limits.

---

## Positive Observations

- Live **presenter** join requires SHA-256 hashed token (`live-rooms.js` L14–20, L50–53, L66–72).
- AI custom endpoint SSRF: private IP block + DNS-pinned undici Agent (`ai-endpoint-guard.js`).
- PPTX: extension, magic ZIP, entry/decompression budgets (`pptx-guards.js`, constants).
- Share passwords: bcrypt; no password in GET URL.
- Soft-deleted decks blocked from share render via `findServeablePresentation`.
- Storage: withFileLock + writeJsonAtomic; concurrency tests exist.
- Upload: extension allowlist + file-type magic + 100MB cap + SHA-256 dedup.
- Analytics gated by matching share token (`analytics.js` L28–38).
- History path segments validated (`history.js` L27–38).
- rclone: `execFile` + remote name allowlist (no shell); obscure password required.

---

## Recommended Actions (priority)

1. **Ship live controller tokens** (mirror presenter) — Critical #1.  
2. **Kill or auth games REST privileged routes** + hostToken — Critical #2–3.  
3. **SVG upload sandbox** (strip/serve non-executable) — High #6.  
4. **Optional admin token** for all mutating `/api/*` + secrets encryption — High #4.  
5. **AI + room mint rate limits**; generic 500 bodies — High #5, #7.  
6. **Security headers** on share + uploads — High #8.  
7. Fix deployment-guide CORS/auth notes — Medium #12.

---

## Metrics (qualitative)

| Area | Status |
| --- | --- |
| App-level auth | None (by design) |
| Live presenter auth | Present |
| Live controller auth | **Missing** |
| Game host auth (socket) | Weak (claim race) |
| Game host auth (REST) | **Missing** |
| Upload MIME checks | Present |
| Upload active-content quarantine | **Gap (SVG)** |
| SSRF (AI custom) | Strong |
| Rate limits | Partial (upload/share view only) |
| Error redaction | Inconsistent |
| Storage concurrency (single process) | Good |

---

## Unresolved questions

1. Is multi-user / LAN multi-client a supported production mode, or strictly one operator + public share viewers?  
2. Should remote-control (`controller`) be treated as high-privilege as presenter for product policy?  
3. Are games REST endpoints still client-called, or dead surface that can be removed?

---

*Brutal bottom line:* Presenter token + PPTX/SSRF work is real. **Controller-by-room-code and games REST host bypass are ship-blockers for any shared/live classroom use.** App-wide open API is acceptable only behind a proven external auth gate — treat perimeter failure as total compromise today.
