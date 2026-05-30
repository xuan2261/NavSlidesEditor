---
phase: 2
title: "Status bar kiểu PowerPoint (slider + slide pos + view switcher)"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Status bar kiểu PowerPoint (slider + slide pos + view switcher)

## Overview

Đổi zoom dropdown → zoom slider (giữ nút −/+/Fit, tái dùng store). Thêm "Slide X / Y" bên trái. Thêm view switcher (Normal / Slide Sorter / Present) map mode SẴN CÓ. Giữ attribution + version. Cluster editor gate theo `slideTotal>0` để không hiện trên HomePage.

## Requirements

**Functional:**
- Zoom: slider `min=10 max=400 step=5` (đơn vị %), đồng bộ 2 chiều với `ui-store.zoom`. Giữ nút −/+ (`zoomIn/zoomOut`), Fit (`fitZoom`), và % hiển thị. Kéo slider → `setZoom(pct/100)` + `setUserZoomMode(true)`.
- Slide position: "Slide {current+1} / {total}" đọc từ store (Phase 2 thêm `slidePosition`). Chỉ hiện khi `total>0`.
- View switcher: 3 nút toggle — Normal (`viewMode='normal'`), Slide Sorter (`viewMode='sorter'`), Present (gọi handler đăng ký từ EditorPage). Active state theo `viewMode`. Present GIỮ ở status bar (quyết định user — PPT đặt Slide Show trong cụm view; header Present vẫn giữ).
- **Gate TOÀN BỘ cụm phải (zoom + slide-pos + view) theo editor context** (quyết định user): chỉ hiện khi `slidePosition.total>0`. Home/Settings/Explore (cùng dưới MainLayout, KHÔNG có canvas) → total=0 → ẩn cả cụm; status bar chỉ còn attribution + version. `slidePosition.total` là proxy "editor active" vì CHỈ EditorPage gọi `setSlidePosition` (KISS, tái dùng tín hiệu sẵn có, không cần cờ `editorActive` riêng).
- "Slide X / Y": `total = slides.length` (CHỈ slide cha cấp cao — quyết định user). KHÔNG tính `currentVerticalIndex`/độ sâu child. `current = currentSlideIndex` (đã là chỉ số slide cha; khi sửa vertical, `currentSlideIndex` vẫn trỏ slide cha — verify `EditorPage.jsx:141` + verticalEdit là state riêng).

**Non-functional:**
- StatusBar toàn cục (MainLayout) → KHÔNG được crash/hiện sai khi route không phải editor.
- Giữ toàn bộ `data-testid` cũ chừng nào còn ý nghĩa; testid mới cho slider/slide-pos/view.

## Architecture

**`ui-store` mở rộng (nhóm tách biệt Phase 1):**
- `slidePosition: { current: 0, total: 0 }`; action `setSlidePosition({current, total})`.
- `presentHandler: null`; action `setPresentHandler(fn)`.
  - **CẢNH BÁO (MAJOR đã verify):** các setter khác trong `ui-store` (dòng 79-95) dùng idiom `typeof v === 'function' ? v(s) : v`. NẾU `setPresentHandler` copy idiom này → nó sẽ GỌI `fn(state)` ngay lúc đăng ký → mở cửa sổ present mỗi lần mount/đổi presentation. PHẢI implement THUẦN: `setPresentHandler: (fn) => set({ presentHandler: fn })`. KHÔNG dùng function-idiom.
- `viewMode`/`setViewMode` ĐÃ có ở `editor-store.js:62/68` → StatusBar import `useEditorStore` cho view switcher (Normal/Sorter). Present dùng `presentHandler` từ `ui-store`.
- **Sorter có renderer thật (verify):** `SlideSorterView.jsx` tồn tại; EditorPage render theo `viewMode` (`EditorPage.jsx:1221,1324`) + Ctrl+Shift+S (`:796`). Nút Sorter ở status bar đổi `viewMode='sorter'` → hiển thị thật, KHÔNG dead-state.

**Vì sao cầu nối store, không prop:** StatusBar render ở `MainLayout.jsx:11` (ngoài cây EditorPage). `currentSlideIndex` là `useState` cục bộ EditorPage (`:141`). Không thể truyền props trực tiếp → đồng bộ qua store (giống `zoom` đang làm).

**EditorPage wiring (useEffect):**
```
// slide position
useEffect(() => {
  setSlidePosition({ current: currentSlideIndex, total: presentation?.slides?.length ?? 0 })
}, [currentSlideIndex, presentation?.slides?.length, setSlidePosition])

// present handler đăng ký + cleanup
useEffect(() => {
  setPresentHandler(() => presentInWindow(presentation))
  return () => setPresentHandler(null)
}, [presentation, setPresentHandler])
```
**Cleanup quan trọng:** unmount EditorPage (về Home) → `setSlidePosition({current:0,total:0})` + `setPresentHandler(null)` để cluster ẩn. Đặt cleanup trong cùng useEffect (return) hoặc một useEffect unmount riêng.

**StatusBar refactor:**
- **Cụm phải bọc trong gate `{total>0 && (...)}`** (zoom + slide-pos + view cùng ẩn/hiện theo editor). Attribution + version LUÔN hiện.
- `ZoomControls`: thay `<select>` bằng `<input type="range" data-testid="statusbar-zoom-slider">`. Giữ −/+/Fit/display. Nằm TRONG gate `total>0`.
- `SlidePosition`: `<span data-testid="statusbar-slide-position">Slide {current+1} / {total}</span>` (trong gate).
- `ViewSwitcher`: 3 nút `data-testid="statusbar-view-normal|sorter|present"`, aria-pressed theo viewMode (present không pressed — là action). Trong gate.

## Related Code Files

- Modify: `client/src/components/layout/StatusBar.jsx` (slider + slide-pos + view switcher + gate)
- Modify: `client/src/stores/ui-store.js` (slidePosition, presentHandler + actions)
- Modify: `client/src/pages/EditorPage.jsx` (useEffect đồng bộ slidePosition + đăng ký presentHandler + cleanup)
- Modify: `client/src/components/layout/StatusBar.test.jsx` (dropdown→slider; thêm slide-pos + view tests)
- Create: `client/src/stores/ui-store-slide-position-and-present-handler.test.js`

## Implementation Steps (TDD)

1. **RED — store test** (`ui-store-slide-position-and-present-handler.test.js`):
   - default `slidePosition={current:0,total:0}`, `presentHandler===null`.
   - `setSlidePosition({current:2,total:5})` → đọc lại đúng.
   - `setPresentHandler(fn)` → `get().presentHandler` gọi được; `setPresentHandler(null)` → null.
   - **đăng ký KHÔNG tự gọi (regression cho MAJOR):** `const spy=vi.fn(); setPresentHandler(spy)` → `expect(spy).not.toHaveBeenCalled()`; chỉ khi `get().presentHandler()` mới gọi spy.
2. **GREEN** — thêm vào `ui-store.js`.
3. **RED — StatusBar tests** (cập nhật `StatusBar.test.jsx`):
   - **Lưu ý gate:** zoom nay nằm TRONG cụm `total>0`. Các test zoom/view/slide-pos phải `useUIStore.setState({ slidePosition:{current:_,total:5} })` trước render để cụm hiện.
   - **Cụm ẩn khi total=0:** `slidePosition={current:0,total:0}` → KHÔNG có `statusbar-zoom-slider`, `statusbar-slide-position`, `statusbar-view-normal`; vẫn có attribution + version.
   - **Zoom slider thay dropdown** (với total=5):
     - `statusbar-zoom-select` KHÔNG còn; có `statusbar-zoom-slider`.
     - render zoom=0.75 → slider value `75`.
     - `fireEvent.change(slider,{target:{value:'200'}})` → `zoom===2`, `userZoomMode===true`.
     - giữ test −/+/Fit cũ (set total>0 + đổi selector nếu cần).
   - **Slide position** (total=5): `{current:2,total:5}` → text "Slide 3 / 5".
   - **View switcher** (total=5):
     - `viewMode='normal'` → 3 nút hiện; Normal aria-pressed=true, Sorter=false.
     - click Sorter → `editor-store.viewMode==='sorter'`.
     - click Present → `presentHandler` được gọi (mock qua `setPresentHandler`).
4. **GREEN** — refactor StatusBar theo kiến trúc trên.
5. **Wire EditorPage** 2 useEffect + cleanup; chạy dev: Home (ẩn cluster) ↔ Editor (hiện, slide-pos đúng, view chuyển đúng, Present mở cửa sổ).
6. **Refactor** — tách `SlidePosition`, `ViewSwitcher` thành component con trong cùng file (giữ <200 LOC; nếu vượt → tách file `status-bar-view-switcher.jsx`).

## Todo List

- [ ] Store test (RED) → impl (GREEN)
- [ ] StatusBar zoom slider test (RED) → impl
- [ ] StatusBar slide-position test (RED) → impl
- [ ] StatusBar view-switcher test (RED) → impl
- [ ] EditorPage useEffect slidePosition + presentHandler + cleanup
- [ ] Manual: Home ẩn cluster / Editor hiện đúng, Present hoạt động
- [ ] lint + build + test xanh

## Success Criteria

- [ ] Zoom slider đồng bộ store 2 chiều; −/+/Fit/% còn hoạt động (khi cụm hiện).
- [ ] "Slide X / Y" đúng theo slide cha hiện tại; ẩn khi total=0.
- [ ] View switcher: Normal/Sorter đổi `viewMode`; Present mở present window; active state đúng. Present giữ ở status bar.
- [ ] Home/Settings/Explore (total=0): ẩn CẢ cụm (zoom + slide-pos + view); chỉ còn attribution + version; không crash.
- [ ] Test cũ chuyển sang slider pass; test mới pass; lint/build sạch.

## Risk Assessment

- **Phá test `statusbar-zoom-select`** (Trung bình — đã lường trong report): thay assertion sang slider (bước 3). Có chủ đích.
- **Gate cả cụm theo editor (quyết định user)** (Thấp): zoom + slide-pos + view ẩn trên Home/Settings/Explore (total=0). Dùng `slidePosition.total>0` làm proxy "editor active" (chỉ EditorPage gọi `setSlidePosition`). Rủi ro: nếu sau này route non-editor nào đó gọi `setSlidePosition` với total>0 → cụm hiện sai. Hiện KHÔNG có → an toàn; ghi chú để tránh lạm dụng setter.
- **presentHandler giữ reference presentation cũ** (Thấp): useEffect phụ thuộc `[presentation,...]` → re-register khi presentation đổi. Cleanup set null khi unmount.
- **viewMode='sorter' từ status bar nhưng đang ở Home** (Thấp): cụm view ẩn khi total=0 nên không bấm được; an toàn.

## Security Considerations

Thuần UI state qua store; không trust boundary. `presentInWindow` đã tồn tại, không đổi hành vi mở cửa sổ.

## Next Steps

Phase 3 (big-button) độc lập store; có thể bắt đầu sau khi Phase 2 build xanh.
