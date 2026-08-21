# Backend / Electron / native / CI code review

Ngày: 2026-08-20  
Scope: `server/**`, `electron/**`, `native/**`, `scripts/**`, workflows và unit tests liên quan.  
Trust model: single-user, self-hosted; không coi author-controlled HTML/CSS/JS là XSS finding tự thân.

## Findings

### 1. High — Analytics làm lộ share capability giữa các link của cùng presentation

- Impact: holder của một share token bất kỳ có thể đọc plaintext các token khác đã phát sinh view, kể cả link có password/expiry khác; từ đó bypass capability separation hoặc thu thập referrer nhạy cảm.
- Evidence: `recordView` lưu nguyên token/referrer tại `server/routes/analytics.js:7-18`. Route chỉ kiểm tra query token thuộc cùng presentation tại `server/routes/analytics.js:25-38`, rồi trả token làm key trong `byToken` và trả raw events tại `server/routes/analytics.js:53-64`.
- Evidence test: test tạo capability `analyticsToken`, ghi event bằng token khác `token-a`, rồi xác nhận response chứa `byToken['token-a']`: `server/routes/api-surface.test.js:241-256`.
- Verification suggestion: tạo hai share link A/B, mở B một lần, gọi `GET /api/analytics/:id?token=A`; assert response không được chứa B hay raw event token/referrer. Analytics owner access nên dùng editor/admin boundary, không dùng viewer share token.

### 2. High — Electron same-origin check có prefix bypass; external page chạy trong unsandboxed renderer

- Impact: URL như `http://127.0.0.1:3002@example.com/` vượt check, điều hướng trusted window hoặc mở child window tới origin ngoài. Renderer sandbox bị tắt toàn cục; external content nhận attack surface Electron lớn hơn và preload bridge có IPC đọc/ghi/xóa credential theo key tùy ý.
- Evidence: sandbox bị tắt trước startup và bằng Chromium switch tại `electron/main.js:1-8`. Cả popup và navigation dùng `url.startsWith(APP_ORIGIN)` tại `electron/main.js:126-149`, thay vì parse rồi so `new URL(url).origin`. Preload expose credential APIs tại `electron/preload.js:7-34`; main handlers không validate sender/origin hoặc key tại `electron/main.js:34-74`.
- Local verification: Node URL parser cho URL trên kết quả `startsWith=true`, nhưng `origin=http://example.com`.
- Verification suggestion: unit/integration test URL userinfo, encoded forms, mixed-case/default-port; chỉ allow khi parsed origin bằng chính xác `APP_ORIGIN`. Bật Chromium sandbox và set explicit `sandbox: true`; IPC handlers phải reject sender không thuộc app origin.

### 3. Medium — SSRF guard bỏ lọt IPv4-mapped IPv6 dạng hex-canonical

- Impact: custom AI endpoint có DNS AAAA như `::ffff:7f00:1` hoặc `::ffff:0a00:1` được coi public, sau đó pinned dispatcher kết nối loopback/private target. Đây là SSRF boundary mà code chủ đích bảo vệ.
- Evidence: mapped IPv6 chỉ được block nếu phần sau `::ffff:` được `net.isIP(...)=4` tại `server/services/ai-endpoint-guard.js:20-30`; hex form không thỏa. `assertSafeAiEndpoint` chấp nhận khi mọi address qua `isBlockedIp`, rồi pin chính các address đó tại `server/services/ai-endpoint-guard.js:109-126`.
- Local verification: `isBlockedIp('::ffff:7f00:1') === false`, `isBlockedIp('::ffff:0a00:1') === false`. Test hiện chỉ cover dotted form `::ffff:127.0.0.1`: `server/services/ai-endpoint-guard.test.js:13-28`; module PPTX khác đã ghi nhận URL canonicalization này tại `server/services/pptx-import/mapper/map-media-private-host.test.js:30-37`.
- Verification suggestion: normalize IPv6 bằng byte representation rồi kiểm tra mapped/NAT64/special ranges; thêm DNS lookup test trả hex-mapped loopback/private và assert fail-closed.

### 4. Medium — Shutdown release package writer lock trước khi HTTP connections drain

- Impact: Electron quit/SIGTERM có thể release writer lock và kết thúc process trong khi save/upload request còn active. Request sau đó có thể fail vì store đang `shuttingDown`, hoặc process bị quit trước response/write hoàn tất; tạo cửa sổ data loss/race với lần khởi động kế tiếp.
- Evidence: `stopServer` gọi `server.close()` nhưng không await callback/`close` event, rồi shutdown store ngay tại `server/index.js:405-412`. Signal path `finally(() => process.exit(0))` tại `server/index.js:418-426`; Electron chờ `stopBackend()` rồi gọi `app.quit()` tại `electron/main.js:176-183`.
- Test gap: test shutdown chủ động gọi `server.closeAllConnections()` trước `stopServer`, nên không cover active request: `server/index-shutdown-writer-lock.test.js:30-40`.
- Local verification: giữ một HTTP request chưa hoàn tất; `await stopServer(server)` trả về với `closeEventEmitted=false`; event chỉ xuất hiện sau khi socket bị destroy.
- Verification suggestion: integration test delayed mutation/save; shutdown phải đợi server close với bounded timeout, sau đó mới release store. Khi timeout, force-close có log và explicit failure semantics.

### 5. Medium — Desktop dev/test runtime là Electron 42 nhưng release artifact đóng gói Electron 33

- Impact: security flags, Chromium behavior và native compatibility được phát triển/test trên runtime khác artifact người dùng nhận. Regression hoặc security fix của Electron 42 không có trong package 33.
- Evidence: dependency dùng `electron ^42.3.0` tại `package.json:77-87`, README công bố Electron 42 tại `README.md:469`, nhưng builder pin `electronVersion: '33.4.11'` tại `electron-builder.yml:6`.
- CI gap: release chỉ kiểm tra thư mục `express` tồn tại trong unpacked app, không launch packaged executable hay assert runtime version: `.github/workflows/release.yml:52-66`. Unit release-readiness chỉ kiểm metadata/workflow text: `tests/unit/electron-release-readiness-contract.test.js:11-42`.
- Verification suggestion: dùng một nguồn version duy nhất; sau build chạy packaged smoke, đọc `process.versions.electron`, mở main window, hit health/API, rồi clean shutdown.

### 6. Medium — Electron server dependencies trong release không lock reproducibly

- Impact: tag giống nhau có thể đóng gói transitive dependency khác nhau; release nhận code chưa được root lockfile/CI review, tăng supply-chain và regression risk.
- Evidence: script tạo package chỉ chứa semver dependencies, không tạo/copy lockfile tại `scripts/prepare-electron.js:52-63`, rồi chạy `npm install --omit=dev --ignore-scripts` tại `scripts/prepare-electron.js:65-75`. Release gọi script này tại `.github/workflows/release.yml:31-38`.
- Verification suggestion: tạo committed lock cho isolated server package hoặc dùng workspace-aware `npm ci --omit=dev`; fail nếu packaged dependency tree khác tree/hash đã kiểm trong CI.

## Hypotheses / cần xác nhận

- Native OfficeCLI launcher không được compile/test trong workflows đã đọc; `native/windows-officecli-launcher/**` cũng không nằm trong `electron-builder.yml:10-34`. Nếu launcher là release-supported capability, cần Windows CMake build, protocol/containment smoke và artifact identity gate; nếu chỉ experimental/external, nên ghi rõ status.
- Credential IPC hiện chưa có caller trong `client/**` theo `rg`, nên chưa chứng minh secret đang được lưu. Tuy vậy sender/origin/key validation vẫn phải có trước khi bridge được dùng; finding #2 đã tạo external-renderer path.

## Verification đã chạy

- `npx vitest run server/services/ai-endpoint-guard.test.js --reporter=verbose` — 5/5 pass; không cover hex-mapped IPv6.
- Focused analytics test — pass và xác nhận cross-token disclosure hiện là tested behavior.
- Shutdown writer-lock + Electron release-readiness tests — 4/4 pass; shutdown test force-closes connections trước khi gọi owner function.

## Unresolved questions

- Analytics được thiết kế cho editor owner hay cho share viewer? Code hiện dùng viewer capability nhưng trả owner-level token detail.
- Native launcher có thuộc release contract hiện tại không, hay chỉ là guarded prototype?
