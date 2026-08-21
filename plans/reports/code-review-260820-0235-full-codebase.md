# Full codebase production-readiness review — remediation verified

Ngày review: 2026-08-20  
Ngày đóng remediation: 2026-08-20  
Scope: toàn bộ monorepo (`client`, `shared`, `server`, `electron`, `native`, scripts, CI, dependency/packaging contracts).  
Mode: review/debug toàn diện, triển khai remediation, independent read-only re-review và release verification.  
Trust model: HTML/CSS/JS do presentation author kiểm soát là intentional; chỉ flag khi dữ liệu vượt capability/origin/network boundary.

## Kết luận

**Remediation source hoàn tất; release vẫn conditionally blocked.** Ba High blockers và toàn bộ Medium/Low findings đã được sửa hoặc disposition rõ ràng. Independent final review trả **PASS**, không còn material correctness/security/reliability/contract defect đã biết trong pending implementation.

Không được tuyên bố unconditional production-ready vì hai qualification boundary còn mở:

1. Docker artifact/runtime smoke không chạy được do workstation không có Docker executable.
2. PPTX release qualification chưa đạt: importer-native strict gate chỉ pass 9/11 deck; PowerPoint evidence integrity pass nhưng fixed visual policy fail (mean SSIM `0.23698886751039192`, minimum `0`, thấp hơn `0.99`/`0.97`).

Trạng thái cuối:

- Open code findings: Critical 0, High 0, Medium 0, Low 0.
- Rejected: 1 finding cũ về Socket.IO production closure; build-time vendor contract đã được artifact-check.
- Release blockers: 2 boundary groups — Docker artifact qualification và PPTX strict/PowerPoint visual qualification.
- Capacity hypothesis không đủ evidence để thành finding: dashboard thumbnail iframe performance.

## Remediation closure

| Finding group | Status | Evidence chính |
|---|---|---|
| H1 analytics capability disclosure | Closed | Raw analytics operator-only; share token bị loại khỏi auth/client contract; redacted modal + negative tests. |
| H2 TipTap v2/v3 invalid graph | Closed | Direct TipTap family pin exact `2.27.2`; clean dependency tree và runtime receipt pass. |
| H3 presenter shortcut runtime throw | Closed | Producer callback returned; popup bridge queues/drains actions; timer actions dùng primary live socket; unsupported team/reveal controls bị loại khỏi registry/config/docs. |
| M1–M13 | Closed | Exact Electron origin/sandbox/no IPC, bounded shutdown drain, exact runtime/lock, transactional Rclone, Reveal ownership, defaults/marketplace/route-state/SVG/accessibility fixes. |
| L1–L4 | Closed | Canonical mapped/NAT64 handling, shared theme catalog, Node source-of-truth, zero-warning lint baseline. |
| Socket.IO production 404 | Rejected + qualified | Vendored `4.8.3` asset tồn tại trong final Electron artifact và trả HTTP 200. |

Các section finding bên dưới giữ lại evidence gốc để audit; trạng thái hiện tại của chúng là **closed** trừ finding bị bác.

## Historical High blockers — closed

### H1 — Analytics trả raw token/referrer cho holder của share token khác

Loại: **verified capability disclosure**.

- Evidence: `server/routes/analytics.js:7-18,25-38,53-64` lưu raw token/referrer, chỉ kiểm token thuộc cùng presentation, không enforce expiry/password, rồi trả mọi token/event. `server/routes/api-surface.test.js:241-257` codify cross-token visibility.
- Impact: link expired/protected có thể đọc token active khác cùng deck và referrer nhạy cảm; phá capability separation nếu analytics endpoint nằm trên viewer-accessible boundary.
- Remediation tối thiểu: raw analytics phải dùng editor/admin authorization. Nếu viewer analytics là requirement, chỉ trả aggregate đã redact, enforce trạng thái share link, dùng header capability và `Cache-Control: no-store`.
- Verify: tạo A expired/protected và B active; request bằng A phải bị deny, không chứa B/referrer; owner path vẫn trả đúng contract.

### H2 — TipTap dependency graph trộn major v2/v3 và npm đánh dấu `invalid`

Loại: **verified dependency defect**.

- Evidence: hầu hết TipTap stack là v2 nhưng `@tiptap/extension-highlight` là v3 tại `client/package.json:13-27`; installed/locked tree đặt core/pm v3 cạnh v2 peer ranges. Fresh `npm ls @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-text-style @tiptap/pm --all` exit 1 với `ELSPROBLEMS` và `invalid`.
- Impact: editor behavior phụ thuộc unsupported hoisting; clean/strict reconciliation có thể drift hoặc fail.
- Remediation tối thiểu: align toàn bộ `@tiptap/*` về một supported major, ưu tiên migration nhỏ nhất tương thích code hiện tại.
- Verify: clean install; `npm ls` exit 0; mount editor thật và exercise highlight/color/table commands + document round-trip.

### H3 — Game presenter shortcuts gọi callback không được return

Loại: **verified runtime defect**.

- Evidence: `use-editor-live-session-controller.js:107-119` tạo `emitGameShortcutAction` nhưng return object tại `:121-130` bỏ callback; `EditorPage.jsx:488-537` destructure/truyền `undefined`; `use-editor-keyboard-controller.js:83,106,133` gọi trực tiếp.
- Reproduction: fresh focused run fail 2 assertions và phát sinh 2 uncaught `TypeError: c.emitGameShortcutAction is not a function`.
- Impact: Enter/Space/P/team shortcuts không phát event và throw trong key handler khi game active.
- Remediation tối thiểu: return callback từ producer; giữ direct producer/consumer contract và bridge contract test.
- Verify: `editor-page-present-wiring.test.jsx` không throw, local typed event đúng scope; focused presenter-popup bridge test nhận đúng `post` payload.

## Historical Medium findings — closed

### M1 — Electron origin check dùng prefix trong unsandboxed renderer

Loại: **verified confinement bypass + bounded privilege risk**.

- Evidence: sandbox bị disable tại `electron/main.js:1-8`; navigation/window checks dùng `url.startsWith(APP_ORIGIN)` tại `:126-149`; `http://127.0.0.1:3002@example.com/` pass prefix nhưng origin thật là `http://example.com`. Preload expose credential IPC (`electron/preload.js:7-34`); handlers tại `electron/main.js:34-74` không validate sender/frame/key.
- Severity calibration: official Electron checklist coi sandbox/navigation/IPC sender validation là required security controls, nhưng repo search không có `window.electronAPI` consumer; chưa chứng minh GitHub token hoặc secret hiện được lưu qua bridge.
- Impact: external page có thể chạy trong renderer giữ preload/IPC surface thay vì system browser; practical secret impact hiện chưa chứng minh.
- Remediation tối thiểu: exact parsed origin; bật sandbox; mặc định xóa dead preload/IPC bridge. Chỉ giữ nếu có real contract, khi đó validate sender/main frame/origin và allowlist keys.
- Verify: userinfo/encoded/default-port/prefix/blob/child-window/subframe matrix; packaged renderer sandboxed; preload absent hoặc non-app IPC reject.

### M2 — Shutdown release writer lock trước khi HTTP requests drain

Loại: **static race + verification gap**. `server/index.js:409-412` gọi `server.close()` nhưng không await close callback rồi shutdown store; signal handler exit khi promise này hoàn tất. `server/index-shutdown-writer-lock.test.js:34-40` force-closes connections trước `stopServer`, loại bỏ race. Stop admission, close/expire Socket.IO work, await promisified HTTP close; deadline path force-close remaining transports, log active count/reason, rồi mới release store.

### M3 — Electron dev/test dùng 42 nhưng release pin 33

Loại: **verified configuration mismatch**. `package.json:77-87` dùng Electron `^42.3.0`; `electron-builder.yml:6` pin `33.4.11`. Một concrete pinned version phải drive developer binary, lock và builder; packaged smoke compare `process.versions.electron` với declared value.

### M4 — Custom AI endpoint thiếu declared `undici` trong production closure

Loại: **static production-closure defect**. Guard `require('undici')` tại `server/services/ai-endpoint-guard.js:62-78,121-124`, nhưng `server/package.json:10-27` không khai báo. Root hiện chỉ có transitive `undici` qua Electron tooling; Docker/Electron server-only closure không được dựa vào đó. Pin version tương thích Node floor; `undici` latest hiện yêu cầu Node mới hơn Node 20 support claim.

### M5 — Rclone config ghi file mới trước connection test, không rollback

Loại: **static transactional defect**. `server/routes/sync.js:348-353` persist config trước `rclone lsd`; probe fail để lại config hỏng. Ghi same-directory temp config, probe qua overridden `RCLONE_CONFIG`, atomic replace sau success; serialize concurrent config changes và cleanup temp.

### M6 — `npm start` hỏng trên Windows được support

Loại: **verified command defect**. Root script tại `package.json:18-24` dùng POSIX env assignment. Fresh `cmd.exe /c npm start` exit 1 với `'NODE_ENV' is not recognized`. Dùng cross-platform launcher và Windows health + clean-stop smoke.

### M7 — Electron production dependency install không reproducible

Loại: **static supply-chain/release risk**. `scripts/prepare-electron.js:52-91` tạo semver-only temp package, chạy `npm install`, move `node_modules`, xóa temp lock. Chọn authoritative isolated-server lock, dùng `npm ci`, và compare canonical package name/version/integrity tree từ hai clean runs cùng OS.

### M8 — Reveal iframe timeout cũ có thể clear polling của frame mới

Loại: **static lifecycle race**. `client/src/hooks/use-reveal-preview-frame.js:27-69` giữ interval trong shared ref nhưng timeout không được retain/cancel; timeout/onload A có thể tác động interval B. Effect generation phải own interval, timeout và onload; test A→B + unmount timer cleanup.

### M9 — Default Preferences được persist nhưng không dùng khi tạo deck

Loại: **verified data-flow defect**. Settings load/save `defaultTheme/defaultTransition` (`SettingsPage.jsx:57-67,87-105,197-213`), Home hardcode/reset `black/slide` (`HomePage.jsx:278-283,345-356`). Load defaults nhưng không overwrite form nếu user đã sửa trong lúc request pending; failure giữ documented fallback.

### M10 — Primary interactions dùng click-only `div`

Loại: **verified accessibility defect**. Media item (`MediaLibraryModal.jsx:289-340`) chứa cả outer click target và nested Delete button; template selector (`TemplatePreview.jsx:152-175`), Jeopardy cell/team (`game-element-renderer.jsx:821-855,1152-1175`) thiếu keyboard semantics. Media cần noninteractive card + dedicated insert button + sibling Delete button; các surface khác dùng native controls với accessible name/state.

### M11 — Marketplace fetch error hiển thị loading vô hạn

Loại: **verified state-model defect**. `HomePage.jsx:807-823` chỉ có data/filter state và log rejection; `:1460-1467` dùng empty array đồng nghĩa loading. Tách loading/error/data, có Retry và distinct successful-empty state.

### M12 — Live presenter route-state focused test stale

Loại: **verification gap, không phải runtime defect**. `editor-live-presenter-route-state.test.jsx:24-29` fixture chỉ trả room/presenter token, trong khi controller yêu cầu `remoteToken` + `speakerToken` tại `use-editor-live-session-controller.js:73-83`. Fresh focused run fail vì modal không mở. Cập nhật fixture; không đổi production behavior; có thể thêm malformed-response test.

### M13 — SVG upload error contract drift làm focused API suite đỏ

Loại: **verified runtime UX defect + stale contract test**. Sanitizer tạo message rõ ràng và code (`server/services/svg-upload-sanitizer.js:19-22`), nhưng route trả code làm trường `error` (`server/routes/upload.js:79-87`). `client/src/utils/api.js:13-27` biến trường này thành `Error.message`, nên Media Library có thể hiển thị opaque `invalid-svg`. Fresh isolated `server/routes/api-surface.test.js` fail vì expected `File content is not valid SVG`, received `invalid-svg`. Trả `{ error: error.message, code: error.code }` và test cả message lẫn code.

## Historical Low findings — closed

### L1 — AI SSRF guard bỏ lọt IPv4-mapped IPv6 dạng hex

Loại: **verified helper bypass, defense-in-depth theo trust model hiện tại**. `server/services/ai-endpoint-guard.js:20-30,109-126` chỉ nhận mapped dotted IPv4; fresh reproduction cho `::ffff:7f00:1` và `::ffff:0a00:1` trả `false`. Canonicalize IP bytes và dùng globally-reachable/special-use table; không blanket-block public IPv6/NAT64. Nâng severity nếu untrusted tenant được cấu hình custom endpoint.

### L2 — Reveal theme catalogs drift

Home/Settings có `sky` nhưng thiếu `blood`; Design tab ngược lại. Shared mapping hỗ trợ cả hai. Export một ordered supported list từ shared owner; mọi selector consume cùng list và mỗi item có token mapping.

### L3 — Documented Node floor không khớp toolchain đã chọn

Vite 8.0.14 yêu cầu `^20.19.0 || >=22.12.0`; Electron 42 baseline đã được chọn yêu cầu Node `>=22.12.0`. README/docs/website/CI/Docker hiện còn nói hoặc pin floating Node 20. Đồng bộ root engines, CI, Docker và toàn bộ English/Vietnamese sources về Node `>=22.12.0`; đây là build/release-toolchain floor, không tự chứng minh server runtime fail trên early Node 20.

### L4 — Lint baseline còn 29 warnings

Fresh `npm run lint` exit 0 với 29 warnings. Không phải blocker độc lập; inventory theo rule/path và đặt measurable zero hoặc explicit narrow baseline. “Giảm warning” không phải acceptance criterion closeable.

## Finding bị bác hoặc giữ dưới dạng hypothesis

- **Rejected Socket.IO production 404:** `scripts/copy-vendor.js` publishes `socket.io-client/dist` into `server/vendor/socket.io` through staged manifest + atomic replacement; Docker/Electron package the vendored tree and server serves the fallback. Final Electron artifact contains `socket.io.min.js`; packaged HTTP smoke returned 200 with Socket.IO `4.8.3`.
- Dashboard thumbnail lazy Reveal iframe/card là capacity hypothesis; chưa có profile 50/200 decks, performance budget hay user-visible failure.
- Native OfficeCLI launcher không bundle trong Electron artifact phù hợp external qualified-binary contract hiện tại.
- Electron credential bridge/IPC had no repository consumer and was removed; renderer sandbox, absent preload surface and exact-origin navigation are covered by source/runtime checks.

## Reference checks

- Electron security checklist: https://github.com/electron/electron/blob/v42.9.3/docs/tutorial/security.md
- TipTap v3 highlight metadata: https://registry.npmjs.org/@tiptap/extension-highlight/3.20.4
- Vite 8.0.14 Node engine: https://registry.npmjs.org/vite/8.0.14
- Electron 42.9.3 package metadata: https://registry.npmjs.org/electron/42.9.3
- npm clean-install contract: https://docs.npmjs.com/cli/v11/commands/npm-ci

## Final verification matrix

| Gate | Kết quả | Ý nghĩa |
|---|---:|---|
| `npm test` | 564 files PASS, 1 skipped; 4539 tests PASS, 3 skipped | Final all-green unit/integration run sau capture-viewport regression. |
| Focused final regression set | 9 files, 71 tests PASS | NAT64, presenter runtime, shortcut registry/controller, generated HTML, inventory contracts. |
| `npm run lint` | PASS, 0 warnings | Measured lint baseline đạt zero. |
| `npm run build` | PASS | Final production client bundle built. |
| `npm run matrix:gate` | 112/112 verified; GAP/FAIL/TAGGED = 0 | Element-control matrix 141 rows PASS. |
| Independent code review | PASS | Không còn material static finding; README/team shortcut contract đã đồng bộ. |
| Windows Electron build | PASS | Electron `42.9.3`; NSIS + portable + unpacked artifacts rebuilt từ final source. |
| Final packaged Electron smoke | PASS | Server ready, presentations API 200, Socket.IO `4.8.3` asset 200; packaged NAT64/live-timer code present; runtime receipt refreshed. |
| Packaged Electron UI/PPTX smoke | PASS | Browser-driven dashboard mở, upload fixture `background-image-notes-footer.pptx`, import hoàn tất với warning contract và editor route mở thành công. |
| Docker artifact smoke | BLOCKED | Không có Docker executable trên workstation; không suy diễn PASS. |
| PPTX best-effort lanes | PASS | Corpus 11/11, adversarial 10/10, browser 6/6, package/phase13/perf pass. |
| PPTX importer-native strict | FAIL-CLOSED | 9/11 deck pass; `Bai_2_1.pptx` còn 8 unmapped/permanent placeholders và `Bai_2_5.pptx` còn 5. |
| PowerPoint visual oracle | FAIL POLICY | Microsoft PowerPoint evidence integrity pass; qualification fail tại mean SSIM `0.23698886751039192`, minimum `0`, policy `0.99`/`0.97`. |
| Release evidence | PASS | `full-codebase-remediation-release-evidence-260820.json` + checksum index refreshed; decision vẫn conditionally blocked. |

Release decision và hashes authoritative nằm tại `plans/reports/full-codebase-remediation-release-evidence-260820.json`.

## Executed remediation order

1. Dependency/runtime closure: TipTap, Undici, exact Electron/Node, deterministic Electron lock/tree, Windows start, staged vendor publication và receipts.
2. Capability/confinement: operator-only analytics, exact Electron origin, sandbox/no dead IPC, canonical mapped/special/NAT64 IP handling.
3. Product reliability: presenter popup bridge, timer routing, Reveal lifecycle, settings defaults, marketplace và route-state coverage.
4. Lifecycle/data integrity: bounded HTTP/Socket.IO drain, transactional Rclone, stable SVG contract, cancelled-import cleanup.
5. Accessibility/docs/lint cleanup và generated coverage inventory regeneration.
6. Full tests/build/lint/matrix, Electron rebuild/smoke, PPTX qualification và checksummed evidence.

Chi tiết execution: `plans/260820-0235-full-codebase-review/plan.md`.

## Locked product decisions

- Runtime baseline: Electron `42.9.3`, electron-builder `26.15.3`, Node exact `22.22.0`, public engine floor `>=22.13.0`.
- Analytics: raw editor/operator-only; share viewer không có analytics endpoint trong remediation scope.
- Shortcuts: chỉ expose action có runtime consumer; direct team selection không còn là supported presenter shortcut.
