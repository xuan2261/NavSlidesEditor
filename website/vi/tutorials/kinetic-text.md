# Văn Bản Động (Kinetic Text)

Công cụ Kinetic Text cho phép bạn chèn các hiệu ứng văn bản động với một thư viện mẫu — không cần lập trình.

## Mở thư viện

Nhấn nút **Kinetic** trên thanh công cụ (bên cạnh Embed). Một hộp thoại mở ra với lưới mẫu, bản xem trước trực tiếp, và các điều khiển tham số.

## Quy trình

1. **Chọn một mẫu** từ bảng bên trái.
2. **Gõ văn bản của bạn** vào ô văn bản.
3. **Điều chỉnh tham số**: phông chữ, cỡ chữ, màu, thời lượng.
4. Xem **bản xem trước trực tiếp** cập nhật theo thời gian thực.
5. Nhấn **Insert** để đặt nó lên slide hiện tại dưới dạng một phần tử HTML embed.

Sau khi chèn, bạn có thể đổi kích thước và định vị lại phần tử như bất kỳ phần tử nào khác. Để chỉnh sửa nội dung sau này, nhấn đúp vào nó để mở trình soạn HTML.

## Các mẫu

### Typewriter

Các ký tự xuất hiện từng cái một với con trỏ nhấp nháy, giống như văn bản đang được gõ.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-typewriter.html" style="width:100%;height:100px;border:none"></iframe>
</div>

### Word Reveal

Các từ mờ dần và trượt lên từng cái một với thời gian xếp so le.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-word-reveal.html" style="width:100%;height:100px;border:none"></iframe>
</div>

### Revolve

Văn bản lật vào từ phía sau qua một phép xoay trục Y 3D, rồi trôi nhẹ nhàng.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-revolve.html" style="width:100%;height:120px;border:none"></iframe>
</div>

### Wave

Các chữ cái nhấp nhô lên xuống theo một mẫu sóng sin xếp so le.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-wave.html" style="width:100%;height:100px;border:none"></iframe>
</div>

### Split-Flap

Các chữ cái lật xuống như bảng giờ khởi hành sân bay — mỗi ký tự xoay từ phía trên.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-splitflap.html" style="width:100%;height:100px;border:none"></iframe>
</div>

### Fade Cascade

Các chữ cái mờ-vào từng cái một, tạo ra một sự tiết lộ tăng dần.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-fade.html" style="width:100%;height:100px;border:none"></iframe>
</div>

### Circular Orbit

Văn bản sắp xếp dọc theo một vòng tròn, xoay liên tục.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-circular.html" style="width:100%;height:220px;border:none"></iframe>
</div>

### Glitch

Hiệu ứng nhiễu kỹ thuật số với sự tách kênh màu lục lam và đỏ tươi.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-glitch.html" style="width:100%;height:110px;border:none"></iframe>
</div>

### Bounce In

Các chữ cái rơi từ trên xuống với độ nảy vọt như lò xo.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-bounce.html" style="width:100%;height:110px;border:none"></iframe>
</div>

### Stagger from Center

Các chữ cái bật ra ngoài từ trung tâm kèm xoay.

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/kinetic-stagger.html" style="width:100%;height:100px;border:none"></iframe>
</div>

## Mẹo

- Sau khi chèn, đổi kích thước phần tử để vừa với bố cục slide của bạn.
- HTML được tạo ra là độc lập — nó hoạt động trong các bản xuất và liên kết chia sẻ.
- Để chỉnh sửa hiệu ứng sau khi chèn, nhấn đúp vào phần tử để mở trình soạn HTML.
- Các hiệu ứng phát lại mỗi khi slide trở nên hoạt động trong chế độ trình chiếu.
