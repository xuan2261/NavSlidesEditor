# HTML Embeds & p5.js

Nhúng nội dung tương tác tùy chỉnh trực tiếp lên slide của bạn — trực quan hóa D3, hiệu ứng canvas, HTML tùy ý, hoặc các bản phác thảo p5.js.

## HTML / D3 embed

1. Nhấn **Embed** trên thanh công cụ.
2. Một trình soạn mã mở ra với một biểu đồ phân tán D3 khởi đầu.
3. Viết bất kỳ HTML hợp lệ nào — nội dung hiển thị bên trong một iframe được cách ly (sandbox).
4. Nhấn **Apply** để chèn. Phần tử xem trước trực tiếp trên slide.

HTML được nhúng hoàn toàn độc lập. Nó hoạt động trong chế độ trình chiếu, các tệp đã xuất, và liên kết chia sẻ. Các script bên ngoài (D3, Three.js, v.v.) có thể được tải qua CDN.

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/d3-scatter.html" style="width:100%;height:220px;border:none"></iframe>
</div>

## Bản phác thảo p5.js

1. Nhấn **p5** trên thanh công cụ.
2. Một trình soạn mã mở ra đã được nạp sẵn thư viện p5.js.
3. Viết bản phác thảo p5.js của bạn bằng `setup()` và `draw()`.
4. Nhấn **Apply**. Bản phác thảo hiển thị trực tiếp trên slide.

### Kết quả mẫu

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/p5-stars.html" style="width:100%;height:220px;border:none"></iframe>
</div>

## Hiệu ứng Manim

1. Nhấn **Manim** trên thanh công cụ.
2. Viết một cảnh Manim trong trình soạn mã.
3. Nhấn **Render** — máy chủ hiển thị hiệu ứng và nhúng video.

::: warning
Việc hiển thị Manim yêu cầu gói Manim được cài đặt trên máy chủ. Quá trình hiển thị có thể mất vài giây tùy thuộc vào độ phức tạp.
:::

## Mẹo

- Các HTML embed nhận `EMBED_WIDTH` và `EMBED_HEIGHT` dưới dạng biến toàn cục JavaScript — dùng chúng để định kích thước canvas của bạn một cách linh hoạt.
- Nhấn nút **Preview Slide** trong bảng bên phải để kiểm tra embed của bạn trong chế độ trình chiếu mà không cần điều hướng qua toàn bộ bộ slide.
- Các embed hỗ trợ tương tác chuột trong chế độ trình chiếu — hiệu ứng di chuột, trình xử lý nhấp chuột, và cuộn đều hoạt động bên trong iframe.
