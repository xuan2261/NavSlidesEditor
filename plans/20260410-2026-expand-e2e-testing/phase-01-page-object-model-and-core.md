# Phase 1: Xây Dựng Page Object Model (POM) & Slides Flow

## Mục tiêu
Thiết lập kiến trúc gốc cho các bài Test Playwright trong dự án bằng cách sử dụng Page Object Model (POM). Viết kịch bản E2E Test cho nghiệp vụ Core: Trang chủ (Tạo trình chiếu) và Slides Panel (Quản lý Slide).

## Files to Create/Modify
- `tests/e2e/pages/HomePage.js` [NEW]
- `tests/e2e/pages/EditorPage.js` [NEW]
- `tests/e2e/slides.spec.js` [NEW]
- `tests/e2e/editor.spec.js` [MODIFY]

## Yêu cầu Kiến trúc (POM)
**1. HomePage.js**
- Đóng gói các UI Selectors như nút "New Presentation", Modal input `placeholder="My Presentation"`.
- Cung cấp method: `goto()`, `createNewPresentation(title)`, `clickPresentation(index)`.

**2. EditorPage.js**
- Đóng gói các Selectors: `.slide-canvas`, list của Toolbar elements, SlidePanel thumbnails.
- Cung cấp methods: `waitForReady()`, `addTextNode()`, `changeBackground(color)`, `addSlide()`, `deleteSlide()`.

## Cấu trúc E2E Test (slides.spec.js)
```javascript
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';

test('Slides CRUD Workflow', async ({ page }) => {
    // Navigate home -> Tạo mới.
    // Confirm default có 1 slide.
    // Lệnh gọi `editorPage.addSlide()` -> expect số lượng `.slide-panel .thumbnail` = 2.
    // Lệnh gọi `editorPage.deleteSlide()` -> expect phục hồi.
});
```

## Checklist
- [ ] Khởi tạo thư mục `tests/e2e/pages`.
- [ ] Implement `HomePage.js`.
- [ ] Implement `EditorPage.js` (tập trung vào slides layout).
- [ ] Viết suite `slides.spec.js`.
- [ ] Refactor lại `editor.spec.js` cũ sang dùng POM thay vì hardcoded selectors.
- [ ] Chạy `npm run test:e2e` tự động.
