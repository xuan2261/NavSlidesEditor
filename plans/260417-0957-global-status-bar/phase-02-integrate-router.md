# Phase 2: Tích hợp vào Router App.jsx & Kiểm thử

## Mục tiêu
Đưa `MainLayout` vào làm Route bọc ngoài cho các trang quản trị và thao tác, đồng thời kiểm tra và không để lộ thanh này ở màn hình thực thi (Presentation).

## Các file cần thao tác
- Cập nhật: `client/src/App.jsx`

## Các bước triển khai
1. **Import `MainLayout` vào `App.jsx`**.
2. **Cập nhật `AppRoutes`:**
   - Tạo thẻ `<Route element={<MainLayout />}>` bên trong thẻ định tuyến `<Routes>`.
   - Di chuyển các Component Route sau đây vào làm con của `<Route element={<MainLayout />}>`:
     - `<Route path="/" element={<HomePage ... />} />`
     - `<Route path="/editor/:id" element={<EditorRoute />} />`
     - `<Route path="/template/:id" element={<EditorRoute isTemplate />} />`
     - `<Route path="/settings" element={<SettingsPage />} />`
     - `<Route path="/explore" element={<ExplorePage />} />`
   - Đảm bảo các route Live, Remote và Speaker vẫn nằm ở bậc ngang hàng bên dưới chứ không bị bọc bởi `MainLayout`.
3. **Chạy trình phát triển (Local Dev Server) & Kiểm duyệt:**
   - Kích hoạt ứng dụng và truy cập Route `/`. Kiểm tra Status Bar có hiển thị ở chân màn hình không.
   - Nhấn mở một Slide mẫu, chuyển sang Router `/editor/:id`. Xác nhận Status Bar vẫn tồn tại.
   - Chuyển tiếp sang `Settings` và `Explore` để thấy sự đồng bộ hiển thị (Global view).
   - Khởi động chế độ Presentation (Play), check qua route `/live/:roomCode` hoặc `/speaker/:roomCode` để bảo đảm chữ ký thiết kế không bị rò rỉ vào không gian trình chiếu chính thức.

## Tiêu chí hoàn thành
- [ ] Router bọc chính xác chỉ những page cần thiết.
- [ ] Theme (Sáng/Tối) hoạt động bình thường, layout bên trong EditorPage, HomePage không bị méo lệch, padding/flex container ở UI chính vẫn giữ nguyên tỷ lệ cấu trúc.
- [ ] Chữ ký Status Bar xuất hiện tĩnh ổn định.
