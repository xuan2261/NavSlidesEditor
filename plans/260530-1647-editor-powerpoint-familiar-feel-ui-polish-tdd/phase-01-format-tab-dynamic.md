---
phase: 1
title: "Format Tab động (nhãn + accent + ẩn/hiện)"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Format Tab động (nhãn + accent + ẩn/hiện)

## Overview

Format tab ẩn khi không có selection; xuất hiện + auto-active (lần đầu) khi chọn element; đổi nhãn theo type (Shape Format / Picture Format / Table Design / Chart Design / Code / Media); dải accent terracotta khi active. Bỏ chọn → ẩn, fallback về Home nếu đang ở Format.

## Requirements

**Functional:**
- `!selectedElement` → tab `format` KHÔNG render trong TabBar; nếu `activeTab==='format'` → set về `'home'`.
- Có `selectedElement` → tab `format` render với nhãn động theo type:
  - `shape`/`line` → "Shape Format"
  - `image` → "Picture Format"
  - `table` → "Table Design"
  - `chart` → "Chart Design"
  - `code` → "Code"
  - `video`/`audio` → "Media"
  - mặc định (text, v.v.) → "Format"
- Auto-active LẦN ĐẦU khi một selection mới bắt đầu (từ no-selection → có selection). Nếu user đã chủ động rời sang tab khác trong khi vẫn giữ selection → KHÔNG ép quay lại Format ở các re-render sau.
- **Phân biệt thị giác Format = NHÃN ĐỘNG** (theo quyết định user: một-màu-brand, đổi nhãn theo type). Mọi tab active HIỆN ĐÃ dùng `border-primary` (terracotta) tại `tab-bar:26` → KHÔNG cần thêm "accent class" mới; viền brand active có sẵn chính là accent. (Tùy chọn nicety: thêm 1 dải mảnh `border-t` brand RIÊNG cho tab format để gợi "contextual tab" — KHÔNG bắt buộc, KHÔNG test bằng class string.)

**Non-functional:**
- Không prop-drill `selectedElement` qua RibbonHeaderBar (giữ API hiện tại). Dùng `ui-store` làm cầu nối.
- Giữ persist `activeTab` hiện có; khi format ẩn mà đang active → ghi `'home'` (đồng bộ localStorage qua `setActiveTab`).

## Architecture

**Cầu nối context qua `ui-store`** (tránh đổi chữ ký RibbonHeaderBar):
- Thêm state: `formatContext: { hasSelection: boolean, elementType: string|null }`.
- Thêm action: `setFormatContext({ hasSelection, elementType })`.
- Thêm cờ nội bộ: `formatAutoActivatedForSelection: boolean` để thực thi "auto lần đầu, tôn trọng manual leave".

**Logic auto-active (đặt trong `setFormatContext`):**
```
setFormatContext({ hasSelection, elementType }):
  prev = get()
  // bắt đầu selection mới (none -> some)
  if hasSelection && !prev.formatContext.hasSelection:
     set activeTab='format' (qua setActiveTab), formatAutoActivatedForSelection=true
  // mất selection
  if !hasSelection:
     formatAutoActivatedForSelection=false
     if prev.activeTab==='format': setActiveTab('home')
  set formatContext={hasSelection, elementType}
```
Nếu user click tab khác khi đang có selection → `setActiveTab('other')` chạy bình thường; lần `setFormatContext` sau (đổi type cùng selection) KHÔNG re-trigger vì `prev.hasSelection` đã true.

**`VALID_RIBBON_TABS`**: GIỮ `'format'` trong set (vẫn là tab hợp lệ để persist/active); chỉ điều khiển HIỂN THỊ ở TabBar, không xoá khỏi set.

**TabBar render động:**
- `RIBBON_TABS` thêm field `dynamicLabel?: (type)=>string` cho tab format; hoặc TabBar nhận `formatContext` từ store và:
  - lọc bỏ tab `format` khỏi danh sách khi `!hasSelection`.
  - thay `label` của format bằng nhãn động khi render.
- **`RibbonPanel` PHẢI dùng `effectiveTab` guard, KHÔNG chỉ dựa TabBar.**
  - **Cạm bẫy radix (BLOCKER đã verify):** `Tabs.Root value={activeTab}` sẽ HIỆN `Tabs.Content` có `value` trùng `activeTab` BẤT KỂ có Trigger tương ứng hay không. Nếu reload với `localStorage activeTab='format'` nhưng chưa có selection → TabBar ẩn trigger format NHƯNG panel Format vẫn render (flash 80px) cho tới khi effect EditorPage chạy `setActiveTab('home')`. Dựa vào effect async là SAI.
  - **Fix:** trong `RibbonPanel` (và `RibbonHeaderBar` nếu cũng dùng `Tabs.Root value`), tính:
    ```
    const effectiveTab = (activeTab === 'format' && !formatContext.hasSelection) ? 'home' : activeTab
    ```
    rồi truyền `effectiveTab` vào `Tabs.Root value`. Đồng bộ, không flash.
  - GIỮ render tất cả `Tabs.Content` (radix ẩn cái không khớp `effectiveTab`).

**EditorPage wiring:** thêm `useEffect` đồng bộ `selectedElement` → `setFormatContext`:
```
useEffect(() => {
  setFormatContext({ hasSelection: !!selectedElement, elementType: selectedElement?.type ?? null })
}, [selectedElement, setFormatContext])
```
(`selectedElement` đã có tại `EditorPage.jsx:837`.)

**Nhãn động** — helper thuần trong `ribbon-tabs-config.js`:
```
export function formatTabLabel(type) { switch(type){...} }
```

## Related Code Files

- Modify: `client/src/stores/ui-store.js` (state formatContext + actions + auto logic)
- Modify: `client/src/components/ribbon/ribbon-tabs-config.js` (thêm `formatTabLabel`)
- Modify: `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx` (ẩn/hiện + nhãn động)
- Modify: `client/src/components/ribbon/ribbon-panel.jsx` (effectiveTab guard — chống flash panel format khi reload không selection)
- Modify: `client/src/components/ribbon/ribbon-header-bar.jsx` (effectiveTab guard nếu `Tabs.Root value` cũng cần — verify khi code)
- Modify: `client/src/pages/EditorPage.jsx` (useEffect đồng bộ selectedElement → store)
- Modify: `client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx` (số tab động)
- Create: `client/src/stores/ui-store-format-context.test.js`
- Create: `client/src/components/ribbon/format-tab-dynamic-visibility-and-label.test.jsx`

## Implementation Steps (TDD)

1. **RED — store test** (`ui-store-format-context.test.js`):
   - default `formatContext={hasSelection:false, elementType:null}`.
   - `setFormatContext({hasSelection:true, elementType:'shape'})` từ no-selection → `activeTab==='format'`, `formatAutoActivatedForSelection===true`.
   - đang format + có selection, user `setActiveTab('insert')`, rồi `setFormatContext({hasSelection:true, elementType:'image'})` (đổi type cùng selection) → `activeTab` VẪN `'insert'` (không ép về format).
   - `setFormatContext({hasSelection:false})` khi đang `activeTab==='format'` → `activeTab==='home'`.
   - `setFormatContext({hasSelection:false})` khi đang `activeTab==='insert'` → giữ `'insert'`.
2. **GREEN** — implement state/actions trong `ui-store.js`.
3. **RED — TabBar test** (`format-tab-dynamic-visibility-and-label.test.jsx`):
   - `formatContext.hasSelection=false` → KHÔNG có `data-testid="ribbon-tab-format"`.
   - `hasSelection=true, elementType='image'` → có tab format, text "Picture Format".
   - `elementType='table'` → "Table Design"; `'chart'` → "Chart Design"; `'shape'` → "Shape Format"; `'code'` → "Code"; `'video'` → "Media".
   - **KHÔNG assert class accent** (border brand active đã có sẵn cho mọi tab → assert vô nghĩa + brittle). Phân biệt Format = nhãn động (đã cover ở trên).
   - **effectiveTab guard (RibbonPanel)**: mount RibbonPanel với `activeTab='format'`, `formatContext.hasSelection=false` → panel Format KHÔNG hiện (panel Home hiện, hoặc không có content format active); không flash. Mount với `hasSelection=true` → panel Format hiện.
4. **GREEN** — implement TabBar đọc `formatContext` từ store, lọc + nhãn + accent.
5. **RED — config test**: `formatTabLabel('shape')==='Shape Format'` v.v. (thêm vào `ribbon-tabs-config.test.js`).
6. **GREEN** — thêm helper.
7. **Wire EditorPage** useEffect; chạy app dev kiểm tra thủ công.
8. **Cập nhật test cũ** `ribbon-shell-tab-navigation-and-rendering.test.jsx`:
   - test "renders 7 tab triggers" → tách 2 case: no-selection ⇒ 6 tab (không format); có selection ⇒ 7 tab.
   - "renders all tab labels": expectedLabels bỏ 'Format' ở case no-selection; thêm case selection có nhãn động.
9. **Refactor** — gọn helper, xoá trùng lặp.

## Todo List

- [ ] Store test (RED) → impl (GREEN)
- [ ] TabBar visibility/label/accent test (RED) → impl (GREEN)
- [ ] formatTabLabel helper + test
- [ ] EditorPage useEffect đồng bộ selection
- [ ] Cập nhật ribbon-shell navigation test (6/7 tab động)
- [ ] Manual: chọn/bỏ chọn element kiểm tra ẩn/hiện + auto-active + manual-leave
- [ ] lint + build + test xanh

## Success Criteria

- [ ] No selection: chỉ 6 tab, không có Format; nếu đang ở Format → tự về Home.
- [ ] Chọn element: Format xuất hiện, nhãn đúng type, auto-active lần đầu, accent brand hiển thị.
- [ ] User rời Format thủ công (vẫn giữ selection) → đổi type không ép quay lại Format.
- [ ] Bỏ chọn: Format ẩn, activeTab về Home (nếu đang Format).
- [ ] Test cũ + mới pass; lint/build sạch.

## Risk Assessment

- **Phá test duyệt-7-tab** (Trung bình): cập nhật theo trạng thái selection (bước 8). Đây là thay đổi hành vi có chủ đích, không phải regression.
- **Persist activeTab='format' khi reload mà không có selection** (Trung bình — đã verify là BLOCKER tiềm ẩn): radix `Tabs.Root value='format'` HIỆN panel Format dù không có trigger → flash panel rỗng. **KHÔNG** dựa vào effect async để chữa. Fix bắt buộc: `effectiveTab` guard trong RibbonPanel (và RibbonHeaderBar nếu cũng `Tabs.Root value`) — xem Architecture. Test init-guard ở step 4 (effectiveTab). Store value vẫn có thể là 'format' (persist) nhưng `effectiveTab` ép về 'home' khi `!hasSelection`.
- **Vòng lặp set state** (Thấp): `setFormatContext` gọi `setActiveTab` có thể trigger re-render EditorPage; useEffect chỉ phụ thuộc `[selectedElement, setFormatContext]` (action ổn định) → không loop.

## Security Considerations

Không đụng trust boundary; thuần UI state. Không thêm input ngoài.

## Next Steps

Phase 2 mở rộng tiếp `ui-store` (nhóm khác) — tránh chạm vùng `formatContext` để giảm xung đột.
