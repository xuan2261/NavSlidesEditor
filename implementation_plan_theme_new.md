# Báo cáo Phân tích Kiến trúc: Có nên chuyển sang TailwindCSS?

Với tư cách là Chuyên gia Kiến trúc Hệ thống (ck:brainstorm), tôi rất trân trọng tư duy hướng tới tương lai của bạn. Việc muốn "Chuẩn hóa 100% và dễ maintain về sau" là tư duy của một kỹ sư trưởng (Lead Engineer) thực thụ.

Dưới đây là sự thật phũ phàng (Brutal Honesty) và phân tích chuyên sâu về việc chọn **Phương án A (TailwindCSS)** cho dự án NavSlidesEditor.

## 1. Sự thật về TailwindCSS trong dự án này

**Bạn có nên dùng TailwindCSS không?**
**CÓ.** Đối với một ứng dụng phức tạp như Trình soạn thảo (Editor) có vô số Panel, Modal, Toolbar và trạng thái (states), việc duy trì các file CSS thuần (Vanilla CSS) sẽ nhanh chóng trở thành một cơn ác mộng (CSS Spaghetti). Tailwind giải quyết triệt để bài toán đồng bộ Theme (với prefix `dark:`), giúp file component trở thành Nguồn sự thật duy nhất (Single Source of Truth).

**Nhưng việc "Chuyển đổi toàn bộ TAY KHÔNG trong một lần" (Big Bang Rewrite) có phải ý hay?**
**KHÔNG.**

- Dự án của bạn hiện có khoảng **8 file CSS với tổng dung lượng ~60KB** (ước tính 2000-3000 dòng code CSS).
- Việc đập bỏ 60KB CSS để viết lại bằng utility classes trong cùng một lúc sẽ:
  1. Đóng băng tiến độ phát triển tính năng mới trong ít nhất vài ngày.
  2. Gây ra vô số lỗi vỡ giao diện (Visual Regressions) tiềm ẩn ở các góc khuất của ứng dụng (như z-index, absolute positioning, flex alignment).
  3. Vi phạm nguyên tắc **KISS** (Giữ cho mọi thứ đơn giản và khả thi).

## 2. Các phương án thực tế (The Pragmatic Approaches)

### Lựa chọn A1: The Big Bang Rewrite (Chuyển đổi toàn bộ ngay lập tức)

- **Cách làm:** Xóa sạch thư mục `styles/`, cài Tailwind, và đập đi xây lại class cho ~50+ component.
- **Pros:** Sạch sẽ 100% ngay khi xong. Cấu trúc tuyệt vời.
- **Cons:** Rủi ro cực cao. Tốn thời gian khổng lồ. Rất dễ nản chí và bỏ dở giữa chừng.

### Lựa chọn D: The Progressive Tailwind Migration (Di cư dần dần - Đề xuất tối ưu nhất)

Đây là chiến lược được các Big Tech sử dụng khi áp dụng công nghệ mới vào dự án cũ.

- **Cách làm:**
  1.  **Cài đặt Tailwind:** Tích hợp TailwindCSS vào Vite project.
  2.  **Đồng bộ biến (Token Mapping):** Cấu hình `tailwind.config.js` để đọc các biến CSS hiện tại (vd: `colors.primary = var(--color-primary)`).
  3.  **Sửa lỗi cục bộ bằng Tailwind:** Áp dụng Tailwind để sửa các lỗi hiện tại ở `SlideCanvas`, `Toolbar`, thiết lập lại `dark:` mode cho các phần bị lỗi nền. (SlideCanvas có nền `#ffffff` mặc định).
  4.  **Chuyển đổi cuốn chiếu:** Các component mới sẽ viết 100% bằng Tailwind. Các component cũ sẽ giữ nguyên file `.css`, và chỉ chuyển sang Tailwind khi nào bạn có task cần sửa đổi component đó (Boy Scout Rule: Để lại code sạch hơn lúc bạn tìm thấy nó).
- **Pros:** Rủi ro gần như bằng 0. Vừa có hệ thống mới, vừa không làm vỡ hệ thống cũ. Đạt được mục tiêu dài hạn.
- **Cons:** Tồn tại song song 2 hệ thống (CSS cũ và Tailwind) trong một khoảng thời gian (Technical Debt được trả góp).

## 3. Kiến trúc Theme Sáng/Tối với Tailwind (Nếu áp dụng)

Nếu áp dụng Tailwind (Lựa chọn D), việc xử lý Theme sẽ cực kỳ nhàn rỗi và chuẩn mực:

1.  **Nền SlideCanvas:** Sẽ luôn là `bg-white` (bảo vệ triết lý tờ giấy trắng).
2.  **App Workspace:** Sẽ dùng `bg-gray-100 dark:bg-[#0f0f14]`.
3.  **Rulers & Overlays:** Dùng `bg-white/90 dark:bg-gray-900/90`.
    Không còn phải đau đầu tìm kiếm và sửa các chuỗi `rgba()` thủ công nữa.

---

> [!QUESTION] Quyết định của bạn (User Review Required)
> Với sự thật về rủi ro của "Big Bang Rewrite" và lợi ích của "Progressive Migration", bạn chọn hướng đi nào?
>
> **- Lựa chọn A1:** Chấp nhận rủi ro vỡ layout, dành toàn bộ nỗ lực để chuyển sang TailwindCSS 100% ngay bây giờ.
> **- Lựa chọn D (Khuyến nghị):** Cài Tailwind, sửa các lỗi UI/Theme hiện tại bằng Tailwind, và duy trì chiến lược "Chuyển đổi dần dần" để đảm bảo an toàn.
> **- Lựa chọn B (Cũ):** Không dùng Tailwind, chỉ sửa lại các biến CSS Vanilla.
>
> Hãy cho tôi biết quyết định của bạn để tôi lập Plan và triển khai Code (Invoke `/ck:plan` -> `/ck:cook`)!
