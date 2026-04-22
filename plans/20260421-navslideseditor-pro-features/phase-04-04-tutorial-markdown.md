---
phase: 4
title: '04-tutorial-markdown'
status: completed # pending | in-progress | completed
priority: P3 # P1 | P2 | P3
effort: '2h'
dependencies: []
---

# Phase 4: 04-tutorial-markdown

## Overview

Cải thiện trải nghiệm người dùng bằng cách thêm một Tutorial Popup (Joyride / Carousel) khi mới vào Editor. Đồng thời, nâng cấp bộ import Markdown để nó hiểu được các thuộc tính config của slides.com (như thẻ thiết lập background `<!-- .slide: data-background-color="red" -->`).

## Requirements

- Functional:
  - Hiển thị Popup hướng dẫn các khu vực (Toolbar, Canvas, Properties) nếu `localStorage` chưa lưu cờ `navSlidesTutorialSeen`.
  - Nâng cấp RegEx trong `markdown-import.js` để bắt thẻ comment `<!-- .slide: ... -->` và parse lấy config màu nền.
- Non-functional:
  - Popup cần thiết kế gọn nhẹ, không làm phiền user cũ.
  - Hàm parser Markdown cần xử lý fallback tốt để không làm vỡ logic import cũ.

## Architecture

- **TutorialModal**: Component React độc lập, kiểm tra trạng thái ngay khi mount `EditorPage`.
- **Markdown Parse**: Thêm một regex match comment, phân tách bằng DOMParser ảo nếu cần để lấy value của attribute, sau đó map vào `slide.background` thay vì dùng màu default.

## Related Code Files

- Create: `client/src/components/TutorialModal.jsx`
- Modify: `client/src/pages/EditorPage.jsx` (Import và gọi TutorialModal).
- Modify: `client/src/utils/markdown-import.js` (Thêm Regex logic).

## Implementation Steps

1. Khởi tạo `TutorialModal.jsx` sử dụng layout có sẵn của hệ thống. Hiển thị 3-4 slides giới thiệu ngắn gọn bằng icon và text.
2. Thêm state `showTutorial` vào `EditorPage`, kiểm tra `localStorage` trong `useEffect`. Khi user bấm tắt/hoàn thành, lưu `navSlidesTutorialSeen = true`.
3. Trong `markdown-import.js`, trước khi split by `---`, quét tìm các block comment dạng `<!-- .slide: ... -->`.
4. Viết hàm regex parse lấy chuỗi `data-background-color="mã màu"` hoặc `data-background-image="url"`.
5. Đẩy dữ liệu parse được vào field `background` của object slide trả về.

## Success Criteria

- [x] User mới vào Editor lần đầu sẽ thấy Popup. Refresh trang sẽ không thấy nữa.
- [x] Import file markdown chứa thẻ config background sẽ cho ra slide có nền đúng theo config đó thay vì màu xám/đen mặc định.

## Risk Assessment

- Rủi ro: Tutorial Modal có thể cản trở trải nghiệm nếu check `localStorage` bị lỗi trên các trình duyệt block cookie/storage.
- Mitigations: Thêm try-catch khi thao tác với `localStorage`, nếu lỗi thì mặc định bỏ qua tutorial.
