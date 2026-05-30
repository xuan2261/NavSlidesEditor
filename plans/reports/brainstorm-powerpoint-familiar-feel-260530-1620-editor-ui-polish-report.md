# Brainstorm — PowerPoint familiar-feel cho EditorPage UI/UX

**Ngày:** 2026-05-30 · **Loại:** Brainstorm / đánh giá giao diện · **Trạng thái:** Thiết kế đã chốt, CHƯA lên plan (theo yêu cầu user)
**Branch:** master · **Phạm vi:** EditorPage + ribbon + status bar (familiar-feel, giữ brand)

---

## 1. Problem statement

User muốn EditorPage "giống PowerPoint" để người dùng quen tay, dễ dùng. Tham chiếu: PowerPoint Design styles / PowerPoint 365.

**Phát hiện scout (quan trọng):** app KHÔNG thiếu PowerPoint-ness. Đã có sẵn:
- Ribbon 7 tab: Home / Insert / Design / Format / Transitions / Animations / View (`ribbon-tabs-config.js`)
- File dropdown, QuickAccessToolbar (undo/redo/save), nhóm AI & Share, nút Present (`ribbon-header-bar.jsx`)
- Layout 3 cột: SlidePanel · SlideCanvas (960×540) · PropertiesPanel + StatusBar (`design-guidelines.md`)
- StatusBar ĐÃ dùng `bg-accent` (terracotta) — tức đã mô phỏng "thanh trạng thái màu" PPT (`StatusBar.jsx:70`)
- Format tab ĐÃ contextual nội dung theo `selectedElement.type` (`ribbon-format-...controls.jsx:170`)
- "PowerPoint classic ribbon layout contract" đã ghi trong docs (vùng lệnh 80px, group label đáy, floating overlay)

→ **Rủi ro #1 của task: thiết kế lại cái đã chạy tốt.** Định hướng: đóng đúng các gap "familiar-feel", KHÔNG rewrite.

## 2. Requirements (đã chốt qua hỏi-đáp)

| Hạng mục | Quyết định |
|---|---|
| Mảng ưu tiên | Cả 4: mật độ ribbon, contextual tab có màu, panel phải & view phụ, màu/theme |
| Visual identity | **Giữ brand dark/terracotta**, chỉ mô phỏng bố cục + tương tác |
| Độ trung thành | **Familiar-feel** (không pixel-perfect clone) |
| Bản tham chiếu | **PowerPoint 365 / 2021 (modern)** |
| Chiều cao ribbon | **Giữ 80px** (không phá contract/test) |
| Format tab | **Ẩn/hiện theo selection** (auto-active khi chọn) |
| Status bar / view | **Chỉ map mode sẵn có** (không xây Slide Sorter/Reading mới) |
| Bước tiếp theo | **Chỉ viết report** (chưa /ck:plan) |

## 3. Khoảng cách thật vs PowerPoint 365 (đã verify code)

| # | Mảng | Hiện tại | Gap |
|---|------|---------|-----|
| 1 | Contextual tab | 1 tab `Format` cố định, đổi nội dung theo type | PPT đổi **nhãn** (Shape/Picture/Table Design), có **dải màu**, **ẩn khi bỏ chọn** |
| 2 | Mật độ ribbon | Nút đồng đều 28–32px (`ribbon-section.jsx`) | PPT có **1 nút LỚN** (icon trên/label dưới) + nút nhỏ 2 tầng → nhận diện nhanh |
| 3 | View phụ | Zoom **dropdown** (`StatusBar.jsx:26`), không view switcher | PPT có **zoom slider**, **"Slide X/Y"**, view switcher |
| 4 | Chrome | Tab active có biên ngăn panel | PPT: tab active **liền mạch** với panel dưới |

## 4. Approaches đánh giá

**A. Polish có chủ đích (CHỌN)** — nâng cấp tại chỗ 4 mảng trên nền ribbon hiện có.
- ✅ Ít rủi ro, không đụng plumbing lõi, bám YAGNI/familiar-feel
- ✅ ~6 vùng file, tái dùng zoom-store & contextual-content sẵn có
- ⚠️ Cần mượn 1 mẩu nhẹ của B (Format tab động/màu/ẩn-hiện)

**B. Refactor ribbon-engine + hệ contextual-tab-set** — abstraction tab-set ẩn/hiện có màu đầy đủ.
- ✅ Linh hoạt mở rộng nhiều contextual tab về sau
- ❌ Đụng `VALID_RIBBON_TABS`, `ui-store`, `RibbonPanel`, vỡ nhiều test; thừa cho familiar-feel

**C. Dựng lại shell đầy đủ** (Backstage toàn màn, Designer pane, Slide Sorter, Reading view).
- ❌ Vi phạm YAGNI + "familiar-feel"; **LOẠI**

→ **Chọn A**, mượn tối thiểu của B chỉ đủ cho Format tab động.

## 5. Recommended solution (Approach A)

### Mảng 1 — Format tab động: nhãn + màu + ẩn/hiện
- Ẩn tab khi `!selectedElement`; hiện + auto-active khi chọn.
- Nhãn theo type: shape→"Shape Format", image→"Picture Format", table→"Table Design", chart→"Chart Design", code→"Code", video/audio→"Media".
- Dải màu accent mảnh trên tab theo type (giữ nền dark, chỉ viền màu).
- **Touchpoints:** `ribbon-tabs-config.js`, `tab-bar-with-scroll-and-icons.jsx`, `ui-store.js` (VALID set + logic ẩn/hiện), `ribbon-format-...controls.jsx`.

### Mảng 2 — Big-button hierarchy
- Component mới `RibbonBigButton` (icon 20–24px trên, label 11px dưới, ~52px, vừa khít 80px) + nút nhỏ xếp 2 tầng cạnh.
- Áp cho action chủ đạo: Home→Paste; Insert→New Slide / Text Box / Picture.
- **Touchpoints:** `ribbon-section.jsx`, `components/ui/Button.jsx` (variant), `ribbon/controls/*`.

### Mảng 3 — Status bar + view phụ kiểu PPT
- Zoom **dropdown → slider** + nút Fit (tái dùng `zoomIn/zoomOut/setZoom/fitZoom` đã có trong store).
- Thêm **"Slide X / Y"** bên trái.
- View switcher chỉ map mode ĐÃ CÓ (Normal hiện tại, Present, toggle Notes/Speaker nếu có) — KHÔNG view mới.
- Giữ nguyên dòng attribution "Vietnam Naval Academy" (quyết định brand của user).
- **Touchpoints:** `StatusBar.jsx`, `ui-store.js` (zoom đã đủ).

### Mảng 4 — Tinh chỉnh chrome (giữ brand)
- Tab active nối liền panel dưới (bỏ biên giữa tab active ↔ panel).
- Chuẩn hóa separator + group label (phần lớn đã có).
- **Touchpoints:** CSS tab strip, `ribbon-panel.jsx`.

### Out of scope (YAGNI)
Backstage toàn màn · Designer/Design Ideas · Slide Sorter/Reading view mới · đổi default sang light theme.

## 6. Risks & mitigation

| Risk | Mức | Mitigation |
|---|---|---|
| Đổi zoom dropdown→slider phá test `data-testid="statusbar-zoom-select"` | Trung bình | Cập nhật test StatusBar; giữ testid input mới |
| Format tab ẩn/hiện phá test duyệt-7-tab (`ribbon-shell-tab-navigation...test`) | Trung bình | Cập nhật test cho trạng thái không-selection; thêm test selection→tab xuất hiện |
| Big-button làm tràn vùng 80px | Thấp | Thiết kế khít 80px (đã chốt giữ 80px); kiểm tra ở viewport hẹp |
| Thay đổi `VALID_RIBBON_TABS` ảnh hưởng persist activeTab | Thấp | Khi format ẩn mà đang active → fallback 'home' |
| Drift docs vs contract | Thấp | Cập nhật `design-guidelines.md` contract sau khi đổi |

## 7. Success metrics / validation

- Chọn element → tab "X Format" xuất hiện, đổi nhãn+màu đúng type, tự active; bỏ chọn → tab ẩn, về Home.
- Mỗi group ribbon có ≥1 big-button nhận diện được; vùng lệnh vẫn 80px, không tràn ở ≥1280px.
- Status bar: zoom slider hoạt động (đồng bộ store), "Slide X/Y" đúng, nút view chuyển đúng mode sẵn có.
- `npm run lint && npm run build` sạch; `npm run test` + e2e ribbon/status pass sau khi cập nhật test.
- Brand dark/terracotta giữ nguyên; không đổi default theme.

## 8. Next steps

- **Hiện tại:** dừng ở report (theo yêu cầu user).
- **Khi muốn triển khai:** chạy `/ck:plan` với report này làm input → chia phase (đề xuất thứ tự: Mảng 1 Format tab → Mảng 3 Status bar → Mảng 2 big-button → Mảng 4 chrome), kèm cập nhật test + `design-guidelines.md`.

## 9. Unresolved questions

1. View switcher "map mode sẵn có" — xác nhận tập mode đích chính xác (Normal/Present/Notes?) khi vào phase, vì hiện chưa có Reading/Sorter để map.
2. Auto-chuyển sang Format tab khi chọn element: chuyển ngay hay chỉ khi user click tab? (Đề xuất: auto-active lần đầu chọn, tôn trọng nếu user đã rời tab thủ công — cần chốt ở plan.)
3. Bộ màu dải accent theo từng element-type chưa định danh hex cụ thể — chốt khi thiết kế chi tiết.
