# Đóng góp

Các quy ước khi đóng góp cho NavSlides Editor. Tài liệu tham khảo nội bộ là [`docs/code-standards.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/code-standards.md).

## Phong cách mã nguồn

- **Kích thước file**: giữ mỗi file mã nguồn dưới ~200 LOC. Tách nhỏ các component lớn; trích xuất các tiện ích và service.
- **Đặt tên**: tên file kebab-case, mang tính mô tả và tự diễn giải.
- **YAGNI / KISS / DRY**: đừng thiết kế quá mức; ưu tiên thành phần hóa (composition) hơn kế thừa; logic dùng chung nằm trong `shared/src/`, không bao giờ trùng lặp giữa client và server.
- **Bám theo các mẫu hiện có**: đọc mã nguồn lân cận và tuân theo quy ước của nó thay vì giới thiệu cái mới.

## Quy tắc mã nguồn dùng chung

Bất kỳ logic nào được dùng bởi cả client lẫn server đều thuộc về workspace `shared/`. Khi bạn thêm hoặc thay đổi gì đó ở đó, cả hai phía sẽ tiếp nhận qua symlink của workspace — vì vậy hãy giữ nó là Node.js thuần, không có giả định riêng cho client hay server.

## Thêm một loại phần tử

19 loại phần tử được định nghĩa trong `client/src/data/element-defaults.js` — file đó là nguồn chuẩn. Khi thêm một loại, hãy cập nhật nó trước, rồi đến registry của bộ kết xuất (renderer), sau đó giữ cho số đếm trong README đồng bộ (một unit test bảo vệ sự khớp này).

## Commit & trước khi push

- Dùng **conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Giữ thông điệp tập trung vào thay đổi; không tham chiếu AI.
- Chạy **lint** trước khi commit: `npm run lint` (và `npm run format` để áp dụng Prettier).
- Chạy **kiểm thử** trước khi push: `npm run test`. Đừng bỏ qua các bài kiểm thử thất bại để build xanh.
- Không bao giờ commit secrets — `.env`, thông tin đăng nhập, hay token.

## Giữ tài liệu chính xác

Trang này phản chiếu sản phẩm. Khi bạn thay đổi nhãn UI, phím tắt, số đếm, hay tính năng, hãy cập nhật các trang tương ứng — các bài kiểm thử bảo vệ độ chính xác ghim chặt những dữ kiện dễ sai nhất (loại biểu đồ, số lượng preset, phím tắt trình chiếu). Nếu bạn thay đổi UI trình soạn thảo xuất hiện trong một ảnh chụp màn hình, hãy chạy lại script chụp màn hình để hình ảnh luôn cập nhật.

## Mô hình bảo mật

NavSlides Editor là một công cụ self-hosted, đơn người dùng, nơi nội dung lập trình được phong phú (HTML embed, CSS tùy chỉnh, inline SVG) là **nội dung do tác giả tin cậy** theo thiết kế — việc thực thi HTML/CSS/JS do tác giả kiểm soát là cố ý, không phải lỗi. Tuy vậy hãy rà soát bất cứ thứ gì vượt qua một ranh giới tin cậy: các upload/import không đáng tin, liên kết chia sẻ công khai để lộ năng lực trình soạn thảo, rò rỉ nội dung giữa các phiên, lộ thông tin đăng nhập, path traversal, SSRF, hay command injection. Đối với các triển khai hướng ra Internet hoặc đa người dùng, hãy đặt một lớp xác thực bên ngoài ở phía trước.

Xem thêm: [Build từ mã nguồn](/vi/develop/building-from-source) · [Kiến trúc](/vi/develop/architecture).
