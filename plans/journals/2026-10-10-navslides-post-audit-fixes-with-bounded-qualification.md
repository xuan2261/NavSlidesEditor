---
title: NavSlides post-audit fixes with bounded qualification
date: 2026-10-10
summary: Nine findings repaired; source-matched affected tests and native smokes passed; release qualification remains blocked.
---

# NavSlides post-audit fixes with bounded qualification

## Kết quả

Đã sửa chín findings sau audit plan NavSlides reliability. Giữ RED sản phẩm riêng với lỗi harness; 16 assertions RED quan sát được. GREEN trên 19 file: 222 tests passed, 0 failed; source/config/harness identity trước và sau khớp.

## Root causes và quyết định

- Restore thay global epoch: republish mọi compatibility head bị invalidation, không làm biến mất deck khác.
- No-op edited export: giữ authority Original/Rn qua reopen, replay và portable replacement, thay vì coi journal record no-op là revision được validation.
- Portable replacement: sidecar theo active Original; template giữ metadata riêng.
- Startup: expire pending admissions bằng session-lock/ownership recovery trước readiness; ownership không chắc chắn vẫn degraded.
- Settings: bỏ obsolete StrictMode GET completion; nhả shortcut recording trước dialog; dirty status theo baseline sau reload.
- Linux/Windows receipt: clientSubject theo SHA string thực từ producer; từ chối object shape trước receipt output.
- Evidence: phase 14 và final qualification không được đóng bằng stale/failed-budget receipts.

## Kiểm chứng

- Native package/HTTP smoke: restore A không ẩn B, Original download/reopen, no-op export replay và portable replace giữ template.
- Browser thật: StrictMode cancellation, revision conflict, recording → discard Tab/Escape, Save/revert/reload và persistence; tab/service/root test đã đóng và xóa.
- CLI Linux/Windows thật được chạy với upstream inputs synthetic; không phải physical Office, scanner hoặc signing evidence.
- Client build, docs build và machine facts passed. Inventory 672 files, exact lane union true; không phải full-suite run. Lint 21 affected files: 0 errors, 4 warnings.
- Đã cập nhật docs/changelog/plan; xóa bốn throwaway audit-fixes scripts do phiên này tạo.

Canonical evidence: [final-evidence.json](../261009-0901-navslides-full-reliability-deep-tdd/reports/final-evidence.json), [GREEN](../261009-0901-navslides-full-reliability-deep-tdd/reports/audit-fixes-green.json), [identity](../261009-0901-navslides-full-reliability-deep-tdd/reports/audit-fixes-green-identity.json).

## Gate còn mở

Current full-suite/E2E and controlled navigator performance qualification; exact-subject hosted GitHub CI; physical Linux/container runtime, scan and permissions; physical Windows/PowerPoint and Authenticode signing; explicit publish authorization. Không commit/push/tag/publish và không chứng nhận toàn bộ 16 phases.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
