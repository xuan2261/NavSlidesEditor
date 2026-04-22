# Debug Report: Font Size Mismatch — Present/Export vs Editor

**Date:** 2026-04-16  
**Type:** Root Cause Investigation + Fix  
**Files changed:** `shared/src/htmlGenerator.js`, `client/src/components/SlideCanvas.jsx`

---

## Symptom

Khi Present hay export HTML/Live, font chữ lớn hơn nhiều so với trong Editor.

---

## Root Cause

**Phase 1 — Mismatch hoàn toàn giữa base font-size:**

| Component              | Base font-size   | h1                     | h2                     |
| ---------------------- | ---------------- | ---------------------- | ---------------------- |
| Editor (`ProseMirror`) | `16px`           | 36px (2.25em)          | 28px                   |
| Generated reveal.js    | `42px` ← **bug** | Browser default × 42px | Browser default × 42px |

`font-size: 42px` cứng trên `<section>` trong `htmlGenerator.js` là nguyên nhân gốc. TipTap không output explicit `font-size` cho heading → trình duyệt dùng browser default (~24px × 42px = ~29px) trong khi editor dùng 16px base → h1 = 36px.

---

## Fix Applied

### 1. `shared/src/htmlGenerator.js` — base font-size 42px → 16px

```diff
- style="...font-size:42px;">
+ style="...font-size:16px;">
```

- `<section>` (line 315)
- `<section>` child slides (line 349)
- `.slide-page` print HTML (line 703)

### 2. `shared/src/htmlGenerator.js` — text elements: preserve color/fontFamily/fontSize

```diff
- style="${style} padding:8px 12px; color:white;">
+ style="${style}padding:8px 12px;color:white;color:${el.textColor};font-family:${el.fontFamily};font-size:${el.fontSize}px;">
```

Áp dụng tại:

- Main slide elements (lines 77-78)
- Vertical child sections (lines 336-338)
- Print HTML (lines 594-596)

### 3. `client/src/components/SlideCanvas.jsx` — editor preview match generated HTML

```diff
- style={{ ..., color: 'white', padding: '8px 12px', boxSizing: 'border-box' }}
+ style={{ ..., color: 'white', padding: '8px 12px', boxSizing: 'border-box', fontSize: '16px' }}
```

Thêm `fontSize: '16px'` vào div preview text để đồng bộ với reveal.js output.

### 4. Print HTML markdown placeholder font-size 42px → 16px (line 621)

---

## Verification

Build thành công: `✓ built in 12.46s` — 0 lỗi syntax.

---

## Summary

- **Root cause:** `font-size: 42px` cứng trên `<section>` (gốc từ reveal.js mặc định, không được điều chỉnh về 16px để match editor)
- **Fix:** Đổi tất cả `42px` → `16px` trong htmlGenerator + thêm explicit CSS properties cho text elements (color, fontFamily, fontSize)
- **Expected result:** Font size Present/Export/Live khớp 1:1 với Editor
