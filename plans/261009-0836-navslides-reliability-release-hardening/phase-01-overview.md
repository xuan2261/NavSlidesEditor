---
title: "Phase 01 — Baseline, scope và evidence harness"
status: pending
priority: P1
depends_on: []
---

# Phase 01 — Baseline, môi trường và evidence harness

## Mục tiêu và rescout

Khóa đối tượng kiểm chứng, inventory command thật, môi trường và decision còn mở trước sửa. Không reset/stash/clean các file của người dùng. Baseline planning `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131`, nhánh `main`; CI lịch sử `5e324699…` không phải current evidence.

Đọc lại `CLAUDE.md`, `package.json`, `vitest.config.mjs`, `config/vitest/*`, `playwright.config.js`, `config/release-target-policy.json`, `config/container-vulnerability-policy.json`, workflows và từng phase trước execution. `code_explore` chỉ dùng nếu index có sẵn; thiếu index thì grep/read, không tự tạo dữ liệu vào tree ngoài scope.

## File inventory

| File | Hành động dự kiến | Cỡ thay đổi | Test impact |
|---|---|---|---|
| `package.json`, `vitest.config.mjs`, `config/vitest/*.mjs` | Đọc, xác định focused/full commands | 0 mặc định | Test discovery và project isolation |
| `scripts/vitest/run-vitest-suite.mjs` | Đọc passthrough arguments, inventory refresh | 0 | Không đoán cách lọc test |
| `playwright.config.js` | Đọc server/port/data-dir/browser conditions | 0 | Browser test tránh đụng dữ liệu thật |
| `config/release-target-policy.json` | Đọc gates hiện hành, pin hash | 0 | Release policy source |
| `plans/.../evidence-ledger.md` | Ghi run records trong plan này | 20–80 dòng mỗi batch | Bằng chứng, không snapshot bí mật |
| `tests/ci/evidence-ledger-contract.test.mjs` | **Đề xuất mới**, chỉ thêm nếu xây receipt checker chung sau rescout | 80–150 dòng | Không bắt buộc tạo framework mới chỉ để ghi Markdown |

## Invariants và quyết định trước thi công

- Xác nhận lại trusted author/private single-operator; user chưa chốt câu hỏi trust. Nếu yêu cầu untrusted content: tách ADR/phase origin isolation, không đổi ngầm phạm vi 11.
- Revision Settings được user chọn; API contract migration chi tiết phải review tại 02. Không ép client cũ qua gate mà không có lộ trình.
- Giữ Windows NSIS/portable và mọi Office/signing gate; thiếu certificate/license/runner => blocked.
- Phân biệt source commit, dirty patch digest, workflow revision, artifact digest namespace. Sau sửa trước commit chỉ là local candidate, không phát hành bằng receipt của parent SHA.
- Dùng data dir/temp copy riêng. Backup kiểm tra restore trước test recovery/migration. Không test trên thư mục deck thật.

## Tests Before → GREEN → Refactor → Tests After

1. Chụp `git status --short`, `git rev-parse HEAD`, tool/runtime versions; ghi scope file có sẵn không thuộc phiên.
2. Kiểm tra command thật bằng help/read config. Test install/login khi cần bằng command an toàn thật; lỗi auth/env ghi blocked, không dùng credential phỏng đoán.
3. Chạy nhóm hiện có cho Settings/history/CI verifier làm baseline. Lưu failure nguyên trạng; không sửa ngoài scope để làm sạch số liệu.
4. Nếu thêm checker evidence: RED bằng fixtures sai SHA/digest/missing gate; GREEN validate tối thiểu; Refactor parser không coupling provider; chạy positive và negative. Nếu chỉ dùng ledger thủ công, đánh dấu đây là checklist, không gọi là automated tests.
5. Với application bug, RED cụ thể thuộc phase owner; Phase 01 không sửa ứng dụng.

## Scenario matrix

| ID | Ưu tiên / tầng | Setup | Oracle |
|---|---|---|---|
| S01-01 | P1 / preflight | Tree có untracked file ngoài plan | Nội dung và trạng thái không bị thay đổi |
| S01-02 | P1 / evidence | CI success của SHA cũ | Không gắn passed cho candidate mới |
| S01-03 | P1 / evidence | Working tree dirty trên parent SHA | Receipt ghi patch digest; không coi parent là source mới |
| S01-04 | P1 / environment | Docker/browser/Office thiếu | Gate blocked có lý do, không skip-as-pass |
| S01-05 | P1 / test isolation | Port E2E đang dùng | Dừng xin quyết định, không kill service lạ |
| S01-06 | P1 / storage | Test tạo sửa deck | Chỉ temp data dir bị tác động |
| S01-07 | P1 / secrets | Log Settings/token/signing | Không có secret; chỉ trạng thái redacted |
| S01-08 | P1 / discovery | Thêm test mới vào đúng project | Runner inventory phát hiện file, không 0-test success |
| S01-09 | P1 / provenance | Image registry digest khác config ID | Không so sánh hai namespace như cùng loại |
| S01-10 | P1 / recovery | Backup fixture trước migration | Restore + hash kiểm chứng trước destructive experiment |
| S01-11 | P1 / policy | Chưa xác nhận trust scope | Phase 11 chưa được phép mở rộng claim |
| S01-12 | P1 / harness | RED vì import lỗi thay vì assertion | Bị phân loại harness failure, không chấp nhận RED |

## Lệnh ban đầu

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
npm test -- client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm run lint
```

Lệnh đọc remote an toàn khi cần: `gh run list --commit <candidate-sha> --json databaseId,headSha,conclusion,workflowName`. `<candidate-sha>` là placeholder bắt buộc thay, không copy nguyên. Cài dependency/build/scanner nặng chỉ sau kiểm tra môi trường và lockfile; không chạy qualification ở phase này.

## Tasks và exit

- [ ] Baseline/source/dirty files ghi trong ledger, không thay file ngoài scope.
- [ ] Trust decision được xác nhận hoặc Phase 11 đánh blocked rõ.
- [ ] Existing focused tests được chạy, failures phân loại, tools missing ghi owner.
- [ ] Command catalog và fixture/data isolation được xác nhận.
- [ ] Ready lanes 02/04/06/07 và 11 nếu được chốt.

Rollback: phase này không thay app/data; xóa fixture do phase tạo chỉ sau xác nhận quyền sở hữu. Không xóa untracked artifacts của người dùng.
