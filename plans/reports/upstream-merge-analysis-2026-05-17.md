# Phân Tích Toàn Diện: Merge Upstream parallax-presentations

**Ngày**: 2026-05-17
**Upstream**: https://github.com/jbirky/parallax-presentations
**Current**: NavSlidesEditor (https://github.com/xuan2261/NavSlidesEditor)
**Remote upstream đã cấu hình**: `upstream -> https://github.com/jbirky/parallax-presentations.git`

---

## Mục Lục

1. [Tình Hình Hiện Tại](#1-tình-hình-hiện-tại)
2. [Khác Biệt Kiến Trúc Cốt Lõi](#2-khác-biệt-kiến-trúc-cốt-lõi)
3. [Danh Mục Thay Đổi Cần Port](#3-danh-mục-thay-đổi-cần-port)
4. [Chi Tiết Từng Thay Đổi](#4-chi-tiết-từng-thay-đổi)
5. [Bảng Phân Loại Theo Mức Độ Ưu Tiên](#5-bảng-phân-loại-theo-mức-độ-ưu-tiên)
6. [Chi Tiết File-by-File Cần Sửa](#6-chi-tiết-file-by-file-cần-sửa)
7. [Giải Đáp 5 Câu Hỏi Chiến Lược](#7-giải-đáp-5-câu-hỏi-chiến-lược)
8. [Rủi Ro Cụ Thể](#8-rủi-ro-cụ-thể)
9. [Thứ Tự Thực Hiện Đề Xuất](#9-thứ-tự-thực-hiện-đề-xuất)

---

## 1. Tình Hình Hiện Tại

### 1.1 Tổng Quan

Hai repo `NavSlidesEditor` và `jbirky/parallax-presentations` có chung một gốc nhưng đã **phát triển hoàn toàn khác nhau**. Upstream có hơn **130 commit** chưa có trong project hiện tại, thay đổi tới **9,658 file** với **888,000 dòng thêm / 307,000 dòng xóa**. Nếu chạy `git merge` trực tiếp sẽ **không khả thi** vì xung đột quá lớn.

### 1.2 Git Status

```
Commits trong HEAD nhưng không có upstream:  (30 commits - tính năng riêng)
Commits trong upstream nhưng không có HEAD:  (130+ commits - cần port)

Fetch upstream: Đã cấu hình, có thể git fetch upstream
Branch: master (HEAD), upstream/main
```

### 1.3 Tính Năng Riêng Của Từng Project

**NavSlidesEditor có mà upstream không có:**
- Gamification (game elements, HUD, leaderboard, interactive games)
- PPTX import/export nâng cao (video, audio, math, shadow, filters, diagram connectors)
- Annotation canvas (vẽ chú thích)
- Command palette
- Laser pointer
- Product tour (React Joyride)
- AI copywriter/translate/generator modals
- CSS editor modal
- Slide sorter view
- Selection pane
- Sync modal (rclone)
- Media library modal

**Upstream có mà NavSlidesEditor không có:**
- Timeline element (BCE dates, click-to-expand, tick spacing)
- Video từ URL + trimming + playback speed
- File browser cho uploads
- SHA-256 dedup cho uploads
- Line-arrow shape
- Ctrl+K link modal
- LaTeX font size/color controls
- Citation font settings + side citations
- GSAP entry animations (12 presets)
- Custom transitions (differential-rotation)
- PDF export với fragment expansion
- Fullscreen button
- 2D slide navigation (columns)
- Slide group (shared page numbers)
- Time widget (clock/timer)
- Plugin system
- Landing page
- Stripe billing / Clerk auth (SaaS)

---

## 2. Khác Biệt Kiến Trúc Cốt Lõi

| Khía cạnh | NavSlidesEditor | Upstream (jbirky) |
|-----------|-----------------|-------------------|
| **HTML Generation** | `shared/src/htmlGenerator.js` (583 dòng, CommonJS, server-side) + client re-export wrapper 9 dòng | `client/src/utils/generateHTML.js` (1141 dòng, ES module, client-side hoàn toàn) |
| **Shape Utils** | `shared/src/shapeUtils.js` (108 dòng, CommonJS) | `client/src/utils/shapeUtils.js` (77 dòng, ES module) |
| **Element Renderers** | `shared/src/element-renderers.js` (460 dòng, CommonJS) | Inline trong `generateHTML.js` (không tách riêng) |
| **Slide Notes** | `shared/src/slideNotes.js` (38 dòng) | Inline trong generateHTML |
| **Presenter Tools** | `shared/src/presenterTools.js` (322 dòng) | Inline trong generateHTML |
| **CDN vs Local** | Dùng `/vendor/` local path | Dùng CDN (`cdn.jsdelivr.net`) |
| **Font loading** | Không load font từ ngoài | Load 50+ Google Fonts + Latin Modern + Futura PT + Bauhaus 93 + National Park |

**Hệ quả**: Không thể cherry-pick trực tiếp các commit upstream vào `client/src/utils/generateHTML.js` vì file hiện tại chỉ là wrapper 9 dòng. Thay vào đó, cần port CSS/feature changes vào `shared/src/htmlGenerator.js` và `shared/src/element-renderers.js`.

---

## 3. Danh Mục Thay Đổi Cần Port

### 3.1 Upstream Có Gì Mà Chưa Có?

#### Tính năng mới giá trị cao (nên port)

| Tính năng | Mô tả | Độ phức tạp | Commits |
|-----------|--------|-------------|---------|
| **Timeline element** | Phần tử dòng thời gian với ngày BCE, click-to-expand, khoảng cách tick | Cao | `9d3288ea..2e280692` |
| **Video từ URL** | Nhúng video từ link + cắt thời gian đầu/cuối + điều chỉnh tốc độ phát | Thấp-Trung bình | `31d8ffbe`, `a388d35b`, `f7a3a351` |
| **Trình duyệt file** | Xem các file đã upload ngay trong editor | Thấp | `916a63df` |
| **SHA-256 dedup** | Loại bỏ file trùng lặp khi upload bằng mã băm | Thấp | `4e225d27` |
| **Hình mũi tên đường thẳng** | Shape mới: mũi tên chỉ có stroke, không có fill | Thấp | `ce548c53` |
| **Modal chèn link Ctrl+K** | Bôi chọn text rồi Ctrl+K để chèn hyperlink | Thấp | `2913f7a6` |
| **Cỡ chữ/chữ màu LaTeX** | Điều khiển font size và font color cho khối LaTeX/TikZ | Thấp | `315eee97`, `6d971eb0` |
| **Cài đặt font cho citation** | Tùy chỉnh cỡ chữ, font family, màu sắc cho phần trích dẫn | Thấp | `0e7196b6`, `856d206b` |
| **Fragment animations mới** | Thêm hiệu ứng slide/flip/strike cho fragment vào panel thuộc tính | Trung bình | `8050b08a` |
| **GSAP entry animations** | 12 animation preset (fadeIn, fadeUp, zoomIn, slideUp, flipX...) | Trung bình | Nhiều commit |
| **Time widget** | Hiển thị đồng hồ/bộ đếm thời gian trong footer | Thấp | Nhiều commit |
| **Fullscreen button** | Nút fullscreen trong present mode | Thấp | Nhiều commit |

#### Sửa lỗi giá trị cao (nên port)

| Lỗi | Mô tả | Commits |
|-----|--------|---------|
| **Vị trí editor vs present mode khác nhau** | Dùng `em` thay vì `px`导致 kích thước bị lệch giữa chế độ chỉnh sửa và trình chiếu | `53173592`, `40c3687b` |
| **HTML embed không hiện trong present mode** | Dùng data URL thay vì blob URL để nhúng HTML hoạt động đúng | `cde1b2e9`, `347d6ad8` |
| **Khối LaTeX không render trong present mode** | Render trực tiếp bằng KaTeX thay vì dùng iframe srcdoc | `edfc1ba5` |
| **Khoảng cách chữ bị sai** | Font-size section từ 42px xuống 16px, ép line-height:normal | `6c3ef006`, `fc2d1c7c` |
| **Ảnh tràn sang slide khác** | Thêm `overflow:hidden` và `contain:paint` cho section | `87bd4dff` |
| **Auto-animate bị leak** | Phần tử auto-animate hiện ra ở slide không có auto-animate | `5055f3ec` |
| **Chế độ overview bị hỏng** | `contain:paint` làm break reveal.js overview | `d800052a` |
| **Theme CSS không khớp** | Override toàn bộ theme reveal.js cho khớp với editor | `6ffa85ce` |
| **Ảnh crop bị overflow** | Ảnh đã crop nhưng vẫn hiện toàn bộ trong editor | `efcf2632`, `b69202d8` |
| **Iframe trên slide có animation** | Iframe không hiện trên slide có animation | `77f6b74b` |
| **JSXGraph SVG conflicts** | SVG fit script override library-managed SVGs | `5a844115` |
| **Fragment visibility** | Fragment hiện ra trước khi reveal.js kích hoạt | `a8bc9ad6` |

#### Bỏ qua (không liên quan đến self-hosted)

- Stripe billing, Clerk auth, quản lý subscription
- Landing page cloud mode
- R2 storage setup
- Plugin system (thay đổi kiến trúc lớn, khác mô hình)
- Free tier plan enforcement
- Marketplace routes

---

## 4. Chi Tiết Từng Thay Đổi

### 4.1 CSS Theme Override (quan trọng nhất)

**Vấn đề**: Upstream có CSS override rất mạnh để present mode khớp chính xác với editor. Hiện tại CSS đơn giản hơn nhiều.

**CSS upstream thêm/bạn thiếu** (so sánh từng rule):

```css
/* ── Upstream CÓ, bạn THIẾU ── */

/* 1. CSS Variables override */
:root {
  --r-main-font-size: 42px;
  --r-block-margin: 0px;
  --r-heading-margin: 0 0 0.4em 0;
  --r-heading-text-transform: none;
  --r-heading-letter-spacing: normal;
}

/* 2. Section overflow control */
.reveal .slides section {
  overflow: hidden !important;           /* ← bạn không có */
  line-height: 1.4 !important;           /* ← bạn không có */
  text-transform: none;                  /* ← bạn không có */
  letter-spacing: normal;                /* ← bạn không có */
}
.reveal .slides section > * { overflow: hidden; }  /* ← bạn không có */

/* 3. Heading text-shadow removal */
.reveal h1, .reveal h2, .reveal h3, .reveal h4 {
  text-shadow: none !important;          /* ← bạn không có */
  text-transform: none !important;       /* ← bạn không có */
  letter-spacing: normal !important;     /* ← bạn không có */
}

/* 4. Code/blockquote reset */
.reveal code {
  background: rgba(255,255,255,0.1);
  padding: 2px 5px;
  border-radius: 3px;
}
.reveal pre {
  background: rgba(0,0,0,0.4);
  padding: 12px 16px;
  border-radius: 6px;
  margin: 0 0 0.4em !important;
  width: auto !important;
  box-shadow: none !important;
}
.reveal blockquote {
  border-left: 3px solid rgba(255,255,255,0.3);
  padding-left: 16px;
  opacity: 0.8;
  width: auto !important;
  box-shadow: none !important;
}

/* 5. Fragment visibility forcing */
.reveal .slides section .fragment:not(.visible):not(.current-fragment) {
  opacity: 0 !important;
  visibility: hidden !important;
}

/* 6. Custom fragment animations */
.fragment.slide-up {
  transform: translateY(40px);
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.fragment.slide-down { transform: translateY(-40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-left { transform: translateX(40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-right { transform: translateX(-40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-up, .fragment.slide-down, .fragment.slide-left, .fragment.slide-right { opacity: 0; }
.fragment.slide-up.visible, .fragment.slide-down.visible, .fragment.slide-left.visible, .fragment.slide-right.visible {
  transform: none; opacity: 1;
}
.fragment.flip-up { transform: perspective(600px) rotateX(90deg); opacity: 0; transition: transform 0.6s ease, opacity 0.3s ease; }
.fragment.flip-down { transform: perspective(600px) rotateX(-90deg); opacity: 0; transition: transform 0.6s ease, opacity 0.3s ease; }
.fragment.flip-up.visible, .fragment.flip-down.visible { transform: none; opacity: 1; }

/* 7. Image interaction styles */
[data-expand] { transition: box-shadow 0.2s, outline 0.2s; outline: 2px solid transparent; outline-offset: 2px; }
[data-expand]:hover { outline-color: rgba(99,102,241,0.6); box-shadow: 0 0 16px rgba(99,102,241,0.25); }
.expand-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.92); z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transition: opacity 0.2s;
}
.expand-overlay.active { opacity: 1; }
.expand-overlay img { max-width: 90vw; max-height: 90vh; object-fit: contain; cursor: default; border-radius: 4px; }
.image-popup {
  position: fixed; z-index: 10001; background: rgba(20,20,30,0.95);
  color: #fff; padding: 12px 18px; border-radius: 8px;
  font-family: -apple-system,sans-serif; font-size: 15px; line-height: 1.5;
  max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.1); opacity: 0;
  transition: opacity 0.2s; white-space: pre-wrap; pointer-events: auto;
}
.image-popup.active { opacity: 1; }
[data-popup] { transition: box-shadow 0.2s, outline 0.2s; outline: 2px solid transparent; outline-offset: 2px; }
[data-popup]:hover { outline-color: rgba(251,191,36,0.5); box-shadow: 0 0 12px rgba(251,191,36,0.2); }

/* 8. Citation styles */
.image-caption {
  position: absolute; left: 0; right: 0; top: 100%;
  font-size: ${citationFontSize}px;
  color: rgba(255,255,255,0.5);
  font-family: ${citationFontFamily};
  line-height: 1.3; padding: 3px 2px 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.image-caption a { color: rgba(255,255,255,0.5); text-decoration: underline; }
.cite-sup {
  position: absolute; top: 4px; right: 4px;
  background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.85);
  font-size: 10px; font-weight: 700; min-width: 16px; height: 16px;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  padding: 0 4px; pointer-events: none; line-height: 1;
}
.slide-citations {
  position: absolute; right: 2px; top: 0; bottom: 0; z-index: 890;
  display: flex; align-items: center; pointer-events: none;
}
.slide-citations-text {
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-size: 9px; color: rgba(255,255,255,0.45);
  font-family: -apple-system,sans-serif; line-height: 1.3; white-space: nowrap;
}
.slide-citations-text a { color: rgba(255,255,255,0.45); text-decoration: underline; }

/* 9. Fullscreen button */
#fs-btn {
  position: fixed; bottom: 16px; right: 16px; z-index: 9999;
  background: rgba(0,0,0,0.5); color: white;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px; padding: 6px 10px;
  cursor: pointer; font-size: 13px;
  backdrop-filter: blur(4px); transition: background 0.15s;
}
#fs-btn:hover { background: rgba(0,0,0,0.75); }
:fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
```

**File cần sửa**: `shared/src/htmlGenerator.js` — phần `<style>` trong `generateRevealHTML()`

### 4.2 Element Renderers Mới

**File cần sửa**: `shared/src/element-renderers.js`

| Element | upstream có | bạn có | Cần thêm |
|---------|------------|--------|----------|
| `timeline` | Có (render full) | Không | **Cần thêm component mới** |
| `textpath` | Có (SVG text path) | Không | Cần thêm renderer |
| `manim` | Có (video loop) | Không | Cần thêm renderer |
| `plugin:*` | Có (plugin system) | Không | Bỏ qua (quá lớn) |

### 4.3 Video Enhancements

**Upstream thêm**:
- Video từ URL (không chỉ upload)
- `.ogv` format support
- Playback speed control (`el.playbackRate`)
- Start/end time trimming (`el.startTime`, `el.endTime`)

**File cần sửa**:
- `shared/src/element-renderers.js` — phần render video
- `client/src/components/Toolbar.jsx` — thêm tùy chọn video URL
- `client/src/components/PropertiesPanel.jsx` — thêm controls cho speed/trim

### 4.4 LaTeX Enhancements

**Upstream thêm**:
- Font size control cho LaTeX (`el.latexFontSize`)
- Font color picker cho LaTeX (`el.latexColor`)
- Render trực tiếp bằng KaTeX trong present mode (thay vì iframe srcdoc)

**Hiện tại dùng**: `shared/src/element-renderers.js` render LaTeX qua iframe srcdoc
**Upstream dùng**: `data-latex-block` attribute + KaTeX render trực tiếp

### 4.5 Citation System

**Upstream thêm**:
- Citation font size (`presentation.citationFontSize`)
- Citation font family (`presentation.citationFontFamily`)
- Citation font color picker cho image elements
- Side citations (hiển thị dọc bên phải slide)
- Citation text/link per image element

### 4.6 Shape: Line-Arrow

**Upstream thêm**: shape `line-arrow` — mũi tên stroke-only, không fill

**Port location**: `shared/src/shapeUtils.js` — thêm case `line-arrow` vào switch + thêm vào mảng `SHAPES`

```javascript
// Thêm vào SHAPES array:
{ id: 'line-arrow', name: 'Line Arrow', icon: '⟶' },

// Thêm vào switch trong shapeSvgString():
case 'line-arrow': {
  const lw = el.strokeWidth || 3
  const lineColor = el.stroke && el.stroke !== 'none' ? el.stroke : (el.fill || '#ffffff')
  const lsda = el.strokeDasharray === 'dashed' ? `${lw*3} ${lw*2}` : el.strokeDasharray === 'dotted' ? `${lw} ${lw*1.5}` : ''
  const lsdaAttr = lsda ? ` stroke-dasharray="${lsda}"` : ''
  const hs = Math.max(lw * 3, h * 0.3)
  inner = `<line x1="${lw}" y1="${h/2}" x2="${w-lw}" y2="${h/2}" stroke="${lineColor}" stroke-width="${lw}"${lsdaAttr} fill="none" />`
    + `<polyline points="${w-lw-hs},${h/2-hs} ${w-lw},${h/2} ${w-lw-hs},${h/2+hs}" stroke="${lineColor}" stroke-width="${lw}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
  break
}
```

### 4.7 GSAP Entry Animations

**Upstream thêm**: Hệ thống animation entry cho từng element qua GSAP

- Attributes: `data-gsap-enter`, `data-gsap-delay`, `data-gsap-duration`
- 12 presets: fadeIn, fadeUp, fadeDown, fadeLeft, fadeRight, zoomIn, zoomOut, slideUp, slideDown, slideLeft, slideRight, flipX, flipY
- Script trong HTML output: `GSAP_PRESETS` object + `runSlideAnimations()` function

### 4.8 Custom Transitions

**Upstream thêm**: `differential-rotation` transition (hiệu ứng Bauhaus bands)

### 4.9 PDF Export Improvements

**Upstream có**: PDF export với fragment expansion (mỗi fragment state thành 1 trang riêng)
**Bạn có**: PDF export cơ bản

### 4.10 Time Widget

**Upstream thêm**: Hiển thị đồng hồ/bộ đếm thời gian trong footer
- Modes: `none`, `clock12`, `clock24`, `timer-up`, `timer-down`
- Configurable: `footerTimeMode`, `timerDuration`

### 4.11 2D Slide Navigation (Columns)

**Upstream thêm**: Group slides theo column cho navigation 2D
- `getSlideColumns()` function
- Slides có `column` property

### 4.12 Slide Group (Shared Page Numbers)

**Upstream thêm**: Slides cùng group chia sẻ số trang
- `slide.slideGroup` property
- `pageGroupSeen` Set để track

---

## 5. Bảng Phân Loại Theo Mức Độ Ưu Tiên

### Ưu tiên 1: Sửa lỗi CSS (ảnh hưởng trực tiếp UX)

| # | Thay đổi | File sửa | Độ phức tạp | Dòng thay đổi ước tính |
|---|----------|----------|-------------|----------------------|
| 1 | CSS variables override | `shared/src/htmlGenerator.js` | Thấp | ~5 dòng |
| 2 | Section overflow + line-height | `shared/src/htmlGenerator.js` | Thấp | ~4 dòng |
| 3 | Heading text-shadow reset | `shared/src/htmlGenerator.js` | Thấp | ~3 dòng |
| 4 | Code/blockquote reset | `shared/src/htmlGenerator.js` | Thấp | ~6 dòng |
| 5 | Fragment visibility forcing | `shared/src/htmlGenerator.js` | Thấp | ~2 dòng |
| 6 | img reset (max-width, box-shadow) | `shared/src/htmlGenerator.js` | Thấp | ~1 dòng |

### Ưu tiên 2: Sửa lỗi render present mode

| # | Thay đổi | File sửa | Độ phức tạp |
|---|----------|----------|-------------|
| 7 | Font-size section 42px | `shared/src/htmlGenerator.js` | Thấp |
| 8 | LaTeX render trực tiếp KaTeX (thay vì iframe) | `shared/src/element-renderers.js` | Trung bình |
| 9 | HTML embed data URLs (thay vì blob/srcdoc) | `shared/src/element-renderers.js` | Trung bình |
| 10 | Margin px vs em | `shared/src/htmlGenerator.js` | Thấp |

### Ưu tiên 3: Thêm tính năng mới (từng cái một)

| # | Tính năng | Files cần sửa | Độ phức tạp |
|---|-----------|---------------|-------------|
| 11 | Line-arrow shape | `shared/src/shapeUtils.js` | Thấp |
| 12 | Custom fragment animations (slide/flip) | `shared/src/htmlGenerator.js` | Thấp |
| 13 | GSAP entry animations | `shared/src/htmlGenerator.js` + `shared/src/element-renderers.js` | Trung bình |
| 14 | Image interaction (popup + expand) | `shared/src/htmlGenerator.js` + `shared/src/element-renderers.js` | Trung bình |
| 15 | Citation system (side citations, font settings) | `shared/src/htmlGenerator.js` + `shared/src/element-renderers.js` + `PropertiesPanel.jsx` | Trung bình |
| 16 | Video enhancements (URL, trim, speed) | `shared/src/element-renderers.js` + `Toolbar.jsx` + `PropertiesPanel.jsx` | Trung bình |
| 17 | LaTeX font size/color | `shared/src/element-renderers.js` + `PropertiesPanel.jsx` + `SlideCanvas.jsx` | Trung bình |
| 18 | Time widget (clock/timer) | `shared/src/htmlGenerator.js` | Thấp |
| 19 | Fullscreen button | `shared/src/htmlGenerator.js` | Thấp |
| 20 | PDF export fragment expansion | `client/src/utils/generateHTML.js` | Cao |
| 21 | Ctrl+K link modal | `Toolbar.jsx` + TipTap extension | Trung bình |
| 22 | SHA-256 dedup uploads | `server/routes/upload.js` | Thấp |
| 23 | File browser | Component mới | Trung bình |
| 24 | Timeline element | Component mới + renderer + properties | **Rất cao** |

---

## 6. Chi Tiết File-by-File Cần Sửa

```
shared/src/htmlGenerator.js          ← CSS overrides, fragments, GSAP, time widget, fullscreen
shared/src/element-renderers.js      ← Video, LaTeX, HTML embed, citation, timeline renderer
shared/src/shapeUtils.js             ← line-arrow shape
shared/src/presenterTools.js         ← (có thể cần update nếu upstream thay đổi)

client/src/components/Toolbar.jsx    ← Video URL option, Ctrl+K, timeline insert
client/src/components/PropertiesPanel.jsx ← Video speed/trim, LaTeX font, citation font, timeline props
client/src/components/SlideCanvas.jsx ← Timeline rendering, citation display, video enhancements
client/src/utils/generateHTML.js     ← (giữ nguyên nếu dùng shared; hoặc rewrite nếu muốn client-side)
```

---

## 7. Giải Đáp 5 Câu Hỏi Chiến Lược

### 7.1 CDN hay Local cho Export HTML?

**Phân tích**:

| Phương án | Ưu điểm | Nhược điểm |
|-----------|---------|-----------|
| **CDN** | File HTML nhẹ, luôn phiên bản mới, font đẹp | Cần internet, phụ thuộc bên thứ ba |
| **Local** | Offline, chủ quyền | File lớn, phải tự update |
| **Hybrid** | Tốt nhất cả hai | Phức tạp hơn chút |

**Khuyến nghị: Hybrid**
- Editor/present mode: Dùng `/vendor/` local (server đang chạy)
- Export HTML standalone: Dùng CDN (file export cần mở được ở bất kỳ đâu)
- Export HTML offline: Embed toàn bộ JS/CSS vào file HTML

### 7.2 Có thêm dependency GSAP không?

**Phân tích**:

| Khía cạnh | Có GSAP | Không GSAP |
|-----------|---------|-----------|
| Kích thước | +60KB gzipped | 0 |
| Animation quality | Mượt, professional | Cơ bản (CSS transitions) |
| Upstream compatibility | Port trực tiếp | Phải rewrite |

**Khuyến nghị: Thêm GSAP nhưng chỉ trong export HTML, không thêm vào bundle chính**
- Load từ CDN trong export HTML
- Không tăng bundle size cho editor/app
- Port được trực tiếp 12 preset animations từ upstream
- Nếu dùng offline export → embed GSAP vào file HTML (tăng ~60KB)

### 7.3 Có load Google Fonts trong export HTML không?

**Phân tích**:

| Phương án | Độ chính xác | Kích thước | Tốc độ |
|-----------|-------------|-----------|--------|
| Load tất cả | 100% | +5KB | Chậm hơn |
| Load thông minh | Đúng font đã dùng | +1-2KB | Nhanh |
| Không load | Sai nếu dùng font lạ | 0 | Nhanh nhất |

**Khuyến nghị: Load thông minh — chỉ load font mà presentation thực sự dùng**
- Scan tất cả elements tìm `fontFamily` được dùng
- Map fontFamily → Google Fonts URL
- Chỉ thêm `<link>` cho font thực sự cần
- Fallback: nếu font không tìm thấy → dùng system font stack

### 7.4 Có đầu tư làm Timeline element không?

**Phân tích**:

| Task | File | Dòng code | Thời gian |
|------|------|-----------|-----------|
| Timeline renderer trong editor | `SlideCanvas.jsx` | ~200 dòng mới | 4-6 giờ |
| Timeline properties panel | `PropertiesPanel.jsx` | ~150 dòng mới | 3-4 giờ |
| Timeline HTML export | `shared/src/element-renderers.js` | ~100 dòng mới | 2-3 giờ |
| Timeline CSS cho present mode | `shared/src/htmlGenerator.js` | ~50 dòng | 1 giờ |
| Timeline data model | `element-defaults.js` | ~30 dòng | 30 phút |
| Timeline toolbar insert | `Toolbar.jsx` | ~20 dòng | 30 phút |
| Bug fixes (upstream có 6 commit fix timeline) | Nhiều file | ~100 dòng | 2-3 giờ |
| **Tổng** | | **~650 dòng** | **15-20 giờ** |

**Rủi ro**: Upstream có 6 commit fix bug riêng cho timeline → code phức tạp, dễ có edge cases

**Khuyến nghị: Có, nhưng không phải ngay. Làm sau khi đã port xong các tính năng nhỏ hơn**
- Các tính năng nhỏ hơn mang lại giá trị nhanh hơn
- Timeline là isolated feature — không block tính năng khác
- Sau khi port xong các fix CSS, hiểu rõ hơn codebase

### 7.5 Giữ shared CommonJS hay migrate sang ES module client-side?

**Phân tích**:

| Tiêu chí | Giữ CommonJS shared | Migrate ES module |
|----------|-------------------|-------------------|
| Server-side rendering | ✅ Server dùng được | ❌ Không dùng được |
| Code reuse | ✅ Client + server cùng dùng | ❌ Phải duplicate |
| DRY | ✅ 1 source of truth | ❌ 2 bản riêng |
| Port upstream dễ | ⚠️ Phân tích code | ✅ Copy-paste |
| Server export | ✅ Share link, GitHub push | ❌ Phải tạo bản riêng |

**Server dependency**: Server dùng `shared/src/htmlGenerator.js` cho:
1. Share link — serve HTML khi người khác mở link chia sẻ
2. GitHub push — push HTML lên GitHub Pages
3. Cloud sync — export HTML để sync

**Khuyến nghị: GIỮ CommonJS shared module. Port upstream features vào shared.**

Lý do:
1. Server cần generate HTML server-side
2. DRY — sửa 1 chỗ, cả client lẫn server đều dùng
3. Logic thuần (CSS strings, SVG generation) — port vào CommonJS chỉ cần thay `export` → `module.exports`
4. Kiến trúc hiện tại hoạt động tốt

**Cách port**: Chỉ port `generateRevealHTML()` logic vào shared. Giữ `downloadHTML()`, `exportPDF()`, `presentInWindow()` trong client wrapper.

---

## 8. Rủi Ro Cụ Thể

| Rủi ro | Chi tiết | Mức độ | Mitigation |
|--------|----------|--------|-----------|
| **CDN vs Local** | Upstream dùng CDN cho reveal.js, KaTeX, highlight.js, GSAP, Google Fonts. Bạn dùng `/vendor/` local. | Trung bình | Dùng hybrid: local cho editor, CDN cho export |
| **Font loading** | Upstream load 50+ Google Fonts. Bạn không có. | Thấp | Load thông minh (chỉ font đã dùng) |
| **HTML generation architecture** | Bạn dùng CommonJS shared. Upstream dùng ES module client-side. | Trung bình | Giữ CommonJS, port logic vào shared |
| **GSAP dependency** | Upstream dùng GSAP cho animations. Bạn chưa có. | Trung bình | Chỉ dùng trong export HTML (CDN) |
| **Timeline element** | Rất phức tạp — component mới, renderer, properties. Hơn 200 dòng code mới. 6 commit fix bug. | Cao | Làm cuối, sau khi port tính năng nhỏ |
| **CSS conflicts** | CSS mới có thể xung đột với hệ thống theme hiện tại | Trung bình | Test present mode sau mỗi thay đổi |
| **File `shared/src/htmlGenerator.js`** | Đã khác nhau nhiều giữa hai project | Trung bình | So sánh diff kỹ trước khi áp dụng |

---

## 9. Thứ Tự Thực Hiện Đề Xuất

### Tuần 1: CSS Overrides + Shape + Fragment Animations
```
Thay đổi trong: shared/src/htmlGenerator.js, shared/src/shapeUtils.js

#1  CSS variables override (~5 dòng)
#2  Section overflow + line-height (~4 dòng)
#3  Heading text-shadow reset (~3 dòng)
#4  Code/blockquote reset (~6 dòng)
#5  Fragment visibility forcing (~2 dòng)
#6  img reset (~1 dòng)
#11 Line-arrow shape (~15 dòng)
#12 Custom fragment animations (~30 dòng)
#19 Fullscreen button (~5 dòng)
```

### Tuần 2: Video + LaTeX + Citation
```
Thay đổi trong: shared/src/element-renderers.js, PropertiesPanel.jsx, Toolbar.jsx

#8  LaTeX render trực tiếp KaTeX
#9  HTML embed data URLs
#15 Citation system (side citations, font settings)
#16 Video enhancements (URL, trim, speed)
#17 LaTeX font size/color
```

### Tuần 3: GSAP + Image Interactions + Time Widget
```
Thay đổi trong: shared/src/htmlGenerator.js, shared/src/element-renderers.js

#13 GSAP entry animations
#14 Image interactions (popup + expand)
#18 Time widget (clock/timer)
#20 PDF export fragment expansion
```

### Tuần 4: Timeline (nếu còn thời gian)
```
Thay đổi trong: SlideCanvas.jsx, PropertiesPanel.jsx, shared/src/element-renderers.js

#24 Timeline element (component mới)
```

### Command Reference

```bash
# Xem file mà commit upstream thay đổi
git show <sha> --stat

# Xem diff chi tiết cho 1 commit
git show <sha>

# Xem diff cho 1 file cụ thể
git diff HEAD..upstream/main -- <filepath>

# Thử cherry-pick (có thể conflict)
git cherry-pick --no-commit <sha>

# Kiểm tra sau mỗi thay đổi
npm run build && npm run test
```

---

## Appendix: Danh Sách Commit Upstream Chưa Port

```
ce548c53 add line-arrow shape: stroke-only arrow with no fill
efcf2632 fix cropped images showing full image in editor by adding position:relative to clip div
31d8ffbe add video from URL option and gitignore large media files
5a844115 fix JSXGraph lines not rendering: SVG fit script was overriding library-managed SVGs
77f6b74b fix iframes not rendering on animated slides by wrapping in container divs
f5e6dcaa fix present mode text density and callout alignment by matching editor font-size
fc2d1c7c fix dense text spacing: force line-height:normal on section with !important
69c8195b fix phantom image from timeline: position:relative was overriding position:absolute
4e225d27 add SHA-256 deduplication for file uploads
916a63df add file browser to browse uploaded files in the editor
1d6e1117 fix title slide spacing: remove !important from p line-height override
6ffa85ce comprehensive reveal.js theme override to match editor exactly
975bca4a fix font spacing density and callout position in present mode
a8bc9ad6 force fragments hidden with !important until reveal.js triggers them
d800052a fix overview mode: remove contain:paint that broke reveal.js overview
af600bd8 match export CSS exactly to editor CSS for text spacing consistency
40c3687b fix edit vs present mode dimension/position mismatches
87bd4dff fix cross-slide image bleed: add overflow hidden and contain paint to sections
72368382 add interactive hint text below demo slide on landing page
5055f3ec fix auto-animate elements leaking to non-auto-animate slides
6c3ef006 fix text spacing mismatch: change section font-size from 42px to 16px
2e280692 timeline top items: reorder to label/description/date, remove text-image gap
56067fde timeline: put text above image for top-side items so image connects to line
cde1b2e9 fix HTML embeds in present mode: use data URLs instead of blob URLs
b69202d8 fix cropped image showing overflow when citation text is present
3471ab66 add per-event connector length offset for timeline items
2ba20cd3 fix React not defined: extract timeline into proper component
fe5deaae timeline: click-to-expand events, detailed description, 45° tick labels
778a7646 support negative years in timeline (BCE dates)
93816b88 add Copy URL to right-click context menu for image and video elements
347d6ad8 fix HTML embeds not showing in present mode: use blob URLs instead of srcdoc
53173592 fix editor vs present mode position mismatch: use px instead of em for margins
edfc1ba5 fix LaTeX blocks in present mode: render directly with KaTeX instead of srcdoc iframe
315eee97 add font size control for LaTeX/TikZ elements
0e7196b6 add global citation font size and font family settings
2913f7a6 add Ctrl+K link modal for embedding links in text
515b607c fix citation text clipped in editor by overflow hidden
6d971eb0 add font color picker for LaTeX elements
a6f42a8b timeline start/end date selects match tick spacing intervals
856d206b add citation font color picker for image elements
78b62e53 add configurable timeline tick spacing with year-only labels for long ranges
5177e11b fix missing Clock import in Toolbar
9d3288ea add timeline element with date range, events, images, and export
a388d35b add video start/end time trimming controls
f7a3a351 add .ogv video support and playback speed control
8050b08a add slide/flip/strike fragment animations to properties panel and export
```
