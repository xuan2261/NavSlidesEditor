# Backend / runtime production-readiness review

Ngày: 2026-08-20  
Scope: `server/**`, `electron/**`, `native/**`, packaging/release/tests liên quan.  
Trust model: single-user self-hosted; không flag trusted author HTML tự thân. Share/import/Electron credential-admin boundary vẫn in-scope.

## Critical

Không có finding Critical đã chứng minh.

## High

### H1 — Live presenter runtime hỏng trong Docker/Electron production artifact

- Evidence: server chỉ tìm client bundle tại root `node_modules` (`server/index.js:121-152`), còn runtime luôn tải `/vendor/socket.io/socket.io.min.js` (`shared/src/live-presenter-runtime.js:20-34`). `server/package.json:10-27` không khai báo `socket.io-client`; Docker chỉ install workspace server (`Dockerfile:30-41`); Electron chỉ đóng `server/node_modules` (`electron-builder.yml:20-30`).
- Failure: Docker hoặc desktop packaged trả 404 cho script; `io` không tồn tại, presenter không join room/broadcast navigation.
- Tests miss: full-workspace `npm ci` hoist dependency từ client, che lỗi; `server/vendor-assets.test.js:6-19` không test Socket.IO asset; release chỉ kiểm `express` (`.github/workflows/release.yml:57-66`).
- Minimal verification: build production image/unpacked Electron; `GET /vendor/socket.io/socket.io.min.js` phải 200; mở Present với `?live=...`, assert presenter socket join thành công.

### H2 — Share analytics tiết lộ active capability từ password-protected/expired link

- Evidence: analytics lưu raw token/referrer (`server/routes/analytics.js:7-18`), chỉ kiểm token thuộc cùng deck (`:25-38`), không kiểm `expiresAt`/password, rồi trả toàn bộ token keys/events (`:53-64`). Share viewer thật sự enforce expiry/password tại `server/index.js:250-261,270-299`.
- Failure: holder của link A đã expired hoặc chưa biết password gọi analytics bằng A, đọc token B active rồi mở deck qua B; raw referrer cũng bị lộ.
- Tests miss: test hiện codify leakage bằng cách auth `analyticsToken` rồi assert thấy `token-a` (`server/routes/api-surface.test.js:241-256`); E2E chỉ kiểm response shape/aggregation (`tests/e2e/share/analytics-view-tracking-and-token-based-access.spec.js:31-41,66-86`).
- Minimal verification: tạo A expired/protected và B active, ghi một view bằng B, gọi `GET /api/analytics/:id?token=A`; response không được chứa B/referrer và A phải bị deny.

### H3 — Electron origin allowlist có prefix bypass trong renderer tắt sandbox

- Evidence: sandbox bị disable toàn cục (`electron/main.js:1-8`); popup/navigation dùng `startsWith(APP_ORIGIN)` (`:126-149`); preload expose credential IPC (`electron/preload.js:7-34`) và handlers không validate sender/key (`electron/main.js:34-74`). `http://127.0.0.1:3002@example.com/` qua prefix nhưng origin thật là `http://example.com`.
- Failure: crafted/imported link điều hướng hoặc mở external content bên trong app renderer thay vì system browser; external page nhận preload surface trong unsandboxed renderer. Claim “đọc GitHub token hiện tại từ safeStorage” chưa chứng minh vì repo không có caller lưu token, nhưng confinement bypass là thật.
- Tests miss: không có Electron navigation/IPC integration test; release contract chỉ grep workflow metadata (`tests/unit/electron-release-readiness-contract.test.js:29-42`).
- Minimal verification: Electron test với userinfo/encoded/default-port URL; parsed `new URL(url).origin` khác `APP_ORIGIN` phải bị deny, `shell.openExternal` được gọi, IPC từ non-app frame phải reject.

## Medium

### M1 — AI SSRF guard bỏ lọt IPv4-mapped IPv6 dạng hex

- Evidence: mapped IPv6 chỉ được chuyển sang IPv4 nếu phần sau `::ffff:` được `net.isIP(...)=4` (`server/services/ai-endpoint-guard.js:20-30`); `::ffff:7f00:1` và `::ffff:0a00:1` vì vậy pass rồi được pin (`:109-126`).
- Failure: attacker-controlled DNS AAAA trả hex-mapped loopback/private; custom endpoint kết nối nội bộ qua chính pinned dispatcher.
- Tests miss: chỉ cover dotted `::ffff:127.0.0.1` (`server/services/ai-endpoint-guard.test.js:13-28`).
- Minimal verification: mock `dns.lookup` trả `::ffff:7f00:1`/`::ffff:0a00:1`; `assertSafeAiEndpoint` phải reject.

### M2 — Shutdown release package writer lock trước khi HTTP requests drain

- Evidence: `stopServer` gọi `server.close()` nhưng không await close, rồi shutdown store ngay (`server/index.js:405-412`); signal path exit ngay sau promise (`:418-426`); Electron quit cũng chờ đúng promise này (`electron/main.js:176-183`).
- Failure: save/import đang active có thể chạm store đã shutdown hoặc process thoát trước khi response/write hoàn tất; lần chạy kế tiếp được phép mở store trong khi request cũ chưa drain.
- Tests miss: helper force `closeAllConnections()` trước `stopServer` (`server/index-shutdown-writer-lock.test.js:30-40`), loại bỏ chính active-request race.
- Minimal verification: giữ delayed mutation request; gọi `stopServer`; assert promise chưa resolve/release lock cho tới close event, hoặc bounded timeout force-close có log rõ.

### M3 — Dev/test Electron 42 nhưng release đóng Electron 33

- Evidence: devDependency là `electron ^42.3.0` (`package.json:77-87`), builder ép `33.4.11` (`electron-builder.yml:6`).
- Failure: security fixes, Chromium/Node behavior và native compatibility được test trên runtime khác binary người dùng nhận.
- Tests miss: packaged verification chỉ kiểm thư mục `express`, không launch executable hay assert `process.versions.electron` (`.github/workflows/release.yml:57-66`).
- Minimal verification: packaged smoke phải assert runtime version bằng một source-of-truth, mở main window, hit health/API và clean shutdown.

### M4 — Custom AI endpoint mất `undici` trong production dependency closure

- Evidence: guard cần `require('undici')`, thiếu thì fail closed (`server/services/ai-endpoint-guard.js:62-78,121-124`), nhưng `server/package.json:10-27` không có dependency này; Docker/Electron chỉ cài server production deps (`Dockerfile:35-41`, `scripts/prepare-electron.js:52-70`).
- Failure: custom provider luôn trả “Unable to establish a pinned connection” trong Docker/desktop artifact dù endpoint public hợp lệ.
- Tests miss: AI tests chạy full dev tree nơi Electron tooling kéo `undici`; không có artifact/dependency-closure test (`server/services/ai-endpoint-guard.test.js:44-50`).
- Minimal verification: trong production-deps-only artifact, require guard và validate public IP với stub dispatcher/module-resolution; `undici` phải resolve từ declared server dependency.

### M5 — Rclone config lỗi ghi đè cấu hình đang hoạt động

- Evidence: route ghi config mới trước (`server/routes/sync.js:325-350`), sau đó mới test `rclone lsd`; failure chỉ trả 400, không restore file cũ (`:351-354`).
- Failure: typo password/network outage khi reconfigure phá remote đang dùng; lần sync sau dùng credential hỏng.
- Tests miss: E2E chỉ happy path (`tests/e2e/sync/rclone-proton-drive.spec.js:24-43`); unit sync suite không có rollback assertion cho `/config`.
- Minimal verification: seed working `rclone.conf`, mock `lsd` fail, POST config mới; file cuối phải byte-identical config cũ (hoặc temp config chỉ rename sau successful probe).

### M6 — `npm start` không chạy trên Windows được support

- Evidence: root script dùng POSIX env assignment (`package.json:18-24`), trong khi README quảng bá Node.js source/runtime 20+ không giới hạn OS (`README.md:85-96,387-389`).
- Failure: PowerShell/cmd chạy `npm start` thoát với `'NODE_ENV' is not recognized`; production-style local run không khởi động.
- Tests miss: CI Linux dùng trực tiếp `NODE_ENV=production ... node server/index.js` (`.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:214-229`), không chạy root start trên Windows.
- Minimal verification: Windows CI chạy `npm start` với port tạm và poll health; command phải start server rồi shutdown sạch.

### M7 — Electron server dependency tree không reproducible

- Evidence: prepare tạo package chỉ chứa semver ranges (`scripts/prepare-electron.js:52-63`), chạy `npm install` không input lock (`:65-75`), rồi xóa temp lock và chỉ move `node_modules` (`:78-91`).
- Failure: cùng tag có thể đóng transitive versions khác, gồm regression/security drift chưa qua root CI.
- Tests miss: release readiness chỉ kiểm module-directory presence/workflow text (`scripts/prepare-electron.js:93-109`, `tests/unit/electron-release-readiness-contract.test.js:29-42`), không kiểm lock/hash/tree.
- Minimal verification: hai clean builds phải có identical production lock/tree hash; release dùng `npm ci` từ committed/generated-and-verified lock.

## Low

Không có finding Low đáng giữ.

## Researcher claim disposition

- Giữ: analytics disclosure, IPv6-mapped SSRF, shutdown race, Electron runtime mismatch, non-reproducible Electron deps.
- Giữ nhưng thu hẹp: Electron prefix bypass/unsandboxed renderer; không khẳng định GitHub token hiện đang nằm trong `safeStorage` vì client không gọi bridge và deployment docs nói token nằm plaintext trong `github-config.json` (`docs/deployment-guide.md:376-380`).
- Reject native packaging hypothesis: release contract cố ý **không bundle/download OfficeCLI** (`server/services/pptx-import/officecli/packaging.test.js:18-40`), manifest cũng định nghĩa external qualified binary; thiếu native launcher trong Electron artifact không phải regression theo contract hiện tại.

## Verification note

- Trước khi controller báo shared `node_modules` bị incomplete: Node one-liner xác nhận prefix URL parse sang `http://example.com`, `isBlockedIp('::ffff:7f00:1') === false`; `npm start` trên Windows fail đúng cú pháp env.
- Sau cảnh báo: dừng toàn bộ npm/test/install; phần còn lại static evidence only. Không sửa code/test/config.

## Unresolved questions

- Có public share deployment nào cố tình cho viewer xem analytics chi tiết hay analytics luôn là editor-owner surface?
