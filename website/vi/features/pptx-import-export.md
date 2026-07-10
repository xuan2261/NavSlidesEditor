# Nhập & Xuất PPTX

NavSlides Editor nhập bộ slide PowerPoint để chỉnh sửa và xuất bài trình chiếu trở lại định dạng `.pptx`.

## Nhập

1. Tại **trang chủ**, chọn **Import → Import PPTX**
2. Chọn một tệp `.pptx`
3. Máy chủ phân tích bộ slide, ánh xạ nội dung được hỗ trợ thành phần tử NavSlides, lưu bài trình chiếu và giữ gói tải lên gốc để tải xuống không mất dữ liệu khi đủ điều kiện

Đã được kiểm thử với bộ chạy corpus: `npm run test:corpus` chạy các bài kiểm thử độ trung thực ngữ nghĩa và chuyển đổi hai chiều dựa trên các fixture trong `./PPTX/`.

## Xuất

- Trong trình biên tập, chọn **File → Export PPTX**.
- Với bài trình chiếu đã nhập nhưng chưa chỉnh sửa, NavSlides có thể tải xuống **byte gốc** của tệp đã tải lên nếu gói gốc vẫn còn.
- Sau khi có chỉnh sửa cục bộ, chỉnh sửa đã được máy chủ ghi nhận, hoặc khi gói gốc không còn, NavSlides dùng quy trình **xuất dựng lại ở phía máy khách**. Văn bản, hình ảnh, hình khối, bảng, biểu đồ và ghi chú được giữ ở dạng có thể chỉnh sửa khi có thể; phần tử hình ảnh không được hỗ trợ có thể dùng ảnh raster dự phòng.

## Giới hạn đã biết

- Quy trình nhập và xuất dựng lại không phải là vòng lặp PowerPoint giống từng byte. Siêu dữ liệu riêng của PowerPoint, hoạt ảnh nâng cao, hiệu ứng chuyển và hiệu ứng ít gặp có thể bị đơn giản hóa hoặc bỏ qua.
- SmartArt được xấp xỉ thành **hình khối có thể chỉnh sửa** khi dữ liệu sơ đồ ánh xạ được. Bố cục phức tạp có thể bị đơn giản hóa, cắt bớt hoặc thay bằng phần tử giữ chỗ.
- Một số biến thể biểu đồ, đối tượng nhóm, media, phông chữ, vùng cắt và hình học có thể được xấp xỉ. Cảnh báo nhập sẽ nhóm các trường hợp này theo loại.
- Chỉ có thể xuất byte gốc khi bài trình chiếu chưa được chỉnh sửa và gói gốc đã lưu vượt qua bước xác thực của máy chủ.
