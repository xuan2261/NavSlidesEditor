---
phase: 10
title: "Portable archive: revision, blob, media và authority"
status: in-progress
priority: P1
effort: ""
dependencies: [9]
---

# Phase 10: Portable archive: revision, blob, media và authority

## Goal
Round-trip project package-backed sang root mới giữ đủ package authority và media; replace destination phải có explicit expected-head fence.

## Context và bằng chứng
package-store/portable.js:24–53,116–171,247–486 có closure/hash/owner/rebind và atomic metadata commit; hiện bundle package không gồm compatibility JSON/media. project-import-media-session.js là transaction riêng chưa tự import PPTX package authority.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [09](phase-09-pptx-recovery.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/portable.js` | destination precondition và package envelope |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/portable.test.js` | exact closure and destination races |
| Modify | `C:/Work/NavSlidesEditor/server/routes/project-import.js` | package-backed portable orchestrator |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-media-session.js` | package import checkpoint integration |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-media-session-recovery.js` | cross-owner recovery |
| Modify | `C:/Work/NavSlidesEditor/server/routes/project-import.test.js` | whole archive roundtrip |
| Modify | `C:/Work/NavSlidesEditor/server/routes/sync.test.js` | expected source/destination identities |
| Create | `C:/Work/NavSlidesEditor/server/routes/portable-package-project.test.js` | full package/media archive behavior |
| Create | `C:/Work/NavSlidesEditor/server/routes/project-export.js` | GET /api/presentations/:id/project-archive, server-owned full ZIP export |
| Modify | `C:/Work/NavSlidesEditor/server/index.js` | mount new archive endpoint trong private editor boundary |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-archive.js` | explicit v2 package-backed ZIP validation |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-archive-validation.js` | bounded package entries allowlist |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-archive-limits.js` | compressed/expanded/entry-count limits cho full archive |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-presentation.js` | validated placement map chung, không bypass authority sanitization |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-archive.test.js` | v2 schema, closure, active-content và path negatives |
| Modify | `C:/Work/NavSlidesEditor/client/src/hooks/use-export-actions.js` | save/export barrier và authoritative Open Project |
| Modify | `C:/Work/NavSlidesEditor/client/src/hooks/use-export-actions.test.js` | dirty/save failure/entrypoint roundtrip |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/export-project.js` | package-backed server export, không stripped-authority backup |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/export-project.test.js` | full archive/no-media/missing-media cases |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/import-project.js` | authoritative import session cho new format |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/import-project.test.js` | new/legacy consumer contracts |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/api.js` | full archive endpoint API |
| Modify | `C:/Work/NavSlidesEditor/client/src/utils/api.test.js` | response/error/body contract |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/client/src/pages/home/use-presentation-imports.js` | Home và Editor cùng atomic import contract |
| Modify | `C:/Work/NavSlidesEditor/client/src/pages/HomePage.project-import-lifecycle.test.jsx` | Home v2/legacy admission |
| Modify | `C:/Work/NavSlidesEditor/server/services/package-backed-presentation-read.test.js` | canonical destination media URLs sau restore |
| Create | `C:/Work/NavSlidesEditor/tests/e2e/portable-project-roundtrip.spec.js` | UI Export→Home/Editor Open ở fresh root |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Chốt full package-backed archive là ZIP manifest **version 2.0**, có presentation.json, manifest.json/media descriptors, package/manifest.json và package/blobs/<sha256>. Kể cả không có local media vẫn xuất ZIP chứa package; projection-only JSON v1.1 giữ contract riêng. Reuse package bundle serializer/validator, không copy authority bằng client DTO. New format version không thay version nội bộ package manifest.
2. New server endpoint GET `/api/presentations/:id/project-archive` ở project-export.js lấy expected head từ request precondition, authoritative projection/package snapshot và verified owned media. Caller use-export-actions dùng beginExport/flushPendingSave/endExport barrier hiện có: dirty snapshot phải commit trước, conflict/save failure abort; edit mới sau snapshot không bị gọi là đã export. Nếu source head đổi, trả SYNC_SOURCE_CHANGED không download. Bound response size/ZIP expansion; missing required media abort, không skippedMedia-success. Không fetch remote URL tùy ý ở server để tạo SSRF; archive chỉ đóng gói media thuộc local upload ownership, external links được inventory explicit.
3. Preflight thêm v2 vào project-import-archive.js/validation/limits, giữ path normalization, entry/byte ceilings và active-content acknowledgement. Validate exact package revision/blob closure, length/hash/source-map/journal invariants. Reject extra/missing/duplicate entries trước publication. Sanitizer legacy vẫn bỏ client authority; package authority chỉ từ validated package envelope, không bỏ guard chung để cho DTO tự khai quyền.
4. Migrate Editor Open Project ở use-export-actions.js từ parse→rehydrate→createPresentation sang importProjectAtomically như Home, cùng capability/session rollback và active-content acknowledgement. Home và Editor nhận v2 qua cùng server preflight. Xóa obsolete bypass cho full archive; legacy projection JSON vẫn import với limits/ack hiện có. Agent `format=json` vẫn reference-only, không ngầm thêm full-archive MCP format. Sync giữ folder backup contract package/ + _uploads riêng; expected-head checks vẫn dùng package serializer nhưng không claim folder là ZIP v2.
5. Default create-new destination; replace chỉ explicit operation + expectedHead rechecked trong store.mutate. Destination-local publication identity/generation và predecessor fence theo phase 08, không copy source generation để chặn captured stale writes. Rebase source-map/results/pending authority nếu generation thay; không đổi original binary identity.
6. Stage media và package trong durable import session; journal intent gắn expected package outcome và media owner. Placement filename ở root mới có thể đổi: xây **một destination URL map** dùng cho compatibility projection và mọi canonical committed/pending authority projection. Truyền map vào portable rebind transaction, tính lại projection/source-map/request snapshot hashes theo validator; giữ pending journal hợp lệ. Không sửa Original/package OOXML bytes/hash chỉ vì đổi local upload URL. Reader không được canonical-merge URL nguồn đè URL destination.
7. Publish theo phase 07, recovery theo phase 09; success chỉ khi raw projection identity, authoritative head và media ownership đầy đủ. Roundtrip A→B→C, root A offline/không truy cập được; GET deck từ canonical reader trả destination URLs, fetch ảnh/video/poster/track thật, so Original hash và edited availability. Không mock package/media layers để claim full archive.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P10-01 | C | Package+projection+media export/import root mới | Original hash giữ, deck mở/media đủ, authority rebound đúng |
| P10-02 | C | Destination changes sau preflight | Conflict không xóa head/owner/projection mới |
| P10-03 | C | Source head đổi khi export | SYNC_SOURCE_CHANGED; không archive mixed |
| P10-04 | C | Missing/extra/duplicate revision/blob/payload | Reject trước publication |
| P10-05 | H | Digest/length mismatch hoặc corrupt existing blob | Reject; no new head |
| P10-06 | H | Foreign owner/source-map/journal authority | Reject spoofed authority |
| P10-07 | H | Duplicate/traversal/absolute media path | Reject, không file ngoài sandbox |
| P10-08 | H | Kill giữa package commit và media/projection | Restart recover hoặc reconcile-required; không success thiếu media |
| P10-09 | H | Import same archive twice create-new | Hai destination độc lập, không cross-owner deletion |
| P10-10 | H | Explicit replace đúng expectedHead | Đúng generation và ownership; giữ original cần retention |
| P10-11 | M | Plain legacy JSON không package | Vẫn import; không claim lossless/original |
| P10-12 | H | A→B→C roundtrip và Original download | Hash invariants; không mutable source reuse |
| P10-13 | C | Export package-backed deck không local media, Open qua Home và Editor | ZIP v2 vẫn có package; cả hai entrypoints giữ Original/authority |
| P10-14 | C | Media filenames đổi ở B/C, root A không truy cập | Canonical GET dùng destination URLs, media fetch thành công; pending/committed hashes hợp lệ |
| P10-15 | H | Save barrier conflict hoặc missing owned media khi export | Abort với lỗi user-visible, không download stale/degraded full archive |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run server/services/pptx-import/package-store/portable.test.js server/routes/project-import.test.js server/routes/portable-package-project.test.js server/routes/sync.test.js
npx vitest run client/src/utils/export-project.test.js client/src/utils/import-project.test.js client/src/hooks/use-export-actions.test.js client/src/utils/api.test.js client/src/pages/HomePage.project-import-lifecycle.test.jsx server/services/project-import-archive.test.js server/services/package-backed-presentation-read.test.js
npx playwright test tests/e2e/portable-project-roundtrip.spec.js --project=chromium
```

## Runtime smoke bắt buộc
Export từ chính UI package-backed deck có ảnh/video và một deck không local media; Open từ cả Home và Editor ở server temp mới không blobs/media. Ngắt process giữa publish rồi restart. Tắt truy cập root A, GET canonical deck/fetch destination media và download Original/Validated Edited theo availability; so hashes và render thực.

## Deliverables / checklist
- [ ] 10.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 10.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 10.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 10.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 10.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: archive/session/client implementation, retained-authority GREEN và source-bound process termination passed P10-08 tại năm boundaries. Browser final04 (`reports/editor-portable-ui-final04.json`) passed bảy native journeys, superseding retained final02 offline-poster failure; Home/Editor, no-local-media và explicit refusal variants được chạy. Đây là scoped working-tree evidence, không clean-SHA qualification. Exact archive/store/HTTP regressions pass 86 tests/eight files; final current-input process/browser binding vẫn mở. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation).

## Exit gate
Full archive portability có evidence độc lập package bundle unit tests; fenced replace, create-new default, không missing media success. Legacy JSON không tăng fidelity claim.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Archive integration là thay đổi nhiều owner; phase-entry scout bắt buộc enumerate exporter/client/agent/sync consumers và version migration trước code. Không mock media/package layer để tuyên bố end-to-end.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
