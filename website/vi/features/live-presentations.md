# Trình chiếu trực tiếp

NavSlides Editor đi kèm một **chế độ trình chiếu trực tiếp** tích hợp sẵn được hỗ trợ bởi Socket.IO. Trình chiếu từ một máy và để người xem theo dõi trên trình duyệt của họ — không cần dịch vụ bên ngoài. Người trình bày giữ một **presenter token do máy chủ cấp** nên chỉ máy chủ lưu trữ mới có thể điều khiển bộ slide.

## Các chế độ

- **Live View** (`/live/:roomCode`): trình xem chỉ đọc phản chiếu các thay đổi slide theo thời gian thực
- **Speaker View** (`/speaker/:roomCode`): bảng điều khiển của người trình bày với ghi chú, bản xem trước slide kế tiếp và bộ đếm giờ
- **Remote Control** (`/remote/:roomCode`): điều khiển bộ slide từ điện thoại hoặc máy tính bảng
- **Chú thích**: công cụ bút, con trỏ laser, bút tô sáng và tẩy đồng bộ tới mọi người xem theo thời gian thực và **được lưu theo từng slide** khi người xem tham gia lại

## Điều khiển của người trình bày

- **Điều hướng kiểu PowerPoint**: `F5`, `Home`, `End` và các phím mũi tên
- **Lớp phủ màn hình đen / trắng**: nhấn `B` hoặc `W` để làm trống chế độ xem của khán giả
- **Bộ đếm giờ trực tiếp dùng chung** được đồng bộ giữa chế độ người trình bày và người xem

## Bắt đầu một phiên

1. Mở một bài trình chiếu trong trình soạn thảo
2. Nhấp **Present → Live**
3. Chia sẻ mã phòng được tạo hoặc URL với người xem

Trạng thái phòng nằm trong bộ nhớ trên máy chủ (`server/services/live-rooms.js`); các phòng hết hạn khi người trình bày ngắt kết nối.

## Ghi chú triển khai

- Truyền tải thời gian thực: Socket.IO qua namespace `/ws`
- Các sự kiện thay đổi slide được phát tới mọi người xem trong phòng
- Nét chú thích dùng cùng socket để giữ độ trễ dưới một khung hình
