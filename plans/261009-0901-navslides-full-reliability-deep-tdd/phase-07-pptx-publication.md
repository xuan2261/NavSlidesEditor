---
phase: 7
title: "PPTX publication, visibility và template authority"
status: in-progress
priority: P1
effort: ""
dependencies: [1]
---

# Phase 07: PPTX publication, visibility và template authority

## Goal
Chỉ cho mở package-backed deck khi authority và compatibility projection cùng nhận dạng outcome; giữ nguyên ba contract export.

## Context và bằng chứng
package-store/import-commit.js:159–239 publish root/owner/head/job/outbox cùng mutation; pptx-import.js:194–290 so outcome revisionId/generation/headHash trước visibility. lifecycle.js đã có duplicate/restore/template guards, cần chứng minh không thay bằng rewrite.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/import-commit.js` | publication boundary |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/lifecycle.js` | duplicate/template/restore authority |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/compatibility-outbox.js` | projection generation fencing |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/routes/pptx-import.js` | job visibility/read reconciliation |
| Modify | `C:/Work/NavSlidesEditor/server/routes/pptx-import-crash-points.test.js` | published-not-visible behavior |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/lifecycle.test.js` | template/duplicate invariants |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/compatibility-outbox.test.js` | apply/ack and stale row |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store-runtime.js` | production drain owner, exact publication fence |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/compatibility-view.js` | persisted raw row identity trước canonical merge |
| Modify | `C:/Work/NavSlidesEditor/server/services/package-backed-presentation-read.js` | list/open visibility oracle |
| Modify | `C:/Work/NavSlidesEditor/server/services/package-backed-presentation-read.test.js` | wrong raw head không được resolver che |
| Modify | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store-runtime-lock-order.test.js` | production replay lock-order barriers |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. State transitions: prepared bytes → package authority published → compatibility projected → openable. Gate completeJob/SSE và live GET lẫn durable GET bằng exact visibility, không chỉ presentationId hoặc drain resolve/count. Production drain có thể resolve với zero healthy writes/dead-letter, không được coi done.
2. Visibility oracle kiểm tra **persisted raw compatibility publication identity trước canonical merge** so exact expected outcome. `package-backed-presentation-read.js`/`compatibility-view.js` có thể thay head bằng current authority khi merge; giá trị do resolver tự thay không chứng minh projection đã apply. List/open/export/duplicate/template/snapshot dùng cùng rule.
3. Dùng package-store/outbox/data thật trong temp root. Mở rộng CP tests đang có thay dựng fake manager. Kiểm tra template instantiation rebind destination/source map; không copy authority ID từ source như một deck mới.
4. Phân biệt Original bytes immutable, reconstructed/hybrid best effort, validated-edited fail-closed theo availability/generation/idempotency. Không fallback hybrid khi edited bị từ chối.
5. Chỉ sửa path chứng minh violation. Publish root không là transaction toàn bộ JSON/media; bước apply có thể retry với identity. Preserve source original và owner refs trong mọi failed publish.
6. Cập nhật docs state diagram/contract sau evidence. Phase này không tự bật physical GC hay thêm dịch vụ outbox thứ hai.
7. Production replay owner là package-store-runtime.js, không chỉ generic compatibility-outbox.js. Giữ lock order snapshot dưới package serialization → release → apply dưới presentations lock → release → ack exact write. Không giữ package serialization khi chờ presentations lock. Fence captured upsert/remove theo exact publication/outcome identity đã invalidated bởi rollback/replace, không chỉ numeric generation nhỏ hơn.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P07-01 | C | Root committed, projection chưa apply | Job chưa openable; list/open không ghost |
| P07-02 | C | Projection row đúng ID nhưng sai generation/hash | Không đủ để job done/openable |
| P07-03 | C | Outbox apply thành công, ack thất bại | Retry không duplicate/regress newer row |
| P07-04 | H | Malformed outbox record | Fail/reconcile-required, không success |
| P07-05 | H | Pending projection rồi duplicate/template | Reject theo contract, không half deck |
| P07-06 | H | Template source changes trước commit | Reject stale source; destination không partial |
| P07-07 | H | Destination source-map/authority rebind | Đúng destination identity, original bytes giữ nguyên |
| P07-08 | H | Cancel trước/ sau publication | Theo visibility policy, không openable ghost |
| P07-09 | H | Durable completed job nhưng in-memory map mất | GET reconcile bằng exact outcome |
| P07-10 | H | Edited export unavailable/stale generation | Lỗi contract, không hybrid fallback |
| P07-11 | M | Original export sau failed edited publish | Byte hash bằng original nhập |
| P07-12 | H | List và direct-open dùng khác read paths | Cùng fail-closed authority rule |
| P07-13 | C | Production drain dead-letters mọi write, resolves 0 | Live GET/SSE không done/openable; durable reconcile state còn |
| P07-14 | C | Raw row sai head nhưng canonical resolver trả head mới | Visibility reject trước merge; không giả projection applied |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run server/routes/pptx-import-crash-points.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/compatibility-outbox.test.js
npx vitest run server/services/package-backed-presentation-read.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js
```

## Runtime smoke bắt buộc
Import fixture thật, pause trước drain, gọi job/list/open/export HTTP; release drain rồi mở deck và download Original so SHA256. Với template, instantiate rồi mở destination qua UI/API.

## Deliverables / checklist
- [ ] 07.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 07.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 07.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 07.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 07.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: native parser/corpus HTTP publication/template/Original passed P07-01/07/10/11/12. New committed-journal reader GREEN chưa có final source-bound all-reader C/H exit. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation); availability không chứng minh verified Edited/Office.

Finding #6 collision repair: [HTTP regressions](../../server/routes/presentations-destination-collision.test.js) cover existing package/JSON destinations, rowless authority, root-commit compensation and successor preservation. Mutation-time admission is exercised by [publication acceptance](../../server/services/pptx-import/package-store/publication-acceptance.test.js). [Affected GREEN receipt](reports/destination-collision-green.json) records 139 passing tests across 12 suites; [source-bound Node/HTTP smoke](reports/destination-collision-runtime.json) proves both collisions return 409 without changing the winner and both noncolliding create/open paths retain Original bytes. Owners: `presentations-crud.js`, `lifecycle.js` and `destination-creation.js`. This closes the bounded finding, not phase-wide reader, physical or release qualification.

## Exit gate
Publication/visibility invariants có assertion qua real readers; original truy xuất được; existing protection xanh không bị mô tả như bug đã sửa.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Có nhiều reader compatibility; một owner phải enumerate trước cutover. Không che failures bằng returning empty deck/list.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
