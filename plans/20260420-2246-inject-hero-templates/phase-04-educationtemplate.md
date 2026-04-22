---
phase: 4
title: 'Education Template: Interactive STEM Lab'
status: pending
priority: P1
effort: '2h'
dependencies: []
---

# Phase 4: Education Template: Interactive STEM Lab

## Overview

Xây dựng và inject cấu trúc JSON 7 slide cho template Giáo dục "Interactive STEM Lab". Cần nhấn mạnh tính năng trắc nghiệm và Latex rendering.

## Requirements

- Functional: Template có chứa công thức LaTeX render thành công, có câu hỏi trắc nghiệm quiz interactive.
- Non-functional: Dễ hiểu, khoa học.

## Architecture

Nhúng `latex` string vào thuộc tính `content` của `element`. Đối với quiz, định nghĩa structure `options` và `correctAnswer` tùy thuộc schema hệ thống, hoặc giả lập nút ấn `interactive` đơn giản bằng màu shape.

## Related Code Files

- Modify: `server/data/built-in-templates.json`

## Implementation Steps

1. Khởi tạo metadata (id: `edu-stem-lab`, tags: `education`, `academic`, `quiz`, `simulation`, `interactive`).
2. Viết JSON slide 1: Bài giảng Vật lý Động lực học.
3. Viết JSON slide 2: Text và công thức `latex`.
4. Viết JSON slide 3: Mô phỏng quỹ đạo bay.
5. Viết JSON slide 4, 5: Quiz questions.
6. Viết JSON slide 6: Table ghi chép.
7. Thêm template vào `built-in-templates.json`.

## Success Criteria

- [ ] Mở danh mục "Education" hiển thị template này.
- [ ] Công thức LaTeX và Table render chuẩn xác.

## Risk Assessment

- Lỗi cú pháp LaTeX JSON escape. Khắc phục: Dùng `\\` thay vì `\` trong JSON payload.
