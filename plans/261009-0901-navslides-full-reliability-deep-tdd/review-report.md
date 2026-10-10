# Review và validation — deep TDD

## Kết luận

Kế hoạch đã qua bốn góc review độc lập: assumptions, failure modes, scope/contracts và security. Có **23 finding raw** (16 high, 7 medium), gồm các finding trùng nhau giữa reviewers; tất cả được tiếp nhận hoặc gộp vào cùng correction, không bác bỏ finding nào. Đây là review tĩnh của kế hoạch và source, không phải chứng minh bug đã reproduce hoặc implementation đã sửa.

## Dispositions

| Nguồn review | Finding | Correction trong plan |
|---|---|---|
| Assumptions 1; Security R7 | Atomic helper có failure sau rename | Phase 02: rename commit point, bỏ post-commit chmod dư thừa; verification strategy phân biệt trước/sau commit |
| Assumptions 2; Security R5 | Masked API key không chứng minh remote unchanged | Phase 03: sau 412, replace/clear bắt buộc explicit local/server choice, không suy từ sentinel |
| Assumptions 3 | Benchmark baseline và after khác concurrency | Phases 13/14: riêng workers=1/retries=0, tách functional/a11y |
| Failure 1; Contracts R1 | Full archive chưa có producer/consumer cutover | Phase 10: ZIP v2.0, server project-archive endpoint, dirty-save barrier, Home/Editor atomic importer, validators/limits và UI roundtrip |
| Failure 2 | Canonical authority đè media URL destination | Phase 10: chung placement map cho compatibility và pending/committed authority; rehash đúng contract, Original immutable |
| Failure 3 | PPTX shared media rollback xóa winner | Phases 08/09: durable owner của media thật, giữ winner/reconcile khi uncertainty; native isolated scope không đổi |
| Failure 4 | Fencing sai owner, canonical merge che wrong raw head | Phases 07/08: production runtime owner, exact raw publication identity, destination-local replacement fence, giữ lock order |
| Failure 5 | Corrupt session ledger bị reset thành rỗng | Phase 09: chỉ ENOENT tạo ledger mới; JSON/schema/I/O failure fail closed, không overwrite |
| Failure 6 | Recovery helper không được startup gọi | Phase 09: startup recovery trước readiness/admission, test startServer thật và degraded state |
| Contracts R2; Security R2/R3 | Physical schema và artifact transport mismatch | Phase 12: authoritative raw validator → release envelope, separate Linux/OfficeCLI/PowerPoint run IDs, exact artifact routing/provenance |
| Contracts R3; Security R4 | Receipt hash lời khai passed thay leaf evidence | Phase 16: required evidenceRoot, manifest đủ shards/lanes/run/attempt/source/client, CLI producer→root negatives |
| Contracts R3; Security R1 | Attestation identity do argv tự gắn | Phase 12 owner; phase 16 integration: genuine gh schema, per-EXE digest/source/workflow/issuer, reject rỗng/missing/stale |
| Contracts R4; Security R10 | Release lookup hardcoded master | Phase 16: approved branch policy áp dụng cả PR base và release CI lookup; main-only positive, wrong SHA/event negatives |
| Security R6 | Post-download copy signer evidence và che exit code | Phase 12: independent EXE timestamp/trust verification, immediate node/gh/verifier exit checks trong từng iteration |
| Security R8 | Bare oracle scripts thiếu evidence arguments | Phase 12: explicit manifest/role receipts/corpus/goldens/actuals/report arguments; host tạo evidence là prerequisite |
| Security R9 | Windows command rebuild client đã qualify | Phase 12: verify downloaded manifest → prepare → runtime verify → electron:builder, không electron:build:win |

Các vị trí source được reviewers trace: storage.js:93–103; settings.js masking; use-export-actions.js:216–249; project-import-archive.js/validation; portable.js rebind; media-dedup.js; package-store-runtime.js production drain; compatibility-view.js; project-import-media-session-store.js; server/index.js startup; release-receipt-workflow.mjs Linux/physical/Authenticode/attestation producers; release.yml CI lookup; reusable-green-sha-verification.yml; reusable-windows-qualification.yml. Line numbers là dấu vết review, phải rescout khi implementation.

## Validation decisions

- Phạm vi giữ nguyên toàn bộ chặng 0–5, 16 phase; không thu hẹp còn Settings.
- Revision precondition là breaking contract: server/UI/callers cập nhật cùng lane; không compatibility shim che stale writes.
- Giữ architecture package-store/WAL/outbox; production owner và lock-order mới là nơi đặt race tests, không chỉ generic helper.
- Full archive v2 là thay đổi được lên kế hoạch, chưa phải format hiện hỗ trợ. Legacy reference-only JSON giữ giới hạn rõ ràng.
- No-change navigator chỉ hợp lệ khi measured baseline đạt acceptance, không bỏ phase để giảm scope.
- Không cần hỏi người dùng dữ kiện có thể đọc từ repo; quyền publish/signing/remote settings vẫn là authorization riêng lúc thực thi.
- Các file chung tích hợp tuần tự bởi integration owner; phases 07–10 nối tiếp, phase 16 tích hợp owner phase 12 thay tạo owner thứ hai.

## Kiểm tra artifact

Script kiểm tra trực tiếp Markdown: 16 phases; 203 scenario IDs duy nhất; 80 checkbox phase còn unchecked; dependencies đi về phase trước; npm script names tồn tại; Modify/Verify paths phải tồn tại hoặc được dependency trước khai báo Create; relative links phải resolve. Kết quả máy cuối cùng lưu tại [reports/plan-validation.json](reports/plan-validation.json).

Phase 14 sửa navigator-performance.spec.js do phase 13 khai báo Create: dependency hợp lệ, không phải file thiếu ngoài scope. Các test/route ghi Create chưa được tạo trong phiên plan. Không gọi command nhắm file tương lai để tạo false RED.

## Giới hạn

Không chạy lint/build/product unit/E2E/load/container/Office/signing qualification trong phiên lập kế hoạch. Không đổi application code hoặc GitHub settings; không commit, tag hay publish. Static review không chứng nhận runtime hoặc release readiness. Office host, pinned verifier, signer, artifact transport permissions và approved branch phải preflight ở phase 01/12/16; thiếu thì blocked, không synthetic evidence.

Trạng thái soạn kế hoạch: hoàn tất sau artifact sweep/task hydration. Trạng thái triển khai: toàn bộ phases vẫn pending. Handoff ở [plan.md](plan.md).
