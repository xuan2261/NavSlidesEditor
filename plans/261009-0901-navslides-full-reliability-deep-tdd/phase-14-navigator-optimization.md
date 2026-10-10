---
phase: 14
title: "Navigator optimization có điều kiện và accessibility"
status: "blocked: controlled-environment performance qualification required"
priority: P2
effort: ""
dependencies: [13]
---

# Phase 14: Navigator optimization có điều kiện và accessibility

## Goal
Giảm bottleneck đã đo mà không phá focus, DnD, multiselect, children hoặc history.

## Context và bằng chứng
SlidePanel.jsx:60–68 focus refs yêu cầu mounted item; :85–87 DnD index-based, nên virtualization không thể chỉ thay map bằng window. Phase 13 là authority chọn giải pháp.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [13](phase-13-navigator-baseline.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify only if measured | `C:/Work/NavSlidesEditor/client/src/components/SlidePanel.jsx` | memoization/lazy preview/windowing tối thiểu |
| Modify only if measured | `C:/Work/NavSlidesEditor/client/src/components/slide-panel/slide-navigator-item.jsx` | stable props/preview costs |
| Modify | `C:/Work/NavSlidesEditor/client/src/components/SlidePanel.test.jsx` | offscreen selection/focus invariants |
| Modify | `C:/Work/NavSlidesEditor/tests/e2e/navigator-performance.spec.js` | before-after same fixture |
| Modify | `C:/Work/NavSlidesEditor/tests/e2e/slide-management-modal-and-multiselect.spec.js` | offscreen multi/DnD regression |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Decision gate: nếu baseline đạt frozen budget, ghi no-change và vẫn chạy navigation smoke. Nếu fail, optimize hot path nhỏ nhất: stable callbacks/props, thumbnail memoization/lazy preview trước khi windowing.
2. Nếu DOM/windowing là bottleneck đã chứng minh, flatten stable parent/child identities với index mapping; preserve selected/current/focused state ngoài mounted window. Scroll-to-item rồi focus sau mount, pin drag target/focus item khi cần.
3. DnD phải hỗ trợ offscreen/autoscroll và translate visible index→logical index. Children row heights, keyboard ordering, context-menu anchor/focus restoration không được dựa vào DOM nodes luôn có.
4. Không thêm caching thumbnail không có invalidation cho layout/master/token/content/size. Bounded cache nếu dùng; verify edits cập nhật preview ngay.
5. Rerun cùng baseline conditions trên candidate; báo distributions và paired ratios, không chọn best run. Nếu giảm DOM nhưng input/open/drop/focus regress thì revert optimization, không hạ acceptance.
6. Chạy history/autosave focused regression vì selection lifecycle có thể đổi. Không làm modularity/TypeScript rewrite ngoài hot path đo được.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P14-01 | C | Focus next/Home/End tới offscreen item | Scroll/mount/focus đúng stable ID |
| P14-02 | C | Drag across window boundary | Order persisted đúng, không duplicate/lost slides |
| P14-03 | H | Selected offscreen rồi bulk delete/duplicate | Đúng IDs, không visible-only action |
| P14-04 | H | Current parent/child scrolled out/in | Không reset selection/caret/history |
| P14-05 | H | Context menu item unmount/reorder | Action/focus đúng item, không stale index |
| P14-06 | H | Master/token/content/size change | Preview invalidates đúng |
| P14-07 | H | Long scroll qua toàn deck | Không growing leak/cache unbounded |
| P14-08 | H | Keyboard-only và accessible names/order | Không missing offscreen navigation contract |
| P14-09 | H | Performance cùng fixtures/hardware | Đạt frozen budget và mục tiêu bottleneck đã chọn |
| P14-10 | M | Baseline đã đạt budget | No-change decision có proof, không unnecessary optimization |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run client/src/components/SlidePanel.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm run build
npx playwright test tests/e2e/navigator-performance.spec.js --project=chromium --workers=1 --retries=0
npx playwright test tests/e2e/slide-management-modal-and-multiselect.spec.js tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium
```

Chạy hai lệnh Playwright tuần tự; measurement riêng cùng worker/retry policy baseline. Không benchmark cùng functional load hoặc bỏ failed timing samples.

## Runtime smoke bắt buộc
Browser production: scroll full 300+children deck, keyboard first/last, drag across offscreen, edit master preview và reload. Record before-after và visually inspect focus/menu/children.

## Deliverables / checklist
- [x] 14.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [x] 14.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 14.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 14.4 Focused regression và runtime smoke đạt trên current inputs; performance gate của `reports/navigator-candidate.json` còn blocked.
- [x] 14.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: Render memoization và stable callback delegators đã được triển khai; không dùng virtualization để giữ focus, DnD, multiselect và accessibility contracts. [Candidate receipt](reports/navigator-candidate.json) có samples nhưng `summary.stable=false`, `summary.withinBudget=false`, `comparison.passed=false`; decision của oracle là `phase14 blocked`. Hai paired scroll ratios vượt cap nhưng noise không hợp lệ, nên không kết luận stable regression hoặc qualified improvement. Giữ nguyên frozen budgets; cần đo lại trong môi trường được kiểm soát trên current source/artifact trước khi đóng phase. Functional receipts lịch sử không thay performance qualification.

## Exit gate
Measured improvement cho bottleneck hoặc justified no-change; C/H interactions không regress, no accessibility regression. Budget không đổi để hợp kết quả.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Windowing có thể tăng complexity nhiều hơn lợi ích; chọn lazy preview/memoization nếu đủ. Nếu không đạt, giữ phase pending thay vì ship regression.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
