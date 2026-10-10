---
phase: 9
title: "PPTX durable recovery và cleanup ownership"
status: in-progress
priority: P1
effort: ""
dependencies: [8]
---

# Phase 09: PPTX durable recovery và cleanup ownership

## Goal
Crash/restart hội tụ về visible committed outcome hoặc reconcile-required bền vững; cleanup không phá dữ liệu có chủ sở hữu.

## Context và bằng chứng
state-store.js:1–260 đã WAL/root/predecessor recovery; collector.js:1–37 audit-only, deletion disabled. pptx-import.js:479–490,565–579 có best-effort cleanup paths; cần phân biệt với durable reconcile. Project import media session có checkpoint/recovery riêng.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [08](phase-08-pptx-concurrency.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/state-store.js` | root/WAL recovery invariants |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/routes/pptx-import.js` | durable reconcile error ownership |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/project-import-media-session-recovery.js` | cross-store restart |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/server/services/project-import-media-session.js` | identity-bound checkpoints |
| Modify | `C:/Work/NavSlidesEditor/server/routes/pptx-import-crash-points.test.js` | actual kill/reopen scenarios |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-media-session.test.js` | placement/session ownership |
| Create | `C:/Work/NavSlidesEditor/server/services/pptx-import/package-store/restart-recovery.test.js` | child-process crash harness |
| Modify | `C:/Work/NavSlidesEditor/server/services/project-import-media-session-store.js` | fail-closed ledger read/schema, không catch-all {} |
| Modify | `C:/Work/NavSlidesEditor/server/index.js` | bounded recovery trước readiness/admission |
| Modify | `C:/Work/NavSlidesEditor/server/services/health-state-readiness.js` | session uncertainty và PPTX media intents vào readiness |
| Modify | `C:/Work/NavSlidesEditor/server/index-health.test.js` | degraded/ready state qua startup thật |
| Create | `C:/Work/NavSlidesEditor/server/index-project-recovery.test.js` | actual startServer kill/restart cross-store proof |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Định nghĩa failure ledger từ durable job/outbox/session hiện có: pending apply, rollback failed, reconcile-required, quarantined. Chọn startup làm automatic retry trigger: server/index.js chạy bounded recovery sau package writer/roots sẵn sàng, trước ready/admission; health-state-readiness phản ánh mọi durable session/media uncertainty. Với reconcile-required không thể tự sửa, operator backup/inspect/fix prerequisite rồi restart để retry; không thêm unauthenticated repair endpoint.
2. Giữ audit-only orphan blobs. Cleanup scope là temp/session-owned media và metadata compensation chứng minh ownership; không triển khai destructive content-addressed GC trong kế hoạch này. Retained original/snapshot/template/shared blobs không được xóa.
3. Child process IPC marker ở các boundaries: bytes committed, WAL prepared, root replaced, JSON apply, ack, media placement, session checkpoint. Kill child thật rồi restart từ cùng temp dirs; test injected throw trước đó vẫn hữu ích nhưng không gọi là process-death evidence.
4. Recovery đọc authority/root/hash trước mutate; uncertain/corrupt roots quarantine/fail closed theo existing model, không tự regenerate defaults. Không khẳng định power-loss/fsync durability từ process kill.
5. Kiểm tra repeated restart và recovery retry không duplicate media/owners/rows; delete stale row cần session/payload/head identity match. Nếu storage lỗi dai dẳng, giữ reconcile-required và thông tin có thể vận hành không chứa secret.
6. Runbook recover: backup nguyên root, inspect audit, retry exact intent, verify original hash/openability; stop nếu authority không xác định. Thử restore backup tại temp root trước khuyến nghị production.
7. `project-import-media-session-store.js:8–14` hiện catch mọi read/JSON error thành {}; chỉ ENOENT được coi ledger mới. JSON/schema/I/O error phải giữ nguyên file, cấm mutation và trả recovery-required. Validate session identity/record shape trước recovery; create session mới không được overwrite corrupt ledger. Đây là owner cần sửa riêng ngoài recovery helper.
8. Kill/restart phải đi qua server startup thật, không gọi helper trực tiếp để claim production recovery. Bao gồm PPTX uploaded-media boundary của phase 08, không chỉ project-import sessions. Recovery giữ uncertain media references và Original; bounded timeout đưa readiness degraded thay vì server admission giả healthy.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P09-01 | C | Kill sau blob commit trước root | Không có head ghost; orphan audit, original không bị GC |
| P09-02 | C | Kill sau root trước projection | Pending/reconcile state survive; không openable sai |
| P09-03 | C | Kill sau JSON apply trước ack | Restart convergence exactly once |
| P09-04 | C | Kill sau visibility trước job callback | Durable outcome trả đúng khi exact reader match |
| P09-05 | H | Kill sau media placement trước checkpoint | Không delete shared media, không duplicate placement |
| P09-06 | H | Kill sau row insert trước media owner commit | Reconcile session/payload rồi finish đúng một lần |
| P09-07 | H | Rollback write fails và restart | Failure durable, không false success |
| P09-08 | H | Repeated restart/reconcile | Không owner leak, no regression/new mutation |
| P09-09 | H | Corrupt newest root/predecessor | Validate chain; quarantine/fail closed, không fabricate authority |
| P09-10 | H | Stale writer epoch sau reopen | Mutation rejected |
| P09-11 | H | Cleanup attempt chứa winner/session khác | Không xóa winner hoặc referenced blob |
| P09-12 | M | Disk full/permission denied | Actionable blocked state và dữ liệu cũ nguyên vẹn |
| P09-13 | C | Truncated/corrupt/unreadable session ledger rồi tạo session mới | Không reset {}; không overwrite file/intent, readiness recovery-required |
| P09-14 | C | Kill PPTX route sau shared-media publication trước commit/checkpoint | Restart qua server thật giữ winner media và reconcile exact job |
| P09-15 | H | Startup còn committing/session uncertainty hoặc recovery timeout | Converge rồi ready, hoặc degraded/admission blocked; không helper-only proof |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run server/services/pptx-import/package-store/restart-recovery.test.js server/services/pptx-import/package-store/package-store.test.js server/routes/pptx-import-crash-points.test.js server/services/project-import-media-session.test.js server/routes/project-import.test.js
npx vitest run server/index-project-recovery.test.js server/index-health.test.js server/services/pptx-import/media.test.js
```

## Runtime smoke bắt buộc
Chạy service child thật với temp data, kill ở IPC marker, start lại, GET/list/open/download original qua HTTP và đối chiếu digest. Lưu journal boundaries và exit signal. Không dùng process.kill lên server người dùng.

## Deliverables / checklist
- [ ] 09.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 09.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 09.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 09.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 09.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: durable recovery/startup/readiness/ownership implemented; focused GREEN và source-bound real startServer/process-death HTTP passed. P09-09/12/13 có focused assertions; P09-10 explicit final mapping, backup/restore runbook proof và final impacted-source binding còn mở. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation); không suy power-loss/Linux permissions từ process kill/injected EACCES.

Post-audit startup correction expires pending admissions through the existing ownership/lock-aware recovery routine before readiness. Both empty-media and owned-media cases changed from HTTP 503 RED to readiness 200 and create 201; uncertain upload-directory ownership remains live 200, readiness/mutations 503 and preserves exact ledgers/media. All three new cases plus deadline/process-death/abort neighbors pass in [source-matched affected GREEN](reports/audit-fixes-green-identity.json); this does not close physical backup/power-loss/Linux permission gates.

## Exit gate
Crash matrix có process-death evidence; mọi failed cleanup có owner/retry hoặc explicit reconcile-required; original/shared bytes giữ nguyên. Không yêu cầu physical GC để phase complete.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Power loss và process death khác nhau; ghi giới hạn platform. Không retry vô hạn hay delete uncertain metadata để làm test pass.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
