# 🧠 Brainstorm: NavSlides Controls & Template System Enhancement

## Tình trạng hiện tại

### Element Types (Controls) — 13 loại

| #   | Type           | Insert Menu                                                                    | Properties Panel                                       | Ghi chú                     |
| --- | -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------- |
| 1   | Text           | ✅                                                                             | ✅ Rich formatting, TipTap                             | Đầy đủ                      |
| 2   | Image          | ✅ URL + Upload                                                                | ✅ Fit, Brightness, Contrast, Grayscale, Round corners | Đầy đủ                      |
| 3   | Shape          | ✅ 8 shapes (rect, rounded-rect, circle, triangle, diamond, arrow, star, line) | ✅ Fill, Stroke, Opacity, Text, Border radius          | OK                          |
| 4   | Code           | ✅                                                                             | ✅ 24 languages, 10 themes, round corners              | Đầy đủ                      |
| 5   | LaTeX/TikZ     | ✅                                                                             | ✅ Split-pane editor                                   | Đầy đủ                      |
| 6   | HTML Embed     | ✅                                                                             | ✅ D3 default                                          | OK                          |
| 7   | Markdown       | ✅                                                                             | ✅ Textarea                                            | OK                          |
| 8   | Chart          | ✅                                                                             | ✅ 6 chart types, data editor                          | OK nhưng thiếu multi-series |
| 9   | Video          | ✅ URL + Upload                                                                | ✅ Autoplay, loop, muted, poster, fit                  | Đầy đủ                      |
| 10  | Audio          | ✅ Upload                                                                      | Cơ bản                                                 | Ít tùy chỉnh                |
| 11  | Table          | ✅ Grid picker (8×8)                                                           | ✅ Header, cell editing                                | OK                          |
| 12  | Icon           | ✅ Searchable Lucide library                                                   | ✅ Color, stroke width                                 | OK                          |
| 13  | Callout        | ✅                                                                             | ✅ Number, color, font size                            | OK                          |
| 14  | SVG            | ✅ File upload                                                                 | Không                                                  | Chỉ upload, không edit      |
| 15  | Drawing Canvas | ✅                                                                             | ?                                                      | Chưa rõ mức độ              |
| 16  | Line/Arrow     | ✅                                                                             | Cơ bản                                                 | Thiếu style options         |

### Slide Templates — 8 layout

| Template       | Mô tả              |
| -------------- | ------------------ |
| Blank          | Trống              |
| Title Slide    | Tiêu đề + subtitle |
| Two Column     | 2 cột              |
| Three Column   | 3 cột              |
| Image + Text   | Hình ảnh + text    |
| Section Header | Section divider    |
| Comparison     | So sánh A vs B     |
| Big Number     | Số lớn + mô tả     |

### Built-in Template Gallery (Marketplace)

- **53 templates** tổng cộng (~911KB JSON)
- **17 categories**: military, engineering, digital-electronics, microprocessor, circuit-theory, electronics, automation, electrical, measurement, power-electronics, mechanical, technical-drawing, fluid-mechanics, academic, corporate, creative, tactical
- UI: Modal gallery + sidebar categories + search + difficulty badges
- Nhiều template chuyên ngành kỹ thuật (Digital Electronics, etc.)

### Custom Templates

- CRUD API đầy đủ (`/api/templates`)
- User có thể tạo template từ presentation hiện tại
- Lưu trữ `templates.json` riêng

---

## Phần 1: Phân tích Controls — Đề xuất bổ sung

### 🔴 Ưu tiên CAO — Controls thiếu rõ ràng

#### 1. **Timeline / Progress Bar** (Mới)

- **Lý do**: Slides bài giảng cần thanh tiến trình hoặc timeline hiển thị các bước/stages
- **Use case**: Giảng viên muốn thể hiện quy trình, lịch sử phát triển, roadmap
- **Triển khai**: Element type `timeline` — horizontal/vertical, auto-layout steps, editable labels + colors
- **Effort**: Medium

#### 2. **Connector / Flowchart Lines** (Cải tiến Line)

- **Lý do**: Line/Arrow hiện tại chỉ là đoạn thẳng đơn giản. Thiếu connector nối giữa 2 shapes
- **Use case**: Flowchart, sơ đồ khối, process diagram — **rất quan trọng cho kỹ thuật**
- **Triển khai**: Nâng cấp line element thêm: bezier curves, elbow connector, arrowhead styles, line dash patterns
- **Effort**: High (cần snap-to-element logic)

#### 3. **Text Callout / Tooltip Box** (Cải tiến)

- **Lý do**: Callout hiện tại chỉ là số tròn. Cần speech bubble / annotation box
- **Use case**: Chú thích trên sơ đồ, highlight key points
- **Triển khai**: Element `callout-box` với tail direction, auto-wrap text, các style presets
- **Effort**: Medium

#### 4. **Equation Block tách biệt (KaTeX inline)** (Cải tiến)

- **Lý do**: LaTeX element hiện tại là full block. Trong text box có inline math nhưng UX chưa trực quan
- **Triển khai**: Nút Insert → "Math Equation" tạo standalone KaTeX block nhỏ gọn hơn (không cần TikZ overhead)
- **Effort**: Low — reuse existing KaTeX rendering

### 🟡 Ưu tiên TRUNG BÌNH

#### 5. **QR Code Generator** (Mới)

- **Lý do**: Giảng viên hay cần chia sẻ link tài liệu, survey, form
- **Triển khai**: Element `qrcode` — input URL/text, render bằng qrcode.js, tuỳ chỉnh size + color
- **Effort**: Low

#### 6. **Countdown Timer / Stopwatch** (Mới)

- **Lý do**: Interactive presentations cần timer cho quiz, exercises
- **Triển khai**: Element `timer` — configurable duration, auto-start on slide, visual countdown circle
- **Effort**: Medium

#### 7. **Shapes mở rộng** (Cải tiến)

- **Hiện tại**: 8 shapes (rect, rounded-rect, circle, triangle, diamond, arrow-right, star, line)
- **Thiếu**: Hexagon, Pentagon, Cloud, Bracket, Cylinder (database), Parallelogram, Trapezoid
- **Use case**: Sơ đồ khối kỹ thuật cần nhiều hình dạng hơn
- **Effort**: Low — chỉ thêm SVG path definitions

#### 8. **Audio player cải tiến**

- **Hiện tại**: Upload audio nhưng ít controls trong Properties Panel
- **Cần**: Waveform visualization, play/pause controls visible on slide, volume preset
- **Effort**: Medium

### 🟢 Ưu tiên THẤP (Nice-to-have)

#### 9. **Embed Web (iframe URL)**

- **Hiện tại**: HTML embed cho custom code. Thiếu quick "paste URL" iframe
- **Use case**: Embed YouTube, Google Maps, Desmos, GeoGebra
- **Effort**: Low — wrapper around iframe

#### 10. **Sticky Note / Post-it**

- **Mục đích**: Visual annotation, brainstorm boards
- **Effort**: Low — styled shape variant

#### 11. **Badge / Chip / Tag**

- **Mục đích**: Status labels, category tags trên slides
- **Effort**: Low

#### 12. **Separator / Divider**

- **Hiện tại**: Dùng Shape rect mỏng thay thế
- **Đề xuất**: Dedicated divider element với line styles (solid, dashed, dotted, gradient)
- **Effort**: Very Low

---

## Phần 2: Template System — Đề xuất cải tiến

### Vấn đề hiện tại

1. **Slide Templates (EditorPage)** và **Marketplace Templates (TemplateGallery)** là 2 hệ thống tách biệt hoàn toàn
2. Slide Templates chỉ có 8 layout cơ bản, không có preview
3. Marketplace có 53 templates nhưng **tất cả read-only** (built-in JSON), không có cơ chế community/user upload
4. Thiếu template categories phổ biến: **Toán học, Vật lý, Hóa học, Tin học, Ngoại ngữ**
5. Thiếu **Template Preview** trước khi áp dụng
6. Chưa có **Rating / Popularity** system

### 🔴 Đề xuất 1: Mở rộng Slide Layout Templates

Thêm các slide layout phổ biến:

| Layout mới          | Mô tả                              | Priority |
| ------------------- | ---------------------------------- | -------- |
| **Quote**           | Trích dẫn lớn + tác giả            | High     |
| **Agenda / TOC**    | Mục lục với numbered sections      | High     |
| **Timeline**        | Horizontal timeline với milestones | High     |
| **4-Grid**          | 2×2 grid cards                     | Medium   |
| **Steps / Process** | 3-5 numbered steps horizontal      | High     |
| **Team / Profile**  | Avatar + name + role               | Medium   |
| **Thank You / End** | Kết bài, CTA, QR                   | High     |
| **Definition**      | Term highlighted + definition text | Medium   |
| **Pro-Con**         | Two-column with ✅/❌              | Medium   |
| **Image Gallery**   | 3-4 image placeholders             | Low      |
| **Key Takeaways**   | Bullet points with icons           | Medium   |
| **Q&A**             | Câu hỏi & thảo luận ending         | High     |

### 🔴 Đề xuất 2: Hệ thống Template Categories mở rộng

#### A. Categories mới cho Marketplace

```
- mathematics       — Toán cao cấp, Xác suất thống kê
- physics           — Vật lý đại cương
- chemistry         — Hoá học
- computer-science  — Tin học, Lập trình
- foreign-language  — Ngoại ngữ (Anh, Nga)
- navigation        — Hàng hải
- signal-processing — Xử lý tín hiệu
- control-theory    — Lý thuyết điều khiển
- embedded-systems  — Hệ thống nhúng
```

#### B. Template Packs (thay vì single templates)

- Mỗi pack = 1 bài giảng hoàn chỉnh (10-20 slides)
- Pack metadata: author, version, last-updated, prerequisites
- Import/Export pack format: `.navslides-pack`

### 🔴 Đề xuất 3: Interactive / Simulation Templates

> **Đây là unique selling point lớn nhất** — Các template có mô phỏng, tương tác, chuyên nghiệp

#### Tier 1 — Template có HTML Embed mô phỏng

Mỗi template chứa sẵn `html` elements với JavaScript simulations:

| Template                  | Category            | Mô phỏng                                      |
| ------------------------- | ------------------- | --------------------------------------------- |
| **Logic Gate Simulator**  | digital-electronics | Drag wires, click inputs, observe outputs     |
| **K-map Solver**          | digital-electronics | Clickable K-map grid, auto-group, show result |
| **Flip-Flop Timing**      | digital-electronics | Clock signal + D/JK input → Q output waveform |
| **Ohm's Law Calculator**  | circuit-theory      | Adjust V/I/R sliders, see real-time results   |
| **RLC Circuit Response**  | circuit-theory      | Time-domain/frequency response visualization  |
| **Op-Amp Configurations** | electronics         | Inverting/Non-inverting, gain calculation     |
| **PID Controller**        | automation          | Tune Kp/Ki/Kd sliders, see step response      |
| **Signal Spectrum**       | signal-processing   | FFT visualization, filter cutoff              |
| **Binary Converter**      | computer-science    | Dec ↔ Bin ↔ Hex ↔ Oct                         |
| **Sorting Algorithm**     | computer-science    | Visual step-by-step sorting animation         |
| **Newton's Laws**         | physics             | Force vectors, acceleration visualization     |
| **Projectile Motion**     | physics             | Launch angle + velocity → trajectory          |
| **Chemical Bonding**      | chemistry           | Electron shell visualization                  |
| **Matrix Calculator**     | mathematics         | Matrix operations, determinant, inverse       |
| **Probability Dist.**     | mathematics         | Normal/Poisson/Binomial curves with params    |

#### Tier 2 — Interactive Quiz Templates

Templates có sẵn quiz/exercise với feedback:

| Template              | Mô tả                                              |
| --------------------- | -------------------------------------------------- |
| **Multiple Choice**   | 4 options, click to answer, show correct/incorrect |
| **True/False**        | Statement list with T/F toggle                     |
| **Matching**          | Drag-to-match columns                              |
| **Fill-in-the-blank** | Text with input fields                             |
| **Ordering**          | Drag items to correct sequence                     |

#### Tier 3 — Data Visualization Templates

Templates với Chart.js hoặc D3 pre-configured:

| Template                  | Mô tả                    |
| ------------------------- | ------------------------ |
| **Dashboard**             | 4 charts + KPI numbers   |
| **Before-After Analysis** | Side-by-side charts      |
| **Trend Report**          | Line chart + annotations |
| **Survey Results**        | Pie + bar combination    |
| **Performance Metrics**   | Radar chart + scores     |

### 🟡 Đề xuất 4: Template Preview & Management UX

#### A. Template Preview Modal

- Khi hover/click template → show **slide carousel preview** (không phải chỉ gradient thumbnail)
- Render actual slide content trong miniature view
- Show metadata: slide count, element types used, interactive features

#### B. "Use Template" Flow cải tiến

1. User chọn template → Preview modal
2. Option: "Use as New Presentation" hoặc "Insert Slides into Current"
3. Nếu insert: chọn slides nào muốn insert, vị trí insert

#### C. Template Rating & Sorting

- ⭐ Star rating (lưu local storage)
- Sort by: Popularity, Newest, Difficulty, Rating
- Filter by: Interactive, Quiz, Lecture, Exercise

#### D. My Templates Tab

- Gộp Custom Templates + Favorite Built-in templates
- Quick access panel bên cạnh slide panel

### 🟡 Đề xuất 5: Template Authoring Workflow

#### "Save as Template" cải tiến

1. Select slides muốn include (checkboxes)
2. Set metadata: title, description, category, tags, difficulty
3. Define **placeholder regions** (text boxes auto-highlight for user to fill)
4. Export as `.navslides-template`

#### Template Inheritance

- Template có thể define **master slide** (header, footer, accent color)
- Khi user thay đổi accent color → cập nhật toàn bộ slides

---

## Phần 3: Đánh giá ưu tiên & Effort

### Ma trận Impact × Effort

```
HIGH IMPACT
│
│  ⬤ Interactive Templates    ⬤ Slide Layout Templates
│  ⬤ Connector Lines          ⬤ Template Preview
│
│  ⬤ Shapes mở rộng          ⬤ QR Code
│  ⬤ Math Block              ⬤ Quiz Templates
│
│  ⬤ Timeline element        ⬤ Rating system
│  ⬤ Callout Box             ⬤ Template packs
│
LOW IMPACT
└────────────────────────────────────────→
  LOW EFFORT                        HIGH EFFORT
```

### Recommended Roadmap

#### Phase 1 — Quick Wins (1-2 tuần)

- [ ] Thêm 8-12 Slide Layout Templates mới (Quote, Agenda, Steps, Thank You, Q&A, etc.)
- [ ] Thêm shapes mới (hexagon, pentagon, cylinder, cloud, parallelogram)
- [ ] QR Code element
- [ ] Separator/Divider element
- [ ] Template Preview modal (slide carousel)

#### Phase 2 — Interactive Templates (2-3 tuần)

- [ ] 5-8 Interactive Simulation templates (Logic Gate Sim, K-map Solver, Ohm's Law, etc.)
- [ ] 3-5 Quiz templates (Multiple Choice, True/False, Matching)
- [ ] 3-5 Data Visualization templates (Dashboard, Trend, Survey)
- [ ] New categories (mathematics, physics, computer-science)

#### Phase 3 — Template System UX (1-2 tuần)

- [ ] "Insert Slides" flow (chọn slides từ template để insert)
- [ ] Template Rating & Sorting
- [ ] My Templates / Favorites tab
- [ ] Template metadata editor (khi Save as Template)

#### Phase 4 — Advanced Controls (2-3 tuần)

- [ ] Connector lines (bezier, elbow, snap-to-shape)
- [ ] Timeline element
- [ ] Callout Box (speech bubble)
- [ ] Countdown Timer element
- [ ] Audio player cải tiến

---

## Câu hỏi cần xác nhận

1. **Scope ưu tiên**: Anh muốn tập trung Phase nào trước? Quick Wins + Interactive Templates là recommendation của tôi.
2. **Interactive templates language**: HTML embed simulations nên viết bằng vanilla JS + D3, hay cho phép frameworks (React within iframe)?
3. **Template categories**: Danh sách categories mới có cần thêm/bớt gì không?
4. **Quiz templates**: Cần có grading/scoring system không, hay chỉ visual feedback?
5. **Connector lines**: Có cần full flowchart editor (snap + auto-route) hay chỉ manual bezier curve?

---

> **Tóm lại**: Hệ thống controls đã khá đầy đủ (13+ element types). Cần bổ sung chính là **shapes mở rộng**, **connector lines**, và **QR code**. Về template system — cần thêm **slide layouts** (hiện chỉ 8) + **interactive simulation templates** (unique selling point) + **UX cải tiến** (preview, rating, insert flow). Phase 1 + 2 sẽ tạo impact lớn nhất.
