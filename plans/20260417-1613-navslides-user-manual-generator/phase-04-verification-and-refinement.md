# Phase 04: Rà soát, Sửa lỗi và Hoàn thiện

## Overview
- **Priority:** Medium
- **Current status:** Complete
- **Description:** Review file DOCX đầu ra, sửa lỗi format (nếu có), kiểm thử các mẫu Prompt AI đã viết trong Chương 5.

## Requirements
- File DOCX phải không bị tràn ảnh ra khỏi lề trang giấy A4.
- Mục lục tạo tự động trên Word phải khớp số trang.
- Prompt AI khi copy paste vào ChatGPT phải sinh ra được code chạy tốt.

## Implementation Steps
1. Chạy toàn bộ pipeline: `node` lấy ảnh -> `python` gen Word.
2. Mở file `.docx` trong Microsoft Word, bấm update Table of Contents.
3. Rà soát căn lề hình ảnh (cần scale width sao cho `Inches(6.0)` là tối đa cho khổ A4 dọc).
4. Lấy thử 1 prompt trong Chương 5 (ví dụ: Tạo slide tương tác mạch logic), ném vào AI, copy code bỏ vào file `test_present.html` (hoặc NavSlides Editor) chạy thử xem có hoạt động không.
5. Nếu cần, tinh chỉnh lại thư viện `python-docx` để thêm đường viền ảnh bằng XML manipulation (nâng cao).

## Todo List
- [x] Chạy pipeline end-to-end.
- [x] Khắc phục lỗi overflow ảnh trong Word.
- [x] Kiểm thử 1 mẫu Prompt AI thực tế.
- [x] Cập nhật lại artifact WALKTHROUGH.

## Success Criteria
Tài liệu Word hoàn hảo, ready to print (Sẵn sàng in ấn và đóng quyển). Prompt AI cực kỳ hữu ích cho giảng viên tự chế tạo bài giảng ảo.
