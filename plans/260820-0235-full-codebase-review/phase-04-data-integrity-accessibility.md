# Phase 04 — Data integrity and accessibility

Status: **Complete** — lifecycle/data-integrity, stable error, semantic interaction, shared catalog/docs và zero-warning lint contracts verified.

## Goal

Ngăn shutdown/config/import cleanup data loss, sửa SVG error contract, và bảo đảm primary interactions dùng được bằng keyboard.

## Findings covered

- Medium M2: shutdown release writer lock trước HTTP drain.
- Medium M5: failed Rclone probe ghi đè config đang hoạt động.
- Medium M10: click-only media/template/game controls.
- Medium M13: SVG upload trả opaque error code và focused API contract test fail.
- Low L2: Reveal theme catalog drift.
- Low L3: Node floor docs mismatch.
- Low L4: lint warnings.
- Red-team hardening: shutdown single-flight/idempotency, Rclone pre-existing directory preservation và cancelled-import late settlement tracking.

## Likely files

- `server/index.js`, shutdown integration tests
- `server/routes/sync.js`, `server/routes/sync.test.js`
- `server/routes/pptx-import.js`, importer cancellation/cleanup tests
- `server/routes/upload.js`, `server/services/svg-upload-sanitizer.js`, API surface tests
- `client/src/components/MediaLibraryModal.jsx`
- `client/src/components/dashboard/TemplatePreview.jsx`
- `client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- Shared theme catalog/selectors
- Root engines, CI, README, docs và English/Vietnamese website sources
- Files owning current lint warnings

## Steps

1. Tạo một idempotent `shutdownOnce` promise được signal handlers, Electron quit và explicit `stopServer` cùng gọi; không shutdown store riêng từ `server.close` event.
2. Shutdown order cố định: stop admission → close/expire Socket.IO work → await promisified HTTP close; deadline path force-close remaining transports, log active count/reason, rồi mới shutdown package store. Concurrent calls nhận cùng promise/result.
3. Ghi Rclone candidate vào same-directory temp config, probe bằng overridden `RCLONE_CONFIG`, atomic replace only after success; serialize concurrent config changes. Chỉ cleanup temp do operation sở hữu; failed probe giữ byte/mode và pre-existing directory entries nguyên trạng.
4. Với cancelled/timed-out PPTX import, track cả late resolve và late reject. Late resolve cleanup output handle; late reject đi qua diagnostic/cleanup owner; shutdown/test harness có thể await detached cleanup registry, không để unhandled rejection hoặc orphan temp/output.
5. Trả invalid SVG `{ error: client-safe message, code: stable code }`; không đưa opaque code vào `Error.message`.
6. Replace click-only surfaces bằng semantic controls. Media card dùng noninteractive wrapper + dedicated insert button + sibling Delete button, không nested buttons.
7. Centralize ordered supported Reveal themes trong shared owner; mọi selector consume cùng list và mỗi theme có token mapping.
8. Align/enforce public Node floor `>=22.13.0` và exact build runtime `22.22.0` trên package engines, Docker, CI, README, docs và English/Vietnamese website sources.
9. Triage lint warnings theo rule/path; đặt measurable zero hoặc explicit narrow baseline, không chỉ “giảm”.

## Validation

- Hai concurrent `stopServer`/signal-style calls share một promise; delayed mutation giữ connection active và store chưa release trước drain. Deadline path force-close có deterministic evidence, active-count log và không pre-close trong test helper.
- Seed working `rclone.conf` + sibling files, probe new config fail: file byte/mode và directory listing giữ nguyên; success atomically replaces; no-prior-config failure không để temp/config residue.
- Cancel importer rồi cho underlying promise resolve/reject muộn: cleanup registry settles, owned output/temp bị xóa, job terminal state không bị overwrite và không có unhandled rejection.
- Invalid SVG response có human message + `invalid-svg` code; API surface test pass và client không hiển thị opaque code.
- `userEvent.tab()` + Enter/Space cho media insert/delete, template selection, Jeopardy cell/team; accessible names/states pass.
- Theme contract xác nhận mọi selector cùng supported set/order và token mapping.
- CI/Docker/root engines dùng public floor/exact runtime đã khóa; toàn bộ English/Vietnamese docs sources đồng bộ; docs build pass.
- Lint có 0 errors và đạt warning baseline đã định lượng.

## Risks / rollback

- Shutdown timeout quá dài làm quit treo, quá ngắn gây data loss; chọn bounded value từ request SLA, log active transports và giữ single-flight result observable.
- Atomic config replace phải cùng filesystem; concurrent writers cần serialization. Không xóa directory/file không do operation tạo; temp credentials luôn cleanup.
- Detached importer có thể không cung cấp output handle khi reject; importer contract phải tự cleanup partial output và expose tracked settlement, không giả vờ cleanup artifact không định danh được.
- Semantic controls có browser default styles; normalize locally, không quay lại non-semantic div hoặc nested interactive markup.

