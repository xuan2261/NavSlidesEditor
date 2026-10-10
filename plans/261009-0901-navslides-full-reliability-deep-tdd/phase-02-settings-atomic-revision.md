---
phase: 2
title: "Settings: atomic update và revision precondition"
status: blocked
priority: P1
effort: ""
dependencies: [1]
---

# Phase 02: Settings: atomic update và revision precondition

## Goal
Không mất cập nhật server; một form cũ không thể âm thầm ghi đè trạng thái mới từ tab khác.

## Context và bằng chứng
server/routes/settings.js:29–45 đọc/merge/ghi tách rời; server/services/storage.js:47–65 lock theo process, :233–238 khóa riêng đọc/ghi. settings-merge.test.js:36–74 đã bảo vệ merge ai và sentinel.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/server/services/storage.js` | critical section settings; vùng nhỏ trong file lớn |
| Modify | `C:/Work/NavSlidesEditor/server/routes/settings.js` | GET/PUT revision và error mapping; nhỏ |
| Modify | `C:/Work/NavSlidesEditor/server/routes/settings-merge.test.js` | merge + concurrent HTTP tests |
| Modify | `C:/Work/NavSlidesEditor/server/routes/api-surface.test.js` | GET→PUT precondition |
| Modify | `C:/Work/NavSlidesEditor/server/routes/ai.test.js` | settings fixture nếu storage write contract đổi |
| Modify | `C:/Work/NavSlidesEditor/server/services/storage.test.js` | atomic failure/secret permission |
| Create | `C:/Work/NavSlidesEditor/server/routes/settings-concurrency.test.js` | interleaving/revision regression |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Chọn contract đề xuất: GET trả DTO hiện có cộng settingsRevision integer; PUT giữ merge semantics nhưng gửi If-Match với revision dạng quoted decimal. Thiếu header 428, sai cú pháp 400, stale revision 412. Đây là quyết định kế hoạch, không phải API hiện có.
2. Persist revision và settings trong cùng settings.json để không tạo transaction hai file. File cũ thiếu revision đọc là 0; lần ghi thành công đầu tiên tạo 1. Body không được quyết định revision; reject reserved field. Chỉ increase sau commit atomic thành công.
3. Thêm updateSettings(callback/precondition) dưới một withFileLock(SETTINGS_FILE). Đọc fs.readJson và writeJsonAtomic trực tiếp bên trong để tránh gọi lại readSettings/writeSettings gây deadlock. Check revision, merge, ghi, tạo response snapshot trong cùng critical section. Rename thành công là commit point: helper hiện tại còn chmod destination sau rename (`storage.js:100`), có thể throw sau commit. Loại thao tác post-commit dư thừa sau khi chứng minh temp mode 0600 được giữ qua rename; giữ regression permissions của mọi secret-bearing caller. Không rollback/giảm revision đã commit; network response loss sau commit được xử lý bằng GET lại/revision conflict.
4. Giữ top-level replacement khi key có trong request, ai shallow subkey merge như hiện tại: omitted/sentinel apiKey giữ secret; empty string xóa; key mới thay. Mask tất cả GET/PUT/error output. Không đưa secret vào revision hash hoặc log.
5. Giữ writeSettings chỉ cho init/test nếu cần; nếu có production writer khác thì migrate vào atomic owner. Rescout/LSP references trước đổi exported symbol. Consumers đã thấy: SettingsPage.jsx, settings-merge.test.js, api-surface.test.js; fixture writers: ai.test.js, storage.test.js. Không hỗ trợ PUT vô điều kiện để né cutover.
6. Roll out phase 02 và 03 cùng một deploy. Client cũ nhận 428 và reload, không có compatibility path âm thầm bỏ precondition. Lock đảm bảo single process; không hứa multi-process transaction.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P02-01 | C | Hai PUT cùng revision, ép A/B đọc trước commit | Đúng một 200 và một 412; winner còn nguyên |
| P02-02 | C | Retry stale form toàn bộ sau update tab khác | 412, bytes/revision không đổi |
| P02-03 | C | Write/chmod temp/rename thất bại trước commit | Bytes/revision cũ giữ nguyên; request kế tiếp không deadlock |
| P02-04 | H | Hai update server hợp lệ serialize có revision mới | Cả thay đổi được giữ, revision monotonic |
| P02-05 | H | Omit ai/apiKey hoặc echo sentinel | Secret gốc còn, response luôn masked |
| P02-06 | H | Explicit apiKey empty/new | Xóa/thay đúng ý định, không tự phục hồi secret cũ |
| P02-07 | H | Body giả settingsRevision; If-Match thiếu/sai | 400/428; không ghi file |
| P02-08 | H | Legacy settings thiếu revision, restart sau commit | 0→1; reload/restart vẫn 1 |
| P02-09 | H | Malformed stored JSON | Trả lỗi; không ghi defaults đè dữ liệu |
| P02-10 | M | Non-ai object update | Thay top-level theo contract hiện tại; ai subkeys không bị mất |
| P02-11 | M | Response của winner sau request kế tiếp | Trả snapshot winner đúng revision, không lẫn response mới |
| P02-12 | H | Concurrent API-key và model update | Stale writer bị chặn, secret không rò trong conflict |
| P02-13 | H | Rename đã thành công nhưng response bị mất | GET trả revision/bytes mới; retry stale bị 412, không rollback committed state |
| P02-14 | H | Secret file qua atomic rename trên Linux | Mode cuối 0600; lỗi pre-rename không publish, không còn chmod dư sau commit |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run server/routes/settings-merge.test.js server/routes/settings-concurrency.test.js server/routes/api-surface.test.js server/routes/ai.test.js server/services/storage.test.js
```

## Runtime smoke bắt buộc
Khởi chạy API thật với data dir tạm. Hai HTTP clients GET revision 0, gửi PUT cạnh tranh; đọc lại file/GET và restart API để xác nhận winner/revision. Trì hoãn bằng barrier có kiểm soát, không sleep ngẫu nhiên.

## Deliverables / checklist
- [x] 02.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 02.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [x] 02.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 02.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [x] 02.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Local evidence: [focused Settings result](reports/settings-focused-green.json), [actual HTTP concurrency/restart](reports/settings-http-smoke.json), [actual pending-response and two-tab UI](reports/settings-browser-smoke.json). `02.4` remains open for P02-14: the actual POSIX 0600 permission test is skipped on Windows; no registered WSL distribution was listed, Docker is unavailable, and remote candidate dispatch is not authorized. No Linux permission success is inferred from Windows tests.

## Exit gate
Mọi case C/H pass; HTTP concurrency và restart smoke có receipt. Merge API key giữ nguyên semantics; không writer production nào bypass precondition.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
PUT precondition là breaking contract có chủ đích; phase 03 phải deploy cùng. In-memory mutex không bảo vệ nhiều process, giữ single-process deployment invariant.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
