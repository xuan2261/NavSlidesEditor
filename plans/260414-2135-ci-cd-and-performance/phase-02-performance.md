# Phase 2: Performance Load Testing Setup

## Related Code Files

- `package.json`
- `tests/load/api-load.js`
- `tests/load/websocket-load.js`

## Context

Xây dựng Kịch bản giả lập tải (B1) cho REST API và WebSocket của Editor, nhờ đó ta đo đạc mức độ chịu đựng của App với Payload JSON lớn và lượng truy cập đồng thời. Công cụ sử dụng là k6.

## Implementation Steps

- `[x]` Cập nhật `package.json` bổ sung NPM scripts `test:load:ws` và `test:load:api`.
- `[x]` Viết tài liệu hướng dẫn cài đặt `k6` cho developer vào README hoặc docs.
- `[x]` Tạo file test HTTP `tests/load/api-load.js` thực hiện GET và POST `/api/presentations` với JSON payload siêu lớn (giả lập file có 30 ảnh base64).
- `[x]` Cấu hình virtual users (VUs = 50) và duration (30s).
- `[x]` Tạo file test WebSocket `tests/load/websocket-load.js` để kết nối vào Namespace Socket.IO `/` và mô phỏng event `presentation-updated`.

## Success Criteria

- Lệnh `npm run test:load:api` chạy và trả về report của `k6` với request failed = 0.
- Lệnh `npm run test:load:ws` có thể giả lập client handshake và giữ connection ổn định.
