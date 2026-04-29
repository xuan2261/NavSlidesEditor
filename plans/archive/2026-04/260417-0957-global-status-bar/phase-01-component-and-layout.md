# Phase 1: Xây dựng UI Component \`StatusBar\` và \`MainLayout\`

## Mục tiêu

Tạo ra một file layout tổng bao gồm khu vực nội dung (Outlet) và phần thanh trạng thái (StatusBar) cố định dưới đáy.

## Các file cần thao tác

- Mới: \`client/src/components/layout/MainLayout.jsx\` (hoặc thư mục tương tự nếu dự án cấu trúc khác)
- Mới/Cập nhật: \`client/src/components/layout/StatusBar.jsx\`
- Cập nhật: \`client/src/index.css\`

## Các bước triển khai

1. **Tạo StatusBar.jsx:**
   - Xây dựng component \`StatusBar\` trả về một div chứa nội dung text tĩnh: \`"Design by Bùi Thanh Xuân - Khoa Kỹ thuật cơ sở - Học viện Hải quân"\`.
   - Có thể thêm các biểu tượng tinh giản (ví dụ icon code/shield).

2. **Cập nhật CSS trong index.css:**
   - Khai báo class \`.status-bar\` (ví dụ: \`height: 24px\`, \`background: var(--surface-1)\` hoặc thẻ màu tối tương tự VS Coda, \`font-size: 11px\`, \`color: var(--text-muted)\`, \`display: flex\`, \`align-items: center\`, ...).
   - Khai báo class \`.main-layout\` cho App Wrapper với \`display: flex; flex-direction: column; height: 100vh;\`.
   - Khai báo class \`.main-layout-content\` với \`flex: 1; overflow: hidden;\`.

3. **Tạo MainLayout.jsx:**
   - Import \`Outlet\` từ \`react-router-dom\`.
   - Cấu trúc:
     \`\`\`jsx
     export default function MainLayout() {
     return (
     <div className="main-layout">
     <div className="main-layout-content">
     <Outlet />
     </div>
     <StatusBar />
     </div>
     );
     }
     \`\`\`

## Tiêu chí hoàn thành

- [ ] Component StatusBar hiển thị đúng thông điệp tác giả (Học viện Hải quân).
- [ ] Responsive tốt, khi co kéo màn hình thanh trạng thái không bị đè lên hay đẩy lệch quá đáng.
- [ ] Sử dụng đúng biến màu CSS (CSS custom properties) của theme hiện tại.
