# Nhập & Xuất PPTX

NavSlides Editor nhập bộ slide PowerPoint để chỉnh sửa và xuất bài trình chiếu trở lại định dạng `.pptx`.

## Nhập

1. Tại **trang chủ**, chọn **Import → Import PPTX**
2. Chọn một tệp `.pptx`
3. Máy chủ phân tích bộ slide, ánh xạ nội dung được hỗ trợ thành phần tử NavSlides, lưu bài trình chiếu và giữ gói tải lên gốc để tải xuống không mất dữ liệu khi đủ điều kiện

## Xuất

Trong trình biên tập, mở **File → Export PPTX**. Bộ slide đã nhập có thể cung cấp
ba lựa chọn độ trung thực riêng biệt:

- **Download Original** tải lại gói nguồn bất biến đã được xác minh. Tệp này không
  chứa các chỉnh sửa trong NavSlides.
- **Export Validated Edited Revision** chỉ khả dụng khi thẩm quyền gói hiện tại và
  các trình xác thực bắt buộc đều đủ điều kiện. Nếu không chắc chắn về xác thực hoặc
  dọn dẹp, đường xuất này sẽ bị chặn thay vì âm thầm thay bằng kiểu xuất khác.
- **Generate Reconstructed PPTX** tạo tệp mới từ mô hình của trình biên tập. Đây
  không phải là xuất hai chiều; nội dung được hỗ trợ vẫn có thể chỉnh sửa khi có thể,
  còn hình ảnh không được hỗ trợ có thể dùng ảnh raster hoặc phần tử giữ chỗ.

## Giới hạn đã biết

- Quy trình nhập và xuất dựng lại không phải là vòng lặp PowerPoint giống từng byte. Siêu dữ liệu riêng của PowerPoint, hoạt ảnh nâng cao, hiệu ứng chuyển và hiệu ứng ít gặp có thể bị đơn giản hóa hoặc bỏ qua.
- SmartArt được xấp xỉ thành **hình khối có thể chỉnh sửa** khi dữ liệu sơ đồ ánh xạ được. Bố cục phức tạp có thể bị đơn giản hóa, cắt bớt hoặc thay bằng phần tử giữ chỗ.
- Một số biến thể biểu đồ, đối tượng nhóm, media, phông chữ, vùng cắt và hình học có thể được xấp xỉ. Cảnh báo nhập sẽ nhóm các trường hợp này theo loại.
- Khả năng xuất bản chỉnh sửa đã xác thực phụ thuộc vào năng lực triển khai và bản
  thân bước này không chứng minh độ trung thực hình ảnh trong PowerPoint. Hãy dùng
  **Download Original** khi mục tiêu là khôi phục gói đã tải lên.

Ranh giới chi tiết về khôi phục, điều kiện xác thực và bằng chứng được duy trì trong
[Export Fidelity and Known Limitations](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/export-fidelity-and-limits.md).
