# Verification strategy — quy tắc áp dụng cho cả 14 phase

## 1. Ba loại bằng chứng khác nhau

- **Behavior tests:** unit/integration/E2E chứng minh invariant tại fixture xác định.
- **Qualification:** môi trường/thực thể thật (container, Windows, Office, chữ ký) với artifact/source chain cụ thể.
- **Review/checklist:** xét policy, giấy phép, approved risk, thao tác quyền; không gắn nhãn automated test.

Scenario IDs `S01-01`… thuộc phase, không phải tên test đã tồn tại hoặc số tests pass. Khi triển khai, lập mapping ID → file/test name → command → result. Parameterized cases có thể nhiều hơn số IDs. Không cố tăng số test bằng assertion trùng lặp.

## 2. TDD cycle

| Bước | Bắt buộc lưu | Không chấp nhận |
|---|---|---|
| RED | Assertion fail đúng invariant, test name, command, source/patch identity | Không cài dependency, import lỗi, 0 test, port conflict |
| GREEN | Cùng test vượt sau sửa nhỏ nhất + negative control | Xóa expectation hoặc đổi fixture để né bug |
| REFACTOR | Contract không đổi, suite liên quan vẫn vượt | Chia file máy móc, viết lại owner không cần thiết |
| CLOSURE | Focused + adjacent suites + lint/build thích hợp, receipt | Chỉ một unit test để chứng minh toàn lifecycle |

Với bản sửa đã tồn tại (history), characterization GREEN + adversarial cases là đúng. Không bắt tạo regression production để có RED. TDD không tự chứng minh PowerPoint fidelity.

## 3. Tầng test và fixture

- Unit: pure merge/revision/report schema/digest/state transitions; fixed clock/seed.
- Integration: router + real temp filesystem, actual lock helper; deterministic deferred barriers, không dựa `sleep` may rủi.
- Crash/restart: child process kết thúc tại durable boundary, restart đọc disk; mock exception không thay được kill/restart.
- Browser: network delay/ordering, nhiều tab, actual keyboard/focus, dirty UI, Canvas selection, drag/drop. Test rich text tách browser undo khỏi document history.
- Visual: Linux baseline pinned font/browser, không cập nhật baseline hàng loạt để bỏ diff.
- PPTX: adversarial ZIP/authority/outbox/restore fixtures, original SHA-256 và semantic assertions; strict corpus + Office evidence là lane riêng.
- Performance: cùng hardware/runtime/browser, warm/cold runs, fixture hash/seed, p50/p95/số mẫu và peak memory. Threshold sơ bộ cần baseline và phê duyệt trước optimization; không lấy k6 thay UI benchmark.
- Security: scan output sạch/hỏng/có finding từ tool version pin; valid zero finding không đồng nghĩa Results field có mọi list con; ghi actual scanner status và artifact target.

## 4. Command catalog và cách thêm test

Repo dùng `npm test -- <file...>` qua `scripts/vitest/run-vitest-suite.mjs`; runner refresh inventory và dispatch project theo cấu hình. Đọc lại trước chạy. Khi thêm file mới, kiểm tra inventory phân đúng node-serial/node-parallel/client-jsdom; không trực tiếp giả định Vitest discover nếu test được allowlist.

```bash
npm test -- client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm test
npm run test:coverage
npm run lint
npm run build
```

Mỗi phase cung cấp focused commands cho file hiện có hoặc đề xuất mới. Command trỏ file **đề xuất** chỉ được chạy sau khi tạo; không coi error missing file là RED. Release scripts phải rescout `package.json` và `--help` trước thực thi. Browser suite đọc `playwright.config.js`, pin test-specific data dir; không tự chiếm port hoặc reuse server người dùng.

Chạy một vòng kiểm tra đủ sau cụm sửa liên quan; không chạy full suite sau mỗi edit nhỏ. CI final trên candidate frozen cần lint/unit/coverage/E2E/visual/load/container và policy hiện hành. App không đổi (docs-only) không bắt chạy full suite, chỉ link/content checks; không lẫn điều này với gate release cuối.

## 5. Coverage và negative coverage

Coverage tổng không thay invariant. Duy trì thresholds hiện hành, thêm branch cases cho conflict/missing report/cleanup failure/skipped job. Critical guard nên có negative control hoặc mutation có giới hạn trong test harness; không dùng mutation để sửa source production ngoài scope. Reviewer xác nhận test fail nếu loại bỏ guard tương ứng.

## 6. Concurrency, flaky tests và cleanup

Mỗi run có temp root, request IDs, owner token và ports riêng. Barriers chỉ mở sau assertion trạng thái; mọi hook fault injection test-only không được lộ API production. Tối thiểu hai thứ tự A→B/B→A, cùng-key và khác-key, stale/fresh retry. Nếu test flaky: giữ artifact/seed, sửa determinism; không thêm retry blanket để xanh. Cleanup chỉ xóa tài nguyên do test/run sở hữu. Windows locked-file behavior phải có lane thật khi cần, không gọi Linux mock là Windows qualification.

## 7. Exit/blocked/rollback

- `passed`: có artifact/log đúng inputs.
- `failed`: assertion/gate không đạt.
- `blocked`: thiếu môi trường/quyền/tool/decision; người chịu trách nhiệm + việc mở khóa.
- `not-run`: chưa chạy.
- `waived`: chỉ khi policy cho phép và người có thẩm quyền phê duyệt có hạn dùng; không tự chuyển required gate sang waiver.

Rollback với format/schema mới cần compatibility proof/backup restore; không chỉ `git revert`. Quay lại phiên bản không đọc được journal/archive/revision mới phải dừng, không boot mặc nhiên và bỏ dữ liệu. Release publish là thao tác riêng sau approval, không thuộc mặc định test closure.
