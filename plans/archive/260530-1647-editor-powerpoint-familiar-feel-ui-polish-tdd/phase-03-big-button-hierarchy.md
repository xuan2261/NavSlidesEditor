---
phase: 3
title: "Big-button hierarchy (icon trên / label dưới)"
status: completed
priority: P2
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Big-button hierarchy (icon trên / label dưới)

## Overview

Thêm component `RibbonBigButton` (icon 20–24px trên, label 11px dưới, ~52px cao, vừa khít vùng 80px) để tạo phân cấp thị giác kiểu PowerPoint. Áp cho action chủ đạo: Home→Paste; Insert→Text Box / Picture. Các nút phụ giữ nguyên dạng nhỏ xếp cạnh.

> **Hiệu chỉnh sau red-team (đã verify):** report đề xuất "Insert→New Slide" nhưng **Insert ribbon panel KHÔNG có handler New Slide** (`ribbon-insert-tab-element-galleries-panel.jsx:216-244` chỉ có `onAddText/onAddImage/onAddImageUpload/...`; "New Slide" sống ở SlidePanel + Ctrl+M, NGOÀI ribbon). → BỎ "New Slide" khỏi big-button (giữ scope "polish tại chỗ", không thêm action tạo slide vào ribbon — YAGNI). Big-button Insert = **Text Box** (`onAddText`) + **Picture** (`onAddImageUpload` = upload, đúng nghĩa PPT "Picture"; KHÔNG dùng `onAddImage` URL-prompt).

## Requirements

**Functional:**
- `RibbonBigButton`: 1 cột, icon trên (size 20–24), label dưới (11px), chiều cao ~52px (icon + label) vừa trong command row của vùng 80px.
- Hỗ trợ: `icon`, `label`, `onClick`, `title`/`aria-label`, `disabled`, optional `active` (aria-pressed).
- Áp dụng:
  - Home: nút **Paste** thành big-button (`onPaste`, action chủ đạo trái cùng, giống PPT).
  - Insert: **Text Box** (`onAddText`), **Picture** (`onAddImageUpload`) thành big-button.
- Nút nhỏ còn lại GIỮ `variant="ribbon"` (28–32px) xếp 2 tầng/hàng cạnh big-button.

**Non-functional:**
- KHÔNG tràn vùng 80px ở viewport ≥1280px. Command row vẫn là chủ scroll ngang dưới áp lực hẹp (giữ contract).
- Accessible: icon-only fallback có `aria-label`; big-button luôn có label visible + accessible name.
- Tái dùng `Button` nếu khả thi (thêm variant) HOẶC component riêng — chọn component riêng để tránh phình `buttonVariants` (xem Architecture).

## Architecture

**Quyết định: component riêng `ribbon-big-button.jsx`** thay vì thêm variant vào `Button.jsx`.
- Lý do: layout 2-tầng dọc (flex-col) khác hẳn các variant hiện tại (đều 1 hàng, `min-h-8`). Nhồi vào `buttonVariants` sẽ phá rhythm. KISS: component nhỏ chuyên dụng.
- Vẫn dùng `<button>` thuần + `cn()` + focus-visible ring brand theo `design-guidelines` (focus token blue).

**Khung:**
```jsx
// ribbon-big-button.jsx (<60 LOC)
export default function RibbonBigButton({ icon:Icon, label, onClick, title, active, disabled, ...rest }) {
  return (
    <button type="button" data-ribbon-big-button
      title={title} aria-label={title||label} aria-pressed={active||undefined} disabled={disabled}
      onClick={onClick}
      className={cn('flex flex-col items-center justify-center gap-1 px-2.5 h-[52px] min-w-[56px] rounded-md',
        'text-text-secondary hover:bg-hover hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active && 'bg-primary-light text-accent', disabled && 'opacity-50 pointer-events-none', ...)}>
      <Icon size={22} />
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  )
}
```

**Áp dụng:**
- `clipboard-buttons.jsx`: Paste hiện là nút nhỏ (h-7) → tách Paste ra big-button, Copy/Cut/Duplicate giữ nhỏ (cluster cạnh). Handler props đã verify: `onPaste/onCopy/onCut/onDuplicate`.
- `ribbon-insert-tab-element-galleries-panel.jsx`: **Text Box** (`onAddText`) + **Picture** (`onAddImageUpload`) → big-button; phần gallery còn lại giữ nguyên. **KHÔNG có New Slide** (handler không tồn tại — xem Overview).
- `home-tab-content.jsx`: bố trí lại nhóm Clipboard để big-button Paste nằm trái cùng.

**⚠️ Xung đột test đã verify — `ribbon-ui-consistency.test.jsx`:**
- Dòng 14 "all buttons should have consistent h-7 height class" assert MỌI nút trong `ClipboardButtons` có `h-7`, KHÔNG có `h-8`. Big-button Paste (`h-[52px]`) sẽ phá.
- Dòng 38 "Paste button should not be taller than other buttons" assert `pasteHasH7 === cutHasH7`. Big-button Paste cũng phá.
- **Bối cảnh:** 2 assertion này ra đời từ một UI-review CŨ ("Paste không được cao hơn nút khác"). Big-button hierarchy CỐ Ý đảo quyết định đó (Paste cao hơn = phân cấp PPT). → Đây là thay đổi hành vi có chủ đích, KHÔNG phải regression.
- **Fix:** cập nhật 2 test này: nút phụ (Copy/Cut/Duplicate) vẫn h-7; Paste big-button assert riêng (`data-ribbon-big-button`, cao 52px). Bỏ assertion "pasteHasH7===cutHasH7".

**Verify trước khi code:** đọc `clipboard-buttons.jsx`, `home-tab-content.jsx` để biết cấu trúc RibbonSection + có cần truyền thêm prop. (Insert handlers đã verify ở trên.)

## Related Code Files

- Create: `client/src/components/ribbon/ribbon-big-button.jsx`
- Create: `client/src/components/ribbon/ribbon-big-button.test.jsx`
- Modify: `client/src/components/ribbon/controls/clipboard-buttons.jsx` (Paste → big)
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` (Text Box + Picture → big; KHÔNG New Slide)
- Modify: `client/src/components/ribbon/home-tab-content.jsx` (bố trí cluster)
- Modify: `client/src/components/ribbon/ribbon-ui-consistency.test.jsx` (cập nhật 2 assertion h-7-toàn-bộ + Paste-không-cao-hơn → cho phép Paste big-button)

## Implementation Steps (TDD)

1. **RED — big-button test** (`ribbon-big-button.test.jsx`):
   - render `label="Paste" icon` → có text "Paste", `data-ribbon-big-button`.
   - `onClick` gọi khi click.
   - `title` không truyền → `aria-label` = label.
   - `active` → `aria-pressed="true"`.
   - `disabled` → `pointer-events-none`/disabled attr; click không gọi onClick.
2. **GREEN** — tạo `ribbon-big-button.jsx`.
3. **Đọc + map** clipboard/home files (Verify cấu trúc RibbonSection). Insert handlers đã verify: `onAddText` (Text Box), `onAddImageUpload` (Picture).
4. **RED — integration tests** (mở rộng test panel hiện có / thêm test):
   - Home panel render → có big-button "Paste" (`data-ribbon-big-button` + text Paste); click gọi `onPaste`.
   - Insert panel render → có big-button "Text Box" (click gọi `onAddText`) và "Picture" (click gọi `onAddImageUpload`). KHÔNG assert "New Slide".
   - **Cập nhật `ribbon-ui-consistency.test.jsx`:** dòng 14 → nút phụ (Copy/Cut/Duplicate) giữ h-7; Paste là big-button (assert `data-ribbon-big-button`, không ép h-7). Dòng 38 → bỏ assertion `pasteHasH7===cutHasH7` (Paste cố ý cao hơn).
5. **GREEN** — áp big-button vào 2 panel + bố trí home cluster.
6. **Manual 80px guard**: chạy dev ở 1280px và viewport hẹp → big-button không tràn, không vỡ command row; group label vẫn đáy.
7. **Refactor** — gọn, đảm bảo mỗi file <200 LOC.

## Todo List

- [ ] RibbonBigButton test (RED) → impl (GREEN)
- [ ] Đọc clipboard/home để map cấu trúc
- [ ] Home Paste → big-button (+ test)
- [ ] Insert Text Box (`onAddText`) + Picture (`onAddImageUpload`) → big-button (+ test)
- [ ] Cập nhật ribbon-ui-consistency.test.jsx (cho phép Paste big-button)
- [ ] Manual 80px overflow check @1280px + hẹp
- [ ] lint + build + test xanh
- [ ] Manual 80px overflow check @1280px + hẹp
- [ ] lint + build + test xanh

## Success Criteria

- [ ] Mỗi nhóm áp dụng có ≥1 big-button nhận diện được (icon trên/label dưới).
- [ ] Vùng lệnh vẫn 80px, không tràn ở ≥1280px; command row vẫn chủ scroll khi hẹp.
- [ ] Handler click đúng (Paste / Text Box→`onAddText` / Picture→`onAddImageUpload`).
- [ ] Accessible name ổn định; focus ring brand/blue đúng guideline.
- [ ] lint/build/test sạch.

## Risk Assessment

- **Big-button tràn 80px** (Thấp — report đã lường): chiều cao 52px + label, command row 80px còn dư cho group label. Test thủ công viewport hẹp.
- **Đổi cấu trúc home-tab phá test snapshot/layout hiện có** (TB — đã verify): `ribbon-ui-consistency.test.jsx:14,38` assert mọi clipboard button h-7 + Paste không cao hơn Cut → big-button Paste cố ý phá. Đây là đảo quyết định UI-review cũ có chủ đích, KHÔNG regression. Cập nhật 2 assertion (step 4), không xoá test.
- **Nhầm "New Slide" vào Insert** (đã loại): handler không tồn tại trong ribbon → đã bỏ khỏi scope (xem Overview). Nếu sau này muốn New Slide trong ribbon → plan riêng (thêm action + wiring từ EditorPage).
- **Trùng lặp style với `variant="ribbon"`** (Thấp): chấp nhận — layout khác đủ để tách component (KISS hơn nhồi variant).

## Security Considerations

Thuần UI; không trust boundary.

## Next Steps

Phase 4 chốt chrome (tab liền panel) + cập nhật docs phản ánh big-button + status bar + format động.
