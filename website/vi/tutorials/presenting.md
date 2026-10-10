# Trình Chiếu & Xuất

## Chế độ trình chiếu

Nhấn nút **Present** (biểu tượng play) ở thanh công cụ phía trên bên phải để mở toàn bộ bài trình chiếu trong một cửa sổ mới.

### Các điều khiển trong chế độ trình chiếu

| Phím | Hành động |
|-----|--------|
| `Right` / `Space` | Slide tiếp theo |
| `Left` | Slide trước đó |
| `S` | Mở ghi chú người trình bày |
| `F` | Bật/tắt toàn màn hình |
| `Escape` | Thoát toàn màn hình hoặc đóng lớp phủ |
| `O` | Tổng quan / lưới slide |

## Xem trước một slide đơn lẻ

Để kiểm tra một slide đơn lẻ mà không trình chiếu toàn bộ bộ slide:

1. Nhấn nút **Preview Slide N** ở đầu bảng bên phải.
2. Slide hiện tại mở ra trong một cửa sổ mới, được kết xuất đầy đủ ở chế độ trình chiếu.

Điều này hữu ích để kiểm tra HTML embed, hiệu ứng, và các tính năng tương tác mà không cần điều hướng qua toàn bộ bộ slide.

## Ghi chú người trình bày

1. Trong trình soạn, nhấn vào vùng **Notes** ở dưới cùng của bảng thuộc tính.
2. Gõ ghi chú người trình bày của bạn cho slide hiện tại.
3. Trong chế độ trình chiếu, nhấn `S` để mở chế độ xem người trình bày với ghi chú, đồng hồ bấm giờ, và bản xem trước slide tiếp theo.

## Giao diện

Thay đổi giao diện hình ảnh trong thanh công cụ ở mục **Theme**:

- Black, White, League, Beige, Sky, Night, Serif, Simple, Solarized, Moon, Dracula

Giao diện ảnh hưởng đến màu nền, màu chữ, và kiểu tiêu đề. Định dạng ở cấp phần tử được ưu tiên hơn các mặc định của giao diện.

## Chân trang & số trang

1. Mở cài đặt chân trang trong thanh công cụ.
2. Cấu hình:
   - **Section labels** — hiển thị phần đang hoạt động trong một thanh tiến trình
   - **Page numbers** — `n/total` hoặc chỉ `n`
   - **Clock / Timer** — đồng hồ 12h, đồng hồ 24h, bộ đếm tiến hoặc đếm lùi

## Tùy chọn xuất

### HTML

Nhấn **Export** > **Download HTML** để xuất HTML tham chiếu runtime cục bộ do manifest quản lý. Các tài nguyên runtime và media được tham chiếu phải còn truy cập được; xem [Xuất & Chia sẻ](/vi/features/export) để biết giới hạn của HTML thông thường và ngoại tuyến.

### HTML một slide

Nhấn **Export** > **Export Slide HTML** để tải xuống chỉ slide hiện tại.

### PDF

Nhấn **Export** > **Export PDF** để tạo một PDF sẵn sàng in với một trang cho mỗi slide. Các trạng thái mảnh (fragment) được mở rộng thành các trang riêng biệt.

### PowerPoint

Dùng **Export** > **Export PPTX**, rồi chọn chế độ phù hợp. Xem [Nhập & Xuất PPTX](/vi/features/pptx-import-export) về khôi phục Original, xuất Edited đã xác thực và tạo Reconstructed; các chế độ không có chung một cam kết về khả năng chỉnh sửa hay độ trung thực.

## Chia sẻ

1. Nhấn nút **Share** trên thanh công cụ.
2. Tạo liên kết chỉ xem, có thể kèm tên, mật khẩu hoặc thời hạn hết hạn.
3. Người xem cần truy cập được phiên bản đang chạy qua mạng và đáp ứng yêu cầu mật khẩu, thời hạn của liên kết. Điều này không cho phép cộng tác chỉnh sửa.
4. Thu hồi liên kết để gỡ quyền truy cập đó. Xem [Xuất & Chia sẻ](/vi/features/export).

### Ví dụ: slide đã xuất

<div style="border: 1px solid #333; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <iframe src="/NavSlidesEditor/demos/slide-export.html" style="width:100%;height:220px;border:none"></iframe>
</div>
