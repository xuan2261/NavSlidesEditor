# Phase 2: Mở Rộng Elements Insertion

## Mục tiêu
Dựng các test case để đi qua toàn cảnh Toolbar Elements. Viết kịch bản tự động xác nhận việc render của hơn >5+ loại Content blocks (Text, Shape, Media, Code, LaTeX) ngay trên Canvas mà không lỗi. Đảm bảo logic God component (React hook) render chuẩn DOM cho SlideCanvas.

## Files to Modify/Create
- `tests/e2e/pages/EditorPage.js` [MODIFY]
- `tests/e2e/elements.spec.js` [NEW]

## Phân tích & Triển khai
Mở rộng thêm methods vào `EditorPage.js` POM. Thêm các wrapper methods để handle Dropdown menu của Toolbar:

1. **Shape Insertion:** `addShape(type)` – Click button shape, wait for dropdown, select `[title="type"]`.
2. **Text / Code / LaTeX:** `addNode(toolTitle)` – Simple click & assert canvas node rendered.
3. **Table:** `addTable(rows, cols)` (Note: Chức năng table hiện tại dùng `window.prompt`. Cần override dialog của Playwright).

### Xử Lý Dialog Proxy
Khi click Add Table hoặc Image/Video URL, app hiển thị `window.prompt`.
Playwright xử lý nó thông qua event `page.on('dialog', ...)`
Kịch bản Test cần mock/accept prompt event này trong `elements.spec.js`.

### Cấu trúc E2E Test (elements.spec.js)
```javascript
test('Toolbar inserts structural elements correctly', async ({ page }) => {
   // Khởi tạo trang trình chiếu mới qua POM.
   // Test chèn Text box.
   // Test chèn Chart.
   // Giả lập dialogue: page.once('dialog', dialog => dialog.accept('5'))
   // Test chèn Table...
});
```

## Checklist
- [ ] Update POM `EditorPage.js` hỗ trợ handle Dialogs.
- [ ] Khởi tạo `elements.spec.js`.
- [ ] Viết test Insert Base (Text, Shape).
- [ ] Viết test Insert Media/Advanced (Code, Table).
- [ ] Chạy `npm run test:e2e` kiểm tra độ pass.
