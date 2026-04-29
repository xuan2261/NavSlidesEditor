---
phase: 1
title: 'Fix DOM syntax errors'
status: pending
priority: P1
effort: '2h'
dependencies: []
---

# Phase 1: Fix DOM syntax errors

## Overview

Phase này tập trung vào việc khắc phục lỗi cú pháp React DOM khiến ký tự `/>` bị hiển thị dưới dạng văn bản bên trong các nút (buttons) trên toàn bộ ứng dụng (chủ yếu là `HomePage.jsx` và `EditorPage.jsx`). Lỗi này phát sinh từ việc search & replace không triệt để khi chuyển đổi thẻ Icon.

## Requirements

- Functional: Các thành phần UI không hiển thị ký tự rác `/>`. Text của Button phải hiển thị chính xác (ví dụ: "New", "Back", "Present").
- Non-functional: Giữ nguyên cấu trúc Component và Tailwind class.

## Architecture

- Sử dụng Regex hoặc tìm kiếm thủ công trên tất cả các files trong thư mục `client/src/pages/` và `client/src/components/`.
- Sửa các thẻ lỗi như `<Button><Icon ... /> /> Text</Button>` thành `<Button><Icon ... /> Text</Button>`.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/components/layout/EditorMenuBar.jsx` (Nếu có)
- Modify: `client/src/pages/SpeakerViewPage.jsx`
- Modify: `client/src/pages/RemoteControlPage.jsx`

## Implementation Steps

1. Thực hiện quét toàn bộ thư mục `client/src` tìm text `/>` nằm cạnh các từ khóa như "New", "Back", "Present", "Exit", "Next".
2. Sửa lỗi syntax trên `HomePage.jsx` (các nút New, Delete, v.v.).
3. Sửa lỗi syntax trên `EditorPage.jsx` (các nút Back, Present).
4. Review các file `SpeakerViewPage.jsx` và `RemoteControlPage.jsx` để chắc chắn không còn ký tự thừa.

## Success Criteria

- [ ] Không còn bất kỳ text `/>` nào xuất hiện trên màn hình khi xem bằng browser.
- [ ] Render React không warning lỗi phân tích DOM.

## Risk Assessment

- Rủi ro: Có thể xóa nhầm thẻ đóng hợp lệ của React `<Icon />` thay vì ký tự rác.
- Mitigation: Phải review kỹ từng dòng thay đổi thay vì dùng replace all.
