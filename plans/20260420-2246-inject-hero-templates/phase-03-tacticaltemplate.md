---
phase: 3
title: "Tactical Template: Operation Briefing"
status: pending
priority: P2
effort: "2h"
dependencies: []
---

# Phase 3: Tactical Template: Operation Briefing

## Overview
Xây dựng và inject cấu trúc JSON 6 slide cho template "Interactive Operation Briefing" mang phong cách quân sự chiến thuật.

## Requirements
- Functional: Template tích hợp tính năng `simulation` với sa bàn chiến thuật (các object di chuyển).
- Non-functional: Theme Olive Green hoặc Radar Dark.

## Architecture
Tận dụng hệ thống `AnimationTimeline` của NavSlides để set keyframe cho các shape biểu tượng di chuyển dọc theo bản đồ (được nhúng làm ảnh nền).

## Related Code Files
- Modify: `server/data/built-in-templates.json`

## Implementation Steps
1. Khởi tạo metadata (id: `tactical-op-briefing`, tags: `tactical`, `military`, `simulation`, `interactive`).
2. Viết JSON slide 1: Báo cáo Tác chiến Tuyệt mật.
3. Viết JSON slide 2: Table dữ liệu toạ độ và thời tiết.
4. Viết JSON slide 3 (Khó nhất): Simulation Sa bàn chiến thuật. Cấu hình các shape với tọa độ (x, y) thay đổi thông qua mảng `animations`.
5. Viết JSON slide 4: Đánh giá Tình báo.
6. Viết JSON slide 5, 6: Các bước triển khai và Q&A.
7. Thêm template vào JSON.

## Success Criteria
- [ ] Mở danh mục "Tactical" hiển thị template này.
- [ ] Tính năng Simulation hoạt động trơn tru.

## Risk Assessment
- Viết JSON cấu hình animation bằng tay dễ nhầm tọa độ. Khắc phục: Test kỹ logic timeline, tạo một object đơn giản di chuyển thẳng tịnh tiến.
