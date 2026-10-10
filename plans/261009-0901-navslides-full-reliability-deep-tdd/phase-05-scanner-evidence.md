---
phase: 5
title: "Scanner report: schema và binding evidence"
status: in-progress
priority: P1
effort: ""
dependencies: [1]
---

# Phase 05: Scanner report: schema và binding evidence

## Goal
Phân biệt scan sạch hợp lệ với report thiếu/sai/bị cắt; receipt chỉ phát hành khi scan và inventory thuộc đúng image.

## Context và bằng chứng
scripts/verify-container-supply-chain.js:8–60 có fallback report.Results vắng thành []; lỗi {} đã được người dùng thực thi chứng minh, không chạy lại để xác nhận. reusable-container-supply-chain.yml:30–32 pin Trivy v0.74.0, severity HIGH/CRITICAL, ignore-unfixed false, exit-code 0.

Nguồn scout là đọc mã, không phải test đã chạy. Xem [evidence ledger](evidence-ledger.md) và [TDD/evidence contract](verification-strategy.md). Phụ thuộc: [01](phase-01-start.md).

## File inventory và ownership
Mọi đường dẫn Modify/Verify phải tồn tại ở phase-entry scout; Create là đề xuất chưa được triển khai. Quy mô là vùng thay đổi, không cam kết sửa toàn file. Một owner của phase; các file dùng chung phải tích hợp tuần tự theo [roadmap](plan.md).

| Action | File | Phạm vi / test impact |
|---|---|---|
| Modify | `C:/Work/NavSlidesEditor/scripts/verify-container-supply-chain.js` | schema validation trước flatten findings |
| Modify | `C:/Work/NavSlidesEditor/scripts/verify-container-supply-chain.test.js` | invalid input + genuine clean report |
| Modify | `C:/Work/NavSlidesEditor/.github/workflows/reusable-container-supply-chain.yml` | scanner metadata/binding nếu report không đủ |
| Create | `C:/Work/NavSlidesEditor/scripts/fixtures/trivy-v0.74.0-clean.json` | fixture rút gọn từ output thật có provenance |
| Create | `C:/Work/NavSlidesEditor/scripts/fixtures/trivy-v0.74.0-findings.json` | fixture scan thật sanitize |

## Tests Before — RED hoặc characterization
- Rescout source, reference/caller list, fixture isolation và test inclusion trước sửa. LSP references cho exported symbols nếu có; không dùng line number lịch sử như contract.
- Chạy focused suite hiện có. Với regression mới, thêm case C/H trong matrix trước code và ghi failure đúng observable oracle. Setup/import/tool failure không là RED.
- Hành vi đã có và đúng: giữ GREEN characterization, chỉ thêm scenario thiếu. Không cố làm production code hỏng để tạo RED.
- Barriers/deferred promises/fault markers điều khiển ordering; không flaky sleep. State/content/digests/HTTP semantics là oracle, không mock echo, wording hoặc count đơn thuần.

## Architecture và implementation steps
1. Lấy output clean và finding từ đúng pinned scanner trên disposable images. Đối chiếu SchemaVersion, ArtifactName/Type, Metadata.ImageID/RepoDigests và result types thực tế; ghi scanner version/command/database identity. Không đoán schema từ mock cũ.
2. Validate top-level object, supported schema, artifact kind, Results array và từng record. Vulnerabilities có thể absent trên result hợp lệ sạch; nếu present phải array và từng finding có identity/package/severity đúng schema. Unknown/malformed severity không được lọt bằng includes.
3. Bắt buộc result coverage theo scan target: image Linux này phải có OS/package scope phù hợp với metadata/SBOM. Results=[] chỉ hợp lệ nếu pinned scanner contract và image type chứng minh thực sự không có target cần scan; với NavSlides image có OS/packages thì fail. Không dùng mỗi length > 0 làm bằng chứng completeness.
4. Bind report image identity và invocation receipt với actual Docker image ID, expected image ID, SBOM/browser inventories. Phân biệt Docker config/image ID với registry manifest digest; không so sánh hai loại digest như cùng một thứ. Nếu tool không emit đủ metadata, capture wrapper evidence từ workflow; không tin self-declared report field là attestation.
5. Giữ policy HIGH/CRITICAL và exceptions hiện đang rỗng. Exception test dùng fixture test-only có owner/reason/expiry/CVE/package đúng; không thêm exception production để sửa test. Invalid JSON/file missing/scan error không tạo passed receipt.
6. CLI receipt chỉ ghi sau validate toàn bộ, kèm hashes input/policy/scanner metadata; lỗi giữ raw scan artifact để triage, không overwrite receipt cũ như passed. Update consumer tests nếu schema receipt thay.

## Test matrix
C = critical dữ liệu/gate; H = high; M = medium. Đây là scenario được lập kế hoạch, **không phải test đã chạy**. Tái sử dụng test đã bao phủ; không tăng số test bằng sao chép.

| ID | Risk | Tình huống / setup | Oracle pass/fail |
|---|---|---|---|
| P05-01 | C | report {} / null / [] / missing Results | Reject trước cấp receipt |
| P05-02 | C | Results sai kiểu hoặc record null | Reject, không treat clean |
| P05-03 | C | Genuine clean result không có Vulnerabilities | Pass khi scope/identity đầy đủ |
| P05-04 | C | Image OS/package inventory nhưng Results=[] | Reject incomplete evidence |
| P05-05 | H | Vulnerabilities object/string/null | Reject, không bỏ qua |
| P05-06 | H | Finding severity missing/lowercase/unknown | Reject hoặc normalize theo pinned schema rõ ràng; không bypass |
| P05-07 | H | Unapproved HIGH/CRITICAL | Fail kể cả unfixed |
| P05-08 | H | Exception expired/wrong package/wrong CVE | Fail; exact unexpired test fixture pass |
| P05-09 | H | Report target/image identity mismatch | Fail dù findings 0 |
| P05-10 | H | Scanner lỗi/truncated JSON nhưng file tồn tại | Fail, không passed receipt |
| P05-11 | H | SBOM/browser revision mismatch | Fail giữ existing invariants |
| P05-12 | M | LOW/MEDIUM report hợp lệ | Theo policy không tự nâng severity gate |
| P05-13 | H | Schema version mới không hỗ trợ | Fail với diagnostic cần cập nhật adapter |
| P05-14 | M | Duplicate results/findings | Count deterministic, không xóa severe finding |

## Refactor
Sau GREEN, chỉ giản lược owner vừa sửa và loại obsolete path do cutover. Giữ existing patterns; không thêm abstraction/service chưa cần. Không đổi oracle để khớp behavior lỗi. Chỉ thêm permanent regression khi bảo vệ consumer-visible invariant trong matrix.

## Tests After và regression gate
Commands chạy từ `C:/Work/NavSlidesEditor`, bằng dependencies đã pin. Command nhắm Create file chỉ chạy **sau khi file/test tồn tại**; trước đó chạy existing focused subset. Chạy inventory để bảo đảm file mới không bị bỏ bởi Vitest project hoặc Playwright testMatch; không dùng passWithNoTests. Build/E2E cần prerequisites trong verification-strategy.md.

```sh
npx vitest run scripts/verify-container-supply-chain.test.js
```

## Runtime smoke bắt buộc
Chạy pinned Trivy trên image candidate ở phase 11 rồi CLI verifier bằng chính workflow argv. Trong phase này chạy CLI với clean fixture provenance thật và malformed fixture, quan sát exit và không có success receipt khi invalid.

## Deliverables / checklist
- [ ] 05.1 Chốt phase-entry evidence, callers, môi trường và baseline.
- [ ] 05.2 Viết/reuse matrix regression trước thay behavior; lưu RED hoặc existing-GREEN đúng nguyên nhân.
- [ ] 05.3 Hoàn thành implementation/verification steps; không hạ policy hoặc bỏ invariant.
- [ ] 05.4 Focused regression và runtime smoke đạt, receipt gắn SHA/artifact/fixture identity.
- [ ] 05.5 Cập nhật tài liệu/changelog cho thay đổi permanent, giữ limits; không mark code fix khi chỉ verification.

Execution: genuine reduced Alpine scanner CLI passed; exact candidate-image scan/SBOM/browser inventory/attestation gate còn mở. Xem provenance/limits và final P05 matrix gap trong [execution ledger](evidence-ledger.md#execution-ledger-reconciliation).

## Exit gate
Các negative cases fail-closed; genuine clean scan pass. Không quảng bá số findings hiện tại trước actual scan; 71 trong attachment vẫn chỉ lịch sử.

Đóng phase bằng command/exit/output paths và scenario IDs trong reports; `not-run`, `blocked`, `skipped` không là `passed`. Phase verification/no-change vẫn cần observable proof, không đánh completed chỉ vì không sửa code.

## Risks, security và Failure Protocol
Schema pin là contract scanner cụ thể, không generic validator. Scan coverage/DB freshness phải được ghi, scan file tự nó không chứng minh binary scanner đáng tin.

Nếu oracle fail: giữ evidence/fixture, dừng dependent phase, xác định root cause; không auto retry conflict hoặc dùng fallback để biến lỗi thành success. Nếu thiếu prerequisite external: hoàn thành phần độc lập, ghi exact missing capability/owner và giữ gate blocked. Fault cleanup chỉ ở temp roots; không đụng dữ liệu người dùng. Secrets/plaintext API key/capabilities không vào receipt. Mọi thay đổi yêu cầu publish/quyền/ký số phải theo authorization riêng.
