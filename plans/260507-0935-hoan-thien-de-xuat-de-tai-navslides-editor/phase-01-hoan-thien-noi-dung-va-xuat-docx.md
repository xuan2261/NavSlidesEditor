# Phase 01 — Hoàn Thiện Nội Dung Và Xuất DOCX

## Context Links

- Template: `Mau_DX_DT_2026.docx`
- Project overview: `docs/project-overview-pdr.md`
- Architecture: `docs/system-architecture.md`
- Codebase summary: `docs/codebase-summary.md`
- Roadmap: `docs/project-roadmap.md`

## Overview

- Priority: High
- Status: Complete
- Mục tiêu: tạo bản đề xuất nhiệm vụ KH&CN cấp Học viện năm 2026 cho NavSlides Editor.

## Key Insights

- NavSlides Editor là trình biên tập presentation WYSIWYG, self-hostable, privacy-first.
- Stack chính: React 18, Vite, Express, Socket.IO, Electron, reveal.js, TipTap, pptxgenjs.
- Điểm mới: editor trực quan, export HTML/PDF/PPTX, import PPTX, live/presenter tools, game controls, cloud sync.

## Requirements

- Giữ file mẫu gốc.
- Điền đủ 7 mục nội dung.
- Văn phong phù hợp đề xuất nhiệm vụ khoa học công nghệ.
- Dùng thông tin project hiện tại, không bịa số liệu nghiệm thu chưa có.

## Related Code Files

- Files to read: docs và README ở trên.
- Files to create: `de-xuat-de-tai-navslides-editor-2026.docx`.
- Files to delete: none.

## Implementation Steps

1. Đọc cấu trúc template bằng `python-docx`.
2. Thay nội dung các placeholder trong bảng/header và body.
3. Thêm nội dung dạng bullet/đoạn ngắn dưới từng mục.
4. Lưu ra file mới.
5. Đọc lại file xuất để kiểm tra nội dung.

## Success Criteria

- [x] File `.docx` tồn tại và mở được bằng parser.
- [x] Không ghi đè `Mau_DX_DT_2026.docx`.
- [x] Các mục 1-7 không còn placeholder trống.

## Risk Assessment

- Thông tin hành chính như khoa, CN đề tài có thể chưa chắc chắn. Mitigation: dùng dấu vết trong repo và nêu rõ giả định.

## Security Considerations

- Không đưa API key, token, credential hoặc dữ liệu riêng tư vào tài liệu.

## Next Steps

- Nếu người dùng cung cấp khoa/CN đề tài/kinh phí chính xác, cập nhật lại file theo thông tin chính thức.

## Validation Notes

- Output chính: `de-xuat-de-tai-navslides-editor-2026-ban-hoan-thien.docx`.
- Bản đầu `de-xuat-de-tai-navslides-editor-2026.docx` bị Windows lock khi regenerate, nên giữ lại như bản nháp.
- ZIP test: OK.
- XML test: `word/document.xml` và `[Content_Types].xml` parse OK.
- Nội dung đọc lại: có `NavSlides Editor`, `CẤP HỌC VIỆN NĂM 2026`, đủ mục 1-7, không còn `…………`/`…..`/`…`.
- Format check: mục 4 đánh số 1-7, danh sách có bullet, body không bold ngoài heading, metadata author/lastModifiedBy là `Bùi Thanh Xuân`.
