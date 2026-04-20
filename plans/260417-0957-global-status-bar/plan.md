---
title: Global Status Bar (Router Layout Approach)
status: completed
---
# Kế hoạch: Global Status Bar (Router Layout)

**Scope:** Project
**Trạng thái Kế hoạch:** Đã hoàn thành (Completed)

## Overview
Dự án cần phát triển một thanh trạng thái cố định ở dưới cùng (Status Bar). Yêu cầu quan trọng:
1. **Status Bar Layout:** Cố định dưới đáy màn hình, sử dụng style chuyên nghiệp (tương tự VS Code IDE). Chứa chữ ký "Design by Bùi Thanh Xuân - Khoa Kỹ thuật cơ sở - Học viện Hải quân".
2. **Global View (DRY):** Thanh trạng thái phải xuất hiện ở các trang như Dashboard (`HomePage`), `EditorPage`, `ExplorePage`, `SettingsPage`.
3. **Loại trừ màn trình chiếu:** Không xuất hiện ở `LiveViewPage`, `RemoteControlPage`, `SpeakerViewPage`.
4. **Kiến trúc Layout:** Sử dụng React-Router `Outlet` wrapper (`MainLayout`) bọc ngoài các trang cần hiển thị để bảo đảm tính thống nhất và không xung đột Flexbox với từng page con.

## Các Giai đoạn (Phases)
- [x] Phase 1: Xây dựng UI Component `StatusBar` và `MainLayout` (`phase-01-component-and-layout.md`)
- [x] Phase 2: Tích hợp vào Router App.jsx & Kiểm thử (`phase-02-integrate-router.md`)

## Rủi ro và Thoả hiệp
- **Rủi ro:** Khi cấu trúc lại routing trong `App.jsx`, có thể làm ảnh hưởng đến context theme đang được pass qua props cho `HomePage`.
- **Giải pháp:** Kiểm tra kỹ dữ liệu (props) đang truyền vào `<HomePage />` bên trong `App.jsx`, giữ nguyên khai báo truyền props kể cả khi được bọc trong Layout. Xác minh layout Flexbox `flex: 1; overflow: hidden;` của MainLayout hoạt động mượt mà với HomePage và EditorPage.
