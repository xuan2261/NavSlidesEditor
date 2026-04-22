# Cẩm nang Prompt AI dành cho NavSlides Editor

## Mẫu 1: Sinh Slide Trắc nghiệm (Quiz) Tương tác

**Mục đích:** Tạo nhanh một slide câu hỏi trắc nghiệm nhiều lựa chọn có phản hồi đúng/sai tức thì.

**Prompt Template:**

```text
Bạn là một chuyên gia thiết kế bài giảng E-learning. Hãy viết mã HTML cho một slide trắc nghiệm nhiều lựa chọn (Multiple Choice) chạy trong thư viện Reveal.js.

Yêu cầu kỹ thuật:
1. Chỉ sử dụng HTML và JavaScript (nếu cần).
2. Toàn bộ CSS phải viết dưới dạng inline (ví dụ: `style="color: red; padding: 10px;"`) để không xung đột với theme chung của Reveal.js. Không được dùng thẻ `<style>`.
3. Slide cần có 1 câu hỏi và 4 đáp án (A, B, C, D).
4. Khi click vào đáp án đúng, hiển thị thông báo "Chính xác" màu xanh lá cây; đáp án sai hiển thị "Chưa đúng" màu đỏ.
5. Code phải gọn gàng, nằm gọn trong một thẻ `<section>` của Reveal.js.
```

## Mẫu 2: Sinh Slide Mô phỏng Vật lý (Sử dụng Canvas)

**Mục đích:** Tạo một slide chứa hình ảnh động mô phỏng các hiện tượng vật lý (ví dụ: con lắc đơn, chuyển động ném xiên).

**Prompt Template:**

```text
Bạn là một lập trình viên chuyên viết các mô phỏng tương tác giáo dục. Hãy tạo một mô phỏng vật lý (ví dụ: chuyển động của một con lắc đơn) hiển thị trên thẻ `<canvas>`.

Yêu cầu kỹ thuật:
1. Mô phỏng được đặt trong thẻ `<canvas>` với kích thước cố định là width="960" và height="700".
2. Sử dụng vanilla JavaScript để vẽ và cập nhật hoạt ảnh. Hàm animate phải sử dụng `requestAnimationFrame`.
3. Toàn bộ script phải bọc trong một hàm IIFE (Immediately Invoked Function Expression) hoặc lắng nghe sự kiện để không gây ô nhiễm global scope.
4. Có nút "Bắt đầu" và "Dừng" để điều khiển mô phỏng.
5. Layout phải sử dụng inline CSS (`style="..."`), tuyệt đối không dùng thẻ `<style>`.
```

## Mẫu 3: Sinh Slide Animation Điện tử số

**Mục đích:** Mô phỏng trực quan cơ chế hoạt động của các cổng logic (AND, OR, NOT) hoặc mạch kỹ thuật số.

**Prompt Template:**

```text
Bạn là giảng viên môn Điện tử số. Hãy thiết kế một slide minh họa hoạt động của cổng logic AND có tương tác.

Yêu cầu kỹ thuật:
1. Hiển thị hai công tắc (Input A và Input B) và một bóng đèn (Output).
2. Công tắc có thể click để chuyển trạng thái (0 hoặc 1). Bóng đèn thay đổi màu sắc (ví dụ: xám khi tắt, vàng khi sáng) dựa trên kết quả phép toán AND của 2 input.
3. Kích thước slide hiển thị tối ưu trong vùng giới hạn 960x700 pixel.
4. Định dạng bằng inline CSS (`style="..."`), không dùng thẻ `<style>`.
5. Đảm bảo thuộc tính `z-index` hợp lý để các thành phần tương tác không bị đè khuất. Các biến JavaScript phải khai báo cục bộ để tránh lỗi khi chèn vào trang lớn.
```
