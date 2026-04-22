---
title: NavSlides User Manual Generator
date: 2026-04-17
status: completed
---

# Kế hoạch chi tiết: Hệ thống tự động sinh Cẩm nang NavSlides

**Mục tiêu:** Xây dựng Pipeline tự động (Playwright + Python) để sinh file `.docx` Hướng dẫn sử dụng phần mềm NavSlides Editor chuẩn in ấn, có bao gồm Cẩm nang Prompt AI dành cho giảng viên/sinh viên Học viện Hải quân.

## Danh sách các Phase

- [x] **Phase 01:** Khởi tạo Dữ liệu Nội dung & Cẩm nang Prompt AI (`phase-01-content-authoring-and-ai-prompts.md`)
- [x] **Phase 02:** Tự động hóa Chụp ảnh UI với Playwright (`phase-02-playwright-automation.md`)
- [x] **Phase 03:** Lắp ráp File Word với Python DOCX (`phase-03-python-docx-builder.md`)
- [x] **Phase 04:** Rà soát, Sửa lỗi và Hoàn thiện (`phase-04-verification-and-refinement.md`)

## Key Dependencies

- Node.js (Playwright)
- Python 3 (`python-docx`)
- Thư mục dự án `docs/manual/`
