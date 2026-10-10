---
phase: 3
title: "Settings UI: bảo toàn draft và conflict UX"
status: blocked
priority: P1
effort: ""
dependencies: [2]
---

# Phase 03: Settings UI: bảo toàn draft và conflict UX

## Goal
Save response chỉ xác nhận snapshot đã gửi, không xóa chỉnh sửa nhập trong lúc request đang chờ.

## Context và bằng chứng
client/src/pages/SettingsPage.jsx:185–207 setSettings từ response toàn bộ; :222–237 vẫn cho update. SettingsPage.test.jsx:101–120 có save failure coverage; GET hiện chưa có revision.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [02](phase-02-settings-atomic-revision.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/client/src/pages/SettingsPage.jsx` | draft/base/submitted state và conflict UI; file lớn, tách helper chỉ khi cần |
| Modify | `C:/Work/NavSlidesEditor/client/src/pages/SettingsPage.test.jsx` | deferred responses + fields assertions |
| Create | `C:/Work/NavSlidesEditor/tests/e2e/settings-concurrency.spec.js` | hai tab + pending save thực |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Tách baseline đã server xác nhận, draft đang nhập, submitted snapshot và revision; capture immutable snapshot khi click. Gửi If-Match bằng baseline revision, không lấy revision đang mutable trong promise. Serialize chỉ editable settings vào body, loại settingsRevision/server metadata; không stringify nguyên GET DTO vì server reject reserved revision field.
2. Khi 200: nâng baseline/revision từ response; chỉ normalize trường draft chưa đổi kể từ submitted. Trường đã thay đổi tiếp giữ nguyên và vẫn dirty. Không so sánh secret plaintext với sentinel như một thay đổi người dùng.
3. Theo dõi apiKey intent riêng: unchanged/replace/clear. Response masked chỉ xác nhận submitted intent; key người dùng vừa nhập sau submit không bị thay bằng sentinel. Không lưu plaintext vào localStorage, debug receipt hoặc conflict preview.
4. Khi 412: giữ draft, tải latest masked baseline khi người dùng chọn xem conflict; không tự retry overwrite. UI cho reload bỏ draft với xác nhận, hoặc rebase trường đã sửa lên baseline mới và Save rõ ràng. Trường xung đột phải có lựa chọn local/server. Hai sentinel configured không chứng minh secret remote không đổi: sau mọi 412, nếu local apiKey intent replace/clear thì conflict secret là không xác định và bắt buộc chọn giữ server hoặc áp dụng local; unchanged thì omit apiKey. Chỉ hiển thị trạng thái configured, không thêm hash secret.
5. Trong pending Save vẫn cho nhập; ngăn duplicate submit. Hiện trạng thái saved snapshot nhưng còn unsaved changes, không thông báo toàn form đã lưu. Abort/ignore response khi unmount, xử lý lỗi GET/save không ghi defaults lên server.
6. Kiểm tra interaction Test Connection luôn dùng draft chưa lưu; shortcut config local và Sync modal vẫn độc lập. Loại assertion chỉ khóa className/call count nếu chạm test đó; thay bằng hành vi focus/keyboard thật.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P03-01 | C | Save A; nhập B; response A về | Input B còn, dirty true, lần Save sau gửi B |
| P03-02 | C | Save key A; nhập key B đang pending | B còn và không bị sentinel ghi đè |
| P03-03 | H | Không edit trong pending | Response normalization áp dụng, dirty false |
| P03-04 | H | Edit field rồi revert về submitted | Không tạo dirty giả; response baseline dùng đúng |
| P03-05 | H | Hai tab cùng baseline, tab thứ hai Save | 412, giữ draft; không auto force write |
| P03-06 | H | Rebase non-conflicting fields | Lưu thay đổi local và remote không đè nhau |
| P03-07 | H | Cùng field conflict và API key conflict | Yêu cầu lựa chọn; không lộ key server |
| P03-08 | H | HTTP/network/JSON lỗi | Draft giữ nguyên, alert accessible, Save được retry |
| P03-09 | H | GET thất bại | Không Save defaults đè config server |
| P03-10 | M | Double click Save; unmount khi pending | Không gửi hai mutation, không late state update |
| P03-11 | M | Test Connection sau edit chưa Save | Dùng draft mới, không làm dirty mất |
| P03-12 | M | Keyboard focus conflict/reload + Sync Escape | Focus hợp lệ; modal/shortcuts không bị listener chiếm |
| P03-13 | H | Hai tab đều thấy configured; remote đổi key hoặc chỉ đổi model, local replace/clear key | Sau 412 luôn yêu cầu lựa chọn secret rõ ràng; không suy non-conflict từ sentinel giống nhau |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run client/src/pages/SettingsPage.test.jsx
npx playwright test tests/e2e/settings-concurrency.spec.js --project=chromium
```

## Runtime smoke bắt buộc
Mở /settings bằng browser, trì hoãn PUT, nhập field thứ hai rồi release response; chụp input và trạng thái unsaved. Lặp bằng hai tab với server thật, giải quyết 412 và reload chứng minh persisted values.

## Deliverables / checklist
- [x] 03.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 03.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [x] 03.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 03.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [x] 03.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Local [browser evidence](reports/settings-browser-smoke.json) proves authentic PUT-response interleaving, preservation of a newer draft, explicit two-tab conflict/rebase, persisted values after reload, keyboard shortcut recording and Sync cancellation. [Boundary characterization](reports/settings-boundary-green.json) adds the remaining normalization, reverted-edit, HTTP/network/JSON-error and pending-save/unmount cases: 17 local tests passed. The joint 02/03 exit gate remains open for actual Linux permission proof; no skipped case is marked passed.

Post-audit correction: obsolete StrictMode GET callbacks no longer mutate the replacement lifecycle; discard confirmation synchronously releases shortcut capture; post-reload edits show actual dirty state without inventing a Save. [Source-matched affected GREEN](reports/audit-fixes-green-identity.json) includes all three Settings suites; [five real browser/API scenarios](reports/audit-fixes-settings-browser.json) prove conflict, recording-to-Tab/Escape cancellation, confirmed reload, theme/key dirty/revert, Save and persisted reload. Joint POSIX qualification remains open; this does not certify full E2E.

## Exit gate
Không mất draft ở pending/error/conflict; accessible status phản ánh đúng saved snapshot; test key không ghi secrets; phase 02/03 pass cùng nhau.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
So sánh snapshot thuần JSON với sentinel dễ xóa key mới hoặc tạo dirty giả; dùng intent và field-edit tracking, không general state framework.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
