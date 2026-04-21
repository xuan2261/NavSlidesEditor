---
phase: 5
title: "Corporate Template: Annual Financial Report"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 5: Corporate Template: Annual Financial Report

## Overview
Xây dựng và inject cấu trúc JSON 5 slide cho template Doanh nghiệp "Annual Financial Report", tận dụng Area Chart và Bar Chart.

## Requirements
- Functional: Template cung cấp các báo cáo dữ liệu trực quan dùng chart native.
- Non-functional: Giao diện Business Corporate (chuyên nghiệp, tông xanh dương chủ đạo).

## Architecture
Khai báo `{ "type": "chart", "chartType": "bar" }` và `{ "type": "chart", "chartType": "area" }` trong `elements`.

## Related Code Files
- Modify: `server/data/built-in-templates.json`

## Implementation Steps
1. Khởi tạo metadata (id: `corporate-annual-report`, tags: `corporate`, `business`, `chart-heavy`).
2. Viết JSON slide 1, 2: Tóm tắt Ban Giám đốc.
3. Viết JSON slide 3: Bar Chart dữ liệu doanh thu.
4. Viết JSON slide 4: Area Chart lưu lượng dòng tiền (Cash Flow).
5. Viết JSON slide 5: Table Báo cáo kinh doanh.
6. Thêm template vào JSON array.

## Success Criteria
- [ ] Mở danh mục "Corporate" hiển thị template này.
- [ ] Các biểu đồ render thành công và đẹp mắt.

## Risk Assessment
- Thiếu support cho loại biểu đồ. Khắc phục: Mặc định Line, Bar, Area thường được hỗ trợ chuẩn. Cần tuân thủ field mapping đúng.
