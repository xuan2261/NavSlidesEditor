---
phase: 1
title: "Baseline revision, evidence và môi trường"
status: completed
priority: P1
effort: ""
dependencies: []
---

# Phase 01: Baseline revision, evidence và môi trường

## Goal
Chốt một đối tượng kiểm chứng có SHA, dirty-state, policy và artifact identity; phân biệt bằng chứng lịch sử với bằng chứng ứng viên.

## Context và bằng chứng
Phiên lập kế hoạch đọc git status/rev-parse: main, aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131; có tài liệu untracked. package.json:3,12–17,39–83 định nghĩa version/workspaces/test entrypoints. vitest.config.mjs:7–17 định nghĩa projects và coverage floors.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: Không có.

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Read | `C:/Work/NavSlidesEditor/package.json` | scripts và engines; nhỏ |
| Read | `C:/Work/NavSlidesEditor/vitest.config.mjs` | test projects/thresholds; nhỏ |
| Read | `C:/Work/NavSlidesEditor/config/release-target-policy.json` | target gates; nhỏ |
| Create | `C:/Work/NavSlidesEditor/plans/261009-0901-navslides-full-reliability-deep-tdd/reports/baseline.json` | evidence metadata; mới, khi thi hành |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Ghi git SHA, branch, tracked dirty diff digest và danh sách untracked; không add/clean/stash file người dùng. Candidate chưa clean vẫn được kiểm tra local nhưng không gọi là release source.
2. Đọc lại source và test inventory ở đầu từng phase. Ghi tool versions Node/npm/browser/Docker/Trivy/OfficeCLI/PowerPoint; kiểm tra availability không in secret. Thu thập CI run đúng SHA qua GitHub read-only khi có quyền.
3. Lập ledger theo verification-strategy.md. Các số 630/5052/71 và corpus 11/11 trong attachment chỉ là lịch sử do người dùng cung cấp; không gán cho SHA mới.
4. Tách test workspace, data/uploads/tmp và ports theo run; xác nhận fixture backup trước fault/restart. Không thử lỗi trên server/data thật.
5. Chốt inventory gates có thể chạy và gates blocked; không tự cấp token, sửa branch protection, publish hay đổi release policy. Lập capability manifest để phase 11/12 không chờ đến cuối mới biết thiếu môi trường.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P01-01 | C | Evidence đúng SHA nhưng sai digest | Từ chối tái dùng receipt cho artifact mới |
| P01-02 | C | CI xanh ở 5e324699, candidate aa19b59 | Candidate vẫn not-run |
| P01-03 | H | Worktree có untracked người dùng | Giữ nguyên; ghi rõ baseline dirty-state |
| P01-04 | H | Thiếu Office hoặc certificate | Windows gate blocked, không passed/skipped hợp lệ |
| P01-05 | H | Test data dir trỏ production | Dừng trước khi chạy destructive fixture |
| P01-06 | H | Policy hash thay đổi giữa run | Evidence cần qualification lại |
| P01-07 | M | Thiếu node_modules/tool | Preflight blocked, không tính là test RED |
| P01-08 | M | Run đã hết hạn/log không truy xuất được | Ghi unavailable kèm nguồn, không suy ra thành công |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
git rev-parse HEAD
git status --short --branch
node --version
npm --version
npm run test:inventory
```

## Runtime smoke bắt buộc
Chạy inventory ở sandbox/candidate và mở JSON output; xác nhận test entrypoints thực sự được phân loại. Đây là smoke công cụ, chưa chứng minh ứng dụng.

## Deliverables / checklist
- [x] 01.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 01.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [x] 01.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [x] 01.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [x] 01.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

## Exit gate
Baseline ledger đầy đủ; mỗi gate có owner, command, expected artifact và trạng thái not-run/blocked; không có evidence lịch sử được ghi passed cho candidate.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Qualification cần Linux/Docker và Windows/Office thực. Thiếu một môi trường không cản soạn/sửa code độc lập nhưng chặn hoàn thành release.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
