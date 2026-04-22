# Báo cáo Brainstorm & Thiết kế Kiến trúc UI/UX (Pro Max)

Theo nguyên tắc **Root Cause Investigation** (ck:debug) và **YAGNI/KISS** (ck:brainstorm), tôi đã phân tích toàn bộ hệ thống CSS và Component của NavSlidesEditor.

## 1. Phân tích Nguyên nhân Cốt lõi (Root Cause ID)

Lý do Light Theme trông "chắp vá" và SlideCanvas có vùng đen là do **sự rò rỉ các giá trị màu hardcode (Hardcoded Colors Leakage)**:

- **SlideCanvas & Rulers:** Hàm `getBgStyle` mặc định trả về `#1e1e2e`. Các ruler dùng `rgba(30,30,46,0.9)`. Overlay khóa dùng `rgba(0,0,0,0.15)`.
- **Typography & Nội dung:** Trong `components.css`, các thẻ `code`, `pre`, `blockquote` của slide text bị fix cứng `rgba(255,255,255,0.1)`. Khi sang Light Theme (nền trắng), chữ trắng/nền trong suốt khiến nội dung biến mất hoặc cực kỳ khó đọc.
- **Thiếu hụt CSS Tokens:** File `index.css` định nghĩa các biến `--surface-*` nhưng lại không định nghĩa các biến cho trạng thái overlay (phủ mờ), shadow, hoặc các thành phần đặc thù khiến developer buộc phải dùng `rgba` thủ công.

## 2. Đề xuất Kiến trúc Giao diện (3 Phương án)

### Phương án A: Chuyển đổi toàn bộ sang TailwindCSS

- **Mô tả:** Xóa các file `.css` hiện tại, dùng utility classes của Tailwind (vd: `dark:bg-slate-900 bg-gray-100`).
- **Ưu điểm:** Chuẩn hóa 100%, dễ maintain về sau.
- **Nhược điểm:** Phải đập đi xây lại toàn bộ UI component, rủi ro vỡ layout rất cao, tốn rất nhiều thời gian. (Không khuyến nghị).

### Phương án B: Retrofit CSS Variables (Đề xuất chọn - Đạt chuẩn Pro Max)

- **Mô tả:** Giữ nguyên cấu trúc Vanilla CSS hiện tại nhưng **chuẩn hóa triệt để hệ thống CSS Variables (Design System)**.
- **Cách làm:**
  1.  Xây dựng bảng màu Semantic: `--bg-canvas`, `--bg-workspace`, `--text-primary`, `--border-subtle`, `--overlay-dark`, `--overlay-light`.
  2.  Tìm và thay thế _toàn bộ_ mã Hex/RGBA hardcode trong `.jsx` và `.css`.
  3.  Tách biệt **App UI Theme** (Sáng/Tối của phần mềm) và **Slide Theme** (Màu nền của bản thân cái Slide).
- **Ưu điểm:** Khắc phục triệt để lỗi hiển thị, rủi ro thấp, giữ nguyên kiến trúc cũ nhưng nâng cấp chất lượng mã nguồn.

### Phương án C: Sửa lỗi cục bộ (Patching)

- **Mô tả:** Chỉ tìm đúng file `SlideCanvas.jsx` và sửa thành màu trắng.
- **Nhược điểm:** Món nợ kỹ thuật (Technical Debt) vẫn còn đó, tương lai thêm component mới lại tiếp tục lỗi theme. (Từ chối thực hiện theo nguyên tắc ck:debug).

## 3. Bản thiết kế chi tiết (Theo Phương án B)

### A. Hệ thống Design System (Cập nhật `index.css`)

Thiết lập bảng màu đạt chuẩn tương phản WCAG 2.1 (Contrast Ratio > 4.5:1):

**Dark Theme (Default):**

- `--bg-workspace`: `#0f0f14` (Nền ngoài cùng)
- `--bg-panel`: `#16161d` (Nền các thanh công cụ, sidebar)
- `--bg-canvas-default`: `#ffffff` (Nền mặc định của Slide luôn là trắng để in ấn/xuất file chuẩn, trừ khi user tự đổi màu)
- `--overlay-ruler`: `rgba(22, 22, 29, 0.9)`

**Light Theme (`[data-theme='light']`):**

- `--bg-workspace`: `#f3f4f6` (Xám nhạt để làm nổi bật slide trắng)
- `--bg-panel`: `#ffffff` (Trắng tinh)
- `--bg-canvas-default`: `#ffffff`
- `--overlay-ruler`: `rgba(255, 255, 255, 0.9)`
- `--text-primary`: `#111827`
- `--text-secondary`: `#4b5563`
- `--border`: `#e5e7eb`

### B. Cải tiến UI/UX Component (ck:ui-ux-pro-max)

1.  **SlideCanvas (The Stage):**
    - Bản thân Slide sẽ trông như một tờ giấy thật: Có box-shadow nhẹ (`shadow-lg`), nằm giữa vùng `--bg-workspace`.
    - Giúp người dùng phân biệt rõ đâu là UI của phần mềm, đâu là ranh giới của Slide.
2.  **Rulers (Thước kẻ):**
    - Màu nền dùng `--overlay-ruler`, vạch chia dùng `--border`, màu số dùng `--text-muted`. Đảm bảo đẹp ở cả 2 theme.
3.  **Typography trong Slide (`components.css`):**
    - Sửa lại `code`, `pre`, `blockquote` không dùng rgba cố định mà dùng `--bg-hover` hoặc `--surface-2` để chữ code không bị chìm nghỉm khi sang Light Mode.

## 4. Kế hoạch Hành động (Implementation Steps)

1.  **Step 1:** Viết lại biến `:root` và `[data-theme='light']` trong `client/src/index.css`.
2.  **Step 2:** Cập nhật `SlideCanvas.jsx` (Dòng 741 - 900+): Xóa các `rgba()` hardcode ở Ruler và Overlay. Cập nhật `getBgStyle` để trả về `--bg-canvas-default` thay vì `#1e1e2e`.
3.  **Step 3:** Cập nhật `components.css`: Sửa `.slide-text-content` (code, pre, blockquote).
4.  **Step 4:** Kiểm tra (Verify) các file CSS khác (như `slide-panel.css`) để đảm bảo các thumbnail có nền đúng chuẩn thay vì trong suốt.

---

> [!QUESTION] Ý kiến của bạn (User Review Required)
>
> 1.  Bạn có đồng ý với triết lý **"Slide mặc định luôn có nền Trắng (#ffffff) bất kể App Theme là Sáng hay Tối"** không? (Giống như Google Slides/PowerPoint, phần mềm có thể Dark Mode nhưng tờ giấy vẽ luôn là màu trắng trừ khi bạn chủ động đổ màu khác).
> 2.  Bạn có muốn tôi bắt đầu thực hiện Phase Code (triển khai Step 1-4) ngay bây giờ theo Phương án B không?
