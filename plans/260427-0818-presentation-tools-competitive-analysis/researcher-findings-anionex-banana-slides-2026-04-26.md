# Research: Anionex/banana-slides

**Date:** 2026-04-26
**Sources:** GitHub repo, README, WebSearch

---

## 1. Project Description & Tech Stack

**banana-slides** là ứng dụng web tạo PowerPoint bằng AI, xây trên model image generation (được gọi là "nano banana pro"), cho phép chuyển ý tưởng thành slide chuyên nghiệp mà không cần format thủ công. Mô tả chính: "AI-native PowerPoint generator" / "Vibe PPT".

### Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18, TypeScript, Vite 5, Zustand, React Router v6, Tailwind CSS, @dnd-kit, Lucide React, Axios |
| Backend | Python 3.10+, Flask 3.0, uv (package manager), SQLite + Flask-SQLAlchemy |
| AI | Google Gemini API (primary), GPT-image-2, OpenAI, Vertex AI, DeepSeek, Doubao, Qwen, GLM, SiliconFlow, SenseNova |
| Export | python-pptx, Pillow |
| Deployment | Docker, Docker Compose (amd64/arm64) |

---

## 2. Features & Capabilities

- **3 creation paths:** từ 1 câu idea, từ outline có cấu trúc, hoặc từ mô tả chi tiết từng trang
- **Smart material parsing:** upload & trích xuất nội dung từ PDF, DOCX, MD, TXT, ảnh
- **"Vibe" editing:** chỉnh sửa outline hoặc mô tả slide bằng ngôn ngữ tự nhiên (vd: "đổi trang 3 thành case study")
- **Zone-based redraw:** chọn 1 vùng trên slide và regenerate chỉ vùng đó bằng AI
- **Style reference:** upload ảnh mẫu/style để định hướng thiết kế
- **Batch generation + selective regeneration:** tạo tất cả trang cùng lúc hoặc chỉ render lại từng trang
- **Material management:** dán ảnh trực tiếp vào homepage/outline để nhận diện tức thì
- **Multi-language UI:** tiếng Trung/tiếng Anh; light/dark/system theme
- **Không giới hạn số trang** (NotebookLM giới hạn 15 trang)
- **Không watermark**

---

## 3. Key Technical Approaches

- **AI image generation** cho từng slide page (dùng Gemini, GPT-image-2...)
- **Multi-step AI reasoning** cho outline generation
- **Image understanding** để trích xuất style từ ảnh template
- **Background/text extraction** cho editable PPTX export (dùng Baidu OCR API tùy chọn)
- **Material summarization** từ document upload
- **ThreadPoolExecutor** cho xử lý đồng thời phía backend
- **SQLite + Flask-SQLAlchemy** làm database đơn giản
- **Docker Compose** cho deployment nhất quán

---

## 4. AI Features

- Text-to-image generation cho slide pages (Gemini-powered)
- Multi-step reasoning cho outline generation
- Image understanding cho template style extraction
- Background/text extraction cho editable PPTX
- Material summarization từ document uploads
- Hỗ trợ nhiều model: Gemini, GPT-image-2, OpenAI, Vertex AI, DeepSeek, Doubao, Qwen, GLM, SiliconFlow, SenseNova
- **AIHubMix** platform được khuyến nghị để truy cập API thống nhất

---

## 5. Export/Import Formats

### Import (Input)
- PDF
- DOCX
- Markdown (.md)
- Plain text (.txt)
- Hình ảnh (style reference)

### Export (Output)
| Format | Chi tiết |
|--------|----------|
| PPTX chuẩn | 16:9, presentation-ready |
| PPTX editable (Beta) | High-fidelity text + background extraction; background cleanup qua Baidu OCR API |
| PDF | One-click |

---

## 6. Collaboration Features

- Không có mention rõ về collaboration realtime (user authentication system đang trong roadmap commercial)
- Export/import PPTX cho phép chia sẻ file offline
- Share token system (chưa rõ chi tiết — có thể ở server-side)

---

## 7. Unique / Innovative Features

- **"Vibe PPT" concept:** tạo slide bằng cảm xúc, không cần format
- **Zone-based redraw:** chọn vùng trên slide để regenerate — khác biệt so với regenerate toàn bộ
- **No page limit** — vượt trội so với NotebookLM (15 trang)
- **Editable PPTX với background extraction** — giữ được design AI + text có thể edit
- **AIHubMix** — tích hợp nhiều model AI trong 1 platform
- **So sánh NotebookLM:** không watermark, không giới hạn trang, hỗ trợ post-generation material add

---

## 8. License & Popularity

| Metric | Value |
|--------|-------|
| Stars | ~14.1k |
| Forks | ~1.7k |
| Commits | 653 |
| License | **AGPL-3.0** (open-source, phi thương mại) |
| Commercial license | Liên hệ davidyang042@gmail.com |

---

## 9. So sánh với NavSlidesEditor

| Khía cạnh | banana-slides | NavSlidesEditor (NavSlides) |
|-----------|----------------|-----------------------------|
| Mục tiêu | AI tạo slide từ ý tưởng | WYSIWYG editor cho presentation |
| AI | Core (image gen) | Không có AI gen — editor thuần |
| Reveal.js | Không | Có (core rendering) |
| Export | PPTX, PDF | PPTX, PDF, HTML, Markdown |
| Realtime collaboration | Không rõ | Live presentation (Socket.IO) |
| File size limit | Không | Không rõ |
| Self-hostable | Có (Docker) | Có (npm workspace + Docker) |

---

## Unresolved Questions

- Kiến trúc server chi tiết của banana-slides (route structure, auth)
- Cơ chế live presentation/presentation sharing có tương đương Socket.IO không
- Performance của editable PPTX export ở Beta — có stable chưa
- Chi tiết về "Agent mode" trong roadmap

---

## Sources

- [Anionex/banana-slides - GitHub](https://github.com/Anionex/banana-slides)
- [README.md](https://github.com/Anionex/banana-slides/blob/main/README.md)
