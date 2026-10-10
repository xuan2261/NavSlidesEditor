---
phase: 6
title: "History, autosave, rich text và selection"
status: in-progress
priority: P1
effort: ""
dependencies: [1]
---

# Phase 06: History, autosave, rich text và selection

## Goal
Chứng minh bản sửa history hiện có và các tương tác không mất chỉnh sửa; không viết lại redo đã sửa.

## Context và bằng chứng
use-editor-history-controller.js:136–145 dùng state; regression editor-page-history-autosave.characterization.test.jsx:97–133 đã có Undo/Redo/debounce/branch. Scout xác nhận persistence/save route epochs và recovery draft riêng.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-history-controller.js` | history snapshot/redo chỉ sửa regression |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-persistence-controller.js` | route epoch/dirty state |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-save-controller.js` | queued saves/recovery |
| Modify | `C:/Work/NavSlidesEditor/client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx` | cross-controller state sequences |
| Modify | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-save-controller.test.jsx` | pending save errors/late responses |
| Modify | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-rich-text-controller.test.js` | rich text/selection oracle |
| Modify | `C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-layout-controller.test.js` | master/layout integration |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Chạy existing characterization trước; nếu xanh ghi verified existing fix, không tạo artificial RED bằng sửa code tốt. Test mới chỉ cho interaction thiếu coverage.
2. Dùng fake timers kiểm soát history debounce 500ms và autosave scheduling độc lập. Assert serialized content và availability tại từng bước, không chỉ history array length/callback count.
3. Kiểm tra TipTap history vs document history ownership, selection ID/master-edit target sau delete/undo/layout changes; content/formatting phải survive save/reload.
4. Ép pending saves/loads bằng deferred promises: old route response không seed history/draft cho new route; saved snapshot chỉ clear matching dirty/recovery, không clear newer edit.
5. Chỉ sửa controller gây fail; giữ history cap hiện có và server package restore contract. Server snapshot lifecycle faults được phase 08/09 sở hữu, không duplicate tests cùng path.
6. Browser smoke gõ rich text, Undo ngay, Redo, edit master, đổi route trong save; đọc lại persisted content. Cập nhật docs/changelog nêu verified vs fixed.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P06-01 | C | A→B→C, Undo×2, Redo×2, Undo/Redo lại | Mỗi nội dung đúng snapshot |
| P06-02 | C | Undo trước 500ms | Pending edit không mất; về predecessor |
| P06-03 | C | Undo rồi edit D | Redo invalid ngay, không hồi C |
| P06-04 | H | Rapid edits coalesce | Undo boundary đúng, không stale intermediate |
| P06-05 | H | Load initial deck | Không dirty/autosave giả |
| P06-06 | H | History cap và oldest boundary | Bounded và nội dung boundary đúng |
| P06-07 | H | Rich text format/caret selection, delete/undo | HTML/target hợp lệ, destroyed editor không write stale |
| P06-08 | H | Master edit rồi undo/remove master | Không đổi nhầm slide/local lock |
| P06-09 | C | Save A pending; edit B; response A | B vẫn dirty/recoverable |
| P06-10 | H | Route A→B; load/save A về muộn | Không install/save A vào B |
| P06-11 | H | Save failure, retry, reload | Không mất snapshot; lỗi user-visible |
| P06-12 | H | Remote conflict choice | Không queued local save đè lựa chọn remote |
| P06-13 | M | Manual save và unload recovery | Committed snapshot đúng, newer draft không xóa |
| P06-14 | H | Server restore tạo Before restore | Có thể đảo restore; original owner còn |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/hooks/editor-controller/use-editor-save-controller.test.jsx client/src/hooks/editor-controller/use-editor-persistence-controller.test.jsx client/src/hooks/editor-controller/use-editor-rich-text-controller.test.js client/src/hooks/editor-controller/use-editor-layout-controller.test.js client/src/hooks/editor-controller/use-editor-selection-controller.test.js
npx playwright test tests/e2e/editor-history-errors.spec.js tests/e2e/version-history-ui-restore.spec.js tests/e2e/autosave-oversized-recovery.spec.js --project=chromium
```

## Runtime smoke bắt buộc
Quan sát editor thật cùng rich text/master/selection, pending save và reload; lưu trace/video và actual content hash ở đúng SHA.

## Deliverables / checklist
- [ ] 06.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 06.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 06.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 06.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 06.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: historical root `reports/p06-acceptance-closure.json` giữ native initial5 RED (restore generations2/3 nhưng save gửi1→409). Main repair restored generation/history/interaction lifecycle và transport/teardown fencing: `reports/p06-restored-adoption-green02.json` focused40 pass; `reports/p06-native-summary-final02.json` native5 pass, before/after source6b0171… matched. Native IDs07/08/09/10/11/12/14 được chạy; exact13 manual-save/newer-draft/unload oracle và current fullcoverage mapping vẫn mở. Không promote historical root17 hoặc old build. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation).

## Exit gate
Existing redo regression được xác nhận; mọi C/H interaction pass hoặc có blocker rõ ràng không gọi complete. Không thêm redundant history implementation.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Unit fake timers không chứng minh browser IME/TipTap focus; cần UI smoke. Không suy từ corpus/coverage sang không mất dữ liệu.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
