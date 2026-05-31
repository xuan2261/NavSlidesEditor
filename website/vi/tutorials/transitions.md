# Chuyển Cảnh

Kiểm soát cách các slide thay đổi trong khi trình chiếu.

## Chuyển cảnh tích hợp sẵn

Đặt chuyển cảnh toàn cục trong thanh công cụ của trình soạn ở mục **Transition**:

| Chuyển cảnh | Mô tả |
|-----------|-------------|
| None | Chuyển tức thì |
| Fade | Mờ chéo giữa các slide |
| Slide | Các slide trượt theo chiều ngang |
| Convex | Xoay lồi 3D |
| Concave | Xoay lõm 3D |
| Zoom | Phóng to/thu nhỏ |

Bạn cũng có thể đặt một **chuyển cảnh riêng cho từng slide** trong bảng bên phải ở mục **Slide transition**, ghi đè lên mặc định toàn cục.

## Differential Rotation

Một chuyển cảnh tùy chỉnh lấy cảm hứng từ vật lý, trong đó các dải ngang quét qua ở các tốc độ khác nhau — nhanh ở trung tâm (xích đạo), chậm ở các rìa (cực) — mô phỏng cách các ngôi sao xoay.

1. Đặt chuyển cảnh thành **Differential Rotation** (toàn cục hoặc cho từng slide).
2. Trong chế độ trình chiếu, chuyển sang slide tiếp theo sẽ kích hoạt hiệu ứng cắt trượt.

### Cách hoạt động

16 dải ngang phủ kín màn hình, mỗi dải trượt ra với vận tốc không đổi tỉ lệ với cos²(vĩ độ). Các đường phân cách mỏng theo màu chủ đạo Bauhaus (đỏ, lam, vàng) đánh dấu ranh giới các dải. Hiệu ứng chạy ~1,4 giây cho dải chậm nhất.

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/dr-transition.html" style="width:100%;height:240px;border:none"></iframe>
</div>

## Tốc độ chuyển cảnh

Đối với bất kỳ chuyển cảnh nào, đặt tốc độ trong bảng bên phải:

- **Fast** — chuyển cảnh nhanh cho nhịp độ nhanh
- **Default** — thời gian chuẩn
- **Slow** — chuyển cảnh chậm rãi, kịch tính

## Auto-animate

Để có chuyển cảnh biến hình giữa các slide:

1. Trong bảng bên phải, bật **Auto-Animate** trên slide.
2. Nhân đôi slide và sắp xếp lại các phần tử.
3. Các phần tử có cùng `data-id` (được gán tự động) sẽ biến hình mượt mà giữa các vị trí, kích thước, và kiểu dáng.
