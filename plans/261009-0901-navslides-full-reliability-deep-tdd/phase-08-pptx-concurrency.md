---
phase: 8
title: "PPTX concurrency, retry và compensation"
status: in-progress
priority: P1
effort: ""
dependencies: [7]
---

# Phase 08: PPTX concurrency, retry và compensation

## Goal
Stale request/loser không thể ghi đè hoặc xóa winner; retries có identity và không tạo second mutation.

## Context và bằng chứng
PackageStore.mutate index.js:86–124 serialize; WriterLock :32–70 fences writer. rollbackImport import-commit.js:245–295 so exact job/head identity. Race import-import cùng destination chưa được scout tìm thấy test chuyên biệt.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [07](phase-07-pptx-publication.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/import-commit.js` | rollback identity |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/lifecycle.js` | head compare-and-commit |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/compatibility-outbox.js` | snapshot/apply fencing |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/package-store.test.js` | same-destination barriers |
| Modify | `C:/Work/NavSlidesEditor/server/routes/history-package-lock-order.test.js` | snapshot/restore ordering |
| Modify | `C:/Work/NavSlidesEditor/server/routes/history-snapshot-delete-compensation.test.js` | failure compensation |
| Create | `C:/Work/NavSlidesEditor/server/routes/pptx-lifecycle-concurrency.test.js` | cross-owner race harness |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store-runtime.js` | exact captured replay fences theo phase 07 |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/media-dedup.js` | shared pending uploads không được dedupe vô chủ |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/media.js` | durable job media transaction integration |
| Modify | `C:/Work/NavSlidesEditor/server/services/media-placement-ownership.js` | reuse pending/committed ownership cho PPTX uploads |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/media.test.js` | A create, B reuse, A rollback winner preservation |
| Modify | `C:/Work/NavSlidesEditor/server/routes/pptx-import.js` | media rollback chỉ khi exact ownership/visibility cho phép |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Lập lock order hiện có giữa history/presentation/package writer/outbox; không thêm lock ngược. Barriers đặt vào public operations/fault hooks để tái hiện interleavings, không rely sleep.
2. Chuẩn hóa identity đã có cho intent và compensation: operation/job, presentation, expected revision/generation/head hash, owner. Không thêm thứ hai nếu durable outcome đã đủ.
3. Test A/B prepare cùng destination; chỉ winner publish, loser rollback chỉ được chạm own intent. UUID route bình thường khác nhau nên dùng package entrypoint hoặc injected destination fixture, không claim public route tự collides.
4. Idempotency cùng key/cùng payload trả cùng committed result; cùng key/khác payload conflict; late retries không replay vào head mới. Giữ current route export idempotency semantics.
5. Test outbox upsert/ack và lifecycle mutate xen kẽ. Stale compensation delete phải check outcome/session identity trên compatibility row, không delete chỉ bằng presentation ID.
6. Fault failures sau snapshot owner release/reinsert phải có recoverable record hoặc retained file. Migrate exact callers khi đổi signature; một PPTX owner tích hợp phases 07–10 tuần tự.
7. Tách package blobs (collector audit-only) khỏi uploaded media: `media-dedup.js:19–46,62–109` đang ghi RAM records và shared hashes trước commit, rollback unlink created files. Gắn durable job identity cho PPTX media trước publication bằng placement ownership hiện có; không share pending file nếu chưa retain reference bền vững. Chỉ reuse committed bytes hoặc retain owner trước reuse. Nếu package rollback uncertain/failed hoặc deck visible, giữ media và durable reconcile intent, không unconditional unlink. Native reimport validator dùng hashScope isolated vẫn là disposable local transaction, không nhập nhằng shared owner.
8. Destination replacement có publication identity/generation cục bộ destination và expected predecessor; không copy source generation làm stale fence. Captured stale upsert/remove sau rollback/replace phải bị reject kể cả equal generation; ack chỉ exact write. Giữ lock order đã chốt phase 07.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P08-01 | C | Hai prepare/publish cùng destination | Một winner; owner/head/job/outbox winner nguyên vẹn |
| P08-02 | C | Loser cleanup sau head mới đã advanced | Reject stale cleanup, không xóa row winner |
| P08-03 | C | Hai jobs cùng shared blob digest | Không unlink blob winner/other owner dùng |
| P08-04 | C | Old outbox upsert apply sau newer mutation | Không regress generation/projection |
| P08-05 | H | Apply succeeds/ack fails/retry | Idempotent, không increment business operation lần hai |
| P08-06 | H | Duplicate/restore source head đổi giữa đọc và commit | Fail stale, no partial destination |
| P08-07 | H | Same key same payload sau timeout | Same result; không second owner |
| P08-08 | H | Same key different payload | Conflict; old receipt không cấp quyền ghi mới |
| P08-09 | H | Snapshot delete release uncertain | Giữ recovery file/owner, không mất original |
| P08-10 | H | Restore và snapshot concurrent | Lock order không deadlock, pre-restore reversible |
| P08-11 | H | Cancel race với drain và newer head | Chỉ cancel exact job theo visibility rule |
| P08-12 | M | Unrelated deck operations | Không cross-deck state leak hoặc global deadlock |
| P08-13 | C | A tạo upload media, B reuse và publish, A fail/rollback | Winner B fetch media được; không unlink shared committed bytes |
| P08-14 | C | Captured stale upsert/remove sống qua replace cùng numeric generation | Exact publication fence reject; head/row/media winner còn |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/compatibility-outbox.test.js server/routes/pptx-lifecycle-concurrency.test.js server/routes/history-package-lock-order.test.js server/routes/history-snapshot-delete-compensation.test.js
npx vitest run server/services/pptx-import/media.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js
```

## Runtime smoke bắt buộc
Chạy throwaway concurrent HTTP/process harness trên temp root, ghi operation IDs/head hashes trước/sau. Sau loser failure download/open winner và Original; không chỉ assert mock calls.

## Deliverables / checklist
- [ ] 08.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 08.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 08.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 08.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 08.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

## Exit gate
Mọi interleaving C/H có deterministic pass; winner bytes/head/owners/visibility nguyên vẹn; lock acquisition có bounded timeout chứng minh không treo.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

### Observed execution; current joint exit remains open
- Older reconciled run và unbound API smoke là historical checkpoints, không current source qualification.
- [Current complete inventory](reports/pptx-phase08-current-complete-inventory.json): 14 actual files, 233 passed, no failed/skipped. P08-07 lost native save response giữ durable receipt/no second outcome; P08-12 unrelated deck barrier/isolation đã exercised. Hai scenario này không còn unexercised.
- [Source-bound owner API smoke](reports/pptx-phase08-source-bound-owner-api-smoke.json) passed với stable before/after backend-scope digest, winner head/Original/shared media nguyên vẹn. Synthetic ZIP/PNG và injected unavailable projection/rollback sink không phải process death/Office render.
- `completed` cũ ở task-map không đủ chứng minh current exit sau reader/portable authority repairs. Giữ in-progress cho final impacted-source C/H inventory/runtime binding, owning docs và upstream 07 acceptance; không tự check từng item bằng total xanh. [Execution ledger](evidence-ledger.md#execution-ledger-reconciliation) giữ identities/limits.

## Risks, security và Failure Protocol
Logical retry không đồng nghĩa atomic transaction nhiều file. Failure protocol không được nuốt rollback error rồi mark succeeded.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
