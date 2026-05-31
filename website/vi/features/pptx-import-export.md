# Nhập & Xuất PPTX

NavSlides Editor chuyển đổi hai chiều với các bộ slide PowerPoint. Nhập một tệp `.pptx` có sẵn để tiếp tục biên soạn trong NavSlides, hoặc xuất ngược lại thành `.pptx` để bàn giao bộ slide cho đồng nghiệp quen dùng PowerPoint.

## Nhập

1. **File → Import → PowerPoint**
2. Chọn một tệp `.pptx`
3. Máy chủ (`server/services/pptx-import/`) phân tích bộ slide, ánh xạ từng shape thành một phần tử NavSlides, và lưu kết quả dưới dạng một bài trình chiếu thông thường

Đã được kiểm thử với bộ chạy corpus: `npm run test:corpus` chạy các bài kiểm thử độ trung thực ngữ nghĩa và chuyển đổi hai chiều dựa trên các fixture trong `./PPTX/`.

## Xuất

- **File → Export → PowerPoint**
- Bộ xuất (`server/services/pptx-exporter.js`) tạo luồng một tệp `.pptx` mới với văn bản, hình ảnh, hình khối, biểu đồ và ghi chú người trình bày được giữ nguyên

## Giới hạn đã biết

- Hoạt ảnh và hiệu ứng chuyển khi nhập sẽ ánh xạ sang tương đương gần nhất của reveal.js; các đường chuyển động PowerPoint kỳ lạ được xấp xỉ
- Tài nguyên video nhúng được trích xuất và liên kết lại từ thư viện media
- SmartArt được kết xuất thành hình ảnh khi nhập
