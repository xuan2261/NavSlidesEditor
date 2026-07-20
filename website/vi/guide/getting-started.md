# Bắt đầu

## NavSlides Editor là gì?

NavSlides Editor là một trình soạn thảo bài trình chiếu WYSIWYG chạy trên trình duyệt, có thể tự lưu trữ, được xây dựng trên nền [reveal.js](https://revealjs.com/). Nó mang lại độ tinh tế trực quan của các công cụ làm slide hiện đại mà không cần tài khoản đám mây — bạn có thể chạy nó trên laptop, máy chủ tại nhà hoặc một container Docker.

Khác với việc chỉnh sửa trực tiếp các tệp Markdown hay HTML reveal.js thô, NavSlides Editor cho phép bạn:

- **Nhấp và gõ** trực tiếp lên các phần tử slide với định dạng phong phú
- **Kéo, đổi kích thước và xoay** hộp văn bản, hình ảnh, hình khối và khối mã một cách trực quan
- **Xem trước tức thì** — không cần bước build, không cần tải lại
- **Xuất ra mọi nơi** — HTML, HTML ngoại tuyến, PDF hoặc PPTX

## Các tính năng chính

- **Định dạng văn bản phong phú** qua TipTap: tiêu đề, in đậm/in nghiêng/gạch chân, cỡ chữ & màu chữ, tô sáng (highlight), danh sách, bảng và khối mã
- **Giao diện dải lệnh (ribbon)** — một dải lệnh quen thuộc theo phong cách PowerPoint (Home, Insert, Design, View) cùng tab Format theo ngữ cảnh xuất hiện khi một phần tử được chọn; menu **More** giúp các nhóm lệnh ít dùng vẫn truy cập được khi chiều rộng bị giới hạn
- **Thanh trạng thái kiểu PowerPoint** — thanh trượt thu phóng với các nút Fit, vị trí slide hiện tại và bộ chuyển đổi chế độ xem Normal / Slide Sorter / Present; thanh trạng thái, dải lệnh, canvas, phím tắt và bảng lệnh dùng chung một trạng thái thu phóng
- **Không gian làm việc thích ứng** — bộ điều hướng slide và trình kiểm tra chung Properties / Design Ideas được ghim khi đủ chỗ, đồng thời mở dưới dạng lớp phủ ở chiều rộng hẹp hơn để ưu tiên canvas
- **Chỉnh sửa bằng chuột, bút và cảm ứng** — chọn, kéo, đổi kích thước, xoay và cắt qua một mô hình tương tác con trỏ thống nhất, kèm thu phóng bằng hai ngón tay trên thiết bị cảm ứng
- **LaTeX & TikZ** — viết công thức toán dạng hiển thị hoặc sơ đồ TikZ hoàn chỉnh trong trình soạn thảo chia đôi khung với xem trước trực tiếp
- **Biểu đồ** — chèn biểu đồ cột, đường, tròn, vành khuyên (doughnut), radar và vùng cực (polar area) được vận hành bởi Chart.js
- **Điều hướng slide** — slide dọc (slide con) hạng nhất, slide có thể sắp xếp lại, ghi chú người trình bày
- **Giao diện & mẫu thiết kế** — 11 giao diện reveal.js dựng sẵn cùng 39 mẫu thiết kế (preset) dựa trên token trải khắp 7 nhóm
- **Chuỗi chân trang** — chân trang tiến độ theo từng phần tự động cho các bài thuyết trình học thuật
- **Tùy chọn xuất** — HTML độc lập, HTML ngoại tuyến (nhúng CDN), PDF, PPTX, liên kết chia sẻ, đẩy lên GitHub
- **Đồng bộ đám mây** — Proton Drive, S3, Google Drive hoặc bất kỳ remote rclone nào

## Chọn phương thức cài đặt

NavSlides Editor có thể chạy theo ba cách:

| Phương thức | Phù hợp nhất cho |
|--------|----------|
| **Docker** (khuyến nghị) | Máy chủ, thiết lập chạy liên tục, nhóm làm việc |
| **Ứng dụng desktop** | Một người dùng, ngoại tuyến, tệp cục bộ |
| **Node.js từ mã nguồn** | Phát triển, tùy biến |

Xem [Hướng dẫn cài đặt](/vi/guide/installation) để có hướng dẫn từng bước.

## Mở trình soạn thảo

Sau khi chạy, hãy truy cập `http://localhost:3002` trên trình duyệt của bạn. Bạn sẽ vào **màn hình chính**, nơi hiển thị:

![Bảng điều khiển màn hình chính của NavSlides Editor](/img/home-dashboard.png)


- **New Presentation** — tạo một bài trình chiếu trống hoặc chọn một mẫu
- **Recent files** — mở lại các bài trình chiếu bạn đã làm việc trước đó
- **Open file** — tải một tệp bài trình chiếu `.json` có sẵn từ ổ đĩa

## Slide đầu tiên của bạn

1. Nhấp **New Presentation** trên màn hình chính.
2. Chọn một mẫu (hoặc bắt đầu từ bản trống).
3. Nhấp vào dòng văn bản tiêu đề trên slide đầu tiên và bắt đầu gõ.
4. Dùng tab **Home** của dải lệnh (hoặc tab **Format** theo ngữ cảnh) để đổi phông chữ, cỡ chữ hoặc màu sắc.
5. Nhấn **Escape** để bỏ chọn và quay lại chế độ chọn slide.
6. Nhấp nút **+** trong bảng slide để thêm một slide mới.

Các thay đổi được tự động lưu sau một khoảng trễ ngắn. Nhấn **Ctrl+S** (hoặc
**Cmd+S** trên macOS) để lưu ngay; nút Save trên thanh truy cập nhanh, menu File
và bảng lệnh đều dùng chung lệnh lưu này.

## Các bước tiếp theo

- [Cài đặt](/vi/guide/installation) — thiết lập chi tiết cho Docker, desktop và mã nguồn
- [Bài trình chiếu đầu tiên của bạn](/vi/tutorials/first-presentation) — hướng dẫn đầy đủ từ bài trình chiếu trống đến tệp đã xuất
