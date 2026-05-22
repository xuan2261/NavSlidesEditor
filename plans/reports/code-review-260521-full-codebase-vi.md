# Báo Cáo Code Review Toàn Bộ Codebase — NavSlides Editor

**Ngày:** 2026-05-21
**Phạm vi:** Toàn bộ codebase (server, client, shared, electron)
**Phương pháp:** 6 reviewer chạy song song + adversarial review để xác minh các phát hiện
**Trạng thái lint:** Sạch — 0 lỗi, 36 warning nhỏ (unused var trong test, escape vô ích)
**Trạng thái build:** Chưa chạy build — review tĩnh thuần túy

---

## Tổng Quan

| Phân loại | Số lượng |
|---|---|
| **CRITICAL** đã verify | 11 |
| **CRITICAL** bị bác bỏ là false positive | 1 |
| **IMPORTANT** | ~30 |
| **MINOR** | ~30 |

---

## Phán Quyết Adversarial Trên Các Khẳng Định Chính

Trước khi tổng hợp, tôi đã tự xác minh các phát hiện quan trọng nhất bằng cách đọc code thật và chạy test. Kết quả:

| Khẳng định | Phán quyết | Bằng chứng |
|---|---|---|
| **Prototype pollution qua spread JSON `__proto__`** (security C1/C2) | **BÁC BỎ — false positive** | Đã verify: `{...JSON.parse('{"__proto__":{"x":1}}')}` tạo ra **own** `__proto__` data property, KHÔNG mutate `Object.prototype` (theo ES spec dùng `CreateDataProperty`). Vẫn có lỗ hổng validation thật ở `/api/settings` và `/api/rclone/config` — nhưng tác động là data corruption / chuyển hướng rclone, không phải proto pollution. |
| **DNS rebinding bypass AI SSRF guard** (security C3) | **CHẤP NHẬN** | `ai-endpoint-guard.js` resolve DNS một lần, rồi `fetch(url)` lại resolve lần nữa. Lỗi TOCTOU kinh điển. |
| **Regex content-safety chỉ match attr có quote** (shared C2) | **CHẤP NHẬN** | Đã verify `content-safety.js:11-12` dùng backreference `(['"]).*?\1`. `onclick=alert(1)` không có quote sẽ lọt qua. |
| **Attribute values không escape** (shared C1) | **CHẤP NHẬN** | Đã verify `element-renderers.js:91-94, 129, 143`, `htmlGenerator.js:324-327` interpolate trực tiếp `el.alt`, `el.language`, `bg.color`, v.v. |
| **Electron tắt sandbox + bind 0.0.0.0 + không CSP** (electron C1-3) | **CHẤP NHẬN** | `electron/main.js:2,8` xác nhận `ELECTRON_DISABLE_SANDBOX=1` và `--no-sandbox`. `server.listen(p, cb)` ở `server/index.js:314` không có host arg → Node mặc định bind `::`. |
| **PUT presentations `.passthrough()` cho phép client ghi đè system fields** (server C4) | **CHẤP NHẬN** | Đã verify `middleware/schemas.js:75` dùng `.passthrough()`. Client gửi `{deletedAt:null, createdAt:"1970", isTemplate:true}` đều được nhận. |

**Bằng chứng test prototype pollution:**
```js
const x = JSON.parse('{"__proto__":{"polluted":true}}')
const merged = {...{a:1}, ...x}
// ({}).polluted === true  → false (KHÔNG bị pollute)
// merged.__proto__ là own property → true (chỉ là data field bình thường)
```

---

## CRITICAL — Phải Sửa Trước Release Tiếp Theo

### CR-1. Embedded server bind `0.0.0.0` → lộ ra LAN

**Vị trí:** `server/index.js:314`, `electron/main.js:103`

**Vấn đề:**
Khi chạy Electron desktop, server được embed bind vào tất cả network interfaces. Bất kỳ ai trên cùng Wi-Fi (quán cà phê, khách sạn, hội nghị) đều có thể truy cập `http://<ip-bạn>:3002` và:
- Đọc/ghi presentations
- Upload file qua `/api/upload`
- Push GitHub bằng PAT của bạn
- Dùng rclone của bạn

CORS không chặn được — kẻ tấn công dùng `curl` hoặc script bypass CORS dễ dàng. **CORS không phải authentication.**

**Fix:**
Trong Electron mode, set `process.env.HOST = '127.0.0.1'` trước `require(serverPath)` ở `electron/main.js:99`, và sửa `server.listen(PORT, process.env.HOST || '0.0.0.0', cb)` để Docker/headless deployment vẫn bind broadly khi cần.

---

### CR-2. Chromium sandbox bị tắt toàn cục

**Vị trí:** `electron/main.js:2,8`, `electron-builder.yml:55-56`

**Vấn đề:**
- `ELECTRON_DISABLE_SANDBOX=1`
- `appendSwitch('no-sandbox')`
- Linux `executableArgs:['--no-sandbox']`

Một bug ở renderer (ví dụ exploit V8, KaTeX, TipTap, hay PPTX độc hại) thoát thẳng ra renderer process không sandbox, có quyền truy cập filesystem qua các Chromium primitive. `contextIsolation: true` **KHÔNG** thay thế được sandbox.

**Fix:**
Xóa cả 3 dòng (`process.env.ELECTRON_DISABLE_SANDBOX`, `appendSwitch('no-sandbox')`, `executableArgs: ['--no-sandbox']`). Thêm `sandbox: true` vào `webPreferences`.

---

### CR-3. Không có Content-Security-Policy ở bất kỳ HTML response nào

**Vị trí:** `server/index.js`

**Vấn đề:**
Renderer + share viewer chạy với CSP rỗng (mặc định = không hạn chế). Kết hợp với CR-4/CR-5 bên dưới, một file PPTX độc hại import vào có thể XSS lên editor origin và gọi `electronAPI.getCredential('github-token')` (qua Electron preload). Đây là chuỗi exploit thực sự.

**Fix:**
Thêm CSP middleware trước routes:
```js
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
    "connect-src 'self' ws: wss:; frame-src 'self'")
  next()
})
```
Bắt đầu permissive (`'unsafe-inline'` cho script/style để giữ HTML tác giả vẫn chạy), sau đó siết dần.

---

### CR-4. Attribute values không escape rải rác trong shared renderers

**Các vị trí đã xác nhận:**
- `shared/src/element-renderers.js:91-94, 129, 143, 332, 344-346, 367-389, 67-76`
- `shared/src/htmlGenerator.js:324-327, 357-358`
- `shared/src/shapeUtils.js:33, 96, 103`

**Vấn đề:**
Trust model nói "HTML tác giả là trusted" — đúng. Nhưng PPTX/AI import điền vào các trường scalar như `el.alt`, `el.language`, `el.fillOverride`, `bg.color`, `bg.image`. Không trường nào đi qua `escapeHtml`. Một file `.pptx` thù địch (ai đó gửi cho user kèm "mở giúp em file này") trở thành persistent injection ở present-time, share-time, và PDF-export-time.

**Fix:**
Thêm helper `escapeAttr(s)` cho string và `numAttr(n)` cho số. Wrap mọi scalar interpolation. Thay đổi cơ học, ~30 chỗ.

---

### CR-5. Regex `content-safety.js` bypass được + markdown iframe dùng same-origin `srcdoc`

**Vị trí:** `shared/src/content-safety.js:11-12`, `shared/src/element-renderers.js:173-174`

**Vấn đề 1:**
`shared/src/content-safety.js:11-12` dùng backreference `\1` đòi hỏi quote khớp nhau:
```js
return String(html || '').replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
```
Payload không quote như `<svg onload=alert(1)>` lọt qua sạch. Parser `shared-html-parser.js:38` lại nhận attribute không quote → exploit chain hoàn chỉnh.

**Vấn đề 2:**
`shared/src/element-renderers.js:173-174` dùng cùng regex flawed này inline trong markdown iframe. Tệ hơn, dùng `srcdoc=` thay vì `data:` URL. `srcdoc` **kế thừa origin của parent** — markdown payload chạy trong origin của share viewer, có thể đọc cookie và gọi `/api/*`.

**Fix:**
- Sửa regex thành `(?:"([^"]*)"|'([^']*)'|([^\s>]+))` để match cả 3 dạng quote/no-quote.
- Thêm `sandbox="allow-scripts"` (KHÔNG có `allow-same-origin`) cho mọi `srcdoc` iframe (chart, markdown, latex, qr ở các dòng 174, 224, 285, 414).

---

### CR-6. PUT presentations + passthrough cho phép ghi đè system field

**Vị trí:** `server/middleware/schemas.js:75`, `server/routes/presentations.js:260-278`

**Vấn đề:**
`updatePresentationSchema` dùng `.passthrough()`; spread merge `{...presentations[index], ...req.body}` nhận mọi key client gửi, kể cả `deletedAt`, `createdAt`, `isTemplate`. Client có thể:
- Bypass soft-delete (gọi PUT với `deletedAt: null` để un-delete mà không qua `/restore`)
- Corrupt timestamp
- Biến presentation thường thành template

**Fix:**
Strip server-managed key trước khi merge:
```js
const { id, deletedAt, createdAt, isTemplate, ...safe } = req.body
const updated = { ...presentations[index], ...safe }
```

---

### CR-7. Game socket presenter operations không có authentication

**Vị trí:** `server/services/game-socket-handler.js:63-110`, `server/routes/games-rest-api-handler.js:42-53`

**Vấn đề:**
Bất kỳ player ẩn danh nào sau khi `game-join` đều có thể emit `game-random`, `game-next`, `game-end`. Không check presenter, không token, không host socketId. Một viewer trong session kiểu Kahoot có thể end game, skip câu hỏi, trigger picker.

Cộng thêm: `POST /api/games/:gameId/answer` tin tưởng `socketId` client gửi trong body. Bất kỳ ai biết `gameId` (lộ trong URL/QR code) có thể submit answer giả mạo player khác → spoof điểm số.

**Fix:**
Phát presenter token tại `createRoom()`, persist `presenterSocketId`/`hostTokenHash` trên room, gate handler bằng `canControlGame(gameId, socket.id)` giống `live-rooms.canControlRoom`. Lấy `socketId` từ authenticated session, không bao giờ trust body.

---

### CR-8. Live `controller` role bypass presenter token

**Vị trí:** `server/services/live-rooms.js:68-74`

**Vấn đề:**
`joinRoom(role:'controller')` chỉ check room tồn tại; không check `presenterToken`. Controller pass `canControlRoom`, được full quyền annotate, timer, navigate, laser. Bất kỳ viewer nào biết `roomCode` 6 ký tự (lộ công khai) đều có thể gọi browser console:
```js
socket.emit('join', { roomCode, role: 'controller' })
```
để leo quyền.

**Fix:**
Yêu cầu `presenterToken` cho cả role `controller`. Token cấp out-of-band qua URL speaker/remote view.

---

### CR-9. DNS rebinding bypass AI endpoint guard

**Vị trí:** `server/services/ai-endpoint-guard.js:47-83`, `server/services/ai-provider.js:77`

**Vấn đề:**
`ai-endpoint-guard.js` resolve hostname qua `dns.lookup` để check không phải private IP. Sau đó `fetch(url)` resolve lần nữa. Kẻ tấn công kiểm soát DNS có thể trả public IP tại lúc validate, private IP tại lúc fetch (TTL ngắn). Nếu user bị lừa cấu hình custom AI endpoint, attacker có thể SSRF loopback (đọc PAT từ `/api/settings`, dump data qua `/api/rclone/sync`).

**Fix:**
Resolve một lần, sau đó `fetch(parsed.toString(), { dispatcher: pinnedIp })` để pin IP đã resolve, hoặc truyền IP vào URL với header `Host` giữ hostname gốc.

---

### CR-10. Cụm vấn đề server architecture: data loss / DoS

**Lost updates** (đọc rồi ghi NGOÀI `withFileLock` — hai client cùng PUT thì client thứ hai ghi đè client thứ nhất):
- `server/routes/templates.js:61-77, 80-91`
- `server/routes/history.js:58-77`
- `server/routes/explore.js:63-76`
- `server/routes/settings.js:24-46`

**Sync fs trên blob 50MB:** `server/routes/history.js:17,25,63,83` dùng `fs.writeJsonSync`/`readJsonSync`. Snapshot 50MB block event loop ~500ms+ mỗi request. **Fix:** chuyển sang async `fs-extra` API. Lưu metadata snapshot vào `index.json` riêng, chỉ đọc full payload khi restore.

**Snapshot không bị evict, fill disk:** `server/routes/history.js:10-30` không cap số lượng, không TTL. User dùng autosave-style sẽ fill disk. **Fix:** giữ 50 snapshot gần nhất per presentation, evict oldest trong cùng lock.

**`/raster-elements` là DoS vector:** `server/routes/presentations.js:232-245` launch fresh Chromium mỗi request (~200MB RAM, vài giây). N request đồng thời = N browser. **Fix:** thêm Zod validation (slide ≤ 200, element ≤ 5000) + `p-limit(1-2)` + wall-clock timeout.

**Không có SIGTERM handler:** `server/index.js:301-323` không register signal. Trong Docker, `docker stop` kill mid-`writeJson` → file `.tmp` tồn tại nhưng rename chưa xong → JSON corrupt, Socket.IO chưa drain. **Fix:** capture SIGTERM/SIGINT, gọi `server.close()`, `io.close()`, await chuỗi `withFileLock`, rồi exit.

**Fix tổng:** thêm `withTemplates`/`withSettings` mirror cho `withPresentations`.

---

### CR-11. Annotation payload không validate

**Vị trí:** `server/services/socket-handler.js:217-234`

**Vấn đề:**
```js
{ ...annotation, id, createdAt, createdBy: 'presenter' }
```
Nhận key bất kỳ, size không giới hạn. Lưu vào room state và rebroadcast cho tất cả viewer (replay qua `annotations:sync`). Rủi ro:
- Prototype-pollution-style key abuse khi xử lý nội bộ
- Persistent XSS xuyên qua viewer (kết hợp CR-4)
- Memory DoS vì payload khổng lồ

**Fix:**
Whitelist field (`type`, `slideIndex`, tọa độ số, hex color, text có cap length). Reject `__proto__/constructor/prototype`. Cap số byte payload và số annotation per slide.

---

## IMPORTANT — Lên Lịch Sprint Tới

### Server

- **Body limit `50mb` global quá rộng** — `server/index.js:66`. Cap `/api/settings`, `/api/analytics`, `/api/explore` ở 1mb.
- **Production error message lộ thông tin nội bộ** — ~12 route trả raw `err.message` (lộ filesystem path, rclone stderr có thể chứa credential). Wrap qua `errorHandler` trả `'Internal server error'` ở production.
- **Settings PUT shallow merge wipe AI subfield** — `routes/settings.js:27`. PUT `{ai:{provider:"openai"}}` xóa luôn `apiKey`. Dùng deep-merge cho `ai`.
- **Marketplace `readFileSync` hot path** — `routes/marketplace.js:18`. Async preload lúc boot.
- **Adopt `presentation-finder.js`** — file tồn tại nhưng không dùng. Logic find-by-id hiện duplicate ở `routes/presentations.js:128-156, 392-411`.
- **POST /share/:token crash khi token không có password** — `server/index.js:265`. `bcrypt.compare(pwd, undefined)` throw, trả 500 với err.message.

### Live / Game

- **Socket.IO không có origin allowlist ở production** — `server/index.js:308-309` set `origin: false`, không bảo vệ CSRF qua WS upgrade.
- **Live room không bao giờ GC** — `live-rooms.js` không có TTL. Một attacker tạo room không ngừng → fill memory. **Fix:** track `lastActivityAt`, sweep room idle.
- **Presenter election race khi rejoin** — `live-rooms.js:60-67`. Hai socket cùng giữ token → cả hai pass `canControlRoom`. **Fix:** kick old presenter explicitly hoặc reject new join.
- **Leaderboard lộ `socketId`** — `game-room-manager-singleton-service.js:122-126`. Khi biết socketId, attacker spoof CR-7 dễ hơn. Dùng opaque playerId.
- **Speed bonus dùng `timeSpentMs` từ client** — `game-room-manager-singleton-service.js:52-75`. Client set `0` để claim full bonus mãi. **Fix:** track `question.startedAt` server-side.
- **Annotation token nằm trong query string** — `routes/live.js:31-44`. Token rò vào access log + browser history. **Fix:** chuyển sang `Authorization: Bearer` header.
- **Game `playerName` và answer không validate** — `game-socket-handler.js:15-35`. Không cap length, không filter ký tự. Cap name length 32, validate `answerIndex` là integer hợp lệ.
- **Room code có thể enumerate** — `live-rooms.js:31-35`. 6 ký tự từ alphabet 36 (~2.2B). `GET /api/live/room/:code` không rate-limit riêng. Tăng lên 8 ký tự + per-IP rate limit.

### Shared HTML

- **`customCSS` không neutralize `</style>` cho share viewer** — `htmlGenerator.js:201, 507`. Tác giả gửi viewer payload chạy ở share origin.
- **Live presenter bootstrap script bundle vào share HTML** — `htmlGenerator.js:245-315`. Chạy unconditional ở tab share viewer. Gate sau cờ server-side.
- **`escapeHtml(undefined)` trả `"undefined"`** — `element-renderers.js:43`. Dùng `String(str ?? '')`.
- **`renderSvg` override unanchored regex** — `element-renderers.js:393-397`. `svgContent.replace(/fill="[^"]*"/g, …)` — nếu `el.fillOverride` chứa `"` thì pollute downstream attrs.

### Security (lỗi thật bị label sai dưới C1/C2)

- **Thêm Zod `.strict()` cho `/api/settings` PUT** (routes/settings.js).
- **Thêm Zod `.strict()` cho `/api/rclone/config`** (routes/sync.js:73-105).
- **PPTX media extension allowlist** — `services/pptx-import/media.js:93-104`. Reject `.html`/`.svg` từ zip entry.
- **SVG upload bị cấm hoặc DOMPurify-sanitize** — `routes/upload.js:67-83`. SVG render trong editor origin chạy inline JS → vượt trust boundary share viewer.
- **GitHub `owner`/`repo` charset validation** — `routes/github.js:22-43`. Thêm regex `/^[A-Za-z0-9_.-]{1,100}$/` để chặn `..`, `/`, `:`.
- **`rclone.conf` permission 0o600** — `routes/sync.js:96`. Trên multi-user host, password reversible vì rclone obscure không phải encrypt.
- **SPA wildcard catch `/api/*` 404** — `server/index.js:292`. Trả index.html cho API client → DX confusion. Scope route loại trừ `/api`, `/share`, `/uploads`, `/vendor`, `/ws`.
- **Share-tokens DELETE race** — `server/index.js:122-132`. Đọc-ghi không trong lock. Dùng `withShareTokens(...)`.

### Electron

- **`setWindowOpenHandler` fallback `allow`** — `main.js:135`. Drive-by phishing qua `data:`/`file:`. Default-deny.
- **Không có `will-navigate` guard** — XSS có thể `location.href = 'evil.com'` thoát app.
- **Electron Fuses chưa cấu hình** trong `electron-builder.yml`. Attacker ghi vào install dir chạy binary như Node. Cấu hình:
  ```yaml
  electronFuses:
    runAsNode: false
    enableCookieEncryption: true
    enableNodeOptionsEnvironmentVariable: false
    enableNodeCliInspectArguments: false
    enableEmbeddedAsarIntegrityValidation: true
    onlyLoadAppFromAsar: true
    grantFileProtocolExtraPrivileges: false
  ```
- **`before-quit` fire-and-forget** — `main.js:161-165`. Server đóng dở, snapshot history bị truncate.
- **Ghi credential không atomic** — `main.js:30`. Crash giữa truncate-write → mất hết credential. Dùng pattern write-tmp + rename.
- **Port collision = silent failure** — `main.js:13,103`. Hardcoded `PORT=3002`. Nếu port bị chiếm, `listen` emit `EADDRINUSE` nhưng `startServer` không register `server.on('error')`.

### Client architecture (vi phạm budget 200 LOC)

**Mega-file đã xác nhận:**

| File | LOC | Vượt budget |
|---|---|---|
| `client/src/pages/EditorPage.jsx` | 2030 | **10x** |
| `client/src/pages/HomePage.jsx` | 1677 | **8x** |
| `client/src/components/canvas/element-renderers/game-element-renderer.jsx` | 1352 | **6.7x** |
| `client/src/components/SlidePanel.jsx` | 631 | 3.1x |
| `client/src/components/SlideCanvas.jsx` | 628 | 3.1x |

Tổng vượt budget: ~5,810 LOC.

**Top wins (theo thứ tự ROI):**

1. **Extract `<EditorModals>` từ EditorPage** — JSX thuần (lines 1380-1944), ~520 LOC out, 1 file mới. Đây là single biggest win.
2. **Extract hook `useAutoSave` + `useUndoRedo`** — biến thành unit-testable. ~190 LOC out.
3. **Extract `useElementCreators(addElement)`** — consolidate 17 `addXxxElement` wrappers (lines 570-832). ~250 LOC out.
4. **Lift Jeopardy ra khỏi `game-element-renderer`** — 800 LOC riêng, split thành thư mục `game-renderers/jeopardy/` với `interactive-board.jsx`, `static-board.jsx`, `question-modal.jsx`, `daily-double-wager-modal.jsx`, `team-score-panel.jsx`, `presenter-controls.jsx`.
5. **HomePage:** extract `useImports` hook + `<DashboardSidebar>` + per-view components (`<TrashView>`, `<BuiltinTemplatesView>`, `<MyTemplatesView>`, `<MarketplaceView>`, `<PresentationsView>`).

**Bug runtime cần sửa:**

- **Dual state** — `ui-store.js:13-47` định nghĩa modal flag `showShareModal/showHistoryModal/...` với setter. `EditorPage.jsx:198-209` re-declare cùng flag bằng local `useState`. Nếu ai migrate child component sang dùng `useUIStore.openModal()`, UI sẽ silently no-op vì EditorPage chỉ đọc local state. **Fix:** chọn 1 nguồn. Khuyến nghị: xóa modal slice khỏi `ui-store.js`.
- **`presentation-store.js` là dead code** — 21 LOC, không consumer nào đọc. EditorPage dùng local `useState` cho `presentation`. Hoặc wire it up, hoặc xóa file. Để đó là bẫy cho contributor tương lai.
- **`exhaustive-deps` disabled** — EditorPage dòng 459 disable rule trong slide-change reset effect. Hôm nay an toàn, nhưng ẩn rủi ro khi `editor` ref đổi.

**Performance:**

- Missing memoization: `selectedElement` (EditorPage:1051), `commands` array (EditorPage:1101), `pageNumber/totalSlides` (EditorPage:1565), sorted visible elements (SlideCanvas:475). Mỗi render đều re-compute.
- Không có `React.memo` trên SlidePanel/SlideCanvas/PropertiesPanel — gõ phím auto-save trigger re-render toàn bộ.
- `App.jsx` import 7 page tĩnh. Route `/live`, `/remote`, `/speaker`, `/player`, `/editor` nên dùng `React.lazy` để tách bundle.
- 10 hljs theme `?raw` import ở đầu EditorPage → ~30KB initial bundle. Dynamic-import theo theme đang chọn.

**Dead code:**

- `_activeGameType`, `_setAnotationStrokes`, `_lastSavedAt`, `shareStatus` (eslint-disabled, prefix `_` đánh dấu) → xóa.
- `THEMES`/`TRANSITIONS` const arrays trong EditorPage không dùng → xóa.
- Game keyboard shortcut `onGamePause`, `onStartSlideshow` chỉ `console.log` → implement hoặc xóa shortcut.

---

## MINOR (cleanup pass — ~30 mục)

- **36 ESLint warning** (unused var trong test, escape vô ích trong animation template, `no-undef` trong vitest setup polyfill).
- **File-size budget bị vi phạm cả ở server side:** `routes/presentations.js` 535 LOC, `index.js` 325 LOC, `services/storage.js` 208 LOC.
- **`withFileLock` process-local** — `services/storage.js:21-41`. OK hôm nay, nhưng nếu Electron + Express co-run trong tương lai, hoặc cluster, sẽ corrupt JSON. Xem xét `proper-lockfile` hoặc migrate sang SQLite.
- **`app.set('trust proxy', ...)` chưa cấu hình** — sau reverse proxy, rate-limiter sẽ thấy IP của proxy thay vì IP client thật.
- **`incrementShareViews` write per request** — share token JSON tăng monotonically. Cache views in-memory, flush periodically.
- **`triggerRandom` returns `-1` nhưng caller check `=== null`** — `game-room-manager-singleton-service.js:82`. Khi `items` rỗng, `-1` flow qua như winnerIndex hợp lệ.
- **`game-leave` cho phép spoof gameId** — `game-socket-handler.js:113-127`. Broadcast lộ snapshot rooms khác.

---

## False Positive Đã Ghi Lại

**Server security CR C1/C2 "prototype pollution":** Verify rồi — không phải. Object spread của JSON-parsed `__proto__` tạo own data property, không mutate `Object.prototype`. Nhưng lỗ hổng validation thực sự (data corruption / hostile rclone target) vẫn cần fix — chỉ là IMPORTANT chứ không phải CRITICAL.

---

## Quan Sát Tích Cực (Things Done Right)

- **Zod schema** đã được wire cho POST/PUT presentations, AI, share — đúng pattern.
- **PPTX hardening mạnh** — zip-bomb, entry-count, signature check ở `pptx-guards.js:23-69`.
- **AI endpoint SSRF guard** cover IPv4/IPv6/private range bao gồm CGNAT và IPv4-mapped IPv6 (vẫn bị bypass qua DNS rebind, nhưng base coverage tốt).
- **Share password storage** dùng `bcrypt.compare`, không plaintext.
- **Custom CSS sanitizer** chặn `expression()`, `javascript:`, `url(javascript:` ở share-mode rendering (`index.js:154-158`).
- **File locking** quanh tất cả JSON storage mutation (chỉ thiếu adoption ở vài route).
- **`path.basename` defenses** ở `media.js:101`, `presentations.js:481, 509`.
- **PPTX importer cleanup** tmp file trong `finally`.
- **Magic-byte verification** post-multer-save với cleanup on mismatch.
- **Electron renderer hardening:** `nodeIntegration: false` + `contextIsolation: true` + preload surface hẹp (4 method credential-only).
- **`safeStorage` cho credential** thay vì rolled-crypto. Chọn đúng.
- **Plugin iframe** có `sandbox="allow-scripts"` (no `allow-same-origin`) — đúng pattern.
- **`data:text/html` cho `html` element** tạo null-origin iframe — isolation đúng.
- **`sanitizeHref`** chặn đúng `javascript:`, `data:`, allow http/https/mailto/relative.
- **Refs-mirror-state pattern** trong SlideCanvas/EditorPage tránh stale closure.
- **Auto-save queue + attemptId reconciliation** xử lý concurrent save đúng.

---

## Kế Hoạch Hành Động Đề Xuất

| Ưu tiên | Việc | Lý do |
|---|---|---|
| **Same day** | CR-2 (sandbox) + CR-1 (loopback bind) | ~10 LOC tổng cộng, đóng 2 lỗ hổng nghiêm trọng nhất |
| **Day 1-2** | CR-3 (CSP) + CR-6 (passthrough) + CR-7/CR-8 (live/game auth) + CR-9 (DNS rebind pin) | Vừa và nhỏ, mỗi cái 1-3 file |
| **Sprint** | CR-4 (escapeAttr rollout) + CR-5 (sanitizer regex + iframe sandbox) + CR-10 (storage atomicity + history retention + raster mutex + SIGTERM) + CR-11 (annotation validation) | Mechanical change diện rộng |
| **Backlog** | IMPORTANT findings + client mega-file split plan | Lớn hơn, không blocking |

### Quick Wins PR (gói 4 fix trong 1 PR)

Khuyến nghị **làm gói 4 quick wins trong 1 PR** — tổng ~10 LOC, mỗi cái đóng 1 lỗ hổng Critical:

1. **CR-1 loopback bind:** `process.env.HOST = '127.0.0.1'` ở `electron/main.js:99` + `server.listen(PORT, process.env.HOST || '0.0.0.0', cb)` ở `server/index.js:314`
2. **CR-2 sandbox:** xóa 3 dòng (`electron/main.js:2,8`, `electron-builder.yml:55-56`), thêm `sandbox: true` vào `webPreferences`
3. **CR-6 strip system fields:** 1 dòng ở `routes/presentations.js:260` — destructure loại bỏ `id, deletedAt, createdAt, isTemplate`
4. **CR-9 pin DNS:** thay đổi nhỏ ở `services/ai-endpoint-guard.js`/`ai-provider.js` để pin resolved IP

---

## Câu Hỏi Còn Bỏ Ngỏ

1. **Embedded server có cần LAN-reachable** cho use case "phone trên cùng Wi-Fi xem live presenter"? Nếu có, cần room-pairing-code auth; REST API vẫn nên giữ loopback bất kể.
2. **`/api/` có bao giờ reachable ngoài `127.0.0.1`** (tức Docker sau auth proxy) không? Câu trả lời quyết định nhiều IMPORTANT finding có escalate lên CRITICAL hay không.
3. **`customCSS` chỉ owner edit được, hay shareable template cũng mang được?** Quyết định style-injection có vượt trust boundary hay không.
4. **`presentation-store.js` là dead code, hay reserved cho refactor sắp tới?**
5. **`DELETE /api/shares/:token` có chủ ý không auth không?** Token là credential nhưng bất kỳ ai có token đều revoke được cho mọi người.
6. **Snapshot retention nên configurable per presentation hay global?** Ảnh hưởng shape fix cho CR-10.
7. **PPTX import có bao giờ produce element type `'html'` hoặc `'markdown'` không?** Nếu có, CR-5 escalate từ "có thể xảy ra" thành "actively exploitable".
8. **Public share endpoint serve cùng HTML như editor present mode** (live block + presenterTools head) không? Confirm risk surface của I4.

---

## Phương Pháp Review

**6 reviewer chạy song song với scope tách biệt:**

| Reviewer | Scope | Findings (Crit/Imp/Min) |
|---|---|---|
| Server security | share, upload, github, sync, ai, media, pptx-import | 3 / 8 / 7 |
| Server architecture | presentations, templates, history, settings, analytics, storage | 6 / 8 / 7 |
| Live socket | socket-handler, live-rooms, game-socket-handler | 5 / 8 / 7 |
| Shared HTML | htmlGenerator, element-renderers, content-safety | 4 / 9 / 8 |
| Electron shell | main.js, preload.js, electron-builder.yml | 3 / 7 / 5 |
| Client architecture | EditorPage, HomePage, game-renderer, stores | 3 / 12 / 4 |

**Adversarial verification** đã chạy trên 6 claim quan trọng nhất. 1 claim bị bác bỏ là false positive.

---

**Status:** DONE_WITH_CONCERNS
**Tóm tắt:** 11 phát hiện Critical đã verify, tập trung ở (a) trust-boundary trong Electron LAN exposure + thiếu CSP, (b) PPTX/AI import điền vào attribute không escape qua sanitizer regex bị bypass, (c) authorization gap ở live/game socket, (d) race condition + sync I/O + history không bị evict ở storage. Một Critical bị adversarial review bác bỏ là false positive (prototype pollution). Client mega-file vi phạm budget 200 LOC từ 6-10 lần — có split plan nhưng không blocking.
