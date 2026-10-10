---
title: "Phase 11 — Ranh giới security và deployment hiện hành"
status: pending
priority: P0
dependencies: [phase-01]
---

# Phase 11 — Ranh giới security và deployment hiện hành

## Quyết định phạm vi: không tự mở rộng sản phẩm

Đây là PLAN, chưa chạy lệnh kiểm thử hay sửa runtime/config. Scope hiện hành là **trusted author, private deployment, single operator**, không phải vừa được cấp phép xây authorization/multi-user/untrusted-HTML sandbox. Người dùng yêu cầu giải thích lựa chọn, chưa quyết định mô hình mới. Không tự thêm login/RBAC, tước trusted HTML, CSP sandbox toàn bộ deck, đổi origin hoặc mở public server trong phase này. Vấn đề thực sự phá boundary hiện hành vẫn cần RED và sửa tối thiểu; phát hiện đòi hỏi đổi mô hình phải dừng xin quyết định riêng.

Linux/container và Windows public NSIS + portable là **kênh phân phối**, không có nghĩa server CRUD được phép public unauthenticated. Mọi Authenticode, OfficeCLI, PowerPoint gates giữ nguyên. Không lấy nhu cầu security deployment làm lý do bỏ Windows.

## Scout và inventory đã xác minh nội dung

| File | Dòng / byte | Vai trò và tác động dự kiến |
|---|---:|---|
| `server/index.js` | 580 / 22790 | Ingress trước body/upload; trusted share HTML; chỉ sửa điểm boundary nếu RED chứng minh, không đại refactor |
| `server/middleware/local-mutation-ingress.js` | 129 / 5750 | Host/Origin/trusted proxy policy, không identity/authentication |
| `server/middleware/local-mutation-ingress-app.test.js` | 31 / 1031 | Có deny import và uppercase API; mở rộng side-effect assertions |
| `server/services/listen-host-policy.js` | 23 / 854 | Loopback default, nonloopback warning |
| `shared/src/content-safety.js` | 123 / 3957 | Rich text/Markdown/SVG sanitization khác trusted HTML |
| `docker-compose.yml` | 29 / 751 | Container bind 0.0.0.0, publish host default 127.0.0.1, UID 10001 |
| `tests/unit/security-deployment-boundary.test.js` (đề xuất) | Chưa tồn tại; 120–180 dòng | Contract deployment + documentation boundary |
| `docs/security-deployment-boundary.md` (đề xuất) | Chưa tồn tại; 100–160 dòng | Handoff phase 14: mô hình hiện hành, residual risks và lựa chọn chưa quyết |

Đã tìm thấy test paths `server/middleware/local-mutation-ingress.test.js`, `server/services/listen-host-policy.test.js`, `server/services/svg-upload-sanitizer.test.js`, `shared/tests/content-safety.test.js`: phải đọc/recount khi re-scout trước sửa, không coi tên file là test đã pass. Không sửa các file inventory chỉ vì được liệt kê.

Hiện trạng: ingress áp unsafe methods `/api/`, mặc định missing Origin được phép cho local tooling; Host allowlist và origin same-origin không xác thực người dùng. Trusted proxy dựa remote socket address, không tin mọi forwarded header. Nonloopback chỉ warning. Socket.IO và share GET không tự được bảo vệ bởi middleware mutation. `renderShareView` cố ý giữ HTML programmable, chỉ normalize vài customCSS patterns. Uploaded SVG là untrusted navigable document, có sanitizer và sandbox CSP riêng. Regex sanitization không phải chứng minh sandbox toàn bộ nội dung.

## Threat model và giải thích lựa chọn (không chọn thay người dùng)

| Nguồn/surface | Trust hiện tại | Giới hạn phải nói rõ |
|---|---|---|
| HTML tự viết và chủ động duyệt bởi trusted author | Có thể programmable trong editor/share/export | Có thể chạy code cùng context hiện hành; chỉ dùng nội dung thực sự tin cậy |
| File/deck/template/plugin tải từ ngoài, nội dung AI, paste rich text, upload SVG | Nguồn ngoài không tự trở thành trusted chỉ vì do operator import | Sanitization theo loại và review cần thiết; không hứa chống mọi hostile deck |
| Browser website khác gửi mutation vào local app | Untrusted origin | Ingress chống một lớp CSRF/Host abuse, không identity |
| Process local/khách có network access tới API | Không được chứng minh là user được xác thực | Missing Origin có thể hợp lệ; firewall/private perimeter là điều kiện triển khai |
| Viewer/share/live và external embed URL | Boundary riêng, không blanket trusted author | Share password không bảo vệ toàn bộ CRUD; external content có network/privacy risk |

- **Giữ private single-operator**: phù hợp scope hiện có, giữ trusted HTML; cần loopback/private perimeter, không hứa multi-user isolation.
- **External authenticated reverse proxy**: một lựa chọn triển khai cần thiết kế/approval riêng; phải bảo vệ HTTP, upload, Socket.IO và direct-port bypass, không chỉ UI login. Không tự cấu hình proxy trong PLAN.
- **Untrusted author/content sandbox + authorization**: thay đổi kiến trúc, semantics HTML, storage, credentials, exports và compatibility; cần threat model/ADR và quyết định riêng. Chưa có quyền triển khai hoặc công nhận đây là requirement hiện tại.

## Re-scout và TDD

- [ ] Sau phase 01: đọc lại ingress/listen/app tests, SVG/content tests, HTML renderer và viewer call sites thực tế; trace các entry external content. Ghi HEAD, LOC/bytes và boundary diagram; đọc config chỉ ở mức cần thiết, không chép secrets vào evidence.
- [ ] Kiểm tra deployment actual bind/publish, proxy config do operator cung cấp; không thử mở port public hoặc gọi external URL. Tách risk chưa kiểm chứng khỏi bug đã chứng minh.
- [ ] RED trước: characterization trusted HTML và ingress, sau đó test side effects forbidden trên hostile request. Test failing phải do regression boundary hiện có, không do tự đặt requirement auth mới.
- [ ] GREEN tối thiểu: sửa đúng validation/order/header bug nếu RED có; giữ hành vi trusted HTML và missing-Origin policy đã công bố. Nếu cần quyết định khác, ghi blocked decision thay vì tự đổi default.
- [ ] Refactor chỉ helper liên quan dưới 200 LOC; `server/index.js` đã lớn không phải giấy phép rewrite. Chuyển kết quả docs cho phase 14 trước freeze phase 12.

| ID | Layer / severity | Setup / thao tác | Expected và oracle |
|---|---|---|---|
| S11-01 | unit / P0 | Không explicit/env listen host | Resolve 127.0.0.1, không exposure warning |
| S11-02 | unit / P0 | Explicit 0.0.0.0 | Warning unauthenticated-network-exposure; không diễn giải là auth enabled |
| S11-03 | deployment contract / P0 | Compose mặc định và publish override | Default chỉ publish loopback; override phải được docs ghi exposure risk |
| S11-04 | app integration / P0 | Host/Origin hostile POST import, upload/settings mutation | 403 ingress code; upload/parser/storage spies không side effect |
| S11-05 | app integration / P0 | Uppercase `/API/`, PUT/PATCH/DELETE hostile | Deny consistent theo route family; không bypass casing |
| S11-06 | unit / P0 | Header forwarded giả, socket không trusted | Không lấy forwarded host/proto làm trust |
| S11-07 | unit / P0 | Trusted proxy chính xác + same-origin; rồi malformed/multiple forwarded | Allowed hợp lệ; reject malformed, không broad trust |
| S11-08 | unit / P1 | Local tool không Origin với allowMissingOrigin true/false | true cho next, false 403; không claim có identity |
| S11-09 | rendering regression / P0 | Trusted-author programmable HTML tự tạo, không network | Giữ feature hiện hành ở các surface đã trace; không blanket sanitize |
| S11-10 | content integration / P0 | External SVG có script/event, mở `/uploads/*.svg` | Sanitized + CSP sandbox + nosniff như app contract, không suy ra mọi HTML đã sandbox |
| S11-11 | content unit / P0 | Rich text/Markdown URL javascript/event và URL hợp lệ | Unsafe bị loại theo existing contract; safe formatting/link giữ |
| S11-12 | deployment/manual / P0 | Sơ đồ private perimeter, share/live/socket/direct API | Report từng surface; thiếu proxy/firewall evidence => blocked network qualification, không auth claim |
| S11-13 | documentation contract / P1 | Đọc docs đề xuất và release claims | Phân biệt trusted author/external content/public binaries; authorization decision vẫn pending |

Test malicious content dùng payload local có kiểm soát, không tải hostile Internet. Case S11-09 cần oracle hành vi renderer thực tế sau re-scout, không coi “giữ mọi script trên mọi surface” là yêu cầu mới. Positive deployment evidence lấy từ môi trường thực được duyệt; không dựng báo cáo an toàn tổng quát bằng unit mocks.

## Tests After — lệnh dự kiến, chưa chạy

```bash
npx vitest run server/middleware/local-mutation-ingress.test.js server/middleware/local-mutation-ingress-app.test.js server/services/listen-host-policy.test.js server/services/svg-upload-sanitizer.test.js shared/tests/content-safety.test.js
npx vitest run tests/unit/security-deployment-boundary.test.js
npx eslint server/middleware/local-mutation-ingress.js server/middleware/local-mutation-ingress-app.test.js server/services/listen-host-policy.js tests/unit/security-deployment-boundary.test.js
npm run lint
npm run build
npm run test
npm run test:coverage
npm run test:e2e
```

Test mới chỉ chạy sau RED tạo file. Focused tests chứng minh contract local; E2E/smoke không chứng minh production perimeter hay multi-user security. Full gates dùng isolated temp data, không ghi kho operator. Không chạy `docker compose down -v`, không sửa credentials/privileges. Trước qualification cần kiểm chứng HTTP + socket + ingress trong topology thật, thiếu môi trường => blocked.

## Exit, approval và rollback

- [ ] Cases có evidence hoặc blocked rõ ràng; không mở rộng scope thành auth/sandbox khi chưa quyết định.
- [ ] Giải thích residual risks và external content trust được reviewer/operator xác nhận hiểu, không ép quyết định kiến trúc.
- [ ] Thay bind/publish/firewall/proxy privileges, PR settings, signing và publish đều xin riêng; plan này không cấp phép.
- [ ] Rollback code hẹp sau review, giữ private exposure, snapshot dữ liệu trước execution; không disable ingress/sanitizer để chữa compatibility. Nếu trusted HTML regression, giữ release blocked và sửa case tương ứng.
- [ ] Phase 14 đóng docs boundary trước freeze; phase 12 chỉ qualify current private single-operator scope, không claim public multi-tenant secure.
