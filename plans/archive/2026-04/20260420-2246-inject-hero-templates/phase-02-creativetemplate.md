---
phase: 2
title: 'Creative Template: Minimalist Brand Identity'
status: pending
priority: P1
effort: '1h'
dependencies: []
---

# Phase 2: Creative Template: Minimalist Brand Identity

## Overview

Xây dựng và inject cấu trúc JSON 5 slide cho template Creative "Minimalist Brand Identity" vào cơ sở dữ liệu giả lập.

## Requirements

- Functional: Template phải hiển thị giao diện tối giản, tập trung vào Typography và layout hình ảnh dạng grid.
- Non-functional: Phù hợp Dark Mode, chuyển cảnh `fade` mượt mà.

## Architecture

Tạo đối tượng JSON theo schema. Tập trung vào sử dụng các `shape` (vuông, tròn) để định hình bảng màu thương hiệu và sắp xếp `image` dạng grid lưới.

## Related Code Files

- Modify: `server/data/built-in-templates.json`

## Implementation Steps

1. Khởi tạo metadata (id: `creative-brand-identity`, tags: `creative`, `minimal`, `dark`).
2. Viết JSON slide 1: Dark Mode Typography focus.
3. Viết JSON slide 2: Tuyên ngôn thương hiệu (Brand Manifesto) căn giữa.
4. Viết JSON slide 3: Bảng màu thương hiệu sử dụng các shape hình vuông bo góc phối màu.
5. Viết JSON slide 4: Moodboard sử dụng các image URL placeholder.
6. Viết JSON slide 5: Thông tin liên hệ.
7. Thêm template vào `built-in-templates.json`.

## Success Criteria

- [ ] Mở danh mục "Creative" hoặc "Tối giản" hiển thị template này.
- [ ] Layout grid hiển thị chuẩn trên màn hình trình chiếu.

## Risk Assessment

- Lỗi responsive ảnh. Khắc phục: Dùng % kích thước hoặc lock width/height cố định.
