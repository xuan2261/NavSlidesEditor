# Phase 1: Shapes & Controls Expansion

## Context

- [shapeUtils.js](file:///d:/NCKH_2025/revealjs_gui/shared/src/shapeUtils.js) — 8 shapes hiện tại
- [InsertMenu.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/InsertMenu.jsx) — Insert UI
- [htmlGenerator.js](file:///d:/NCKH_2025/revealjs_gui/shared/src/htmlGenerator.js) — Render pipeline
- [EditorPage.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx) — addShapeElement handler

## Overview

- Priority: P0
- Status: ⬜ Pending
- Thêm 7 shapes mới + QR Code element + Divider element

## Requirements

### Functional

1. 7 shapes mới trong shapeUtils.js: `hexagon`, `pentagon`, `cloud`, `cylinder`, `parallelogram`, `trapezoid`, `bracket`
2. QR Code element type: input URL/text → render QR code trên canvas
3. Divider element: horizontal/vertical line với dash styles (solid, dashed, dotted, gradient)

### Non-Functional

- Shapes phải render chính xác ở mọi kích thước (min 20px, max 960px)
- QR Code render client-side (không cần server API)
- Tất cả elements mới phải work trong: Canvas, Present mode, PDF export, PPTX export

## Architecture

### New Shapes — SVG Path Definitions

```
hexagon:       6-sided polygon, flat-top orientation
pentagon:      5-sided polygon
cloud:         Bezier curves tạo hình đám mây (4 arcs)
cylinder:      Rectangle + ellipse top/bottom (database icon)
parallelogram: Skewed rectangle (dx = width * 0.2)
trapezoid:     Top edge shorter than bottom
bracket:       Left curly bracket shape
```

### QR Code Element

- Library: `qrcode` npm package (lightweight, MIT license)
- Element type: `qrcode`
- Properties: `qrData` (string), `qrColor` (#hex), `qrBgColor` (#hex), `qrErrorLevel` ('L'|'M'|'Q'|'H')
- Render: Canvas → toDataURL → img trong SlideCanvas
- Present mode: Generate inline `<canvas>` trong htmlGenerator

### Divider Element

- Reuse `line` element type với preset styles
- InsertMenu adds shortcut button "Divider" → creates horizontal line spanning 80% width

## Related Code Files

### Modify

- `shared/src/shapeUtils.js` — Add 7 shape SVG generators
- `client/src/components/InsertMenu.jsx` — Add QR Code + Divider buttons
- `client/src/pages/EditorPage.jsx` — Add `addQrCodeElement()`, `addDividerElement()`
- `shared/src/htmlGenerator.js` — Add QR code rendering in present/export
- `client/src/components/PropertiesPanel.jsx` — Add QR code properties (URL, color, error level)
- `client/src/components/SlideCanvas.jsx` — Add QR code canvas rendering

### Create

- (none — all changes are additions to existing files)

### Dependencies

- `npm install qrcode` — QR code generation library

## Implementation Steps

1. **Add shapes to shapeUtils.js**
   - Add entries to `SHAPES` array: hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket
   - Add SVG path/polygon generators in `shapeSvgString()` switch-case
   - Each shape uses `el.width`, `el.height`, `el.fill`, `el.stroke`, `el.strokeWidth`

2. **Add QR Code element**
   - Install `qrcode` package: `npm install qrcode`
   - Add `addQrCodeElement()` in EditorPage.jsx
   - Default: `{ type: 'qrcode', qrData: 'https://example.com', qrColor: '#000000', qrBgColor: '#ffffff', qrErrorLevel: 'M' }`
   - Add rendering in SlideCanvas.jsx — use `QRCode.toCanvas()` or `QRCode.toDataURL()`
   - Add rendering in htmlGenerator.js — inline `<script>` with qrcode.js for present mode
   - Add properties in PropertiesPanel.jsx: URL input, foreground/background color pickers, error level select

3. **Add Divider shortcut**
   - In InsertMenu.jsx, add "Divider" button in Layout section
   - Creates line element: `{ type: 'line', x: 96, y: 270, width: 768, height: 4, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, dashArray: '' }`

4. **Test all new shapes**
   - Verify each shape renders in canvas preview
   - Verify each shape renders in present mode (htmlGenerator)
   - Verify PDF export (generatePrintHTML) handles shapes correctly — already uses shapeSvgString()

## Todo List

- [x] Add 7 new shapes to SHAPES array in shapeUtils.js
- [x] Add SVG generators for each shape in shapeSvgString()
- [x] Install qrcode npm package
- [x] Add addQrCodeElement() handler in EditorPage.jsx
- [x] Add QR code rendering in SlideCanvas.jsx
- [x] Add QR code rendering in htmlGenerator.js (present + print)
- [x] Add QR code properties in PropertiesPanel.jsx
- [x] Add QR Code + Divider buttons in InsertMenu.jsx
- [x] Add addDividerElement() shortcut in EditorPage.jsx
- [x] Build test: npm run build — no errors
- [x] Visual test: all shapes render correctly

## Success Criteria

- ✅ 15 shapes total visible in InsertMenu shape picker
- ✅ QR Code generates from URL/text input
- ✅ Divider inserts centered horizontal line
- ✅ All render in canvas + present + PDF export
- ✅ Build passes without errors
