---
title: "NavSlidesEditor: reliability, PPTX lifecycle và release hardening"
description: "Deep TDD plan từ review, không phải chứng nhận triển khai hoặc phát hành"
status: pending
priority: P1
effort: "25–45 engineer-days, ước lượng ban đầu; không bao gồm chờ môi trường/ký số"
branch: main
tags: [deep, tdd, reliability, pptx, security, release]
created: 2026-10-09
---

# NavSlidesEditor: reliability, PPTX lifecycle và release hardening

## 1. Outcome và baseline

Hoàn thành toàn bộ lộ trình review: tính đúng đắn Settings/history, gate CI/bảo mật, contract PPTX, qualification Linux/Windows, hiệu năng có số đo và tài liệu đúng nguồn. Đây là **kế hoạch**, không phải bằng chứng các test/gate đã chạy.

- Baseline local: `main`, `aa19b59cd5bd5de2510f9bc4edd2ef2311ce9131`; lịch sử CI: `5e324699318da8cd2950e80f6a2d0057cd3d7d33`, run `36756667471`. Không chuyển kết quả giữa hai SHA.
- User xác nhận: bảo vệ Settings cả server lẫn nhiều tab bằng revision/precondition; giữ release policy hiện tại Linux/container + Windows NSIS/portable và gate ký số/Office/PowerPoint.
- Trust scope chưa được user chốt sau yêu cầu giải thích: **tạm giữ mô hình hiện có private single-operator + trusted author content, không bổ sung untrusted-content isolation**. Phase 01 phải xác nhận trước Phase 11; không coi im lặng là đồng ý.
- Không đổi policy để né gate; không tự thay quyền GitHub, cấp secret, public exposure, ký/publish release. Các thao tác đó cần phê duyệt riêng.
- Không microservices, không rewrite TypeScript toàn bộ, không mặc định virtualize, không hứa PowerPoint 100%, không sửa lại lỗi history cũ đã được sửa nếu test không chứng minh regression.

## 2. Phases và đồ thị phụ thuộc

Tất cả trạng thái dưới đây là trạng thái **triển khai**, chưa bắt đầu.

| ID | Phase / tài liệu | Phụ thuộc | Ưu tiên | Công sức dự kiến | Trạng thái |
|---|---|---|---|---|---|
| 01 | [Baseline, môi trường, evidence](phase-01-overview.md) | — | P1 | 1–2 ngày | pending |
| 02 | [Settings atomic + revisions](phase-02-settings-atomic-revisions.md) | 01 | P1 | 2–3 ngày | pending |
| 03 | [Settings UI + conflict UX](phase-03-settings-ui-conflicts.md) | 02 | P1 | 1–2 ngày | pending |
| 04 | [Required checks success-only](phase-04-ci-required-checks.md) | 01 | P1 | 0,5–1 ngày | pending |
| 05 | [Supply-chain evidence + CVE triage](phase-05-supply-chain-evidence.md) | 04 | P1 | 1,5–3 ngày | pending |
| 06 | [History regression verification](phase-06-history-regression.md) | 01 | P1 | 1–2 ngày | pending |
| 07 | [PPTX publication và template](phase-07-pptx-publication.md) | 01 | P1; P0 nếu xác nhận mất dữ liệu | 2–4 ngày | pending |
| 08 | [PPTX concurrency + outbox](phase-08-pptx-concurrency.md) | 07 | P1 | 2–4 ngày | pending |
| 09 | [PPTX recovery + quarantine](phase-09-pptx-recovery.md) | 08 | P1 | 2–4 ngày | pending |
| 10 | [Portable authority archive](phase-10-pptx-portable-archive.md) | 09 | P1 | 2–4 ngày | pending |
| 11 | [Security/deployment boundary](phase-11-security-deployment.md) | 01 + scope confirmation | P1 | 1–2 ngày | pending |
| 13 | [Performance + modularity](phase-13-performance-modularity.md) | 06,07; phối hợp 08–10 | P2 | 3–5 ngày | pending |
| 14 | [Documentation + closeout chuẩn bị](phase-14-documentation-closeout.md) | 02–11,13 | P2 | 1–2 ngày | pending |
| 12 | [Release qualification cuối cùng](phase-12-release-qualification.md) | 02–11,13,14 | P1 | 3–5 ngày + chờ bên ngoài | pending |

**Phase 12 chạy cuối dù số thứ tự nhỏ hơn 13/14.** Phase 14 chuẩn bị release docs và ghi gate `pending`; chỉ Phase 12 bổ sung bằng chứng run cuối. Không tạo vòng phụ thuộc.

Các lane song song sau 01: A `02→03`; B `04→05`; C `06`; D `07→08→09→10`; E `11`. Phase 13 benchmark ban đầu có thể thu thập sớm nhưng thay đổi package owner tránh đụng D. Một integration owner kiểm tra DTO/API và test inventory chung. Không chạy nhiều test job dùng chung data dir/port. Ước lượng là planning range, không cam kết lịch; tái ước lượng sau 01 và 07.

## 3. TDD và evidence bắt buộc

Xem [quy trình kiểm thử chung](verification-strategy.md), [decision log](decisions-and-risks.md), [release evidence ledger](evidence-ledger.md), [kết quả review kế hoạch](review-report.md).

1. Rescout file/test/config trước sửa; không dùng line number lịch sử làm contract.
2. Với lỗi mới: RED bằng assertion lỗi hành vi đúng nguyên nhân; lỗi import/môi trường không phải RED hợp lệ.
3. GREEN bằng sửa nhỏ nhất; test không thay oracle để hợp code lỗi.
4. REFACTOR giữ invariant; chạy focused suite sau cụm thay đổi, lint/build và suite liên quan trước đóng phase.
5. Chức năng đã đúng (history/protections PPTX) được characterization GREEN; thêm test đối nghịch để chứng minh guard, không cố làm production hỏng để tạo RED.
6. Lưu command/exit/SHA/runtime/fixture hash/receipt. `blocked`, `skipped`, `waived`, `not-run` không phải `passed`.
7. Mỗi phase có Tests Before / Refactor / Tests After, scenario ID và oracle; một ID có thể triển khai thành nhiều test case parameterized. Số scenario không phải số tests đã chạy.

## 4. Exit toàn chương trình

- [ ] Settings atomic, stale client bị từ chối, request đang chờ không mất form edit; API key không rò rỉ.
- [ ] Required jobs success-only; report scanner hỏng/không phù hợp bị từ chối; finding được sửa hoặc xử lý đúng policy có thẩm quyền.
- [ ] History regression và dirty/autosave invariants được chứng minh đúng revision.
- [ ] PPTX publication/concurrency/recovery/portable invariants có deterministic fault/crash evidence và giữ original bytes.
- [ ] Security scope được xác nhận; triển khai private không vô tình public; không tuyên bố cô lập untrusted content khi chưa làm.
- [ ] Hiệu năng có baseline và kết quả cùng môi trường; refactor/type checks chỉ ở contract hữu ích.
- [ ] Docs lấy đúng executable owners và phân biệt historic/current evidence.
- [ ] Full test/CI + Linux/container + Windows/Office/signing gates đạt trên source/artifact đúng; publication có approval riêng.

Nếu qualification thiếu môi trường: bàn giao trạng thái **implementation verified / release blocked**, không đánh dấu toàn chương trình completed.

## 5. Cách bắt đầu

Bắt đầu Phase 01; chốt scope trust, snapshot baseline và available tools, sau đó mở đợt đầu gồm 02,03,04,05,06. Đóng từng phase bằng receipt trước khi chạy migration hoặc qualification nặng. Không triển khai từ bản tóm tắt chat thay cho file phase và decision log.
