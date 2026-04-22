# Phase 2 — Advanced Editor Features

## Overview

- **Priority**: P1
- **Status**: ⬜ Pending
- **Effort**: 3-4 tuần
- **Dependencies**: Phase 0 (Foundation Refactor)
- **Mục tiêu**: Feature parity với slides.com editor capabilities

## Features to Implement

### 2.1 Rubber-band Selection (Drag to Select)

**Mô tả**: Click + drag trên canvas background tạo selection rectangle, chọn tất cả elements nằm trong vùng đó.

**Implementation**:

- Thêm state `rubberBand: { startX, startY, endX, endY }` vào editor-store
- SlideCanvas: onMouseDown trên background → start rubberBand
- onMouseMove → update rubberBand dimensions
- onMouseUp → tính elements nằm trong vùng → set selectedElementIds
- Render semi-transparent blue rectangle overlay

```javascript
// Logic chọn elements trong vùng
function getElementsInRect(elements, rect) {
  return elements.filter((el) => {
    const elRight = el.x + el.width
    const elBottom = el.y + el.height
    return el.x < rect.right && elRight > rect.left && el.y < rect.bottom && elBottom > rect.top
  })
}
```

**Files**: `SlideCanvas.jsx`, `editor-store.js`

---

### 2.2 Flexible Resolution

**Mô tả**: Cho phép chọn resolution: 16:9 (960×540), 4:3 (960×720), Portrait (540×960), Custom.

**Implementation**:

- Thêm `resolution: { width, height }` vào presentation object
- Settings trong Toolbar hoặc Properties panel khi không có element selected
- Cập nhật SlideCanvas scale logic
- Cập nhật HTML generator → inject resolution vào reveal.js config
- Cập nhật PPTX/PDF export

```javascript
const RESOLUTIONS = {
  '16:9': { width: 960, height: 540 },
  '4:3': { width: 960, height: 720 },
  portrait: { width: 540, height: 960 },
  custom: null, // user input
}
```

**Files**: `presentation-store.js`, `SlideCanvas.jsx`, `generateHTML.js`, `exportPptx.js`, `Toolbar.jsx`

---

### 2.3 Auto-Animate

**Mô tả**: Smooth element transitions giữa 2 slides liên tiếp. Reveal.js đã hỗ trợ native `data-auto-animate`.

**Implementation**:

- Thêm `autoAnimate: boolean` per slide
- Toggle trong slide context menu hoặc slide panel
- HTML generator: thêm `data-auto-animate` attribute cho slide sections
- Thêm `data-id` cho elements để reveal.js match chúng giữa slides
- Element data-id = element.id (UUID) — đảm bảo matching khi copy element sang slide kế

```html
<!-- Generated HTML -->
<section data-auto-animate>
  <div data-id="elem-uuid-1" style="...">Content</div>
</section>
<section data-auto-animate>
  <div data-id="elem-uuid-1" style="...different...">Content</div>
</section>
```

**UI**: Checkbox "Auto-Animate" trong slide properties + visual indicator trên slide thumbnail

**Files**: `SlidePanel.jsx`, `generateHTML.js` (`shared/`), slide data model

---

### 2.4 Freehand Drawing (Canvas-based)

**Mô tả**: Vẽ tự do trên slide bằng chuột/pen, lưu dưới dạng SVG path.

**Implementation**:

- New element type: `drawing`
- Canvas overlay khi ở drawing mode
- Thu thập mouse points → smooth path (Catmull-Rom spline)
- Convert sang SVG `<path d="...">` khi hoàn thành stroke
- Lưu SVG string trong element data
- Properties: stroke color, stroke width, opacity

```javascript
// Element schema
{
  type: 'drawing',
  x: 0, y: 0, width: 960, height: 540,
  paths: [
    { d: 'M10,10 C20,30 40,30 50,10', stroke: '#ff0000', strokeWidth: 3 }
  ]
}
```

**Files**: NEW `components/canvas/DrawingOverlay.jsx`, element renderers, `generateHTML.js`

---

### 2.5 Lines & Arrows 2.0

**Mô tả**: Nâng cấp line element với curved lines, multiple arrowhead styles, connection points.

**Implementation**:

- Upgrade `shape: 'line'` → dedicated `line` element type
- Properties: start point, end point, curvature, arrowhead start/end
- Arrowhead types: none, arrow, diamond, circle, square
- Curved lines: quadratic bezier via control point
- Drag control point to adjust curve
- Snap to element edges (connection points)

```javascript
{
  type: 'line',
  x1: 100, y1: 200,     // start
  x2: 400, y2: 300,     // end
  cx: 250, cy: 150,     // control point (null = straight)
  stroke: '#ffffff',
  strokeWidth: 2,
  arrowStart: 'none',    // none | arrow | diamond | circle
  arrowEnd: 'arrow',
  dashArray: '',         // '' | '5,5' | '10,5'
}
```

**Files**: NEW element type renderer, PropertiesPanel section, `generateHTML.js`, `exportPptx.js`

---

### 2.6 SVG Element

**Mô tả**: Upload + render SVG files natively (không phải image element).

**Implementation**:

- Accept `.svg` upload → store inline SVG content
- Render directly in canvas (not as `<img>`)
- Allows color customization (fill/stroke of SVG internals)
- Crisp rendering at any scale

```javascript
{
  type: 'svg',
  x: 100, y: 100, width: 200, height: 200,
  content: '<svg>...</svg>',
  fill: null,     // override fill color if set
  stroke: null
}
```

**Files**: SVG element renderer, upload handler, PropertiesPanel section

---

### 2.7 Vertical Slides

**Mô tả**: Sub-slides xếp dọc dưới main slide. Reveal.js native support.

**Implementation**:

- Thêm `children: Slide[]` vào slide data model
- SlidePanel: hiển thị children indented dưới parent
- Add "Add vertical slide" option trong slide context menu
- HTML generator: wrap children trong nested `<section>`

```html
<section>
  <!-- horizontal parent -->
  <section>Slide 1</section>
  <!-- vertical child -->
  <section>Slide 2</section>
  <!-- vertical child -->
</section>
```

**UI**: Drag slide để nest/unnest

**Files**: `SlidePanel.jsx`, `presentation-store.js`, `generateHTML.js`

---

### 2.8 Locked Slides

**Mô tả**: Lock toàn bộ slide để ngăn chỉnh sửa vô ý.

**Implementation**:

- Thêm `locked: boolean` per slide
- Khi locked: disable element editing, disable drag/resize, show lock icon
- Toggle trong slide context menu
- Visual: semi-transparent lock overlay

**Files**: `SlidePanel.jsx`, `SlideCanvas.jsx`, slide data model

---

### 2.9 Kiosk/Autoplay Mode

**Mô tả**: Auto-advance slides với configurable timing.

**Implementation**:

- Presentation setting: `autoSlide: number` (ms, 0 = disabled)
- Config trong Settings hoặc present dialog
- Inject `autoSlide` vào reveal.js config
- `autoSlideStoppable: false` cho kiosk mode
- `loop: true` option

**Files**: `generateHTML.js`, present mode config

---

### 2.10 Scroll Mode

**Mô tả**: View presentation như scrollable page (không phải slides).

**Implementation**:

- Reveal.js 5.x hỗ trợ `view: 'scroll'` hoặc `scrollActivationWidth` config
- Thêm option trong present/share dialog: "Scroll Mode"
- Inject config khi generate HTML cho scroll mode
- URL param: `?scroll=true`

**Files**: `generateHTML.js`, Present dialog, Share endpoint

---

### 2.11 Custom CSS Editor

**Mô tả**: Global CSS textarea cho presentation, live preview.

**Implementation**:

- Thêm `customCSS: string` vào presentation data
- Modal với CodeMirror/Monaco textarea + live preview
- Inject custom CSS vào `<style>` tag trong generated HTML
- CSS scoped trong canvas preview via iframe

**Files**: NEW `CustomCSSModal.jsx`, `generateHTML.js`, presentation data model

---

## Todo List

- [ ] Rubber-band selection logic in SlideCanvas
- [ ] Flexible resolution settings + UI
- [ ] Auto-animate toggle per slide + HTML generation
- [ ] Freehand drawing overlay + SVG path generation
- [ ] Lines & Arrows 2.0 element type
- [ ] SVG element type with upload
- [ ] Vertical slides data model + SlidePanel UI
- [ ] Locked slides feature
- [ ] Kiosk/autoplay config in present mode
- [ ] Scroll mode option
- [ ] Custom CSS editor modal

## Success Criteria

- [ ] Rubber-band selection works on canvas background
- [ ] Presentations can be 16:9, 4:3, Portrait, or Custom resolution
- [ ] Auto-animate creates smooth transitions between consecutive slides
- [ ] Freehand drawing produces SVG paths, visible in exported HTML
- [ ] Lines can be curved with multiple arrowhead styles
- [ ] SVG files render crisply at any size
- [ ] Vertical slides nest correctly in present mode
- [ ] Locked slides prevent editing
- [ ] Kiosk mode auto-advances and loops
- [ ] Scroll mode displays all slides as scrollable
- [ ] Custom CSS applies to both preview and exported HTML
