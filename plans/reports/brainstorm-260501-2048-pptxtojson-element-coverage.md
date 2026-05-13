---
name: pptxtojson element coverage analysis
description: Compare pptxtojson output vs NavSlides import mapper coverage
type: brainstorm
---

# Nghiên cứu: pptxtojson → NavSlides Element Coverage Gap Analysis

## 1. Tổng quan

**Nguồn dữ liệu:**
- pptxtojson: https://github.com/pipipi-pikachu/pptxtojson (TypeScript defs + README)
- NavSlides: `server/services/pptx-import/mapper.js` + `shared/src/types/presentation.js`

**Phạm vi phân tích:** Tất cả 10 element types mà pptxtojson parse được, so sánh 1-1 với mapper hiện tại và NavSlides internal schema.

---

## 2. Bảng so sánh tổng quan

| Element Type | pptxtojson | NavSlides schema | Mapper xử lý | Trạng thái |
|---|---|---|---|---|
| `text` | ✅ | ✅ (`text`) | ✅ mapElement | **Hoàn chỉnh** |
| `image` | ✅ | ✅ (`image`) | ✅ mapImage | **Hoàn chỉnh** |
| `shape` | ✅ (15+ types) | ✅ (`shape`) | ✅ mapShape | **Hoàn chỉnh** |
| `table` | ✅ | ✅ (`table`) | ✅ mapTable | **Hoàn chỉnh** |
| `chart` | ✅ (14 types) | ✅ (`chart`) | ⚠️ mapChart | **Gần hoàn chỉnh** |
| `video` | ✅ | ✅ (`video`) | ❌ bị skip | **THIẾU** |
| `audio` | ✅ | ✅ (`audio`) | ❌ bị skip | **THIẾU** |
| `math` | ✅ (LaTeX→img) | ✅ (`latex`) | ⚠️ img fallback | **Mất LaTeX text** |
| `diagram` | ✅ (SmartArt) | ❌ native | ⚠️ flatten | **Chỉ nodes, mất cấu trúc** |
| `group` | ✅ (nested) | ✅ (`groupId`) | ✅ flatten | **Hoàn chỉnh** |

---

## 3. Chi tiết từng element type

### 3.1. `text` — ✅ HOÀN CHỈNH

**pptxtojson output properties:**
```
left, top, width, height, borderColor, borderWidth, borderType,
borderStrokeDasharray, shadow, fill, isFlipV, isFlipH, rotate,
content (HTML), vAlign, isVertical, name, order, autoFit, link
```

**Mapper đã xử lý:**
- `left/top/width/height` → `x/y/width/height` via `mapBox()`
- `borderColor, borderWidth` → `stroke/strokeWidth` (shape rendering)
- `content (HTML)` → `content` (sanitized, via `sanitizeHtml`)
- `textAlign/align/paragraphAlign` → `textAlign` (via `normalizeAlign`)
- `fontSize/fontSz` → `fontSize`
- `fontFamily/fontFace/font/fontName` → `fontFamily`
- `textColor/fontColor/color` → `textColor`
- `rotate` → `rotation`
- `opacity` → `opacity`
- `order` → `zIndex` (effective order sorting)

**Các property MẤT (không được import):**
- `isVertical` — text direction (vertical text → ignored)
- `link` — hyperlinks trong text → không import được
- `autoFit` — autofit behavior (shape vs text) → không chuyển
- `shadow` — text shadow → bị mất
- `fill` — text background fill → bị mất
- `border*` — text box border → bị mất (chỉ shape border được xử lý)

### 3.2. `image` — ✅ HOÀN CHỈNH

**pptxtojson output properties:**
```
left, top, width, height, borderColor, borderWidth, borderType,
borderStrokeDasharray, geom, rect (crop), ref, base64, blob,
rotate, isFlipH, isFlipV, order, filters (brightness/contrast/
saturation/sharpen/colorTemperature), alt, title, descr, link
```

**Mapper đã xử lý:**
- `base64` → saved to disk → `src` (file path)
- `left/top/width/height` → `x/y/width/height`
- `fill mode` → `objectFit` ('cover'/'contain'/'fill'/'stretch')
- `rect` → canonical crop model (`imageW/imageH/imageOffsetX/imageOffsetY`)
- `isFlipH` → `flipH`
- `isFlipV` → `flipV`
- `borderColor/borderWidth` → `borderColor/borderWidth`
- `alt/title/descr` → `alt`
- `rotate` → `rotation`
- `opacity` → `opacity`
- `_pptxImportMeta.cropData` preserved

**Các property MẤT:**
- `filters` (brightness/contrast/saturation/sharpen/colorTemperature) → **KHÔNG xử lý**. NavSlides chỉ có `filterBrightness`, `filterContrast`, `filterGrayscale`. Các filter khác như `sharpen`, `colorTemperature`, `saturation` bị mất.
- `link` — image hyperlink → bị mất
- `geom` — clipping geometry → được đọc nhưng `geom === 'picture'` chỉ set `objectFit: 'cover'`, không tạo actual clipping path

### 3.3. `shape` — ✅ HOÀN CHỈNH

**pptxtojson output:** 15+ shape types (rect, ellipse, triangle, diamond, arrow, star, line, hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket, plus freeform paths)

**Mapper đã xử lý:**
- `shapType` → 15 NavSlides shape IDs via `shapeName()`:
  - ellipse/oval/circle → `circle`
  - triangle/isoscelesTriangle/rightTriangle → `triangle`
  - diamond/rhombus → `diamond`
  - *arrow* → `arrow-right`
  - *line* (pure) → `line` (chuyển thành `line` element với arrow markers)
  - *round/rounded* → `rounded-rect`
  - starN → `star`
  - hexagon/pentagon/cloud/cylinder/parallelogram/trapezoid/bracket → giữ nguyên
  - default → `rect`
- `fill` (solid/gradient) → `fill` / `fillGradient`
- `borderColor/borderWidth` → `stroke/strokeWidth`
- `content` → `text` + `textHtml` + text metadata (fontSize, fontFamily, textColor, textAlign)
- `path` → chuyển thành `svg` element với inline SVG path
- `rotate` → `rotation`
- `opacity` → `opacity`
- text insets → `_pptxImportMeta.textInsets`
- gradient fill → `fillGradient` (angle + stops)

**Các property MẤT:**
- `keypoints` — freeform drawing keypoints → NavSlides có `drawing` type nhưng không có path từ PPTX được map sang `drawing`
- `shadow` → bị mất (NavSlides có `shadow` property ở base level nhưng không extract từ pptxtojson shadow object)
- `name` → không lưu vào element
- `autoFit` → không xử lý

### 3.4. `table` — ✅ HOÀN CHỈNH

**pptxtojson output:**
```
left, top, width, height, data (TableCell[][]), borders,
order, rowHeights, colWidths
TableCell: text, rowSpan, colSpan, vMerge, hMerge,
fillColor, fontColor, fontBold, vAlign, borders
```

**Mapper đã xử lý:**
- `data` → `data[][]` (plain text via `plainText()`)
- `rowSpan/colSpan` → `mergedCells`
- `vMerge/hMerge === 0` → skip continuation cells
- `fillColor` → `cellStyles.bgColors` + `cellBgColor`
- `fontColor` → `cellStyles.textColors`
- `fontBold` → `cellStyles.isBold`
- `align/paragraphAlign` → `cellStyles.aligns`
- `vAlign` → `cellStyles.vAligns`
- `rowHeights/colWidths` → `rowHeights/colWidths`
- `fill` → `headerBgColor`

**Các property MẤT:**
- Per-cell border styling (`borders.top/bottom/left/right`) → chỉ dùng global `borderColor/borderWidth`
- Cell padding → không có trong NavSlides table schema
- Table-level background fill (khác header) → bị mất

### 3.5. `chart` — ⚠️ GẦN HOÀN CHỈNH (8/14 chart types)

**pptxtojson chart types (14 total):**
```
lineChart, line3DChart,
barChart, bar3DChart,
pieChart, pie3DChart, doughnutChart,
areaChart, area3DChart,
scatterChart, bubbleChart,
radarChart, surfaceChart, surface3DChart, stockChart
```

**Mapper đã xử lý:**
- `lineChart` → `line`
- `pieChart` → `pie`
- `doughnutChart` → `doughnut`
- `radarChart` → `radar`
- `polarArea` → `polarArea`
- `barChart/areaChart/stackedBar/surface/bubble/stock/scatter` → `bar`/`line` (fallback)
- `line3DChart` → `line` (fallback, 3D bị mất)
- `bar3DChart` → `bar` (fallback, 3D bị mất)
- `pie3DChart` → `pie` (fallback, 3D bị mất)
- `area3DChart` → `bar` (fallback)
- `surfaceChart/surface3DChart` → `bar` (fallback)
- Chart data series → `chartData.datasets`
- Colors, labels, axis titles
- `_pptxChartMeta` preserved

**Các property MẤT:**
- **3D rendering** — tất cả `*3DChart` types mất 3D effect
- `scatterChart` → không giữ được x/y coordinate scatter format, convert về line
- `bubbleChart` → không giữ được bubble size data
- `stockChart` → không giữ được OHLC structure
- `surfaceChart` → không giữ được surface matrix
- `holeSize` (doughnut) → có trong meta nhưng không dùng
- `marker` → có trong meta nhưng không dùng (Chart.js line chart marker không được set)
- `grouping` (stacked/grouped) → không được xử lý, luôn render dạng bar đơn giản
- Chart animations → bị mất

### 3.6. `video` — ❌ THIẾU HOÀN TOÀN

**pptxtojson output:**
```
type: 'video', left, top, width, height, ref, blob, order
```

**Trạng thái hiện tại:**
- `videoMode: 'none'` trong `parse-worker.js` (line 44) → video blob KHÔNG được extract
- Mapper KHÔNG có handler cho `type === 'video'`
- Element rơi vào fallback → **placeholder "Unsupported PPTX object"**

**Hậu quả:** Video trong PPTX import luôn thành placeholder, không có video nào được import.

**Cách khắc phục:** Bật `videoMode: 'blob'` trong pptxtojson options + viết `mapVideo()` handler trong mapper + save blob ra file + tạo `video` element.

### 3.7. `audio` — ❌ THIẾU HOÀN TOÀN

**pptxtojson output:**
```
type: 'audio', left, top, width, height, ref, blob, order
```

**Trạng thái hiện tại:**
- `audioMode: 'none'` trong `parse-worker.js` (line 44) → audio blob KHÔNG được extract
- Mapper KHÔNG có handler cho `type === 'audio'`
- Element rơi vào fallback → **placeholder "Unsupported PPTX object"**

**Hậu quả:** Audio trong PPTX import luôn thành placeholder.

**Cách khắc phục:** Bật `audioMode: 'blob'` + viết `mapAudio()` handler + save blob + tạo `audio` element.

### 3.8. `math` — ⚠️ MẤT LaTeX TEXT, CHỈ GIỮ IMAGE

**pptxtojson output:**
```
type: 'math', left, top, width, height,
latex, picRef, picBase64, picBlob, text, order
```

**Trạng thái hiện tại:**
```js
if (element.type === 'math') {
  if (element.picBase64) {
    const mathEl = { ...element, type: 'image', base64: element.picBase64 }
    return mapImage(mathEl, context)
  }
  return [placeholder(...)]
}
```

**Vấn đề:** LaTeX text bị mất hoàn toàn. Chỉ image được giữ lại. NavSlides có `latex` type (KaTeX rendering) nhưng không nhận được raw LaTeX string từ pptxtojson.

**Hậu quả:** Math equations trong PPTX import thành raster image, không editable, không scale tốt.

**Cách khắc phục:** Viết `mapMath()` handler: parse `latex` field → tạo `latex` element thay vì fallback về image.

### 3.9. `diagram` (SmartArt) — ⚠️ PARTIAL — CHỈ NODES, MẤT CẤU TRÚC

**pptxtojson output:**
```
type: 'diagram', left, top, width, height,
elements (Shape|Text[]), textList (string[]),
connectors, arrows, order
```

**Trạng thái hiện tại:** `flattenDiagramElement()`:
- Mỗi node → tạo 1 `shape` element với text
- Tối đa 50 nodes (warning nếu >50)
- Connectors/arrows → chỉ ghi warning, KHÔNG tạo line/arrow elements
- Layout thực tế của SmartArt (hierarchy, process, cycle...) → mất hoàn toàn

**Hậu quả:** SmartArt mất cấu trúc diagram, chỉ giữ nội dung text. Các connector lines, arrows biểu diễn quan hệ giữa các node bị mất.

**Cách khắc phục:** Cải thiện `flattenDiagramElement()` để tạo `line` elements cho connectors/arrows.

### 3.10. `group` — ✅ HOÀN CHỈNH

**pptxtojson output:**
```
type: 'group', left, top, width, height, rotate,
elements (BaseElement[]), order,
isFlipH, isFlipV
```

**Trạng thái hiện tại:** `flattenGroupElement()`:
- Recursive flatten (max depth 10)
- Affine matrix transforms (translate, rotate, flip) được apply
- Nested groups xử lý đúng
- Effective order sorting cho zIndex
- Child order preserved

**Đánh giá:** Group handling rất tốt, tương thích cao với nested PPTX groups.

---

## 4. Các property MẤT nằm NGOÀI element type

### 4.1. Slide-level metadata

| pptxtojson property | Trạng thái |
|---|---|
| Master slide layouts | ❌ Không import |
| Slide layout associations | ❌ Không import |
| Presentation theme colors | ✅ `_pptxMeta.themeColors` |
| Used fonts | ✅ `_pptxMeta.usedFonts` |
| Slide size | ✅ `resolution: {width, height}` |

### 4.2. Animation data

pptxtojson KHÔNG parse animations. NavSlides có `fragments[]` per slide cho animation — không có source data từ PPTX.

### 4.3. Shadow object (cấu trúc `{h, v, blur, color}`)

- NavSlides base schema có `shadow?` property
- Nhưng mapper KHÔNG extract shadow từ pptxtojson `shadow` object vào element
- **Shadow bị mất trên tất cả elements (text, shape, image)**

### 4.4. Autofit behavior

pptxtojson cung cấp `autoFit: { type: 'shape' | 'text', fontScale? }` — NavSlides không có equivalent. Font scaling không được import.

### 4.5. Image filters

pptxtojson: `filters: { sharpen?, colorTemperature?, saturation?, brightness?, contrast? }`
NavSlides: `filterBrightness`, `filterContrast`, `filterGrayscale`

**Chỉ 3/5 filters được map:**

| Filter | Trạng thái |
|---|---|
| `brightness` | ❌ Mất |
| `contrast` | ✅ (partial — có property nhưng không extract) |
| `grayscale` | ❌ Mất |
| `sharpen` | ❌ Mất |
| `colorTemperature` | ❌ Mất |
| `saturation` | ❌ Mất |

---

## 5. Bảng tổng hợp gap

### 5.1. Element types hoàn toàn thiếu

| Type | Severity | Effort ước tính |
|---|---|---|
| `video` | Cao | Trung bình (cần blob save + video element) |
| `audio` | Cao | Thấp (cần audio element) |

### 5.2. Element types partial

| Type | Missing | Severity | Effort ước tính |
|---|---|---|---|
| `math` | LaTeX text | Cao | Thấp (parse latex field → latex element) |
| `diagram` | Connectors, layout | Trung bình | Cao (cần geometry calculation) |
| `chart` | 8/14 types + 3D | Thấp | Cao (Chart.js limitation) |

### 5.3. Property-level gaps

| Property | Affects | Severity |
|---|---|---|
| Shadow extraction | text, shape, image | Thấp |
| Image filters (sharpen, saturation, colorTemp) | image | Thấp |
| isVertical text direction | text | Thấp |
| Hyperlinks in text/image | text, image | Trung bình |
| Per-cell border styling | table | Thấp |
| Autofit behavior | text, shape | Rất thấp |
| Image clipping geometry | image | Thấp |

---

## 6. Recommendations

### Ưu tiên CAO (nên fix sớm)

1. **Bật video/audio import** — `parse-worker.js`: đổi `videoMode: 'blob'`, `audioMode: 'blob'` + viết handlers trong mapper. Đây là feature thiếu hoàn toàn.

2. **Map LaTeX thay vì image fallback** — `mapper.js` line 495-500: viết `mapMath()` riêng để tạo `type: 'latex'` element với `content: latex` field từ pptxtojson, không fallback về image.

3. **Extract shadow** — Thêm shadow extraction trong `mapShape()`, `mapText()`, `mapImage()` từ `element.shadow` object → NavSlides `shadow` property.

### Ưu tiên TRUNG BÌNH (nên fix khi có thời gian)

4. **Cải thiện diagram** — Thêm connector/arrow preservation trong `flattenDiagramElement()`. Tạo `line` elements cho connectors.

5. **Image filter extraction** — Extract `brightness`, `contrast` từ `element.filters` (NavSlides đã có property sẵn). Sharpen/saturation/colorTemp → có thể map sang CSS filters.

6. **Chart 3D types** — `line3DChart`, `bar3DChart`, `pie3DChart` → fallback về 2D equivalent (đã làm tốt cho bar/line/pie). Scatter data format → giữ nguyên x/y.

### Ưu tiên THẤP (khi cần fidelity cao)

7. Hyperlink import cho text và image
8. Per-cell border styling cho table
9. Image clipping geometry preservation
10. Vertical text direction support

---

## 7. Kết luận

**Tốt:**
- Core 5 element types chính (text, image, shape, table, group) được xử lý rất tốt
- Shape type mapping 15/15 hoàn chỉnh
- Group flatten với affine transforms xuất sắc
- Table với merged cells, per-cell styling tốt
- Color/gradient fill handling toàn diện

**Cần cải thiện:**
- **Video/audio hoàn toàn thiếu** (0% support)
- **Math LaTeX text bị mất** (chỉ giữ image)
- **Diagram SmartArt mất cấu trúc** (chỉ nodes)
- **Chart 3D types và advanced chart types** bị fallback
- **Shadow bị mất** trên mọi element type
- **Image filters không extract** (contrast/brightness có property nhưng filter data không extract)

**Độ phủ hiện tại:** ~85% element types và ~75% property fidelity. Hai gap lớn nhất là video/audio (missing feature) và math LaTeX text loss (fidelity gap).
