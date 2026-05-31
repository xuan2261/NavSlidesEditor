# Đồng bộ đám mây

NavSlides Editor có thể phản chiếu các thư mục `server/data/` và `server/uploads/` của bạn tới bất kỳ nhà cung cấp đám mây nào mà [rclone](https://rclone.org/) hỗ trợ — Drive, S3, Dropbox, B2, SFTP, WebDAV, và hàng chục dịch vụ khác.

## Vì sao chọn rclone

- **Không khóa nhà cung cấp**: cấu hình một lần, đổi nhà cung cấp mà không cần động đến NavSlides
- **Ưu tiên ngoại tuyến**: toàn bộ dữ liệu nằm cục bộ; đám mây là một bản sao lưu phản chiếu
- **Có chọn lọc**: chỉ đồng bộ bài trình chiếu, hoặc bao gồm cả uploads, hoặc bao gồm cả ảnh chụp lịch sử

## Thiết lập

1. Cài đặt `rclone` trên máy chủ đang chạy NavSlides
2. Chạy `rclone config` để thiết lập remote của bạn
3. Cấu hình đích đồng bộ trong **Settings → Cloud Sync**
4. Kích hoạt đồng bộ thủ công hoặc lên lịch qua bộ lập lịch của hệ điều hành

Endpoint điều khiển đồng bộ là `POST /api/sync` (xem `server/routes/sync.js`). Nó gọi ra `rclone` với remote đã cấu hình — nên bất cứ điều gì bạn làm được trên rclone CLI đều có sẵn ở đây.

## Những gì được đồng bộ

- `server/data/*.json` — siêu dữ liệu bài trình chiếu, mẫu và chia sẻ
- `server/data/history/` — ảnh chụp phiên bản
- `server/uploads/` — tài nguyên media

Các bí mật và cấu hình theo từng phiên bản (`server/data/settings.json`) được loại trừ khỏi đồng bộ theo mặc định.
