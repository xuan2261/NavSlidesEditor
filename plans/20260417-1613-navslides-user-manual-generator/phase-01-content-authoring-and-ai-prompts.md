# Phase 01: Khởi tạo Dữ liệu Nội dung & Cẩm nang Prompt AI

## Overview
- **Priority:** High
- **Current status:** Complete
- **Description:** Soạn thảo toàn bộ nội dung tiếng Việt cho 6 chương của cuốn Cẩm nang dưới định dạng JSON/Markdown để hệ thống Python có thể đọc. Đặc biệt tập trung thiết kế các Mẫu Prompt AI ở Chương 5.

## Requirements
- Định nghĩa file `docs/manual/manual_content.json` chứa cấu trúc 6 chương.
- Chương 5 phải có ít nhất 3 mẫu Prompt (dành cho ChatGPT/Gemini/MetaAI/Grok) để sinh:
  1. Slide Tương tác Trắc nghiệm (Quiz).
  2. Slide Mô phỏng Vật lý (Sử dụng Canvas/JS inline).
  3. Slide Animation giải thích cơ chế Điện tử số.
- Các mẫu prompt phải yêu cầu AI xuất code chuẩn HTML/JS, không lỗi CSS, z-index hợp lý, chạy được luôn trong NavSlides Editor.

## Related Code Files
- `[NEW] docs/manual/manual_content.json`
- `[NEW] docs/manual/ai_prompts_templates.md` (chứa các chuỗi prompt thô để dễ copy)

## Implementation Steps
1. Khởi tạo cấu trúc thư mục `docs/manual/screenshots` và `docs/manual/assets`.
2. Viết file JSON mô tả khung sườn 6 chương.
3. Soạn thảo chi tiết 3 mẫu Prompt Master-level:
   - *Prompt kỹ thuật:* Ép LLM dùng `style="..."` thay vì `<style>` ngoài để tránh xung đột CSS.
   - *Prompt mô phỏng:* Yêu cầu dùng vanilla JS với `requestAnimationFrame` và giới hạn kích thước vùng vẽ (`960x700`).
4. Gắn các đoạn prompt vào `manual_content.json` làm nội dung chương 5.

## Todo List
- [x] Khởi tạo thư mục.
- [x] Viết `manual_content.json`.
- [x] Thiết kế và kiểm thử độ chuẩn xác của 3 mẫu Prompt.

## Success Criteria
File JSON parse được không lỗi, các mẫu Prompt có cấu trúc rõ ràng, chuyên nghiệp, ready để chèn vào Word.
