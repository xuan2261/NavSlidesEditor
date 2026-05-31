# Hiệu Ứng & Mảnh (Fragment)

## Hiệu ứng vào

Làm cho các phần tử xuất hiện với hiệu ứng khi một slide trở nên hoạt động.

1. Chọn một phần tử.
2. Trong bảng bên phải, tìm **Animation** > **Entry Animation**.
3. Chọn một mẫu thiết kế (preset):

| Hiệu ứng | Mô tả |
|-----------|-------------|
| Fade In | Mờ dần độ trong đơn giản |
| Fade Up/Down/Left/Right | Mờ dần + trượt theo hướng |
| Zoom In / Zoom Out | Phóng to/thu nhỏ từ nhỏ hơn/lớn hơn |
| Slide Up/Down/Left/Right | Trượt hoàn toàn từ ngoài màn hình |
| Flip X / Flip Y | Lật xoay 3D |

4. Đặt **Duration** (ms) và **Delay** (ms).

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/animations.html" style="width:100%;height:200px;border:none"></iframe>
</div>

## Dòng thời gian hiệu ứng

Để kiểm soát chi tiết thứ tự hiệu ứng:

1. Nhấn nút **Timeline** trên thanh công cụ phía trên.
2. Một bảng dòng thời gian mở ra ở dưới cùng hiển thị tất cả các phần tử có hiệu ứng.
3. Kéo các phần tử để sắp xếp lại trình tự của chúng.
4. Điều chỉnh độ trễ để xếp so le thời gian xuất hiện.

## Mảnh (Fragment)

Mảnh (fragment) cho phép bạn tiết lộ các phần tử theo từng bước trong một slide duy nhất (chuyển tiếp bằng phím mũi tên hoặc nhấp chuột).

1. Chọn một phần tử.
2. Trong bảng bên phải, bật **Fragment**.
3. Chọn hiệu ứng cho mảnh: fade-in, fade-up, highlight, v.v.
4. Đặt **chỉ số mảnh (fragment index)** để kiểm soát thứ tự tiết lộ (số nhỏ hơn xuất hiện trước).

Trong chế độ trình chiếu, mỗi lần nhấp chuột hoặc nhấn phím mũi tên sẽ tiết lộ mảnh tiếp theo trước khi chuyển sang slide kế tiếp.

::: tip
Kết hợp mảnh (fragment) với hiệu ứng vào để có tác động tối đa — mảnh kiểm soát *khi nào* phần tử xuất hiện, và hiệu ứng vào kiểm soát *cách* nó xuất hiện.
:::
