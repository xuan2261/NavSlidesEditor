---
phase: 4
title: "CI summary: chỉ success mới vượt gate"
status: blocked
priority: P1
effort: ""
dependencies: [1]
---

# Phase 04: CI summary: chỉ success mới vượt gate

## Goal
Fail-closed với mọi required job missing, skipped hoặc không thành công; không đổi gate bắt buộc để có CI xanh.

## Context và bằng chứng
.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:141–166 chỉ từ chối failure/cancelled/timed_out. Required needs gồm 13 job; feature-coverage-gate được ghi non-required ở :109–116.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | required-checks evaluator |
| Create | `C:/Work/NavSlidesEditor/scripts/ci/required-checks.mjs` | evaluator + CLI nhỏ, dùng thật trong workflow |
| Create | `C:/Work/NavSlidesEditor/scripts/ci/required-checks.test.js` | status matrix qua evaluator/CLI |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Định nghĩa exact required IDs: lint, unit-coverage, vitest-performance-budget, build, e2e-chromium, e2e-pptx-import, e2e-live, e2e-mobile, e2e-visual, pptx-corpus-metrics, load-smoke, docker-artifact, container-supply-chain.
2. Truyền JSON needs qua environment vào script, không interpolation dữ liệu không tin cậy vào shell. Script check mỗi required ID tồn tại, object có result === success. Empty/malformed/missing/unknown status đều exit nonzero và nêu ID.
3. Giữ if: always() để gate được đánh giá khi upstream fail/skip. Không include feature-coverage-gate non-required hay linux-ci-receipt phụ thuộc ngược tạo cycle. Không nhầm optional job release mode với required CI jobs.
4. Dùng một danh sách policy owner cho evaluator và kiểm tra parsed workflow needs khớp semantic set; không test raw YAML wording. Checkout step nếu cần chạy script phải được đặt subject ref đúng và không nhận secrets từ PR.
5. Đề xuất diff branch protection/check identity trong runbook nếu needed; không tự sửa GitHub. Matrix E2E phải có evidence mọi shard, aggregate success không thay raw shard receipt.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P04-01 | C | 13 required success | Exit 0 |
| P04-02 | C | Một required skipped ở mỗi vị trí | Exit 1, chỉ rõ job |
| P04-03 | C | needs rỗng/missing một ID | Exit 1, không all([])=true |
| P04-04 | H | failure/cancelled/timed_out/unknown/null | Mọi giá trị đều fail |
| P04-05 | H | JSON hỏng hoặc result object sai kiểu | Diagnostic không tạo receipt passed |
| P04-06 | H | Optional feature coverage failure | Không làm required gate fail sai policy |
| P04-07 | H | Required workflow needs và evaluator lệch | Semantic inventory check fail |
| P04-08 | H | Upstream build fail khiến E2E skip | Summary vẫn chạy và fail |
| P04-09 | M | Extra non-required result | Không thay required success rule |
| P04-10 | H | Một shard fail/skip còn lại success | E2E aggregate/receipt không chứng nhận toàn bộ |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run scripts/ci/required-checks.test.js
```

## Runtime smoke bắt buộc
Chạy CLI thật với JSON needs success và skipped từ temp files/environment, kiểm tra exit codes. Trong CI sandbox của branch được phép, gây required dependency skip có kiểm soát và quan sát summary đỏ; không sửa protection production.

## Deliverables / checklist
- [ ] 04.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 04.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 04.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 04.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 04.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: required-checks evaluator/CLI matrix GREEN; authorized remote graph skipped-job smoke vẫn blocked. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation); unchecked acceptance không có nghĩa implementation chưa chạy.

## Exit gate
Negative status matrix pass và một actual CI graph smoke chứng minh summary không xanh khi required skipped; nếu chưa có runner, ghi CI smoke blocked.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
GitHub needs matrix aggregate không giữ chi tiết từng shard; release evidence cần kiểm tra manifest shard ở phase 16, không suy ra từ job count.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
