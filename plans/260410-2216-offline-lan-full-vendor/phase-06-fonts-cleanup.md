# Phase 06: Fonts Cleanup & Fallback

## Context
- Plan: [plan.md](./plan.md)
- Requires: Phase 04 (htmlGenerator updated), Phase 05 (offlineExport updated)

## Overview
- **Priority:** Medium
- **Status:** Pending

Xử lý fonts còn lại sau khi CDN URLs đã được thay thế:
1. Remove Google Fonts `<link>` khỏi HTML templates (không có local alternative)
2. Remove Computer Modern CDN — không có npm package tương đương dễ dùng
3. Remove Latin Modern Roman `@font-face` CDN declarations
4. Verify `offlineExport.js` Step 5 vẫn hoạt động đúng với paths mới

## Font Categories

### Google Fonts (lines 259, 537 trong htmlGenerator.js)

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:...&display=swap">
```

**Action:** Remove hoàn toàn. App UI vẫn hoạt động vì:
- `htmlGenerator.js` dùng `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` làm fallback
- Google Fonts chỉ load "nice to have" fonts (Inter, Roboto, Open Sans, etc.)
- Khi offline, browser fall back về system fonts tự động

### Computer Modern (dreampulse CDN) (lines 260, 538)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
```

**Action:** Remove. Không có npm package tiêu chuẩn. LaTeX rendering dùng TikZJax fonts riêng (Phase 02).

### Latin Modern Roman @font-face (lines 262–265, 542–544)

```css
@font-face {
  font-family: 'Latin Modern Roman';
  src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') ...
}
```

**Action:** Remove các `@font-face` blocks này.

> Note: `lm-web-fonts` có trên npm. Nếu cần trong tương lai, có thể vendor tương tự các libs khác. Hiện tại YAGNI — TikZJax tự bundle TeX fonts riêng.

## Implementation Steps

### Step 1: Remove từ `generateRevealHTML()` trong htmlGenerator.js

Remove các lines sau (approximate line numbers — verify khi implement):

```diff
- <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&...&display=swap">
- <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
- <style>
-   @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') ... }
-   @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff2') ... }
-   @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff2') ... }
- </style>
```

### Step 2: Remove từ `generatePrintHTML()` trong htmlGenerator.js

Same font links appear in print HTML template (~lines 537–544). Remove same blocks.

### Step 3: Verify offlineExport.js Step 5

Step 5 hiện tại remove Google Fonts và Computer Modern bằng regex:

```javascript
// Step 5 — hiện tại trong offlineExport.js
result = result.replace(
  /<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/g,
  '<!-- Google Fonts removed for offline mode -->'
)
result = result.replace(
  /<link[^>]*href=["']https:\/\/cdn\.jsdelivr\.net\/gh\/dreampulse\/computer-modern[^"']*["'][^>]*\/?>/g,
  '<!-- Computer Modern fonts removed for offline mode -->'
)
```

**Sau Phase 04:** Các links này đã bị remove khỏi `htmlGenerator.js` → Step 5 sẽ không match gì → harmless no-op.

**Action:** Có thể giữ nguyên Step 5 làm safety net, hoặc simplify bỏ đi. Giữ nguyên (KISS — không cần cleanup).

### Step 4: Add Latin Modern remove pattern (safety net)

Thêm vào Step 5 của `offlineExport.js`:

```javascript
// Remove Latin Modern CDN @font-face declarations
result = result.replace(
  /<style>\s*@font-face\s*\{[^}]*lm-web-fonts[^}]*\}[\s\S]*?<\/style>/g,
  '<!-- Latin Modern fonts removed for offline mode -->'
)
```

> Optional — chỉ cần nếu có edge case HTML cũ được export qua offline function.

## Files to Modify
- `shared/src/htmlGenerator.js` — remove 3 font link/style blocks trong cả 2 functions
- `client/src/utils/offlineExport.js` — optionally simplify Step 5 (keep as-is is fine)

## Todo
- [ ] Remove Google Fonts `<link>` từ `generateRevealHTML()` template
- [ ] Remove Computer Modern `<link>` từ `generateRevealHTML()` template
- [ ] Remove Latin Modern `<style>@font-face</style>` block từ `generateRevealHTML()`
- [ ] Remove same 3 blocks từ `generatePrintHTML()` template
- [ ] Verify present mode vẫn render text đúng với system font fallback
- [ ] Verify exported HTML không có external font requests (check Network tab trong DevTools)

## Success Criteria

Mở exported HTML trong browser với Network tab mở:
- Không có requests đến `fonts.googleapis.com`
- Không có requests đến `cdn.jsdelivr.net/gh/dreampulse`
- Không có requests đến `cdn.jsdelivr.net/npm/lm-web-fonts`
- Text vẫn đọc được (system font fallback hoạt động)
- KaTeX math render đúng (dùng KaTeX built-in fonts từ `/vendor/katex/dist/fonts/`)

## Risk

| Risk | Mitigation |
|---|---|
| Một số users dùng 'Latin Modern Roman' font cho LaTeX slide text | TikZJax render TikZ diagrams bằng TeX fonts riêng — không phụ thuộc `lm-web-fonts` |
| Presentation font appearance thay đổi | Expected trade-off — system fonts thay thế web fonts. Document trong changelog |
| `generatePrintHTML` miss một link | Search toàn file cho `fonts.googleapis.com` và `dreampulse` sau khi edit |
