---
phase: 1
title: "01-full-deck-templates"
status: pending       # pending | in-progress | completed
priority: P2          # P1 | P2 | P3
effort: "2h"
dependencies: []
---

# Phase 1: 01-full-deck-templates

## Overview
Xây dựng hệ thống Template với 10 mẫu giao diện hoàn chỉnh (Blank Light/Dark, Palette, Bento, Serif, Bold, Minimal, Code, Desk, Ellipse) dựa theo tiêu chuẩn của slides.com. Nhằm tối ưu hiệu suất (YAGNI & KISS), mỗi template sẽ chứa 5-7 slides tiêu biểu nhất (Title, TOC, Content, Chart, Ending) và dữ liệu được lưu ở phía Backend thay vì hardcode ở Frontend.

## Requirements
- Functional:
  - Tool tự động hóa (Data Generator) để tạo JSON structure cho 10 theme.
  - Cập nhật UI ở `HomePage.jsx` để hiển thị thêm số lượng slide trên mỗi card theme.
  - Fetch dữ liệu template từ Backend khi người dùng bấm "Create".
- Non-functional:
  - Tránh làm phình to JS Bundle Size bằng cách không hardcode data lớn vào file JS.

## Architecture
- `server/data/built-in-templates.json`: Lưu trữ toàn bộ object chi tiết của 10 templates.
- Client (`HomePage.jsx`) chỉ giữ Metadata (Tên, Thumbnail, Tag) trong biến `PRESET_THEMES` để render danh sách.
- Data Flow: Người dùng chọn Template -> Gọi API Fetch chi tiết Template từ server -> Khởi tạo Presentation.

## Related Code Files
- Create: `server/scripts/generate-full-deck-templates.js`
- Modify: `client/src/pages/HomePage.jsx` (Cập nhật fetch logic và metadata).
- Modify: `server/data/built-in-templates.json`

## Implementation Steps
1. Viết script tạo JSON cho 10 theme (mỗi theme 5-7 slides đặc trưng).
2. Lưu kết quả vào `server/data/built-in-templates.json`.
3. Sửa biến `PRESET_THEMES` ở client chỉ chứa thông tin vỏ (id, name, category, thumbnail).
4. Viết logic fetch (nếu chưa có) để tải template detail khi user bấm tạo mới.

## Success Criteria
- [ ] Màn hình Dashboard hiển thị đủ 10 theme mới mà không làm tăng dung lượng bundle JS.
- [ ] Bấm tạo mới từ template sẽ tải được 5-7 slides của theme đó.
- [ ] Chạy vitest / playwright kiểm tra API fetch và render.

## Risk Assessment
- Rủi ro: Delay khi tạo mới project do phải fetch JSON.
- Mitigations: Hiển thị loading state (spinner) trong lúc tải template từ server.
