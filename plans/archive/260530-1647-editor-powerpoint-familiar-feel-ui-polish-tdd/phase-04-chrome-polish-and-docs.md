---
phase: 4
title: "Chrome polish (tab liền panel) + cập nhật docs"
status: completed
priority: P2
effort: "0.5d"
dependencies: [1, 2, 3]
---

# Phase 4: Chrome polish (tab liền panel) + cập nhật docs

## Overview

Tinh chỉnh chrome ribbon: tab active nối liền panel dưới (bỏ biên giữa tab active ↔ panel), chuẩn hoá separator/group-label. Cập nhật `design-guidelines.md` (ribbon contract + Format động + status bar) và README (mô tả familiar-feel) phản ánh Phase 1–3. Chạy CUỐI vì docs phải khớp code đã xong.

## Requirements

**Functional:**
- Tab active "liền mạch" với panel dưới: bỏ đường biên ngăn giữa tab active và `RibbonPanel` (nền tab active = nền panel, không có border-bottom cắt ngang ngay dưới tab active).
- Separator nhóm + group-label đồng nhất (phần lớn đã có — chỉ chuẩn hoá nếu lệch).

**Non-functional / Docs:**
- `design-guidelines.md`: cập nhật mục "Toolbars and Ribbon" — Format tab động (ẩn/hiện, nhãn theo type, accent brand), status bar PowerPoint (slider/slide-pos/view switcher), big-button hierarchy.
- README "Features → Editing": mô tả ngắn familiar-feel (Format tab contextual, zoom slider, slide position, view switcher) — KHÔNG phóng đại; giữ giọng README hiện tại.
- Cập nhật `docs/project-changelog.md` + `docs/codebase-summary.md` nếu có mục ribbon/status liên quan (docs-manager pass).

## Architecture

**Tab liền panel — CSS:**
- `tab-bar-with-scroll-and-icons.jsx`: tab active hiện dùng `border-b-2 -mb-px ... bg-background`. Panel dưới (`ribbon-panel.jsx`) dùng `bg-background border-b border-border`.
- Vấn đề: header bar (`ribbon-header-bar.jsx:116`) có `border-b border-border` chạy dưới TOÀN BỘ dải tab → cắt ngang dưới tab active.
- Giải pháp familiar-feel: tab active có nền `bg-background` (đã có) + đảm bảo KHÔNG có border ngăn ngay dưới nó. Cách tối thiểu: giữ `-mb-px` để tab active đè 1px lên border header, nền `bg-background` trùng panel → tạo cảm giác liền mạch. Verify pixel ở dev; nếu vẫn thấy đường cắt → cân nhắc chuyển border-bottom từ header-bar container sang từng tab inactive (tab active không có).
- KHÔNG phá contract 80px / `data-ribbon-content-row` / `data-ribbon-section(-label)`.

**Thứ tự:** Phase 4 chỉ chỉnh CSS nhỏ + docs. Không thêm state.

## Related Code Files

- Modify: `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx` (chrome tab active — có thể đã chạm ở Phase 1; chỉ tinh chỉnh border)
- Modify (nếu cần): `client/src/components/ribbon/ribbon-header-bar.jsx` (border-bottom container)
- Modify: `docs/design-guidelines.md`
- Modify: `README.md`
- Modify: `docs/project-changelog.md`, `docs/codebase-summary.md` (qua docs-manager)

## Implementation Steps (TDD-ish)

1. **Visual baseline**: chạy dev, chụp/ghi nhận trạng thái tab active hiện tại (đường cắt dưới tab).
2. **RED (light)** — nếu có test chrome (`ribbon-ui-consistency.test.jsx`): thêm assertion tab active không có class border ngăn / có nền panel. Nếu khó assert bằng test đơn vị (thuần CSS) → ghi rõ "verify thủ công" và bỏ qua unit test cho điểm này (KISS, không ép test CSS pixel).
3. **GREEN** — chỉnh CSS tab/header để liền mạch.
4. **Manual verify**: tab active liền panel ở dark + light theme; 7/6 tab động (Phase 1) vẫn đúng; accent Format không bị che.
5. **Docs**: cập nhật `design-guidelines.md` (ribbon + status), README features, changelog. Delegate `docs-manager` nếu muốn; nếu tự làm → giữ ngắn gọn, đúng giọng.
6. **Final regression**: `npm run lint && npm run build && npm run test`; `npm run test:e2e` (ribbon/status). Sửa test còn đỏ do Phase 1–3.

## Todo List

- [ ] Visual baseline tab active
- [ ] Chrome CSS tab liền panel (dark + light)
- [ ] design-guidelines.md cập nhật (Format động + status bar + big-button)
- [ ] README features cập nhật (familiar-feel)
- [ ] changelog + codebase-summary (docs-manager)
- [ ] Final: lint + build + test + e2e xanh

## Success Criteria

- [ ] Tab active liền mạch panel ở cả 2 theme; không đường cắt giữa tab active ↔ panel.
- [ ] Contract 80px + `data-ribbon-*` không vỡ; test ribbon pass.
- [ ] design-guidelines + README phản ánh đúng Phase 1–3; không phóng đại.
- [ ] Toàn bộ suite (unit + e2e ribbon/status) xanh; lint/build sạch.
- [ ] Brand dark/terracotta + default theme giữ nguyên.

## Risk Assessment

- **Chỉnh border phá layout/contrast theme light** (Thấp–TB): verify cả 2 theme; chỉ đụng border tab, không đụng cấu trúc.
- **Docs drift** (Thấp): cập nhật ngay sau code; element-type count KHÔNG đổi (không thêm type) → không chạm `element-defaults` guard.
- **Test CSS-pixel khó** (Thấp): chấp nhận manual verify cho điểm liền-mạch; không ép unit test cho thuần thị giác (KISS).

## Security Considerations

Không đụng trust boundary; thuần CSS + docs.

## Next Steps

Hoàn tất plan → `/ck:journal` ghi nhận quyết định (cầu nối store cho status bar toàn cục, Format động qua ui-store, big-button component riêng).
