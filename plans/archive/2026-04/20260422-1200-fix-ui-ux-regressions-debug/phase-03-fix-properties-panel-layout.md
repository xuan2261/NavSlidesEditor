---
phase: 3
title: 'Fix Properties Panel Layout'
status: completed
effort: 'Small'
---

# Phase 3: Fix Properties Panel Layout

## Overview

Sửa lỗi Layout trong `PropertiesPanel.jsx` (bị chật chội, cắt chữ ở phần Auto-slide, Loop và Slide Footer).

## Requirements

- Functional: Layout cần có margin/padding thoải mái để chứa được label của các ô input, checkbox và nút bấm.
- Non-functional: Giữ tính nhất quán về thẩm mỹ với thiết kế Tailwind CSS hiện tại.

## Architecture

Cấu trúc `grid-cols-2` đang giới hạn không gian cho input `Auto-slide (s)` và label `Loop`. Text placeholder bị cắt mất phần cuối. Cần tinh chỉnh lại các class padding, flex, gap.

## Related Code Files

- Modify: `client/src/components/PropertiesPanel.jsx`

## Implementation Steps

1. Mở `PropertiesPanel.jsx`, kiểm tra section `Presentation Settings`. Thay vì `grid-cols-2`, có thể đổi sang flexbox hoặc điều chỉnh lại gap để rộng rãi hơn.
2. Sửa margin cho các label `Auto-slide (s)` và checkbox `Loop`.
3. Kiểm tra input của phần `Section name (shown in footer)`. Chỉnh padding và placeholder để chữ không bị ẩn `overflow`.
4. Review toàn bộ các component con bên trong Panel để bảo đảm không còn UI bị nén (cramped).

## Success Criteria

- [ ] Text không bị cắt ("Section name (shown in foo...").
- [ ] Label và checkbox giãn cách hợp lý.

## Risk Assessment

- Giao diện có thể bị cuộn nếu Panel không đủ chiều rộng. Giải pháp: Có thể cần set `min-width` lớn hơn một chút nếu cần thiết, hoặc tối ưu text cho nhỏ gọn lại.
