---
phase: 3
title: 'Integrate & Test'
status: pending
priority: P1
effort: '1h'
dependencies: ['phase-02-implement-tour-component']
---

# Phase 3: Integrate & Test

## Overview

Tích hợp component `ProductTour` vào luồng chính của ứng dụng (`EditorPage.jsx`), xoá bỏ `TutorialModal.jsx` cũ, và tiến hành kiểm thử toàn diện để đảm bảo Tour hoạt động ổn định trên các màn hình khác nhau.

## Requirements

- Functional:
  - Thay thế hoàn toàn logic của popup cũ.
  - Test trường hợp user mở Editor lần đầu (chưa có localStorage) và lần 2 (đã có localStorage).
  - Đảm bảo tooltip không che khuất hoàn toàn nội dung quan trọng và có thể cuộn nếu màn hình nhỏ.
- Non-functional: Xoá bỏ code thừa để giảm kỹ thuật nợ (technical debt).

## Architecture

- `EditorPage.jsx` sẽ chỉ việc render `<ProductTour />` mà không cần chứa logic hiển thị bên trong nữa, ProductTour sẽ tự động đọc `localStorage` và tự unmount/ẩn đi khi đã xem xong.

## Related Code Files

- Delete: `client/src/components/TutorialModal.jsx`
- Modify: `client/src/pages/EditorPage.jsx`

## Implementation Steps

1. Xoá file `TutorialModal.jsx`.
2. Gỡ import `TutorialModal` khỏi `EditorPage.jsx` và gỡ bỏ state `showTutorial` cũ.
3. Import `<ProductTour />` vào `EditorPage.jsx` và đặt ở cấp ngoài cùng trong thẻ render.
4. Chạy `npm run dev` để kiểm tra thủ công. Xoá `navSlidesTutorialSeen` trong Local Storage của trình duyệt và reload trang.
5. Kiểm tra tương tác Next/Skip/Back và đảm bảo Highlight nhắm đúng các component.
6. Chạy `npm run test` để đảm bảo không có Unit test nào bị gãy do việc thay đổi UI.

## Success Criteria

- [ ] Xoá thành công `TutorialModal.jsx`.
- [ ] ProductTour hoạt động mượt mà, đúng logic xuất hiện lần đầu.
- [ ] Không có lỗi console. `npm run test` và `npm run lint` pass 100%.

## Risk Assessment

- Rủi ro: Tooltip có thể không tìm thấy phần tử DOM nếu Joyride khởi động trước khi React render xong các components con.
- Mitigations: Đảm bảo Joyride chỉ kích hoạt `run={true}` sau khi component mounted (có thể dùng `useEffect` kết hợp `setTimeout` nhỏ hoặc chờ isLoading = false).
