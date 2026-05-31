# Kiến trúc

Bản đồ tổng quan về cách NavSlides Editor được lắp ráp. Để tham khảo đầy đủ phần nội bộ, xem [`docs/system-architecture.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/system-architecture.md) trong repository.

## Monorepo nhìn thoáng qua

NavSlides Editor là một monorepo dạng npm-workspace với bốn package:

| Workspace | Vai trò |
|---|---|
| `client` | Ứng dụng single-page React + Vite; giao diện trình soạn thảo. Build ra `client/dist/` cho môi trường production. |
| `server` | Express REST API + Socket.IO; phục vụ client đã build và lưu dữ liệu dưới dạng các file JSON. |
| `shared` | Các tiện ích Node.js thuần được dùng bởi **cả** client lẫn server (tạo HTML, hình khối, helper màu sắc/văn bản). |
| `electron` | Vỏ desktop nhúng server để có một ứng dụng offline, không cần Docker. |

`shared` được tiêu thụ bởi `client` (lúc Vite build) và `server` (lúc runtime) thông qua liên kết tượng trưng (symlink) của npm-workspace, nên cùng một logic không bao giờ bị trùng lặp.

## Luồng dữ liệu cốt lõi

Quy trình xuất là trái tim của ứng dụng:

```
presentation JSON  →  shared/src/htmlGenerator.js  →  reveal.js HTML
```

`htmlGenerator.js` duyệt qua các slide và phần tử của bài trình chiếu rồi ủy thác việc tạo markup cho từng phần tử sang `shared/src/element-renderers.js`. Cùng một bộ tạo này vận hành cho xuất offline, xuất PPTX, phục vụ liên kết chia sẻ và đẩy lên GitHub — một nguồn chân lý duy nhất cho "JSON → HTML".

## Trình chiếu trực tiếp

Việc trình chiếu thời gian thực chạy qua Socket.IO. `server/services/socket-handler.js` cùng với `server/services/live-rooms.js` quản lý các phòng trong bộ nhớ: presenter/viewer tham gia, broadcast khi đổi slide, điều khiển từ xa, đồng bộ chú thích, và một bộ đếm thời gian dùng chung. Game Mode dùng một `game-socket-handler.js` riêng và bộ quản lý phòng riêng.

## Đi tiếp đến đâu

- [Cấu trúc Monorepo](/vi/develop/monorepo-structure) — mỗi loại mã nguồn nằm ở đâu
- [Build từ mã nguồn](/vi/develop/building-from-source) — chạy cục bộ
- [`docs/system-architecture.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/system-architecture.md) — tài liệu tham khảo chuyên sâu
