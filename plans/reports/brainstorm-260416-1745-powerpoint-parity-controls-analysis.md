# Brainstorm Report: NavSlides Controls — PowerPoint-Parity Analysis

**Date:** 2026-04-16  
**Author:** Brainstorm Agent  
**Context:** Phân tích toàn diện UX controls của dự án để đạt mức PowerPoint-parity  
**Scope:** Tất cả UI controls: Toolbar, Insert Menu, Properties Panel, Slide Panel, Animation Timeline, Context Menus, Canvas Interactions, Menu Bar

---

## Executive Summary

NavSlides Editor có **kiến trúc controls khá tốt** nhưng **thiếu nhiều features cốt lõi** so với PowerPoint. Dưới đây là phân tích chi tiết theo từng area.

---

## 1. TOOLBAR ANALYSIS

### 1.1 Hiện trạng
- Toolbar hiện tại là **single flat bar** chứa tất cả: Insert dropdown + Font controls + Text formatting + Alignment + Table + Math + Link + Image + Undo/Redo + Grid/Smart Guides/Ruler toggles
- ~50 controls trên 1 hàng → **quá đông, khó quét**
- Font controls: dropdown font-family + dropdown font-size + 20+ formatting buttons → chiếm ~40% toolbar width
- **Phím tắt Ctrl+B/I/U KHÔNG hoạt động** khi đang edit text (vấn đề bug nghiêm trọng)

### 1.2 PowerPoint Ribbon so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| **Mini Toolbar** (xuất hiện khi chọn text) | ❌ Không có | ✅ Ưu tiên cao |
| Floating formatting bar khi select text | Inline toolbar trên canvas | Chưa hover-aware |
| Keyboard shortcuts Ctrl+B/I/U | ❌ Bug — không hoạt động | ✅ Fix ngay |
| Font color picker + highlight | ✅ Có (palette) | OK nhưng cần cải thiện UX |
| Format painter | ❌ Không có | Trung bình |
| Line spacing controls | ❌ Không có | Trung bình |
| Decrease/increase font size | ❌ Không có | Thấp |
| Clear formatting | ✅ Có | OK |

### 1.3 Issues & Recommendations

**ISSUE #T1 — CRITICAL BUG: Ctrl+B/I/U không hoạt động khi edit text**
```
File: client/src/components/SlideCanvas.jsx
Handler: onKeyDown trong useEffect (line 466-512)
Root cause: Khi editingElementId != null, handler return ngay sau xử lý Escape
→ TipTap editor KHÔNG nhận được keyboard events Ctrl+B/I/U
```

**FIX:** Thêm check ở đầu handler:
```jsx
// Thay vì return ngay khi đang edit, xử lý Ctrl combos trước
if (editingElementId) {
  if (e.key === 'Escape') { onStopEdit(); e.preventDefault(); return }
  // Forward formatting shortcuts to TipTap
  if (e.ctrlKey || e.metaKey) {
    // Let TipTap handle these — do NOT return early
    if (['b','i','u','z','y'].includes(e.key.toLowerCase())) return
  }
  return // Chỉ return cho các phím khác
}
```

**ISSUE #T2 — THIẾU: Mini Toolbar (PowerPoint floating bar)**
- PowerPoint: Khi chọn text → hiện floating bar với B/I/U/Size/Font/Color
- NavSlides: Toolbar luôn hiển thị, không context-aware
- **Recommendation:** Thêm `SelectionToolbar` component xuất hiện khi user chọn text element, floating gần vùng chọn. Chỉ hiện B/I/U/Underline/Color/Size

**ISSUE #T3 — TOOLBAR QUÁ ĐÔNG**
- >40 controls trên 1 bar → khó tìm
- Font family dropdown quá rộng (120px) trong khi font size dropdown chỉ 60px
- **Recommendation:**
  - Tách Font controls (Family + Size) vào **formatting group riêng** với border separator
  - Thêm **tooltip** hiện phím tắt cho mỗi button (VD: "Bold (Ctrl+B)")
  - Icon buttons nên có `title` attribute với shortcut

---

## 2. INSERT MENU ANALYSIS

### 2.1 Hiện trạng
- InsertMenu là dropdown menu với 4 categories: Basic, Content, Media, Shapes & Lines, Layout
- Tổng cộng ~20+ item + sub-menus (Shape picker grid, Icon picker grid, Table size picker)
- Sub-menus mở bên trong main menu (onMouseEnter → mở sub-panel)

### 2.2 PowerPoint Insert Tab so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| Pictures (upload, URL, Stock, OneDrive) | ✅ Upload + URL | Khá tốt |
| Online Pictures (Unsplash, etc.) | ❌ Không có | Thấp |
| Shapes gallery | ✅ Shape picker grid | OK |
| Icons | ✅ Icon picker (chỉ 60 icons) | Mở rộng icons |
| SmartArt | ❌ Không có | Thấp (YAGNI?) |
| Chart | ✅ Chart (Chart.js) | OK |
| Table | ✅ Table size picker (8x8 grid) | OK |
| Text Box | ✅ Text | OK |
| WordArt | ❌ Không có | Không cần |
| Drop Cap | ❌ Không có | Không cần |
| Equation | ✅ LaTeX | OK |
| Symbol | ❌ Không có | Thấp |
| Screen Recording | ❌ Không có | Không cần |
| Video (Online/This Device) | ✅ URL + Upload | OK |
| Audio (Online/This Device) | ✅ Upload | OK |
| Media Library | ✅ MediaLibraryModal | OK |
| Header & Footer | ❌ Không có | Trung bình |
| Drawing Canvas | ✅ Drawing Canvas | OK |

### 2.3 Issues & Recommendations

**ISSUE #IM1 — TABLE SIZE PICKER không trực quan bằng PowerPoint**
- PowerPoint: Grid 10x10 click-drag chọn → preview real-time
- NavSlides: Hover highlight cells → click để insert
- Vấn đề: Khi hover, `tableSize.r` và `tableSize.c` được set nhưng CHƯA INSERT cho đến khi click. UX khác PowerPoint (PowerPoint insert ngay khi chọn)
- **Recommendation:** Hoặc giữ current UX (rõ ràng hơn), hoặc đổi thành "chọn = insert" giống PowerPoint

**ISSUE #IM2 — Shape Picker grid 1 hàng dài**
- SHAPES từ `shared/src/shapeUtils.js` có ~15 shapes
- Hiện là 1 grid trong sub-panel → OK
- **Recommendation:** Thêm "Recently used" section ở đầu Shape picker

**ISSUE #IM3 — Icon picker CHỈ CÓ 60 icons (hardcoded)**
- `ICON_NAMES` array trong InsertMenu.jsx hardcoded 60 icons
- PowerPoint/Lucide có 1500+ icons
- **Recommendation:** Load từ Lucide React dynamically thay vì hardcoded array

---

## 3. PROPERTIES PANEL ANALYSIS

### 3.1 Hiện trạng
- PropertiesPanel là **fixed right sidebar** (~300px)
- Hiện Properties khi chọn element hoặc slide
- Element properties: Position (X/Y/Width/Height/Rotation), Lock, Type-specific options, Fragment animation, Drop shadow, Layer controls
- Slide Footer section, Speaker Notes section, Custom CSS section

### 3.2 PowerPoint Format Pane so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| Position & Size (X, Y, W, H) | ✅ Có (grid inputs) | OK |
| Rotation | ✅ Có (number input) | OK |
| Lock/Unlock | ✅ Có (checkbox) | OK |
| Fill color | ✅ Có (color picker) | OK |
| Line/Border | ✅ Có (stroke + width) | OK |
| Shadow effects | ✅ Có (4-field shadow) | OK |
| Art border effects | ❌ Không có | Không cần |
| Crop image | ✅ Có (crop overlay) | OK |
| Remove background | ❌ Không có | Trung bình |
| Compress pictures | ❌ Không có | Không cần |
| Picture corrections (brightness/contrast) | ✅ Có (range sliders) | OK |
| **Selection Pane** (Layer list) | ❌ Không có | ✅ Cao |
| Align/Distribute | ✅ Toolbar buttons | Cần cải thiện UI |
| Group/Ungroup | ✅ Toolbar buttons | OK |
| Bring Forward/Send Backward | ✅ Buttons | OK |
| Fragment animations | ✅ AnimationTimeline riêng | OK nhưng tách rời |
| Font controls (in format pane) | ❌ Trong Toolbar | Nên tách ra Properties Panel |

### 3.3 Issues & Recommendations

**ISSUE #PP1 — THIẾU: Selection Pane (Layer List)**
- PowerPoint: View → Selection Pane → list tất cả objects trên slide, có visibility toggle + rename
- NavSlides: KHÔNG CÓ layer list
- User không thể:
  - Xem tất cả elements trên slide (kể cả elements ẩn/very small)
  - Toggle visibility của từng element
  - Rename elements (đặt tên để dễ quản lý)
  - Reorder zIndex bằng drag trong list
- **Recommendation:** Thêm `SelectionPane` collapsible section trong PropertiesPanel (hoặc floating panel), hiển thị:
  ```jsx
  // Tính năng cần có:
  - List all elements with type icon + name
  - Eye icon toggle visibility
  - Lock icon toggle lock
  - Drag to reorder zIndex
  - Double-click to rename
  - Click to select on canvas
  ```

**ISSUE #PP2 — Position inputs không có unit labels**
- `X`, `Y`, `W`, `H`, `Rot` labels không có "px"
- Range sliders hiện giá trị ở trên nhưng number inputs không
- **Recommendation:** Thêm `title` hoặc `aria-label` với unit

**ISSUE #PP3 — Fragment animation tách rời khỏi Properties Panel**
- AnimationTimeline là separate floating component
- PowerPoint: Animation options trong Format Pane + Animation Pane
- **Recommendation:** Giữ AnimationTimeline (vì nó là specialized tool), nhưng thêm "Fragment" section vào PropertiesPanel cho quick access

**ISSUE #PP4 — Drop Shadow inputs có thể gộp**
- 4 separate inputs (X, Y, Blur, Color) cho shadow
- PowerPoint: Visual shadow picker với presets + sliders
- **Recommendation:** Thêm shadow presets (Outer, Inner, Perspective, etc.) + on/off toggle

---

## 4. SLIDE PANEL ANALYSIS

### 4.1 Hiện trạng
- Fixed left sidebar (~200px) với slide thumbnails
- Thumbnail hiển thị elements scaled down + background color
- Right-click context menu: Duplicate, Lock, Auto-Animate, Move Up/Down, Add Vertical Slide, Delete
- Drag-and-drop reorder
- Indicators: Lock icon, Auto-animate sparkle icon, Section name

### 4.2 PowerPoint Thumbnail Pane so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| Thumbnails | ✅ Có | OK |
| Multi-select slides (Ctrl+click) | ❌ Không có | Cao |
| Slide move (drag) | ✅ Có | OK |
| Section organization | ✅ § prefix + section name | OK |
| Slide master indicator | ❌ Không có | Không cần |
| Slide layout indicator | ❌ Không có | Không cần |
| Duplicate slide | ✅ Có (context menu) | OK |
| Delete slide | ✅ Có (context menu) | OK |
| **Slide Sorter View** | ❌ Không có | ✅ Cao |
| Paste slide from clipboard | ❌ Không có | Thấp |
| Reset slide | ❌ Không có | Thấp |

### 4.3 Issues & Recommendations

**ISSUE #SP1 — THIẾU: Slide Sorter View**
- PowerPoint: View → Slide Sorter → hiển thị tất cả slides dạng grid nhỏ
- NavSlides: Chỉ có normal view + thumbnail sidebar (slide nhỏ, khó thấy layout)
- **Recommendation:** Thêm View mode toggle trong EditorPage/View menu:
  - Normal View (default) - 1 slide lớn
  - **Slide Sorter View** - grid 4-6 slides/hàng, click để select, drag để reorder
  - Đặt trong collapsible panel hoặc full-screen overlay

**ISSUE #SP2 — THIẾU: Multi-select slides**
- Không thể Ctrl+click để chọn nhiều slides cùng lúc
- PowerPoint: Multi-select → delete, duplicate, group operations
- **Recommendation:** Thêm Ctrl+click / Shift+click support trong SlidePanel

**ISSUE #SP3 — Thumbnail quá nhỏ khi nhiều slides**
- Slide item height cố định → khi >20 slides, scroll nhiều
- **Recommendation:** Cho phép resize SlidePanel width (draggable divider) hoặc compact mode

**ISSUE #SP4 — Context menu trên slide thumbnail thiếu "Copy/Paste slide"**
- PowerPoint: Copy slide (Ctrl+D), Paste slide, New slide
- NavSlides: Chỉ Duplicate (tạo bản sao ngay tại chỗ), không có Copy/Paste độc lập
- **Recommendation:** Thêm Copy Slide / Paste Slide vào context menu

---

## 5. ANIMATION TIMELINE ANALYSIS

### 5.1 Hiện trạng
- Floating panel hiện khi click "Animation Timeline" button
- Hiển thị Initial state + fragment steps (groups by fragmentIndex)
- Drag-and-drop reorder fragments
- Per-element animation type dropdown
- Preview button

### 5.2 PowerPoint Animation Pane so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| List animations | ✅ Hiển thị fragments | OK |
| Animation type selector | ✅ Dropdown | OK |
| Reorder (drag) | ✅ Drag-drop | OK |
| Duration setting | ❌ Không có | ✅ Cao |
| Delay setting | ❌ Không có | Trung bình |
| Easing/Effect options | ❌ Không có | Thấp |
| Trigger (on click, with previous, etc.) | ❌ Không có | Thấp |
| Animation preview | ✅ Button có | OK |
| Multi-animation per element | ⚠️ Fragment nhưng limited | Cần cải thiện |
| **Animation Gallery** (Entrance/Emphasis/Exit) | ❌ Chỉ có 12 types | ✅ Cao |

### 5.3 Issues & Recommendations

**ISSUE #AT1 — THIẾU: Animation Duration & Delay**
- PowerPoint: Mỗi animation có Duration (0-5s) + Delay (0-10s)
- NavSlides: Chỉ có animation type
- **Recommendation:** Mở rộng AnimationTimeline: thêm duration slider + delay input cho mỗi fragment

**ISSUE #AT2 — THIẾU: Animation Gallery (Entrance/Emphasis/Exit)**
- NavSlides chỉ có 12 animation types hardcoded
- PowerPoint có 50+ animations (Fade, Fly, Wipe, Zoom, etc.)
- **Recommendation:**
  - Mở rộng `ANIMATION_TYPES` array thêm: fly-in, slide-in, zoom-in, bounce, spin, etc.
  - Thêm categories: Entrance / Emphasis / Exit
  - Mapped sang reveal.js auto-animate attributes

**ISSUE #AT3 — Animation Timeline không show non-fragment elements**
- Chỉ hiển thị elements có `fragment: true` (max 5 shown + "+N more")
- Non-fragment elements ẩn → user không biết element nào chưa có animation
- **Recommendation:** Hiển thị ALL elements, highlight những cái chưa có fragment với muted color + "Add" button

---

## 6. CONTEXT MENUS ANALYSIS

### 6.1 Hiện trạng
- **Canvas context menu** (right-click element): Crop, Reset crop, Snap Reference (3x3 grid)
- **Slide thumbnail context menu**: Duplicate, Lock/Unlock, Auto-Animate, Move Up/Down, Add Vertical Slide, Delete

### 6.2 PowerPoint Context Menus so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| Cut/Copy/Paste | ❌ Không có (Canvas) | ✅ Cao |
| Duplicate | ✅ Slide panel only | OK |
| Delete | ✅ Slide + Canvas | OK |
| Bring to Front/Send to Back | ✅ Toolbar buttons only | Nên có trong context menu |
| Bring Forward/Send Backward | ✅ Buttons in Properties | Nên có trong context menu |
| Group/Ungroup | ✅ Toolbar buttons only | Nên có trong context menu |
| Format shape/picture | ❌ Mở Properties Panel | Có thể thêm shortcut |
| Reset picture | ❌ Không có | Trung bình |
| View/Edit alt text | ❌ Không có | Không cần |
| Link/Hyperlink | ❌ Không có | Trung bình |
| Save as picture | ❌ Không có | Không cần |
| Shape quick styles | ❌ Không có | Không cần |

### 6.3 Issues & Recommendations

**ISSUE #CM1 — THIẾU: Cut/Copy/Paste trong Canvas context menu**
- Vấn đề nghiêm trọng: KHÔNG THỂ copy/paste elements trên canvas
- PowerPoint: Ctrl+C/V/D = essential workflow
- **Recommendation:** Thêm Cut (Ctrl+X), Copy (Ctrl+C), Paste (Ctrl+V), Duplicate (Ctrl+D) vào canvas context menu + keyboard shortcuts

**ISSUE #CM2 — Bring to Front/Back KHÔNG CÓ trong Canvas context menu**
- Phải vào Properties Panel → click ↑ Forward / ↓ Backward buttons
- PowerPoint: Right-click → Bring to Front / Send to Back
- **Recommendation:** Thêm vào Canvas context menu khi element được chọn

**ISSUE #CM3 — Context menu không có icon**
- PowerPoint context menus có icons bên trái mỗi item
- NavSlides: Text-only items
- **Recommendation:** Thêm lucide icons vào context menu items

---

## 7. CANVAS INTERACTION ANALYSIS

### 7.1 Hiện trạng
- Drag elements để move
- 8 resize handles (NW/N/NE/E/SE/S/SW/W) + rotation handle
- Grid snap + Smart Guides (snap-to-edge/center)
- Rubber-band selection (click-drag trên canvas)
- Crop mode cho images
- Shift+resize = maintain aspect ratio

### 7.2 PowerPoint Canvas so sánh
| PowerPoint Feature | NavSlides | Cần cải thiện |
|---|---|---|
| Drag to move | ✅ Có | OK |
| 8 resize handles | ✅ Có | OK |
| Rotation handle | ✅ Có | OK |
| Grid snap | ✅ Có (toggle) | OK |
| Smart Guides (alignment) | ✅ Có (snap to edge/center) | OK |
| **Guides** (drag from ruler) | ✅ Có (persistent) | OK |
| **Snap to objects** | ⚠️ Smart guides nhưng limited | Cải thiện |
| Shift+resize = square | ✅ Có | OK |
| Alt+resize from center | ❌ Không có | Thấp |
| Drawing mode (pen tool) | ✅ Có (Drawing Canvas element) | OK |
| **Selection Pane** | ❌ Không có | ✅ Cao |
| Alt text editing | ❌ Không có | Không cần |
| Crop image | ✅ Có | OK |
| Picture correction handles | ❌ Không có | Không cần |
| **Zoom controls** | ⚠️ ResizeObserver auto-fit | Thêm manual zoom |
| Rotate 90° buttons | ❌ Không có | Không cần |

### 7.3 Issues & Recommendations

**ISSUE #CV1 — THIẾU: Manual zoom controls**
- NavSlides: Auto-fit scale-to-container duy nhất, KHÔNG có manual zoom
- PowerPoint: Zoom slider (25%-400%), fit to window, actual size
- **Recommendation:** Thêm zoom controls ở bottom-right của canvas:
  - Zoom in/out buttons (+/-)
  - Zoom percentage dropdown
  - "Fit" button
  - Keyboard: Ctrl+scroll to zoom

**ISSUE #CV2 — THIẾU: Snap to object alignment**
- Smart guides chỉ snap khi đưa element GẦN edge/center của element khác
- PowerPoint: Snap to slide edges, other objects, grid, guides simultaneously
- **Recommendation:** Cải thiện `smartGuides` calculation trong `utils/smartGuides.js` để snap thêm vào: slide corners, other element corners, other element midpoints

**ISSUE #CV3 — Ruler guides không persist across slides**
- Persistent guides hiện tại chỉ cho 1 slide
- PowerPoint: Guides global cho tất cả slides
- **Recommendation:** Nếu muốn global guides, lưu vào presentation level thay vì slide level

---

## 8. ALIGNMENT CONTROLS ANALYSIS

### 8.1 Hiện trạng
- Alignment buttons trong Toolbar, chỉ hiện khi `selectedCount >= 2`
- 8 align options: Left/CenterH/Right/Top/CenterV/Bottom/DistributeH/DistributeV

### 8.2 Issues

**ISSUE #AC1 — Alignment KHÔNG CÓ trong Properties Panel hoặc Context Menu**
- Toolbar buttons là ONLY way để align
- Khi alignment buttons hidden (chỉ có 1 element selected), user phải select thêm element dummy
- **Recommendation:**
  - Thêm alignment section vào Properties Panel (luôn visible khi 1+ elements selected)
  - Thêm vào Canvas context menu khi multi-select

---

## 9. MENU BAR (EditorMenuBar) ANALYSIS

### 9.1 Hiện trạng
- 5 dropdown menus: File, View, Settings, AI, Share
- Settings menu có: Background Theme, Slide Size, Transition, Grid/footer toggles, Auto-advance, Presenter Tools

### 9.2 Issues & Recommendations

**ISSUE #MB1 — Settings menu quá đông**
- >30 items trong Settings dropdown → scrolling cần thiết
- **Recommendation:** Tách Settings thành:
  - **Presentation Settings**: Theme, Slide Size, Transition, Header/Footer
  - **Presenter Tools**: Auto-advance, Loop, Kiosk mode, presenter tools checkboxes
  - Di chuyển ra riêng collapsible section trong Properties Panel

**ISSUE #MB2 — THIẾU: Quick Access Toolbar (QAT)**
- PowerPoint: Top-left QAT với common commands
- NavSlides: KHÔNG CÓ
- **Recommendation:** Thêm QAT strip giữa MenuBar và Toolbar (hoặc trên MenuBar) với:
  - Save, Undo, Redo, Repeat (F4)
  - User có thể customize

---

## 10. FIND & REPLACE ANALYSIS

### 10.1 Hiện trạng
- FindReplaceBar với search input, replace input, match case toggle, prev/next navigation
- Navigate đến slide containing match
- Replace single hoặc Replace All

### 10.2 Issues

**ISSUE #FR1 — KHÔNG tìm trong Markdown, LaTeX, HTML content**
- Find chỉ tìm trong text type, code type, shape text
- Không tìm trong Markdown element content, LaTeX content, HTML iframe content
- **Recommendation:** Thêm search support cho Markdown và LaTeX elements

---

## Priority Matrix

| Priority | Issue | Area | Fix Complexity |
|---|---|---|---|
| 🔴 P0 | Ctrl+B/I/U không hoạt động khi edit text | Canvas | Easy (1 line fix) |
| 🔴 P0 | KHÔNG CÓ Cut/Copy/Paste elements | Canvas | Medium |
| 🔴 P0 | KHÔNG CÓ Selection Pane (layer list) | Properties | Medium |
| 🟠 P1 | KHÔNG CÓ Slide Sorter View | SlidePanel | Medium |
| 🟠 P1 | KHÔNG CÓ Multi-select slides | SlidePanel | Easy |
| 🟠 P1 | Toolbar quá đông, cần tooltip+shortcut labels | Toolbar | Easy |
| 🟠 P1 | THIẾU Mini Toolbar cho text selection | Toolbar | Medium |
| 🟡 P2 | THIẾU Animation duration/delay | Animation | Easy |
| 🟡 P2 | Alignment trong Properties Panel | Properties | Easy |
| 🟡 P2 | THIẾU Manual zoom controls | Canvas | Easy |
| 🟡 P2 | Settings menu quá đông | MenuBar | Easy |
| 🟡 P2 | Context menu: Bring to Front/Back | Context Menu | Easy |
| 🟡 P2 | Bring Forward/Backward trong context menu | Context Menu | Easy |
| ⚪ P3 | Mở rộng animation types (12 → 30+) | Animation | Medium |
| ⚪ P3 | Animation timeline: show all elements | Animation | Easy |
| ⚪ P3 | Find/Replace: tìm trong Markdown/LaTeX | FindReplace | Medium |
| ⚪ P3 | Icon picker mở rộng | Insert | Easy |
| ⚪ P3 | QAT (Quick Access Toolbar) | MenuBar | Medium |

---

## Recommended Implementation Phases

### Phase 1: Critical Fixes (1-2 days)
1. Fix Ctrl+B/I/U keyboard shortcut bug (SlideCanvas.jsx)
2. Add Cut/Copy/Paste + Ctrl+D to canvas (editor-store + SlideCanvas)
3. Add Selection Pane to Properties Panel

### Phase 2: PowerPoint Core Parity (3-5 days)
4. Add Slide Sorter View mode
5. Add Mini Toolbar (floating formatting bar on text selection)
6. Add manual zoom controls (bottom-right corner)
7. Reorganize Toolbar: add tooltip labels + keyboard shortcuts visible

### Phase 3: Polish & Advanced (5-7 days)
8. Add animation duration/delay to AnimationTimeline
9. Move Alignment controls to Properties Panel
10. Reorganize Settings menu (split into sections)
11. Add context menu: Bring to Front/Back, Group/Ungroup
12. Expand animation types gallery

---

## Unresolved Questions

1. **Clipboard format**: Copy/Paste elements nên lưu dạng JSON hay HTML? PowerPoint dùng proprietary XML format.
2. **Slide Sorter View**: Nên là full-screen overlay mode hay inline grid view?
3. **Selection Pane**: Nên đặt trong Properties Panel (collapsible) hay floating panel riêng?
4. **Animation gallery expansion**: Mapped sang reveal.js auto-animate ra sao? reveal.js chỉ support fade/slide/zoom/none mặc định.

---

## Files Analyzed
- `client/src/components/Toolbar.jsx` — 1278 lines
- `client/src/components/InsertMenu.jsx` — 298 lines
- `client/src/components/PropertiesPanel.jsx` — 1643 lines
- `client/src/components/SlidePanel.jsx` — 516 lines
- `client/src/components/SlideCanvas.jsx` — 2294 lines
- `client/src/components/AnimationTimeline.jsx` — 184 lines
- `client/src/components/FindReplaceBar.jsx` — 208 lines
- `client/src/components/EditorMenuBar.jsx` — 315 lines
- `client/src/components/DropdownMenu.jsx` — 105 lines
