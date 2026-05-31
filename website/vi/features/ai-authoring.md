# Biên soạn có hỗ trợ AI

NavSlides Editor bộc lộ một **nhà cung cấp AI** dạng cắm-thêm có thể tạo, tinh chỉnh và tái cấu trúc nội dung slide trực tiếp từ trình soạn thảo.

## Chức năng

- **Tạo slide** từ một câu lệnh (prompt) hoặc dàn ý
- **Viết lại** văn bản đã chọn để phù hợp giọng điệu, độ dài hoặc đối tượng
- **Gợi ý bố cục** cho một slide dựa trên nội dung đã có sẵn ở đó
- **Dịch** slide giữa các ngôn ngữ

## Backend cắm-thêm

Nhà cung cấp được chọn theo từng phiên bản triển khai qua các biến môi trường; xem `server/services/ai-provider.js`. Đổi giữa các API được lưu trữ trên máy chủ và một mô hình cục bộ mà không cần động đến phía client.

Endpoint được giới hạn tần suất và được bảo vệ phía máy chủ (`server/services/ai-endpoint-guard.js`), nên mức sử dụng nằm trong hạn ngạch hoặc ngân sách bất kỳ mà bạn cấu hình.

## Quan điểm về quyền riêng tư

Các lệnh gọi AI là tùy chọn theo từng hành động — không có nội dung slide nào rời khỏi máy chủ trừ khi người dùng nhấp một nút AI. Điều này quan trọng đối với các phiên bản tự lưu trữ xử lý tài liệu nhạy cảm.
