---
phase: 3
title: 'Fix Layout Padding and Margin'
status: done
priority: P2
effort: '1h'
dependencies: []
---

# Phase 3: Fix Layout Padding and Margin

## Overview

Phase này sẽ chỉnh sửa các lỗi về khoảng cách (spacing) và lề (alignment). Cụ thể là Menu AI Assistant bị cắt mất ký tự đầu tiên (`opywriter`), ô "Section name" bị thu hẹp, và "Speaker Notes" thiếu margin.

## Requirements

- Functional: Menu AI Assistant phải hiển thị đầy đủ văn bản (Copywriter, Slide Generator).
- Functional: Các trường Input trong Sidebar có độ rộng và khoảng cách đúng chuẩn theo thiết kế.

## Architecture

- Loại bỏ các lớp `overflow-hidden` dư thừa hoặc `margin` âm (negative margin) trong các Dropdown items.
- Điều chỉnh flexbox layout và gap/padding trong các Sidebar container.

## Related Code Files

- Modify: `client/src/components/layout/EditorMenuBar.jsx` (hoặc Toolbar chứa nút AI Assistant)
- Modify: `client/src/components/panels/SlidePanel.jsx` (Section name input)
- Modify: `client/src/components/panels/SpeakerNotes.jsx` (hoặc Sidebar block)

## Implementation Steps

1. Mở AI Assistant Dropdown code, xóa/thay đổi `-ml-1` hoặc padding trái `pl-*` bị sai, đảm bảo icon và text thẳng hàng.
2. Tại `SlidePanel`, chỉnh lại flex-container cho "Section name" để `w-full` và không bị co ép bởi flex child.
3. Thêm `mt-4` hoặc `gap-y-4` vào khu vực Speaker Notes để phân cách rõ ràng.

## Success Criteria

- [x] Text "Copywriter" không bị mất ký tự "C".
- [x] Các input fields trong editor sidebar được căn lề vuông vắn, không tràn viền.

## Risk Assessment

- Rủi ro: Việc thay đổi Padding có thể khiến Menu bị đẩy ra khỏi khung hình nếu kích thước thay đổi lớn.
- Mitigation: Xác minh trực tiếp trên browser_subagent ở độ phân giải 1080p và 720p.
