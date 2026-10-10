---
title: "Phase 04 — Required summary chỉ nhận success"
status: pending
priority: P0
dependencies: [phase-01]
---

# Phase 04 — Required summary chỉ nhận success

## Phạm vi và bằng chứng scout

Chỉ là PLAN; chưa sửa workflow, chạy test/build, dispatch CI hoặc thay repository settings. Đọc `CLAUDE.md`, `package.json` và các file dưới đây. Phase 01 phải chốt baseline trước khi RED. Giữ Linux/container và Windows public NSIS + portable cùng toàn bộ Authenticode, OfficeCLI, PowerPoint gates; phase này không thay target policy.

| File hiện hữu đã đọc | Kích thước scout (dòng / byte) | Vai trò, tác động dự kiến |
|---|---:|---|
| `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | 185 / 6366 | Sửa duy nhất hợp đồng summary; giữ tên check ổn định |
| `.github/workflows/reusable-green-sha-verification.yml` | 173 / 10494 | Đối chiếu mode CI/release và receipt; không áp summary CI vào các job cố ý không chọn trong mode release |
| `.github/workflows/reusable-container-supply-chain.yml` | 44 / 3026 | Consumer bắt buộc, không được bỏ khỏi needs |
| `tests/unit/container-supply-chain-workflow-contract.test.js` | 40 / 1958 | Mở rộng contract dependency nếu cần |
| `.github/workflows/electron-server-lock-refresh.yml` | 64 / 2970 | Kiểm chứng riêng luồng lock/PR; không đổi quyền ở phase này |
| `config/release-target-policy.json` | 52 / 1424 | Bất biến target/gate, chỉ đọc |
| `scripts/ci/release-receipt-workflow.mjs` | 199 / 7849 | Consumer receipt; gap provenance chuyển phase 12 |
| `tests/unit/required-checks-summary.test.js` (đề xuất mới) | Chưa tồn tại; dự kiến 140–190 dòng | Harness chạy chính body shell summary với needs fixture; không copy thuật toán oracle |

Hiện trạng xác minh tĩnh: summary có `if: always()` và 13 dependency job IDs, nhưng shell chỉ loại `failure`, `cancelled`, `timed_out`. `skipped`, chuỗi rỗng và trạng thái lạ có thể thoát 0. `feature-coverage-gate` được ghi rõ warn-first/non-required, không tự nâng thành required. Một matrix `e2e-chromium` có bốn shard; số job IDs không phải số shard thực tế.

## Hợp đồng mong muốn

- Tập bắt buộc chính xác: lint, unit-coverage, vitest-performance-budget, build, e2e-chromium, e2e-pptx-import, e2e-live, e2e-mobile, e2e-visual, pptx-corpus-metrics, load-smoke, docker-artifact, container-supply-chain.
- Summary chạy dù upstream fail; chỉ exit 0 khi đủ dependency, mỗi `result === success`. Missing, null, empty, skipped, cancelled, failure, timed_out, neutral, unknown đều exit khác 0. Không dùng blacklist hay grep tìm substring `success`.
- Dùng cấu trúc needs để bảo toàn job identity và tập expected, hoặc shell assertion exact với kiểm tra cardinality riêng; thiết kế nhỏ nhất chứng minh được contract. Không đưa expression từ input tùy ý vào executable shell.
- Contract phải phát hiện `continue-on-error`, điều kiện/path filter hoặc removal mới làm mất required gate. Success receipt không được phát hành khi summary fail.
- Required check trong branch protection là setting ngoài repo, không chứng minh chỉ bằng YAML. Chỉ kiểm tra read-only khi được phép; mọi sửa required status/PR permissions cần phê duyệt riêng.

## Re-scout bắt buộc trước thực thi

- [ ] Đọc lại CLAUDE, workflow chính, reusable quality/client/playwright/load/docker/supply-chain, release policy; lưu HEAD và diff để không đè thay đổi người khác.
- [ ] Đối chiếu tên job/check thực tế, expanded matrix và chế độ PR/push/dispatch; capture job API thật sau khi được duyệt, không tạo fixture all-green giả.
- [ ] Kiểm tra framework Vitest include và shell sẵn có trên Windows/Linux. File mới giữ dưới 200 LOC; tách fixture/helper nếu vượt, không refactor unrelated workflow.
- [ ] Inventory trên là snapshot nội dung đã đọc, không phải báo cáo CI. Recount khi file thay đổi và cập nhật phạm vi trước RED.

## TDD — RED → GREEN tối thiểu → Refactor → Tests After

### RED trước

- [ ] Thêm test contract đọc workflow thật và chạy body shell trong subprocess không network; fixtures là JSON needs từ workflow run thật được lưu nguồn/run attempt, với mutations đặt tên rõ.
- [ ] Chứng minh S04-02/05/06 fail trên logic blacklist hiện tại. Không sửa implementation trước khi lưu expected/actual RED.
- [ ] Kiểm tra harness không tự đánh giá một bản sao logic success-only; oracle độc lập là exit code và expected set.

| ID | Layer / mức độ | Setup và thao tác | Expected / oracle |
|---|---|---|---|
| S04-01 | shell integration / P0 | Needs đủ 13 job success, nguồn capture hợp lệ | Exit 0; từng ID được kiểm tra |
| S04-02 | shell integration / P0 | Mutation một job skipped | Exit != 0; không receipt |
| S04-03 | shell integration / P0 | Lần lượt failure, cancelled, timed_out | Mọi lần exit != 0 |
| S04-04 | unit/contract / P0 | Neutral, unknown hoặc `successful` | Reject exact enum, không substring match |
| S04-05 | shell integration / P0 | Payload rỗng hoặc result rỗng/null | Reject, không vacuous success |
| S04-06 | contract / P0 | Bỏ một job hoặc đổi ID, các job còn lại success | Reject missing expected dependency |
| S04-07 | workflow contract / P0 | Mutation bỏ container-supply-chain khỏi needs | Contract fail theo required set |
| S04-08 | workflow contract / P0 | Mutation bỏ always hoặc thêm bypass failure | Contract fail; summary vẫn phải chạy khi upstream fail |
| S04-09 | matrix integration / P0 | Một Chromium shard fail/cancel, ba shard pass | Aggregate required fail; đối chiếu run jobs API thật |
| S04-10 | workflow contract / P1 | Feature coverage warning thất bại riêng | Không tự biến thành blocker, 13 required vẫn đủ |
| S04-11 | receipt integration / P0 | Summary failed nhưng uploader khác còn chạy | Không tạo Linux passed receipt; diagnostics không phải qualification |
| S04-12 | provenance contract / P0 | Dispatch subject khác workflow commit | Ghi riêng subject checkout và workflow identity; không gán workflow SHA thành tested SHA |

### GREEN tối thiểu

- [ ] Thay blacklist bằng acceptance success-only, validate completeness; giữ dependency graph, name và quyền hiện có.
- [ ] Bổ sung log job ID/result không secrets; failure diagnostics có thể upload nhưng không đồng nghĩa passed receipt.
- [ ] Không chỉnh repository branch protection bằng CLI, không dispatch release. PR của lock-refresh dùng GITHUB_TOKEN không tự kích hoạt CI: prepare-electron thành công không thay full CI.

### Refactor

- [ ] Chỉ tách helper nếu logic không thể test trực tiếp hoặc vượt 200 LOC; không thêm YAML parser dependency nếu repo chưa cần và chưa có duyệt lock resolution.
- [ ] Giữ một nguồn expected required-set có contract chống drift; không thay bằng danh sách generated từ chính needs rồi bỏ kiểm tra completeness.

### Tests After và lệnh dự kiến — KHÔNG chạy trong nhiệm vụ PLAN

```bash
npx vitest run tests/unit/required-checks-summary.test.js tests/unit/container-supply-chain-workflow-contract.test.js
npx eslint tests/unit/required-checks-summary.test.js tests/unit/container-supply-chain-workflow-contract.test.js
npm run lint
npm run build
npm run test
npm run test:coverage
```

`required-checks-summary.test.js` là đường dẫn mới chỉ chạy sau khi tạo ở RED. Full CI còn phải chạy các lane đang khai báo; lint JS không xác nhận YAML/execution GitHub. Build local là smoke artifact, không receipt qualification; full workflow run trên exact source và evidence từng shard mới đóng integration cases. Không gọi `npm run format` vì ghi toàn repo.

## Exit, quyền và rollback

- [ ] Tất cả S04 đạt sau RED thật; focused + lint + build + full gates có log exact SHA hoặc trạng thái blocked kèm lý do.
- [ ] Nếu không có runner/GitHub access: integration blocked, không đánh dấu pass bằng contract test.
- [ ] Thay quyền actions/contents/id-token, PR settings, lock resolution hoặc signing/publish đều phải được duyệt riêng. Không đổi sang PAT/App hay pull_request_target để né hạn chế token.
- [ ] Rollback theo commit hẹp sau review; trong thời gian sự cố giữ release blocked, không quay lại blacklist dễ lọt skipped để lấy green.
- [ ] Handoff phase 05 gồm required-set, case IDs, RED/GREEN logs và điểm provenance còn mở; chưa tuyên bố repository đã được bảo vệ chỉ từ docs.
