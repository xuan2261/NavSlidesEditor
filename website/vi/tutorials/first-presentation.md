# Bài Trình Chiếu Đầu Tiên Của Bạn

Hướng dẫn này sẽ dẫn bạn qua việc tạo một bài trình chiếu hoàn chỉnh từ đầu — từ một bộ slide trắng đến tệp HTML đã xuất.

![NavSlides Editor với một bộ slide đang mở](/img/editor-empty.png)

## 1. Tạo một bài trình chiếu mới

1. Mở NavSlides Editor trong trình duyệt của bạn (mặc định: `http://localhost:3002`).
2. Trên màn hình chính, nhấn **New Presentation**.
3. Một hộp thoại hiện ra yêu cầu bạn đặt tên cho bài trình chiếu. Nhập tên (ví dụ: "My First Deck") và nhấn **Create**.

## 2. Chọn một mẫu

Sau khi nhấn Create, bạn sẽ được đưa ra lựa chọn các mẫu khởi đầu:

- **Blank** — một slide trống duy nhất không có phần tử nào đặt sẵn
- **Title Slide** — một slide với tiêu đề căn giữa và chỗ dành sẵn cho phụ đề
- **Academic** — slide tiêu đề + slide dàn ý với chuỗi chân trang
- **Minimal** — bố cục gọn gàng, một phông chữ, không trang trí

Trong hướng dẫn này, hãy chọn **Title Slide**.

## 3. Chỉnh sửa slide tiêu đề

Bạn sẽ thấy một slide với hai chỗ dành sẵn cho văn bản: một tiêu đề lớn và một phụ đề nhỏ hơn.

1. **Nhấn đúp vào tiêu đề** ("Click to add title") để vào chế độ chỉnh sửa.
2. Gõ tiêu đề bài trình chiếu của bạn — ví dụ, *Introduction to Reveal.js*.
3. Nhấn `Escape` để hoàn tất chỉnh sửa tiêu đề.
4. **Nhấn đúp vào phụ đề** và gõ tên bạn hoặc một mô tả ngắn.
5. Nhấn `Escape` lần nữa.

Để thay đổi cỡ chữ:
1. Nhấn đúp vào tiêu đề để vào lại chế độ chỉnh sửa.
2. Chọn toàn bộ văn bản (`Ctrl+A`).
3. Dùng ô cỡ chữ trên thanh công cụ và đổi sang cỡ bạn muốn.
4. Nhấn `Escape`.

## 4. Thêm một slide mới

1. Trong **bảng slide** bên trái, nhấn nút **+** ở dưới cùng, hoặc nhấn chuột phải vào một slide hiện có và chọn **Add Slide After**.
2. Một slide trống mới xuất hiện.
3. Nhấn vào ảnh thu nhỏ của slide mới để chuyển đến nó.

## 5. Thêm một hộp văn bản và một hình ảnh

**Thêm một hộp văn bản:**
1. Nhấn chuột phải lên vùng canvas trống của slide và chọn **Insert → Text Box**.
2. Một hộp văn bản xuất hiện. Nhấn đúp vào nó và gõ nội dung.
3. Dùng thanh công cụ để định dạng văn bản (đậm, màu, cỡ chữ, v.v.).

**Thêm một hình ảnh:**
1. Nhấn chuột phải lên vùng canvas và chọn **Insert → Image**.
2. Một trình chọn tệp mở ra. Chọn một hình ảnh từ máy tính của bạn.
3. Hình ảnh xuất hiện trên slide. Kéo để định vị nó, và kéo các góc để đổi kích thước.

## 6. Áp dụng một giao diện

1. Mở thẻ **Design** trong dải lệnh (ribbon).
2. Nhấn **Themes** để mở ThemeGallery, nơi hiển thị 39 mẫu thiết kế (preset) dựa trên token thuộc 7 danh mục cùng với 11 giao diện nền tích hợp sẵn của reveal.js.
3. Nhấn vào bất kỳ mẫu thiết kế (preset) hoặc giao diện nền nào để áp dụng.
4. Nền và kiểu chữ cập nhật trên tất cả các slide ngay lập tức. Dùng **Apply to all** để xóa các tùy chỉnh riêng cho từng slide.

## 7. Thêm một chuyển cảnh cho slide

1. Nhấn vào một slide trong bảng bên trái để chọn nó.
2. Mở bảng **Slide Settings** (nhấn chuột phải → Slide Properties, hoặc biểu tượng bánh răng trong bảng slide).
3. Trong mục **Transition**, chọn **Fade** từ danh sách thả xuống.
4. Bạn cũng có thể đặt tốc độ chuyển cảnh: Slow, Normal, hoặc Fast.

## 8. Trình chiếu

1. Nhấn nút **Present** (biểu tượng play) trên thanh công cụ phía trên, hoặc nhấn `F5`.
2. Bài trình chiếu vào chế độ toàn màn hình qua reveal.js.
3. Dùng **các phím mũi tên** để chuyển slide.
4. Nhấn **S** để mở cửa sổ **ghi chú người trình bày** trong một tab trình duyệt riêng.
5. Nhấn **Escape** để thoát toàn màn hình.

## 9. Xuất ra HTML

1. Nhấn **File → Export → HTML**.
2. Lưu tệp `.html` vào máy tính của bạn.
3. Mở tệp trong bất kỳ trình duyệt nào — bài trình chiếu của bạn là độc lập và có thể chia sẻ.

::: tip
Nếu bạn dự định trình chiếu mà không có kết nối internet (ví dụ, tại một hội nghị), hãy chọn **File → Export → Offline HTML** thay thế để nhúng toàn bộ tài nguyên vào trong tệp.
:::

Chúc mừng — bạn đã xây dựng và xuất bài trình chiếu đầu tiên của mình!

**Bước tiếp theo:**
- [Hướng dẫn Slide Học thuật](/vi/tutorials/academic-slides) — chân trang, LaTeX, bố cục hai cột
- [Sử dụng LaTeX & Toán học](/vi/tutorials/using-latex) — đi sâu vào phương trình và sơ đồ TikZ
