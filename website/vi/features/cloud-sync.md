# Đồng bộ đám mây

NavSlides Editor xuất các gói bài trình chiếu tới remote [rclone](https://rclone.org/) đã cấu hình. Đây là phân phối bài trình chiếu, không phải phản chiếu hay sao lưu toàn bộ thư mục dữ liệu và uploads của máy chủ.

## Vì sao chọn rclone

- **Không khóa nhà cung cấp**: cấu hình một lần, đổi nhà cung cấp mà không cần động đến NavSlides
- **Soạn thảo cục bộ**: dữ liệu bài trình chiếu nằm trên máy; đồng bộ đám mây cần kết nối mạng và remote rclone đã cấu hình.
- **Phân phối toàn thư viện hoặc một bài**: đồng bộ các bài trình chiếu hợp lệ hoặc xuất một bài cùng media được tham chiếu.

## Thiết lập

1. Cài đặt `rclone` trên máy chủ đang chạy NavSlides
2. Chạy `rclone config` để thiết lập remote của bạn
3. Cấu hình đích đồng bộ trong **Settings → Cloud Sync**
4. Kích hoạt đồng bộ thủ công hoặc lên lịch qua bộ lập lịch của hệ điều hành

Ứng dụng cung cấp các thao tác cố định qua `POST /api/rclone/sync` và `POST /api/rclone/sync-single`, không cung cấp mọi thao tác của rclone CLI.

## Những gì được đồng bộ

Mã tạo gói tại [`server/routes/sync.js`](https://github.com/xuan2261/NavSlidesEditor/blob/main/server/routes/sync.js) sở hữu cấu trúc dữ liệu: HTML và JSON của bài trình chiếu, nội dung có nguồn gói khi khả dụng và uploads được tham chiếu. Settings, dữ liệu mẫu/chia sẻ và thư mục lịch sử của phiên bản cài đặt không phải dữ liệu sao lưu toàn bộ máy chủ. Giữ sao lưu vận hành tách biệt với phân phối bài trình chiếu lên đám mây.
