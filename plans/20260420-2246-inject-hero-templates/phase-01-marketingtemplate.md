---
phase: 1
title: "Marketing Template: Product Launch"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Marketing Template: Product Launch

## Overview
Xây dựng và inject cấu trúc JSON 6 slide cho template Marketing "Product Launch & Growth Strategy" vào cơ sở dữ liệu giả lập.

## Requirements
- Functional: Template phải hiển thị đúng native Line Chart và Pie Chart, đồng thời có slide phễu Marketing (Interactive).
- Non-functional: Payload chuẩn schema, parse không lỗi.

## Architecture
Tạo một object JSON thoả mãn mảng `slides` theo hệ thống NavSlides. Đối với các biểu đồ, tích hợp `{ "type": "chart", "chartType": "line", "data": [...] }`.

## Related Code Files
- Modify: `server/data/built-in-templates.json`

## Implementation Steps
1. Khởi tạo đối tượng metadata cơ bản (id: `marketing-product-launch`, tags: `marketing`, `business`, `chart-heavy`, `interactive`).
2. Viết JSON cho slide 1 (Title) và slide 2 (Text/Image).
3. Viết JSON cho slide 3: Cấu hình `Line Chart` với mock data (Q1, Q2, Q3, Q4 user growth).
4. Viết JSON cho slide 4: Cấu hình `Pie Chart` với ngân sách marketing.
5. Viết JSON cho slide 5: Cấu hình phễu Marketing Interactive.
6. Viết JSON cho slide 6: Call to Action.
7. Thêm template vào mảng của `built-in-templates.json`.

## Success Criteria
- [ ] Mở danh mục "Marketing" hiển thị template này.
- [ ] Trình chiếu không lỗi khi load các native chart.

## Risk Assessment
- Lỗi schema biểu đồ. Khắc phục: Validate JSON với engine parser trước khi commit.
