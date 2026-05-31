# Chế độ Game

Biến bất kỳ bộ slide nào thành một hoạt động tương tác với khán giả. Chế độ Game tái sử dụng bộ máy slide để kết xuất game trong khi một phòng Socket.IO riêng thu thập đầu vào của người chơi, theo dõi điểm số và hiển thị bảng xếp hạng.

## Các loại game

NavSlides đi kèm **7 loại phần tử game tương tác**:

| Game | Chức năng |
|---|---|
| Bốc thăm tên (name picker) | Bộ chọn ngẫu nhiên kiểu vòng quay hoặc xúc xắc (rất tốt để gọi tên ngẫu nhiên) |
| Khoai tây nóng (hot potato) | Chuyền câu hỏi tính giờ với bảng xếp hạng tùy chọn |
| Jeopardy | Bảng chủ đề theo đội với các giá trị điểm |
| Bốn góc (four corners) | Người chơi cam kết với một trong bốn đáp án/góc |
| Tiếp sức (relay race) | Đua theo đội qua một bộ câu hỏi, chia theo vòng |
| Đố vui (trivia champ) | Đố vui nhiều vòng với các vòng chớp nhoáng (lightning) và jackpot tùy chọn |
| Scattergories | Động não theo chủ đề tính giờ, chấm điểm dựa trên đáp án độc nhất |

Một game chỉ là một **loại phần tử** khác mà bạn chèn lên slide, nên một bài trình chiếu có sẵn có thể được nâng lên thành game mà không cần biên soạn một tệp riêng.

## Vai trò

- **Máy chủ lưu trữ / người trình bày**: chạy bộ slide và điều khiển game bằng phím tắt người trình bày (HUD, bộ đếm giờ, hiện đáp án, bảng xếp hạng, tạm dừng, chọn đội)
- **Người chơi**: tham gia từ một trang tham gia dành riêng cho người chơi bằng mã game và biệt danh, rồi trả lời từ thiết bị của mình

## Khi nào nên dùng

- Bài giảng và workshop nơi bạn muốn kiểm tra mức độ hiểu bài nhanh
- Các phiên hội nghị nơi bạn muốn thu thập ý kiến khán giả
- Hoạt động trong lớp học không cần đến một LMS nặng nề

Trạng thái game và điểm số được xử lý bởi một bộ xử lý socket chuyên dụng (`server/services/game-socket-handler.js`) tách biệt với các phòng trình chiếu trực tiếp.
