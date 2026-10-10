# Decisions và risks

## Quyết định / cần phê duyệt

| ID | Trạng thái | Quyết định | Owner / điểm chốt |
|---|---|---|---|
| D01 | User confirmed | Settings chống stale nhiều tab bằng revision/precondition, không chỉ atomic write | Phase 02 contract review |
| D02 | User confirmed | Giữ Linux/container + Windows public NSIS/portable; Office/PowerPoint/signing không bỏ | Phase 12 |
| D03 | Open | Trust scope: user yêu cầu giải thích; đã giải thích, chưa có xác nhận cuối | User trước Phase 11; tạm chỉ mô tả hiện trạng trusted author, không mở claim |
| D04 | Proposed | Settings revision opaque, không dùng hash secret làm public ETag; API key response masked riêng | Phase 02/03; một contract owner |
| D05 | Proposed | Strict conditional-write rollout all first-party callers cùng đợt; legacy missing precondition phải báo upgrade/reload, không bypass ngầm | Phase 02; cần compatibility inventory trước chốt status/header |
| D06 | Proposed | Benchmark rồi mới quyết định virtualization/cache/patch history | Phase 13, budget được phê duyệt sau baseline |
| D07 | Approval required | Thay GitHub Actions PR permission, signing keys, release publish hoặc public network | User/repository admin trước từng effect |
| D08 | Proposed | Schema/journal/archive mới phải có migration/rollback compatibility proof | Phase 07–10; không downgrade mù |
| D09 | Confirmed scope | Chỉ lập kế hoạch trong phiên này; mọi phase implementation pending | Toàn bộ plan |

## Risk register

| Risk | Tác động | Mitigation / trigger dừng |
|---|---|---|
| Dùng CI cũ hoặc parent SHA cho dirty candidate | Chứng nhận nhầm code | Evidence ledger source+patch+workflow+artifact identity; requalify frozen SHA |
| Atomic Settings không ngăn stale full payload | Lost update | Revision compare bên trong cùng lock; inventory mọi writer |
| Client cũ bypass revision | Contract chỉ đúng ở UI mới | Cutover có lỗi rõ/upgrade; compatibility không đồng nghĩa unsafe fallback |
| Request Save response đè edit mới | Mất thao tác UI | Sent revision/draft revision tách biệt, conflict giữ local draft |
| Revision/receipt rò API key | Secret exposure | Opaque metadata; redaction log/fixtures |
| Trivy empty schema báo sạch | False security pass | Real fixtures schema/tool/status/target validation |
| Khóa toàn package store quá rộng | Throughput/deadlock | Owner-specific lock order, deterministic concurrency tests |
| Loser cleanup xóa winner | Mất package authority | Destination identity/ownership CAS và failure receipts |
| Crash sau commit trước outbox ack | Duplicate/inconsistent visibility | Durable idempotency, restart reconciliation |
| Journal mới không đọc được sau rollback | Mất recovery ownership | Versioning + backup restore rehearsal; block incompatible downgrade |
| Portable archive thiếu reachable object | Restore trông thành công nhưng mất authority | Reachability+hash+strict restore independent of compat JSON |
| Finding có patch nhưng dependency bump làm hỏng export | Security fix gây regression | Targeted upgrades, lock integrity, export and runtime closure tests |
| Windows/Office/cert chưa có | Không release được theo policy | Ghi blocked; phân công cung cấp môi trường, không bỏ gate |
| Virtualization làm mất focus/drop target | UX regression | Browser keyboard/drag/subslide/multiselect tests; feature rollback |
| Benchmark nhiễu/threshold tùy ý | Tối ưu sai mục tiêu | Controlled repeated runs, raw evidence, budget approval |
| Documents khẳng định gate chưa chạy đã pass | Sai thông tin release | Phase14 pending placeholders; Phase12 addendum từ ledger |
| Đụng file người dùng/agent khác | Mất việc ngoài scope | Explicit write scopes, rescout status, không stage/clean hàng loạt |

## Điều kiện mở rộng scope

Nếu D03 chuyển sang nhận nội dung không tin cậy, dừng việc đưa claim bảo mật vào Phase 11/14 và bổ sung thiết kế riêng: isolated origin, network/capability policy, editor messaging, import/template trust classification, Electron boundary và tests. Không giải quyết bằng đổi iframe sandbox string đơn lẻ. Multi-tenant auth/authorization vẫn ngoài phạm vi nếu chưa được yêu cầu.

Nếu Phase 07 xác nhận đường đi mất dữ liệu/không đọc được original, nâng issue cụ thể lên P0 với reproduction; không tự nâng mọi tài liệu gap lên P0.
