# Hình Ảnh

Hướng dẫn này bao gồm việc chèn hình ảnh và các tính năng tương tác: nhấn để phóng to và văn bản bật lên.

## Chèn một hình ảnh

**Từ một URL:**
1. Nhấn nút **Image** trên thanh công cụ.
2. Dán URL hình ảnh vào ô nhập và nhấn OK.

**Bằng cách tải lên:**
1. Nhấn vào mũi tên tải lên nhỏ bên cạnh nút Image.
2. Chọn một tệp từ máy tính của bạn. Nó được tải lên máy chủ và chèn vào slide.

## Điều chỉnh một hình ảnh

Chọn một hình ảnh để xem các thuộc tính của nó ở bảng bên phải:

- **Object Fit** — `contain` (letterbox), `cover` (lấp đầy và cắt), `fill` (kéo giãn), `none` (kích thước gốc)
- **Brightness / Contrast / Grayscale** — các thanh trượt bộ lọc
- **Round Corners** — bán kính bo góc có thể điều chỉnh
- **Crop** — nhấn đúp vào hình ảnh để vào chế độ cắt; kéo các tay nắm để cắt

## Nhấn để phóng to

Tính năng này cho phép khán giả nhấn vào một hình ảnh trong khi trình chiếu để xem nó ở kích thước toàn khung nhìn.

1. Chọn phần tử hình ảnh.
2. Trong bảng bên phải, đánh dấu **Click to expand in present mode**.
3. Trong chế độ trình chiếu, di chuột qua hình ảnh sẽ hiện một đường viền màu chàm mờ. Nhấn vào nó sẽ mở một hộp đèn (lightbox) toàn màn hình.
4. Nhấn ra ngoài hình ảnh hoặc nhấn `Escape` để đóng.

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/expand-image.html" style="width:100%;height:260px;border:none"></iframe>
</div>

## Văn bản bật lên

Hiển thị một chú giải văn bản khi một hình ảnh được nhấn trong khi trình chiếu.

1. Chọn phần tử hình ảnh.
2. Trong bảng bên phải, tìm **Pop-up text (present mode)** và nhập chú thích của bạn.
3. Chọn **Position** (Below, Centered, hoặc Side) và **Font size**.
4. Trong chế độ trình chiếu, nhấn vào hình ảnh sẽ hiện hộp văn bản. Nhấn ra ngoài hoặc nhấn `Escape` để bỏ qua.

::: tip
Bạn có thể bật **cả hai** tính năng nhấn-để-phóng-to và văn bản bật lên trên cùng một hình ảnh. Khi được nhấn, hình ảnh phóng to ra toàn khung nhìn và văn bản bật lên xuất hiện bên cạnh hình ảnh đã phóng to.
:::

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/popup-image.html" style="width:100%;height:260px;border:none"></iframe>
</div>
