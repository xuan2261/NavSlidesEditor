# Phase 03: Lắp ráp File Word với Python DOCX Builder

## Overview

- **Priority:** High
- **Current status:** Complete
- **Description:** Viết kịch bản Python đọc file JSON nội dung (Phase 1) và nhúng ảnh Playwright (Phase 2) để xuất ra file Word (.docx) chuyên nghiệp.

## Requirements

- Python `python-docx` library.
- Style chuẩn: Cỡ chữ 12, Font Times New Roman hoặc Arial (chuẩn văn bản quân sự/giáo dục).
- Có Trang bìa: "HƯỚNG DẪN SỬ DỤNG PHẦN MỀM NAVSLIDES" - Bùi Thanh Xuân.
- Có đánh số Heading 1, 2, 3 chuẩn để gen Mục lục.
- Ảnh được căn giữa, có viền nhẹ (tùy chọn) và Caption.

## Related Code Files

- `[NEW] scripts/generate_docx_manual.py`
- `[NEW] requirements-manual.txt` (chứa `python-docx`)

## Implementation Steps

1. Viết `requirements-manual.txt` và lưu.
2. Code `generate_docx_manual.py`.
3. Thiết lập các Styles cơ bản trong Python-DOCX (Heading 1, Normal, Caption).
4. Viết logic tạo Trang bìa (căn giữa toàn bộ chữ, size lớn).
5. Load `manual_content.json`, lặp qua các chương (Chapters) -> Mới mỗi chương thì `document.add_page_break()`.
6. Lặp qua các mục (Sections), thêm text, phát hiện thẻ chèn ảnh để gọi hàm `document.add_picture(path, width=...)`.
7. Lưu file `docs/manual/NavSlides_User_Manual.docx`.

## Todo List

- [x] Tạo file requirements và hướng dẫn cài đặt.
- [x] Khởi tạo Document template bằng python-docx.
- [x] Parse JSON và loop qua nội dung.
- [x] Xử lý chèn ảnh và Caption.

## Success Criteria

Chạy lệnh `python scripts/generate_docx_manual.py` xuất ra file Word có đầy đủ 6 chương, có chèn ảnh đúng vị trí, format chuẩn.
