---
phase: 13
title: "Navigator baseline 50/100/300 slides"
status: blocked
priority: P2
effort: ""
dependencies: [6, 7]
---

# Phase 13: Navigator baseline 50/100/300 slides

## Goal
Đo bottleneck thật và chốt budget có dữ liệu trước quyết định tối ưu.

## Context và bằng chứng
SlidePanel.jsx:20,80–88 map toàn bộ slides, :60–68 focus refs theo index. Eager mount được xác nhận, chưa có số liệu kết luận chậm. playwright.config.js:120–136 mặc định dùng production server và isolated data.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [06](phase-06-history-autosave.md), [07](phase-07-pptx-publication.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Create | `C:/Work/NavSlidesEditor/tests/e2e/navigator-performance.spec.js` | deterministic 50/100/300 fixture + metrics |
| Modify | `C:/Work/NavSlidesEditor/client/src/components/SlidePanel.test.jsx` | behavior invariants trước tối ưu |
| Read | `C:/Work/NavSlidesEditor/client/src/components/slide-panel/slide-navigator-item.jsx` | thumbnail/children cost |
| Read | `C:/Work/NavSlidesEditor/tests/e2e/slide-management-modal-and-multiselect.spec.js` | stable ID operations |
| Create | `C:/Work/NavSlidesEditor/plans/261009-0901-navslides-full-reliability-deep-tdd/reports/navigator-baseline.json` | measurements + budgets khi thi hành |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Tạo deterministic decks 50/100/300 parent slides, variants 0/1/3 children, text/image/chart-like elements và master/token links. Báo tổng flattened entries riêng số parent; fixed content/fixture hashes.
2. Production build cùng browser pins/hardware/viewport, warm một lần và ít nhất 5 repetitions randomized order. Record median/range; p95 dùng ít nhất 20 timed interaction samples, không percentile từ 5 mẫu mà giả precision.
3. Metrics: cold/open-to-ready, selection-to-next-paint, input-to-paint, React commit duration (profiling build tách production), long tasks, DOM count, heap nếu browser hỗ trợ, scroll/drop latency. Metric unsupported ghi N/A, không 0.
4. Profile attribution: thumbnail generation/layout/handlers/DOM vs network/load parsing. npm test:ci-budget đo Vitest runner, tuyệt đối không dùng làm navigator budget.
5. Đóng baseline bằng budget ledger trước phase 14: user-visible SLO dự kiến cần được chốt từ observed UX và hardware; relative non-regression cap đề xuất median/p95 không tăng quá 10% khi noise <5%, nếu noise lớn rerun môi trường ổn định, không loosen ngưỡng sau nhìn kết quả.
6. Nếu baseline không vi phạm budget và không chứng minh bottleneck, phase 14 kết thúc bằng no-change decision có evidence; đây là thực hiện yêu cầu tối ưu có đo, không tự áp virtualization.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P13-01 | H | 50/100/300 deck fixture đồng nhất | Hashes/size/children count đúng, so sánh công bằng |
| P13-02 | H | Cold vs warm measurements | Không trộn population |
| P13-03 | H | Switch first/middle/last slide | Nội dung đúng ID, latency ghi đúng next paint |
| P13-04 | H | Typing rich text khi navigator lớn | Không lost input, capture latency |
| P13-05 | H | Drag across viewport/offscreen | Order và selected IDs đúng |
| P13-06 | H | Ctrl/meta/shift multiselect + bulk delete | ID-stable selection, không index drift |
| P13-07 | H | Children + master previews | Visual/selection đúng; children có keyboard path |
| P13-08 | H | Home/End/Arrow/Enter/Shift+F10 | Focus không rơi body, menu trả focus |
| P13-09 | M | Heap metric unsupported | N/A rõ, không kết luận memory leak từ số 0 |
| P13-10 | M | Timing variance lớn | Baseline invalid cho quyết định, rerun controlled |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npm run build
npx vitest run client/src/components/SlidePanel.test.jsx
npx playwright test tests/e2e/navigator-performance.spec.js --project=chromium --workers=1 --retries=0
```

Measurement chạy riêng không có functional/a11y suites đồng thời. Ghi worker/retry policy và mọi failed sample vào baseline; không để retry chọn mẫu đẹp.

## Runtime smoke bắt buộc
Mở editor production thực từng deck, profile/record thao tác và screenshots first/last/child. Nêu profiler overhead, input latency và paint evidence; không kết luận từ jsdom DOM count.

## Deliverables / checklist
- [x] 13.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 13.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 13.3 Hoàn thành qualification trên baseline có noise hợp lệ; không hạ policy hoặc bỏ invariant.
- [ ] 13.4 Regression và runtime measurement đạt trên current inputs, với receipt đủ source/artifact/fixture identity và noise oracle hợp lệ.
- [x] 13.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: Historical sample collection đã hoàn thành; dữ liệu và budgets giữ nguyên tại [retained receipt](reports/navigator-baseline.json). Receipt ghi `summary.complete=true`, nhưng `summary.stable=false`, `summary.withinBudget=false` và quyết định rerun controlled environment. Riêng `100x3` input có `relativeHalfRangeNoise=0.0627425613782428`, `noiseValid=false`; vì vậy không thể claim toàn bộ core interactions có noise hợp lệ hoặc dùng baseline này đóng P13-10/unblock phase 14. Baseline qualification vẫn blocked cho tới controlled current-input measurement đạt frozen oracle. Không chạy lại benchmark chỉ để xác nhận failure đã được receipt chứng minh, không bỏ mẫu hoặc nới budgets.
## Exit gate
Có baseline raw data, environment/artifact hashes, interaction invariants và budgets frozen trước optimization; không bịa measured numbers.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Artificial fixture quá nhẹ không đại diện PPTX/imported deck; bổ sung một fixture package-backed known-content nhưng không dùng dữ liệu riêng tư.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
