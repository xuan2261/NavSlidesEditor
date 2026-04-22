---
phase: 2
title: 'Fix Theme Sync and Contrast'
status: done
priority: P1
effort: '2h'
dependencies: []
---

# Phase 2: Fix Theme Sync and Contrast

## Overview

Phase này xử lý vấn đề về Dark Mode không đồng bộ trên Properties Panel và các menu thả xuống (Share Menu), cũng như khắc phục lỗi độ tương phản (chữ trắng trên nền xám sáng) ở Welcome Modal.

## Requirements

- Functional: Properties Panel và tất cả Dropdown Menus phải tuân thủ chuẩn Light/Dark mode của hệ thống.
- Functional: Welcome Modal cần được thay đổi màu chữ hoặc màu nền để đảm bảo độ tương phản đọc tốt (> 4.5:1).

## Architecture

- Bổ sung các prefix `dark:bg-slate-800`, `dark:text-white`, `dark:border-slate-700` vào các components còn thiếu.
- Áp dụng các biến CSS Design System đã định nghĩa trong Tailwind.

## Related Code Files

- Modify: `client/src/components/panels/PropertiesPanel.jsx` (và các file con)
- Modify: `client/src/components/modals/WelcomeModal.jsx` (hoặc `TourModal`)
- Modify: `client/src/components/layout/EditorMenuBar.jsx` (Phần Share Menu)

## Implementation Steps

1. Cập nhật class container của `PropertiesPanel` và các tab con, thêm `dark:bg-surface-dark dark:text-text-dark`.
2. Chỉnh sửa Background của `WelcomeModal`, đảm bảo nếu nền sáng (`bg-slate-100`) thì text phải tối (`text-slate-900 dark:text-white`).
3. Xác định Dropdown "Share" trong `EditorMenuBar` và bổ sung `dark:bg-surface-dark` vào wrapper popup.
4. Kiểm tra lại việc chuyển đổi toggle theme bằng mắt thường.

## Success Criteria

- [x] Chuyển đổi Dark Mode làm thay đổi toàn bộ nền và text của Properties Panel.
- [x] Text của Welcome Modal dễ đọc ở cả hai theme.
- [x] Share Menu hiển thị đúng màu nền theo Theme.

## Risk Assessment

- Rủi ro: Việc ghi đè màu nền ở Properties Panel có thể làm sai màu của các Color Picker hoặc Input elements bên trong.
- Mitigation: Sử dụng cẩn thận `dark:bg-*` chỉ ở các wrapper layout cấp độ trên cùng.
