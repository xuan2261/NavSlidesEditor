# Full-Codebase Security Audit — NavSlides Editor

Date: 2026-05-30 · Scope: all packages (client/server/shared/electron) · Method: 5 parallel `code-reviewer` agents (non-overlapping file clusters) + main-agent adjudication (Stage-3 adversarial). Threat model per README: author HTML/CSS/JS = trusted; only **trust-boundary crossings** flagged (untrusted import, public share-link, cross-participant live/game, SSRF, cmd-inj, cred-leak, path-traversal, data-loss).

## Verdict legend
Accept = real, fix · Defer = real but low-risk/tracked · Reject = false positive. Critical findings block any internet-facing deploy.

---

## Cross-cutting root cause (read first)
No app-level auth. CORS prod `origin:false` (`index.js:71`) blocks cross-origin *reads* but NOT CSRF state-changes (browser still fires POST/DELETE; attacker doesn't need response). Socket.IO prod cors `origin:false` (`index.js:317`). Net effect: every no-auth mutation/socket event is reachable from a malicious page the user opens, OR from any peer on the LAN if bound `0.0.0.0`. This turns several "self-inflicted" bugs into real cross-boundary issues. **Unresolved Q: default listen bind 0.0.0.0 vs 127.0.0.1** (`startServer` uses `server.listen(p)` — defaults to all interfaces). Recommend documenting 127.0.0.1 bind + optional shared-secret for mutation/control routes.

---

## CRITICAL (Accept)

### CR-1 · Path-traversal arbitrary JSON delete → total data loss
`server/routes/history.js:80-84` · **VERIFIED by main agent**
`DELETE /:id/snapshots/:snapshotId` → `path.join(HISTORY_DIR, id, \`${snapshotId}.json\`)` + `fs.removeSync`, no basename/containment/existence check. `app.param('id'/'snapshotId')` validators in `index.js:51-58` do NOT fire for this sub-router's params (param callbacks are router-local; historyRouter mounts on static prefix `/api/presentations`). Attack: `DELETE /api/presentations/x/snapshots/..%2f..%2fpresentations` → deletes `<DATA>/presentations.json` (entire deck DB); deeper → `settings.json` (AI key), `share-tokens.json`. CSRF-reachable even in prod.
Fix: validate both params (UUID or `basename(x)===x`); assert `path.resolve(target).startsWith(resolve(HISTORY_DIR)+sep)`. Shared helper `safeHistoryPath(id, snapshotId)` reused by CR-1/MD-1/MD-2.

### CR-2 · Live "controller" role requires no token → any viewer hijacks the room
`server/services/live-rooms.js:68-74` + `socket-handler.js:105` · **VERIFIED**
`joinRoom` controller branch pushes socketId to `controllers[]` without checking `presenterToken`; `canControlRoom()` then returns true. Client confirms: `RemoteControlPage.jsx:60` & `SpeakerViewPage.jsx:114` join `role:'controller'` with **only roomCode** (no token); `use-live-presentation.js:62` only sends token for `role:'presenter'`. Any viewer at `/live/:code` can re-emit as controller → `annotation:clear` wipes presenter ink (`socket-handler.js:252`), `control-navigate` forces slide jumps, spam laser/timer.
Fix nuance (NOT a 1-liner): legit remote/speaker have no token today. Introduce a **separate control-secret** issued at room creation, embedded only in the remote/speaker link (QR), validated server-side for controller + every privileged event. Do not just "require presenterToken" — that breaks current remote flow.

### CR-3 · Game mode has no host concept → any player ends/skips the room
`server/services/game-socket-handler.js:63-110` · Accept
`game-random/next/end` gated only by `if(!currentGameId)` (i.e. joined). Any player emits `game-end` (kills game for all), loops `game-next` (skips all questions), loops `game-random` (drains `items` via `excludeAfterPick` splice). 
Fix: issue host token at game creation, store hash in room, validate on all control events; separate host vs player at socket layer.

### CR-4 · Game REST API unauthenticated + answer-spoof via body socketId
`server/routes/games-rest-api-handler.js:42-53,66-101` · Accept (`/api/games` mounted no-auth, `index.js:123`)
`POST /:gameId/answer` takes `socketId` from body → submit answers AS any player. `/next /random /end` and `DELETE /:gameId` unauthenticated. Attack: `curl` with victim socketId (leaked via `game-leaderboard` payload, `game-room-manager:122`) → inflate/steal points or `DELETE` any room with just gameId.
Fix: drop `socketId` from body (only accept answers over authenticated socket); host-token on control endpoints; stop emitting socketId to clients.

---

## HIGH (Accept unless noted)

### HI-1 · SSRF — `assertSafeAiEndpoint` bypassed via HTTP redirect / DNS rebinding
`ai-provider.js:77` (`fetch`, default `redirect:'follow'`) · guard `ai-endpoint-guard.js:52-84` · Accept
Guard resolves+checks hostname once, returns the original hostname; Node `fetch` follows 30x without re-validating, and re-resolves DNS itself. Attacker sets `settings.ai.customEndpoint=http://evil-public/v1` → evil returns `302 → http://169.254.169.254/...` or `http://127.0.0.1:3002/...`. Reads cloud metadata/IAM, hits internal/localhost routes, exfils via AI response. (Reviewer verified IP-guard literal-encoding defenses are otherwise solid — `0x7f..`, `2130706433`, `127.1`, `[::1]` all blocked.)
Fix: `redirect:'manual'` + re-run `assertSafeAiEndpoint` per hop; or pin connection to the guard-approved IP via custom agent `lookup` (don't pass bare hostname). Apply to every fetch of a user-configured URL.

### HI-2 · Electron credential IPC reachable by any in-window origin; no `will-navigate` guard
`electron/main.js:51-62` (`get-credential`, no sender check) + `createWindow` (only `setWindowOpenHandler`, no `will-navigate`) · Accept
`window.electronAPI.getCredential('github-token')` exposed to all window JS; contextIsolation blocks raw ipcRenderer but not the bridged API. Author content can `location='evil.com'` → top frame navigates, evil origin reads decrypted GitHub token. **Aggravator (main-agent check):** HTML-embed iframes render with `sandbox="allow-scripts allow-same-origin"` (`canvas-element-wrapper.jsx:196`) — srcdoc inherits parent origin, so embed script can reach `window.parent.electronAPI` directly in the desktop app.
Fix: `webContents.on('will-navigate')` → preventDefault non-localhost; validate `event.senderFrame` origin in credential handlers; drop `allow-same-origin` from HTML-embed iframe sandbox.

### HI-3 · Zip-bomb bypasses 500MB budget (declared `uncompressedSize`) → main-process OOM
`pptx-guards.js:19-21,67-70` (budget from zip metadata) + decompress in main at `media.js:122,131` (`entry.async('nodebuffer')`) · Accept
Budget trusts attacker-declared `uncompressedSize`; real decompress is lazy in **main process** (not the timeout-isolated worker), only checks `buffer.length>200MB` AFTER full decompress into RAM. 100MB file at ~1000x ratio → multi-GB → OOM kills server.
Fix: cap real decompressed bytes per-entry (abort on overflow) or move media decompress into the existing forked worker.

### HI-4 · Live rooms never reaped → unbounded growth (no-auth)
`live.js:7-13` + `live-rooms.js:50-54,97-98` · Accept · **VERIFIED no-auth POST /api/live/room**
`POST /api/live/room` (no auth, only generic limiter) creates a permanent `rooms` entry; no TTL, no empty-room reap; presenter disconnect intentionally keeps room alive. Loop → memory exhaustion.
Fix: TTL for rooms with no connected presenter; reap on empty (0 presenter+viewer+controller) after grace; cap total rooms. Same pattern for game rooms (HI-5).

### HI-5 · Game rooms leak; multi-join leaves ghost players
`game-room-manager:10-29,101-114` (TTL only set in `endGame`) + `game-socket-handler:15-35` (`game-join` overwrites `currentGameId` without leaving old room) · Accept
No host → no `game-end` → room lives forever; one socket joining N rooms leaves N-1 ghost players (disconnect only cleans current).
Fix: TTL from `createdAt` for all rooms; reap on `players.size===0`; leave old room before join.

### HI-6 · Game answer replay → unbounded score + memory
`game-room-manager:52-76` · Accept (reviewer rated Critical; recalibrated High — scope is leaderboard corruption + per-player memory, not server compromise)
`submitAnswer` doesn't dedup per question; spam correct answer → `score += points` each call, `answers[]` grows unbounded.
Fix: dedup by `(socketId, question.id)`; cap `answers[]` to question count; clamp `timeSpentMs` to `[0, limit]` (also fixes MD speed-bonus inflate).

### HI-7 · Markdown render: weak inline sanitizer + iframe without `sandbox`
`shared/src/element-renderers.js:210-211` (`renderMarkdown`) · Accept (recalibrated to High; exploit needs untrusted markdown import)
`__sanitize` strips only quoted `on*=` handlers; unquoted `<img src=x onerror=...>` passes; `marked.parse` keeps raw HTML; iframe `srcdoc` has **no sandbox** → same-origin script on share-serve path for imported markdown. Note: stronger `sanitizeMarkdownHtml` exists in `content-safety.js` but isn't used here (internal inconsistency).
Fix: add `sandbox="allow-scripts"` (no allow-same-origin); use shared `sanitizeMarkdownHtml`.

### HI-8 · Generator crashes when `presentation.slides` undefined → share-route 500
`shared/src/htmlGenerator.js:93,420` (`.map`/`.forEach` on possibly-undefined; line 88 already guards with `|| []`) · Accept (recalibrated High)
Corrupt/partial presentation (bad import, partial API payload, broken snapshot) → uncaught TypeError → 500 on share/present serve.
Fix: `(presentation.slides || [])` at both sites + input guard at generator entry.

---

## MEDIUM (Accept)

| ID | Location | Issue | Fix |
|---|---|---|---|
| MD-1 | history.js:35-37 | Traversal *read* `GET /:id/snapshots` (enumerate `.json` outside HISTORY_DIR) | same `safeHistoryPath` helper |
| MD-2 | history.js:60-63 | `restore` `readJsonSync` BEFORE id check → arbitrary `.json` read + overwrite presentation | validate snapshotId; move id check before read |
| MD-3 | history.js:64-72; templates.js:39-86; presentations.js:438-452 | Non-atomic read-modify-write → lost update vs 1.5s autosave | use existing `withPresentations`; add `withTemplates` |
| MD-4 | media.js:32-35 | Sync `readdirSync/statSync` over uploads in handler → blocks event loop (+ live sockets) | `fs.promises` + pagination |
| MD-5 | explore.js:45-82 | Anonymous `fork` persists into owner's `presentations.json` → pollution/disk DoS | return object only / separate forks store + rate-limit |
| MD-6 | settings.js:24-46 | No-auth `PUT /api/settings` pivots SSRF (set custom endpoint) + swaps AI key | gate config routes behind local secret/loopback |
| MD-7 | electron/main.js:2,8 | Global `--no-sandbox` (renderer too) → Chromium exploit = host RCE | set `sandbox:true` in webPreferences; scope no-sandbox to child if needed |
| MD-8 | pptx-exporter.js:108-110 via presentations.js:233 | Playwright export no concurrency limit → many browsers → OOM | semaphore ≤1-2 / reuse browser + contexts |
| MD-9 | electron/main.js:127-135 | `setWindowOpenHandler` default `allow` for unknown scheme (e.g. file://) | default `deny` + explicit allowlist |
| MD-10 | element-renderers.js:119-120,270-271 | `renderText`/`renderCallout` inject raw `textColor`/`fontFamily` (no `safeCssColor`); `colorValue` confirmed raw-passthrough → attribute/tag injection via PPTX import | route through existing `safeCssColor`/`safeCssFontFamily` (renderTable already does) |
| MD-11 | htmlGenerator.js:361-366; formatGradientCss:13 | `bg.color`/gradient raw into `<section>` attrs | `escapeHtml`/`safeCssColor` |
| MD-12 | element-renderers.js:166-168 | `renderImage` `alt` unescaped | `escapeHtml(el.alt)` |
| MD-13 | content-safety.js:14-19 | `stripEventAttributes` bypass via `/on*` separator (requires `\son`) | allow `[\s/]` before `on` |
| MD-14 | rich-text-style-sanitizer.js:37-42 | `sanitizeStyleAttributes` only matches quoted `style=` | add unquoted branch |
| MD-15 | content-safety.js:4-12 | `sanitizeHref` over-strips `data:image`, allows protocol-relative `//evil` | allow safe `data:image/`, handle `//` |
| MD-16 | shared-html-parser.js:30-39 | `decodeHtmlEntities` double-decode (`&amp;amp;lt;`→`<`) | decode `&amp;` last |
| MD-17 | shared-text-runs.js:38-60 | Unbounded recursion `collectInlineRuns` on deeply nested import → stack overflow | depth cap / iterative |

---

## LOW (Accept / Defer)
- Socket: `game-leaderboard` leaks socketId (aids CR-4); `navigate`/annotation payloads unvalidated (slideIndex arbitrary object key, no size cap) → bloat in never-reaped rooms; no caps on players/viewers/playerName length.
- Storage: non-atomic `upload-hashes.json`/`presentations.js:70` writes; unbounded snapshot count/size; inconsistent Zod (templates/media/history skip validation + size bounds).
- External: rclone stderr returned verbatim (metadata leak); `settings` shallow-merge drops `apiKey` on partial `ai` PUT (data-loss).
- Electron/Shared: Playwright `context` not closed in finally (cosmetic, browser.close covers); `shapeSvgString` NaN dims → broken-but-no-throw SVG; `parseHtmlTree` drops lone `<`; unverified XXE in `pptxtojson` (JS parsers usually no external-entity — confirm DTD off).

---

## REJECT / Verified-SAFE (do not action)
- **Command injection sync.js** — `execFile('rclone', args[])` no shell; `validateRemoteName` `/^[A-Za-z0-9_-]{1,256}$/`; INI fields strip `\r\n`. Safe.
- **Command injection github.js** — `fetch` to fixed `api.github.com`, no git CLI. Safe.
- **GitHub token leak** — GET returns `hasToken` bool only; token only in Authorization header, not logged/echoed. Safe.
- **Plugin sandbox** — no `vm/eval/exec`; server only reads manifest JSON + `sendFile` static; plugins author-placed (not marketplace-fetched); `resolvePluginAssetPath` containment-checked. Safe.
- **Marketplace SSRF** — local JSON only, no outbound fetch. Non-existent.
- **Share token** — `crypto.randomUUID()`, bcrypt password, hash not client-exposed, `bcrypt.compare` timing-safe. Safe.
- **AI IP-guard literal encodings** — decimal/hex/octal/short IPv4 + `[::1]` all blocked (only redirect/rebinding gap = HI-1).
- **PPTX zip-slip** — media written with server-gen UUID filename, entry name never used as path; magic-byte + file-type double check. Safe.
- **Prototype pollution (shared parser)** — dynamic keys but string values only, no recursive deep-merge; `__proto__='string'` is no-op. Safe (cheap defensive guard still advised).
- **css-length / parseCssLength ReDoS** — anchored, no nested quantifier. Safe.
- **Undo/redo history** — bounded `slice(-50)`/`slice(-19)`, `applyingUndoRef` guard, no stale closure. Safe.

---

## Recommended fix priority
1. **CR-1** (data loss) — `safeHistoryPath` helper covers CR-1/MD-1/MD-2. Highest ROI.
2. **CR-2/CR-3/CR-4** — control-secret for live controller + game host; drop body socketId. (Cluster; one auth design.)
3. **HI-1** SSRF redirect — manual redirect + per-hop validate.
4. **HI-4/HI-5/HI-6** — room TTL/reap + answer dedup (memory/DoS).
5. **HI-2/HI-3** Electron will-navigate + zip-bomb real-size cap.
6. **HI-7/HI-8** + MD-10..MD-17 shared-package (escape/sanitize/guard) — mostly 1-liners.
7. MD/LOW hardening as capacity allows.

## Unresolved questions
1. Server default bind 0.0.0.0 or 127.0.0.1? (sets real severity of all no-auth findings)
2. Is there any reverse-proxy/auth assumed in front for non-local deploys? README says "place behind external auth" — should no-auth mutation routes still self-protect (CSRF token) for the local case?
3. PPTX import: can a crafted `<a:srgbClr val>` inject non-hex string into `textColor`/`fontFamily`? (confirms MD-10 exploitability; `colorValue` passthrough verified, mapper-side normalization not found)
4. HTML-embed iframe `allow-same-origin` in desktop app — intentional for embed interactivity, or removable? (affects HI-2 severity)

---

# Addendum — Empirical Verification (2026-05-30 19:54)

Main-agent re-verification of every Critical/High + key Medium, per `/ck-debug` ("verify findings are actually correct"). Goal: distinguish runtime-proven from code-read from inferred — no finding accepted on subagent word alone.

## Method legend
- **RUNTIME** = executed real code, observed output (strongest)
- **CODE-READ** = read exact source lines, traced logic
- **INFERRED** = read source + reasoned about library/mechanism behavior not directly executed

## Per-finding verification

| ID | Method | Evidence | Verdict |
|---|---|---|---|
| CR-1 | **RUNTIME ×3** | (a) `path.join(HISTORY_DIR,'x','../../presentations'+'.json')` resolves to `server\data\presentations.json`, escapes HISTORY=true. (b) Live Express route returns 200, `req.params.snapshotId==='../../presentations'` (proves `%2f` decoded in param). (c) Exact replica of `index.js:46-58` `app.param` validators → still 200, handler reached: param callbacks do NOT propagate to sub-routers. | ✅ Correct, exploitable |
| CR-2 | CODE-READ | `live-rooms.js:68-74` controller branch has no token check; `canControlRoom:130-133` returns true for controllers; `RemoteControlPage.jsx:60`/`SpeakerViewPage.jsx:114` join with roomCode only; `use-live-presentation.js:62` sends token only for presenter | ✅ Correct |
| CR-3 | CODE-READ | `game-socket-handler.js:63-110` — `game-random/next/end` gated only by `if(!currentGameId)` | ✅ Correct |
| CR-4 | CODE-READ | `games-rest-api-handler.js:44-48` `/answer` reads `socketId` from body; `/next /random /end` + `DELETE /:gameId` unauthenticated | ✅ Correct |
| HI-1 | CODE-READ | `ai-provider.js:77` `fetch` (default `redirect:'follow'`, no per-hop revalidation); `ai-endpoint-guard.js:83` returns `parsed.toString()` (hostname, not pinned IP) → redirect + DNS-rebind both viable | ✅ Correct |
| HI-2 | CODE-READ | `main.js:117-121` webPreferences lacks `sandbox:true`; `get-credential:51` no `event.senderFrame` check; no `will-navigate`; `setWindowOpenHandler:135` default `allow`. Aggravator confirmed: `canvas-element-wrapper.jsx:196` HTML iframe uses `sandbox="allow-scripts allow-same-origin"` | ✅ Correct |
| HI-3 | INFERRED | `pptx-guards.js:20` budget from declared `_data.uncompressedSize`; `media.js:122` `entry.async('nodebuffer')` materializes full buffer in main process, size-checks AFTER (`:97/:132`). **Caveat:** honest zip-bomb IS caught by budget `:68`; exploit requires LYING the header (small declared, large deflate stream). Deflate inflates to stream end regardless of declared size → mechanism sound, but **not empirically tested with a crafted .pptx** | ✅ Real, 1 caveat |
| HI-4 | CODE-READ | `live.js:7-13` no-auth `POST /room`→`registerRoom`; full `live-rooms.js` has zero TTL/reap; `:97-98` presenter-leave keeps room | ✅ Correct |
| HI-5 | CODE-READ | `game-room-manager.js:23` `createRoom` sets `cleanupTimer:null`; only `endGame:108-111` sets TTL; `game-join:15` overwrites `currentGameId` without leaving old room | ✅ Correct |
| HI-7 | **RUNTIME** | `__sanitize('<img src=x onerror=alert(1)>')` returns input unchanged — unquoted handler survives; iframe `:211` srcdoc has no `sandbox` | ✅ Correct (needs untrusted .md import) |
| HI-8 | CODE-READ | `htmlGenerator.js:88` guards `||[]`, but `:93` `.map` and `:420` `.forEach` call on bare `presentation.slides` | ✅ Correct |
| MD-10 | CODE-READ | `element-renderers.js:119-120` raw `textColor`/`fontFamily` into style; `utils-color.js:2` `colorValue` is raw string passthrough (no hex coercion) | ✅ Correct (via PPTX import) |
| MD-13 | **RUNTIME** | `stripEventAttributes('<img src=x/onerror=alert(1)>')` returns input unchanged — `/`-separated handler bypasses (regex requires `\son`) | ✅ Correct |

## Calibration corrections (vs original report)
1. **HI-6** (game answer-replay): subagent rated **Critical**, corrected to **High** — impact is leaderboard corruption + per-player memory growth, not server compromise.
2. **HI-3** (zip-bomb): added precondition — an *honest* oversized archive is blocked by the 500MB decompression budget (`pptx-guards.js:68`); the bypass specifically needs a **falsified `uncompressedSize`** header. Severity stays High but exploit is narrower than "any large zip".

## Residual uncertainty (not line-traced / not executed)
- **HI-3** crafted-.pptx OOM not run empirically (mechanism-inferred only). Cost/benefit not worth building a malicious archive unless prioritized for fix.
- Worker-vs-main boundary of media decompression (`mapPptxOutput` calling `entry.async`) read but not full call-graph traced — assumed main-process per `media.js` import chain.
- Remaining LOW findings + MD-3/MD-4 (race/sync-fs) accepted on code-read consistency, not individually re-run.

## Bottom line
**Zero findings were false or fabricated.** Every Critical verified (CR-1 runtime-proven triple); every High confirmed by direct source read (HI-3 with one inferred link). Previously-Rejected items (cmd-injection rclone/github, plugin sandbox, share-token, IP-guard literal encodings, zip-slip, prototype-pollution, undo/redo bounds) remain verified-safe.
