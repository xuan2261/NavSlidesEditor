# Tổng quan tính năng

Một chuyến tham quan tổng quát mọi điều NavSlides Editor có thể làm.

![Không gian làm việc NavSlides Editor: dải lệnh, bảng slide, canvas và bảng thuộc tính](/img/editor-empty.png)

## Chỉnh sửa

NavSlides Editor được xây dựng quanh một vùng canvas kéo-thả. Mọi phần tử trên slide — hộp văn bản, hình ảnh, hình khối, khối mã, khối LaTeX, biểu đồ — đều có thể:

- **Nhấp để chọn** và kéo để di chuyển vị trí
- **Thay đổi kích thước** bằng cách kéo tay nắm ở góc hoặc cạnh (giữ `Shift` để khóa tỷ lệ khung hình)
- **Xoay** bằng cách kéo tay nắm xoay phía trên phần tử (giữ `Shift` để bắt theo bước 15°)
- **Phân lớp** bằng các điều khiển đưa-lên-trước / đưa-ra-sau
- **Căn chỉnh** bằng thanh công cụ căn chỉnh tích hợp sẵn

Một ngăn xếp hoàn tác/làm lại theo dõi mọi thay đổi (`Ctrl+Z` / `Ctrl+Y`).

## Các loại phần tử

NavSlides Editor có **19 loại phần tử chuẩn**. Dải lệnh Insert hiển thị hơn 30 hành động vì hình khối (rectangle, circle, triangle, arrow, star), gói biểu tượng kỹ thuật và game (10 biến thể) bộc lộ các biến thể con từ các loại phần tử hiện có.

| Phần tử | Mô tả |
|---|---|
| Text | Văn bản phong phú với TipTap — tiêu đề, bold/italic/underline, cỡ chữ & màu, danh sách, bảng, math nội dòng |
| Image | Tải lên hoặc dán hình ảnh; cắt, bộ lọc, bo góc; thay đổi kích thước và di chuyển tự do |
| Shape | Hình chữ nhật, hình tròn, tam giác, mũi tên, ngôi sao — tô màu hoặc viền, bất kỳ màu nào |
| Code | Mã được tô màu cú pháp; 10 giao diện, hơn 25 ngôn ngữ |
| LaTeX / TikZ | Display math và sơ đồ TikZ (KaTeX + TikZJax) với xem trước chia đôi khung trực tiếp |
| HTML | Nhúng HTML cô lập trong iframe cho nội dung web tương tác |
| Markdown | Khối Markdown được kết xuất ra HTML |
| Chart | Biểu đồ Chart.js — bar, line, pie, doughnut, radar, polar area |
| Video | Video cục bộ hoặc theo URL với cắt đầu/cuối và tốc độ phát |
| Audio | Đoạn âm thanh với điều khiển phát |
| Table | Kéo thay đổi kích thước cột/hàng, chỉnh sửa nội dòng, tạo kiểu theo từng ô, ô gộp |
| QR code | Tạo mã QR từ bất kỳ URL hoặc văn bản nào |
| Icon | Hơn 60 biểu tượng Lucide, có thể đổi màu |
| Callout | Dấu chú thích đánh số để ghi chú |
| Drawing | Nét vẽ tay tự do trên canvas |
| Line | Đường nối thẳng hoặc cong với đầu mũi tên |
| SVG | SVG nội dòng với ghi đè fill/stroke |
| Timeline | Dòng thời gian theo ngày với các sự kiện |
| Game | 10 loại game tương tác (bốc thăm tên, khoai tây nóng (hot potato), Jeopardy, bốn góc, tiếp sức, đố vui, Scattergories, live poll, word cloud, matching) |

Danh sách chuẩn nằm tại `client/src/data/element-defaults.js`.

::: tip
Để chèn một phần tử, dùng tab **Insert** trên dải lệnh ở đầu trình soạn thảo, hoặc nhấp chuột phải vào vùng canvas của slide. Các công cụ dạy học hiển thị tại đây: **Mermaid**, **STEM simulation**, **LaTeX / TikZ**, **Technical symbols** và **Games**.
:::

## Slide

- **Thêm, nhân bản, xóa** slide từ bảng bên trái
- **Sắp xếp lại** bằng kéo-thả trong bảng
- **Slide dọc (slide con) hạng nhất** — tạo, chọn, chỉnh sửa và xuất các slide lồng nhau trực tiếp từ bảng slide cho điều hướng dọc kiểu reveal.js
- **35 bố cục** thuộc 6 nhóm (basic, content, layout, data, structure, ending), cùng hơn 20 mẫu trọn bộ bao gồm mô phỏng tương tác và bộ slide trắc nghiệm
- **Nền theo từng slide** — màu đặc, gradient, hình ảnh, hoặc **nền hiệu ứng động (FX)**
- **Ghi chú người trình bày** — mỗi slide có một ô ghi chú tùy chọn hiển thị ở chế độ người trình bày
- **Hoạt ảnh fragment** với trình chỉnh sửa dòng thời gian trực quan và hộp thoại xem trước
- **Hiệu ứng chuyển slide** — chọn từ các hiệu ứng chuyển của reveal.js (fade, slide, zoom, convex, concave, none)
- **Slide ẩn, số trang theo từng slide**, và hệ thống chân trang (chế độ basic / sequence)

## Nền hiệu ứng động (FX)

Đặt nền của slide thành `type: fx` để dùng một trong **8 hiệu ứng canvas động**: gradient-blob, starfield, matrix-rain, constellation, particle-burst, knowledge-graph, orbit-ring, sparkle-trail. Chúng tạo hoạt ảnh trong trình soạn thảo, chế độ trình chiếu và chế độ xem trực tiếp, tôn trọng `prefers-reduced-motion`, và quay về màu đặc khi in.

## Chế độ Game

Chạy **10 loại phần tử game tương tác** — bốc thăm tên, khoai tây nóng (hot potato), Jeopardy, bốn góc, tiếp sức, đố vui, Scattergories, live poll, word cloud và matching — với trang tham gia dành riêng cho người chơi, bảng xếp hạng, tính điểm và phím tắt cho người trình bày. Xem [Chế độ Game](/vi/features/game-mode).

## Hệ thống chân trang

Hệ thống chân trang cho phép bạn định nghĩa một **chuỗi mục (section sequence)** hiển thị ở cuối mỗi slide — hữu ích cho các bài thuyết trình học thuật.

- Định nghĩa các mục có tên (ví dụ: Giới thiệu, Phương pháp, Kết quả, Thảo luận)
- Chấm tiến trình của từng mục sẽ nổi bật khi bạn tiến qua các slide
- Có thể tùy chỉnh phông chữ, cỡ chữ và màu để khớp với giao diện của bạn

## Giao diện & Mẫu

- **11 giao diện reveal.js tích hợp sẵn**: Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula
- **39 mẫu thiết kế (preset) dựa trên token** thuộc 7 nhóm (minimal, editorial, developer, corporate, creative, earthy, bold), được bộc lộ trong ThemeGallery của dải lệnh Design với chuyển đổi trực tiếp và "Apply to all"
- **6 hiệu ứng chuyển**: none, fade, slide, convex, concave, zoom
- **Bảng Design Ideas** — gợi ý bố cục và giao diện theo heuristic (không dùng AI)
- **Mẫu tùy chỉnh**: Lưu bất kỳ slide nào thành một mẫu tái sử dụng để dùng lại trên nhiều bài trình chiếu
- **Ghi đè theo từng slide**: Thay đổi nền hoặc các token giao diện trên từng slide riêng lẻ mà không ảnh hưởng đến phần còn lại của bộ slide

::: tip
Mẫu thiết kế (preset) áp dụng một bảng màu phối hợp, ngăn xếp phông chữ và kiểu phần tử mặc định cùng một lúc — rất tốt để có được vẻ ngoài chỉn chu một cách nhanh chóng.
:::

## Xuất & Chia sẻ

- **HTML độc lập** — một tệp `.html` duy nhất phát reveal.js từ CDN
- **HTML ngoại tuyến** — toàn bộ tài nguyên CDN được nhúng trực tiếp; hoạt động không cần internet
- **PDF** — sẵn sàng để in qua hộp thoại in của trình duyệt với tất cả fragment được mở rộng
- **PPTX** — xuất tương thích PowerPoint
- **Liên kết chia sẻ** — tạo một URL để chia sẻ chế độ xem chỉ đọc hoặc có thể chỉnh sửa
- **GitHub push** — commit bài trình chiếu của bạn trực tiếp vào một kho lưu trữ GitHub

Xem [Xuất & Chia sẻ](/vi/features/export) để biết chi tiết.

## Đồng bộ đám mây

Đồng bộ thư mục bài trình chiếu của bạn với một nhà cung cấp lưu trữ từ xa bằng [rclone](https://rclone.org/):

- **Proton Drive** — hỗ trợ hạng nhất với thiết lập có hướng dẫn
- **Tương thích S3** — AWS S3, Backblaze B2, Cloudflare R2, MinIO
- **Google Drive, Dropbox** — qua các remote rclone tiêu chuẩn
- Đồng bộ thủ công hoặc đồng bộ nền tự động theo khoảng thời gian có thể cấu hình

## Lịch sử phiên bản

NavSlides Editor duy trì lịch sử phiên bản cục bộ cho mỗi bài trình chiếu:

- Tự động chụp ảnh lúc lưu
- Duyệt và khôi phục bất kỳ phiên bản trước nào
- Chế độ xem khác biệt (diff) cho thấy slide nào đã thay đổi giữa các phiên bản
