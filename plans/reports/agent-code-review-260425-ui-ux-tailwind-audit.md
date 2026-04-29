# Code Review: UI/UX Tailwind CSS Audit — NavSlides Editor

**Review date:** 2026-04-25
**Reviewer:** Claude Code (code-review agent)
**Scope:** Full codebase UI/UX review after Tailwind CSS refactoring
**Files reviewed:** ~25 files (client/src/)

---

## Tổng quan

Base là một React SPA editor trình chiếu WYSIWYG trên reveal.js. Tailwind refactor đã làm tốt về design tokens, nhưng còn nhiều lỗi UX, UI inconsistency, và một số bug thực sự.

---

## PHẦN 1 — Critical Issues (Cần fix ngay)

### [C-01] `PropertiesPanel.jsx:227-242` — Hardcoded dark theme trong Custom CSS textarea

```jsx
// ĐANG VIẾT:
style={{
  width: '100%',
  minHeight: 140,
  background: '#0d0d1a',    // ← hardcoded dark
  color: '#e2e8f0',         // ← hardcoded dark
  fontFamily: "'Fira Code'...",
  ...
}}
```

**Vấn đề:** Textarea này hoàn toàn hardcoded dark mode. Trong light theme, nền `#0d0d1a` tối om và text `#e2e8f0` sáng chói — không thể đọc được. Nên dùng CSS variables hoặc Tailwind class.

**Fix:** Dùng `style` object với CSS variables:
```jsx
style={{
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  borderColor: 'var(--border)',
  ...
}}
```

---

### [C-02] `SlidePanel.jsx:206-211` — Slide index bị ẩn trên nền trắng

```jsx
<span className={`absolute top-1 left-1 text-[10px] text-white/50 bg-black/40 px-1 py-[1px] rounded-[3px] z-10 ${
  slide.locked ? 'line-through opacity-50' : ''
}`}>
```

**Vấn đề:** `text-white/50` + `bg-black/40` — nếu slide background là trắng hoặc gradient sáng, text số thứ tự slide gần như invisible.

**Fix:** Đổi thành `text-white bg-black/60` hoặc thêm outline: `shadow-sm`.

---

### [C-03] `InsertMenu.jsx:23-25` — Import toàn bộ lucide-react icons vào bundle

```js
import * as LucideIcons from 'lucide-react'
const ICON_NAMES = Object.keys(LucideIcons)
```

**Vấn đề:** `lucide-react` có ~1000+ icons. Import `*` kéo **toàn bộ** vào bundle. Icon picker trong InsertMenu chỉ cần 1 phần nhỏ. Đây là **bundle size killer** nghiêm trọng.

**Fix:** Chỉ import những icon cần thiết:
```js
import { Search, Plus, ... } from 'lucide-react'
// Hoặc dùng dynamic import khi mở icon picker
```

---

### [C-04] `Toolbar.jsx:52-108` — COLOR_PALETTE và COLOR_SWATCHES_BG không dùng CSS variables

```js
const COLOR_PALETTE = ['#ffffff', '#e2e8f0', ...]  // hardcoded
```

**Vấn đề:** Color palette hardcoded hex values, không theo theme system. Trong light mode, nền toolbar tối nhưng palette vẫn hiển thị đầy đủ — có thể không phù hợp với light theme surface.

---

## PHẦN 2 — High Priority Issues

### [H-01] `HomePage.jsx:797-805` — Import progress/warning hiển thị ngoài sidebar content

```jsx
{importProgress && (
  <div className="mx-3 mt-2 rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary">
    {importProgress}
  </div>
)}
```

**Vấn đề:** Progress indicator nằm ngoài sidebar nav items nhưng bên trong sidebar wrapper. Nếu nhiều items trong Import section, nó có thể đẩy layout. Cần đặt trong một sticky footer hoặc overlay riêng.

---

### [H-02] `SlidePanel.jsx:386-407` — Vertical children slide quá nhỏ để tương tác

```jsx
className={`... origin-top-left scale-[0.85]`}  // 85% scale
```

**Vấn đề:** Vertical slide children được scale 85%. Trên màn hình nhỏ, thumbnail trở nên rất khó đọc và click chính xác. Nên dùng scale 100% và giảm padding thay vì scale.

---

### [H-03] `Toolbar.jsx:388-391` — BG popup dùng `absolute` không có boundary check

```jsx
className="bg-popup-container absolute left-0 top-full mt-1 w-[260px]..."
```

**Vấn đề:** Nếu toolbar ở bottom của viewport, popup sẽ bị tràn ra ngoài màn hình. Nên dùng `overflow: visible` và `data-floating` placement strategy hoặc check viewport boundary.

---

### [H-04] `HomePage.jsx:1300-1367` — List view overflow: action buttons trong cùng div

```jsx
<div className="group flex items-center gap-4 px-4 py-3 rounded cursor-pointer transition-colors hover:bg-hover"
  onClick={() => onOpen(pres.id)}>
  {/* ... content ... */}
  <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
    <Button variant="icon" ... onClick={(e) => { e.stopPropagation(); onOpen(pres.id) }}>
```

**Vấn đề:** `stopPropagation` hoạt động nhưng cấu trúc này fragile. Clicking "Edit" sẽ chạy `onOpen(pres.id)` hai lần (button + parent div). Với React 18 StrictMode, effect chạy 2 lần có thể gây race condition.

---

### [H-05] `PropertiesPanel.jsx:89` — Emoji trong badge UI

```jsx
<span className="text-xs text-text-secondary">
  📌 {selectedElementIds.length} elements selected
</span>
```

**Vấn đề:** Emoji không consistent với design system. Nên dùng icon SVG từ lucide-react thay vì emoji.

---

## PHẦN 3 — Medium Priority (UX/UI Polish)

### [M-01] `Button.jsx:15` — Ghost variant dùng `border-transparent` nhưng className override

```js
ghost: 'border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary',
```

**Vấn đề:** Ghost buttons được dùng rất nhiều trong toàn bộ codebase. `border-transparent` tốt, nhưng trong một số trường hợp (active state), className override `!bg-accent !border-accent !text-white` dùng `!important` flags. Điều này tạo ra specificity wars.

**Gợi ý:** Nên dùng CSS custom property cho active state thay vì `!important`:
```js
ghost: 'border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary data-[active]:bg-accent data-[active]:border-accent data-[active]:text-white',
```

---

### [M-02] `InsertMenu.jsx:403-433` — Table size picker: max 8x8 grid

```js
Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 8 }, ...)
```

**Vấn đề:** Giới hạn 8x8. User muốn tạo bảng 10x4 không thể. Nên tăng lên 12x12 hoặc dùng 2 input fields (rows × cols) với numeric stepper.

---

### [M-03] `HomePage.jsx:630-641` — Search input không có clear button

```jsx
<Input
  className="w-full pl-9"
  type="text"
  placeholder="Search presentations..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

**Vấn đề:** Không có nút clear search. User phải select all + delete để clear. Thêm icon button "X" khi có query.

---

### [M-04] `QuickAccessToolbar.jsx:21-27` — Undo/Redo qua `dispatchEvent` hack

```js
const handleUndo = useCallback(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
}, [])
```

**Vấn đề:** Dispatch keyboard event để trigger undo là hack. Nếu keyboard event bị `stopImmediatePropagation()` ở đâu đó, nó sẽ fail. Nên dùng ref-based approach hoặc gọi trực tiếp editor history.

---

### [M-05] `Toolbar.jsx:424-440` — Color swatch border logic không rõ ràng

```js
bg.color === color
  ? 'border-2 border-white'
  : color === '#ffffff' || color === '#f8f9fa'
    ? 'border border-border'
    : 'border border-transparent'
```

**Vấn đề:** Logic phức tạp, dễ sai khi thêm màu mới. White swatch dùng `border-border` nhưng transparent swatch dùng `border-transparent` — khó phân biệt active vs inactive.

---

### [M-06] `HomePage.jsx` — `formatDate` dùng `toLocaleDateString` không set locale

```js
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
```

**Vấn đề:** Hardcoded `en-US`. User Việt Nam muốn format `25/04/2026`. Nên dùng `Intl.DateTimeFormat` hoặc cho user chọn locale.

---

### [M-07] `SlidePanel.jsx:362-381` — Hover action buttons không có disabled state visual

```jsx
<button className={`bg-black/60 ... ${slides.length > 1 ? 'text-white' : 'text-white/30'}`}
  title="Delete"
  onClick={(e) => {
    e.stopPropagation()
    if (slides.length > 1) onDelete(index)
  }}>
```

**Vấn đề:** Khi chỉ còn 1 slide, nút delete có `text-white/30` nhưng vẫn clickable. `onClick` handler kiểm tra `slides.length > 1` nhưng không có visual disabled state (cursor, opacity).

---

### [M-08] `HomePage.jsx:1383-1391` — Modal z-index 10000 hardcoded

```jsx
className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
```

**Vấn đề:** z-index 10000 hardcoded. Nếu sau này cần modal cao hơn (ví dụ: tour tooltip z-100000), sẽ conflict. Nên dùng CSS variable `--z-modal: 10000`.

---

## PHẦN 4 — Tailwind Design System Issues

### [T-01] `Input.jsx:9` — Placeholder color không được định nghĩa

```jsx
className={cn('... focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed', className)}
```

**Vấn đề:** `placeholder:text-text-muted` không có trong className. Browser placeholder color sẽ dùng mặc định (thường là gray), không match với design system.

**Fix:** Thêm `placeholder:text-text-muted` vào base Input class.

---

### [T-02] `Select.jsx:8` — Giống hệt Input nhưng dùng `bg-surface-3`

```jsx
className={cn('w-full bg-surface-3 border border-border ...', className)}
```

**Vấn đề:** Input dùng `bg-surface-3`, Select cũng dùng `bg-surface-3`. Nhưng PropertiesPanel ghi đè bằng `className="bg-card ..."`. Sự không nhất quán giữa base component và usage instances.

---

### [T-03] `index.css:44-98` — Design tokens có 2 nguồn: CSS variables + Tailwind config

```css
:root {
  --color-primary: #6366f1;
  ...
  --bg-card: #1e1e28;  /* ← camelCase */
  ...
}
```

```js
// tailwind.config.js
colors: {
  primary: { DEFAULT: 'var(--color-primary)', ... },
  text: { primary: 'var(--text-primary)', ... }  // ← camelCase
}
```

**Vấn đề:** Một số CSS variables dùng kebab-case (`--bg-card`), một số dùng camelCase trong config. Tailwind class `bg-card` → `var(--bg-card)` nhưng config định nghĩa `card: 'var(--bg-card)'`. Nhất quán về naming convention.

---

### [T-04] `index.css:189-203` — Custom scrollbar không có light theme variant

```css
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
}
```

**Vấn đề:** Scrollbar thumb color dùng `var(--border-strong)`. Trong light theme, `rgba(0,0,0,0.16)` — có thể quá tối trên nền sáng. Nên thêm `[data-theme='light']` override riêng.

---

## PHẦN 5 — Accessibility Issues

### [A-01] `HomePage.jsx:751-764` — Import file inputs không có label

```jsx
<input type="file" accept=".pdf" className="hidden" onChange={...} />
```

**Vấn đề:** `<input type="file">` không có `<label>` connected. Screen reader không biết input này làm gì. Dù `<label>` bọc ngoài nhưng `htmlFor` không trỏ đúng vào hidden input.

---

### [A-02] `Toolbar.jsx:856-920` — Color palette popup không có role/semantic

```jsx
<div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(8,22px)] gap-[3px]">
```

**Vấn đề:** Popup color palette không có `role="listbox"` hoặc `aria-label`. Screen reader user không biết đây là color picker.

---

### [A-03] `SlidePanel.jsx:475-550` — Context menu không có keyboard navigation

```jsx
<div className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
  <button onClick={...}>Duplicate</button>
  ...
```

**Vấn đề:** Context menu không hỗ trợ keyboard navigation (↑↓ arrows, Enter, Escape). Không có `role="menu"` hoặc `role="menuitem"`.

---

## PHẦN 6 — Performance Issues

### [P-01] `InsertMenu.jsx:27-49` — ICON_NAMES computed at module load

```js
const ICON_NAMES = Object.keys(LucideIcons)
  .filter((name) => /^[A-Z]/.test(name))
  .filter((name) => !name.endsWith('Icon'))
  .filter((name) => ![...].includes(name))
```

**Vấn đề:** Chạy `Object.keys()` + filter qua ~1000+ keys **mỗi lần module được import**. Nên compute một lần hoặc dùng static array.

---

### [P-02] `Toolbar.jsx` — `getBackgroundColorStyle`, `getBackgroundStyle`, `getBackgroundImageStyle` là 3 helper functions rời

```js
function getBackgroundColorStyle(color) { return { backgroundColor: color } }
function getBackgroundStyle(background) { return { background } }
function getBackgroundImageStyle(image) { return { backgroundImage: `url(${image})` } }
```

**Vấn đề:** 3 functions riêng, có thể gộp thành 1: `getBgStyle({ type, value })`.

---

### [P-03] `HomePage.jsx` — `getPresetTextTone` tạo object mới mỗi render

```js
const tone = getPresetTextTone(preset.thumbnail)
// ...
<span className={tone.titleClassName}>
```

**Vấn đề:** `getPresetTextTone` được gọi bên trong `.map()`, tạo 2 object mới mỗi item mỗi render. Nên memoize hoặc tính inline.

---

## PHẦN 7 — Code Quality

### [Q-01] `Toolbar.jsx:175-178` — Unused state variables

```js
const [showShapeMenu, setShowShapeMenu] = useState(false)   // chưa dùng
const [showIconPicker, setShowIconPicker] = useState(false) // chưa dùng
const [iconSearch, setIconSearch] = useState('')            // chưa dùng
```

**Vấn đề:** Có eslint-disable nhưng biến này không được dùng ở bất kỳ đâu trong Toolbar. Dead code.

---

### [Q-02] `HomePage.jsx:207-210` — Dead variable declarations

```js
let pdfInputRef = null  // eslint-disable-next-line unused-imports/no-unused-vars
let mdInputRef = null    // eslint-disable-next-line unused-imports/no-unused-vars
```

**Vấn đề:** `pdfInputRef` và `mdInputRef` được khai báo nhưng không dùng. Chúng được comment là để "Import file refs" nhưng thực tế file inputs đang dùng inline `<input>` với `onChange` trực tiếp.

---

### [Q-03] `Toolbar.jsx:49-50` — Unused import

```js
import * as shared from 'revealjs-shared'
const { SHAPES } = shared  // eslint-disable-next-line unused-imports/no-unused-vars
```

**Vấn đề:** `SHAPES` được dùng trong InsertMenu nhưng import ở Toolbar thì không. Dead import.

---

### [Q-04] `HomePage.jsx` — eslint-disable comment ở dòng sai vị trí

```js
const [importProgress, setImportProgress] = useState(null)  // dòng 446
// eslint-disable-next-line unused-imports/no-unused-vars  // dòng 445 — sai dòng!
```

**Vấn đề:** Comment eslint-disable nằm **sau** dòng cần disable, không phải **trước**. Hiệu lực không rõ ràng. Nên đặt trên cùng dòng hoặc dòng trước.

---

## PHẦN 8 — Positive Notes (Đã làm tốt)

1. **Design tokens tập trung** — `index.css:44-127` định nghĩa đầy đủ color tokens cho cả dark và light theme, dùng CSS variables nhất quán
2. **Tailwind `important: '#root'`** — Tránh conflicts với third-party libraries
3. **`darkMode: ['class', '[data-theme="dark"]']`** — Đúng approach, `data-theme` attribute dễ control hơn class
4. **`corePlugins: { preflight: false }`** — Đúng, tránh Tailwind reset stylesheet conflict với base styles
5. **Button/Input/Select components** — Tái sử dụng tốt, `cn()` utility hợp lý
6. **`buttonVariants` pattern** — Đúng pattern cho shadcn/ui style components
7. **Lucide React icons** — Nhất quán, đẹp, có `size` props
8. **Responsive grid layouts** — `grid-cols-[repeat(auto-fill,minmax(260px,1fr))]` hoạt động tốt
9. **Keyboard shortcuts** — Ctrl+S save, Ctrl+Z/Y undo/redo được implement
10. **CollapsibleSection** — Tốt cho Properties Panel, giảm cognitive load

---

## Tổng hợp theo mức độ ưu tiên

| ID | Priority | File | Issue |
|----|----------|------|-------|
| C-01 | 🔴 Critical | PropertiesPanel.jsx:227 | Hardcoded dark theme in CSS textarea |
| C-02 | 🔴 Critical | SlidePanel.jsx:206 | Slide index invisible on light backgrounds |
| C-03 | 🔴 Critical | InsertMenu.jsx:23 | Import entire lucide-react bundle |
| C-04 | 🔴 Critical | Toolbar.jsx:52 | Hardcoded color palette脱离 theme system |
| H-01 | 🟠 High | HomePage.jsx:797 | Import progress breaks sidebar layout |
| H-02 | 🟠 High | SlidePanel.jsx:386 | Vertical children 85% scale too small |
| H-03 | 🟠 High | Toolbar.jsx:388 | BG popup overflow viewport |
| H-04 | 🟠 High | HomePage.jsx:1300 | List view double onClick risk |
| H-05 | 🟠 High | PropertiesPanel.jsx:89 | Emoji not in design system |
| M-01 | 🟡 Medium | Button.jsx:15 | Ghost variant uses !important for active |
| M-02 | 🟡 Medium | InsertMenu.jsx:403 | Table picker max 8x8 |
| M-03 | 🟡 Medium | HomePage.jsx:630 | No search clear button |
| M-04 | 🟡 Medium | QuickAccessToolbar.jsx:21 | dispatchEvent undo/redo hack |
| M-05 | 🟡 Medium | Toolbar.jsx:424 | Color swatch border logic fragile |
| M-06 | 🟡 Medium | HomePage.jsx | Hardcoded en-US date format |
| M-07 | 🟡 Medium | SlidePanel.jsx:362 | Delete disabled state not visual |
| M-08 | 🟡 Medium | HomePage.jsx:1383 | z-index hardcoded 10000 |
| T-01 | 🔵 Tailwind | Input.jsx:9 | Missing placeholder color |
| T-02 | 🔵 Tailwind | Select.jsx:8 | Inconsistent bg with Input |
| T-03 | 🔵 Tailwind | index.css | Naming: kebab vs camelCase |
| T-04 | 🔵 Tailwind | index.css:189 | Scrollbar light theme variant |
| A-01 | ⚠️ A11y | HomePage.jsx:751 | File input no aria-label |
| A-02 | ⚠️ A11y | Toolbar.jsx:856 | Color palette no role |
| A-03 | ⚠️ A11y | SlidePanel.jsx:475 | Context menu no keyboard nav |
| P-01 | ⚡ Perf | InsertMenu.jsx:27 | ICON_NAMES computed at load |
| P-02 | ⚡ Perf | Toolbar.jsx:119 | 3 separate getBgStyle functions |
| P-03 | ⚡ Perf | HomePage.jsx | getPresetTextTone not memoized |
| Q-01 | 🔧 Quality | Toolbar.jsx:175 | Dead state variables |
| Q-02 | 🔧 Quality | HomePage.jsx:207 | Dead ref declarations |
| Q-03 | 🔧 Quality | Toolbar.jsx:49 | Unused SHAPES import |
| Q-04 | 🔧 Quality | HomePage.jsx:445 | eslint-disable wrong line |

---

## Unresolved Questions

1. **InsertMenu icon picker** — Có nên giữ Lucide icons đầy đủ (cho phép user chọn từ 1000+ icons) hay nên giới hạn subset phổ biến? Performance vs flexibility trade-off.
2. **Table picker max size** — 8x8 hay 12x12? Một số presentation templates cần bảng lớn.
3. **Light theme scrollbar** — Chưa có override cho scrollbar thumb color trong light mode.
4. **Custom CSS textarea** — Có nên dùng CodeMirror/Monaco editor thay vì plain textarea? (Đã có CodeEditorModal có thể reuse)
