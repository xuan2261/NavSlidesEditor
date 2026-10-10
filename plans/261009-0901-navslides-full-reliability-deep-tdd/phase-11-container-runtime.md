---
phase: 11
title: "Container, runtime closure và supply-chain qualification"
status: blocked
priority: P1
effort: ""
dependencies: [4, 5, 10]
---

# Phase 11: Container, runtime closure và supply-chain qualification

## Goal
Có scan/SBOM/runtime evidence của image ứng viên; finding chưa được xử lý không bị hợp thức hóa bằng thay policy.

## Context và bằng chứng
config/container-vulnerability-policy.json fail HIGH/CRITICAL exceptions []; reusable-container-supply-chain.yml:22–32 load actual image, inspect ID, capture browser/SBOM/Trivy rồi verifier. package.json:24–32 runtime closure/receipt và backup commands.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [04](phase-04-ci-required-summary.md), [05](phase-05-scanner-evidence.md), [10](phase-10-pptx-portable.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Verify/Modify if finding | `C:/Work/NavSlidesEditor/Dockerfile` | base/runtime dependency remediation có giới hạn |
| Verify/Modify if finding | `C:/Work/NavSlidesEditor/package-lock.json` | chỉ dependency liên quan finding |
| Verify/Modify if finding | `C:/Work/NavSlidesEditor/electron/server-package-lock.json` | runtime closure tương ứng nếu affected |
| Verify | `C:/Work/NavSlidesEditor/scripts/verify-runtime-closure.js` | production assets/browser closure |
| Verify | `C:/Work/NavSlidesEditor/scripts/runtime-receipt.js` | artifact identity |
| Verify/Modify if RED | `C:/Work/NavSlidesEditor/.github/workflows/reusable-container-supply-chain.yml` | scan output/binding |
| Modify | `C:/Work/NavSlidesEditor/docs/deployment-guide.md` | private boundary/recovery prerequisites |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Build candidate một lần theo workflow existing docker artifact qualification; tải đúng client manifest. Capture Docker image ID, registry digest nếu có, artifact tar SHA, OS package inventory và runtime browser pins.
2. Chạy pinned SBOM/Trivy và verifier phase 05. Triage findings theo package/source/fix version; sửa base/dependency ít nhất cần thiết, rebuild/rescan rồi dùng digest mới. Không giả định 71 finding cũ còn hoặc đã hết.
3. Không tăng severity threshold, ignore-unfixed, global allowlist hoặc bỏ browser binaries để scan xanh nhưng runtime hỏng. Exceptions production cần approval riêng có expiry/owner/exact scope; nếu chưa approved gate blocked.
4. Runtime smoke từ image đã scan: start API, health/assets, headless Chromium render, import fixture và Original/edited export contract, persistent data qua restart. Kiểm tra secret files permissions phù hợp Linux và container user hiện tại.
5. Test backup/restore Docker volume trên volume dùng thử, không down -v production. Private single-operator là operating assumption giữ hiện trạng; không expose Internet hoặc thêm authentication platform ngoài yêu cầu. CORS/Host không được ghi là authorization.
6. Bằng chứng phase này provisional nếu phase 14/15 còn đổi shipped inputs; phase 16 build/qualify final subject lại, không tái dùng receipt sai hash.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P11-01 | C | Actual image digest khác expected | Fail receipt |
| P11-02 | C | New HIGH/CRITICAL unapproved | Release blocked cho đến remediation/authorized policy disposition |
| P11-03 | C | Scanner/SBOM command fail hoặc output invalid | Không passed |
| P11-04 | H | Browser pin/executable thiếu | Runtime/scan binding fail |
| P11-05 | H | Client manifest/assets thiếu hoặc sai hash | Startup/closure fail |
| P11-06 | H | Headless render trong runtime image | PNG thực đúng size/content, không chỉ executable exists |
| P11-07 | H | Import/export và restart persistent volume | Deck/original/media không mất |
| P11-08 | H | Restore isolated backup | Open/export hash đúng; không overwrite source volume |
| P11-09 | H | Image rebuilt sau receipt | Receipt cũ invalidated |
| P11-10 | M | LOW/MEDIUM còn lại | Inventory công khai theo scope; không giả sạch tuyệt đối |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run scripts/verify-container-supply-chain.test.js scripts/verify-runtime-closure.test.js scripts/runtime-receipt.test.js scripts/docker-backup-restore-contract.test.js
npm run build
npm run runtime:verify
```

## Runtime smoke bắt buộc
Dùng đúng commands trong reusable Docker/supply-chain workflows cho image candidate; chạy server và render Chromium trong container. Lưu actual scan/SBOM/receipt/digest, không coi unit fixtures là scan thật.

## Deliverables / checklist
- [ ] 11.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 11.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 11.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 11.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 11.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: exact Linux/container digest-bound scan/SBOM/runtime/permissions/volume restart/backup restore target unavailable. Reduced Alpine schema input không substitute. Xem [execution ledger](evidence-ledger.md#execution-ledger-reconciliation).

## Exit gate
Image đúng digest có SBOM, valid scan, runtime smoke, backup restore proof; policy không bị hạ. Không có finding nghiêm trọng chưa được xử lý đúng thẩm quyền.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Docker/Linux availability là prerequisite. Dependency fix làm artifact đổi thì phải chạy lại relevant qualification, không gắn old image receipt vào new release.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
