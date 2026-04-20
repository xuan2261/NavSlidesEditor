# Engineering Template Gallery & Interactive Simulations

Mở rộng Template Gallery + Marketplace với hàng loạt templates chuyên ngành kỹ thuật, kèm các presentation mẫu có tương tác/mô phỏng.

## Phân tích hiện trạng

| Thành phần | Hiện tại | Cần làm |
|---|---|---|
| Built-in Presets | 6 preset chung (hardcoded `HomePage.jsx`) | Thêm ~15-20 preset chuyên ngành |
| Marketplace templates | 1 template (Tactical Briefing) | Thêm 30-50+ templates đa dạng |
| Categories | 6 danh mục chung | Thêm ~12 categories chuyên ngành |
| Interactive slides | Chưa có | Tận dụng HTML embed + Chart.js + LaTeX/TikZ |
| Template preview | Đơn giản (gradient box) | Cần mini-preview thực tế |

## Scope Decomposition

> [!IMPORTANT]
> Yêu cầu bao phủ rất nhiều môn — cần decompose thành phases rõ ràng.

### Sub-Project A: Template Data Infrastructure (Nền tảng)
- Mở rộng category system trong `marketplace.js`
- Cải thiện template data schema (thêm tags, difficulty, subject metadata)
- Tối ưu `built-in-templates.json` structure cho số lượng lớn

### Sub-Project B: Engineering Template Content (Nội dung template)
Tạo templates theo từng nhóm môn:

| # | Nhóm môn | Templates | Ưu tiên |
|---|----------|-----------|---------|
| 1 | **Kỹ thuật số (Digital Electronics)** | Cổng logic, K-map, bảng chân trị, flip-flop, máy trạng thái | P0 |
| 2 | **Kỹ thuật vi xử lý (Microprocessor)** | Kiến trúc CPU, instruction set, memory mapping, I/O | P0 |
| 3 | **Lý thuyết mạch (Circuit Theory)** | Mạch RLC, phân tích Kirchhoff, biểu đồ Bode, đặc tính tần số | P0 |
| 4 | **Kỹ thuật điện tử (Electronics Engineering)** | BJT/MOSFET, op-amp, bộ khuếch đại, bộ lọc | P1 |
| 5 | **Tự động hoá (Automation)** | Sơ đồ khối PLC, SCADA, PID controller, ladder diagram | P1 |
| 6 | **Điện (Electrical Engineering)** | Sơ đồ mạch điện, biến áp, máy điện, hệ thống 3 pha | P1 |
| 7 | **Đo lường điện (Electrical Measurement)** | Các loại sensor, cầu đo Wheatstone, oscilloscope, sai số | P2 |
| 8 | **Điện tử công suất (Power Electronics)** | Thyristor, buck/boost converter, inverter, PWM | P2 |
| 9 | **Cơ khí (Mechanical Engineering)** | Truyền động, bánh răng, ổ bi, sức bền vật liệu | P2 |
| 10 | **Hình hoạ - Vẽ kỹ thuật (Technical Drawing)** | Hình chiếu, mặt cắt, kích thước, bản vẽ chi tiết | P2 |
| 11 | **Thuỷ khí (Fluid Mechanics)** | Phương trình Bernoulli, dòng chảy, bơm, van | P2 |

### Sub-Project C: Interactive Simulation Templates
Templates đặc biệt sử dụng HTML embed để tạo mô phỏng tương tác:
- Logic gate simulator (click thay đổi input, xem output)
- RLC circuit animation (thay đổi R/L/C, xem đáp ứng)
- PID tuning interactive (thay đổi Kp/Ki/Kd, xem response)
- Bode plot generator (nhập hàm truyền, vẽ biểu đồ)
- 3-phase system visualizer
- Gear train animation

## Proposed Changes

### [Component 1] Backend — Category & Template Data

#### [MODIFY] [marketplace.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/marketplace.js)
- Mở rộng `CATEGORIES` array: thêm 12 categories kỹ thuật mới
- Thêm subcategory support (optional tag-based filtering)

#### [MODIFY] [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json)
- Thêm 30-50+ template entries với đầy đủ slides, elements, backgrounds
- Mỗi template: 5-10 slides (title, outline, content slides, summary)
- Template chuyên ngành sử dụng LaTeX cho công thức, TikZ cho sơ đồ mạch

---

### [Component 2] Frontend — Template Gallery UI

#### [MODIFY] [TemplateGallery.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/dashboard/TemplateGallery.jsx)
- Thêm icon mapping cho các categories mới (Cpu, Zap, Gauge, Wrench, etc.)
- Thêm search/filter cho templates
- Tag-based browsing

#### [MODIFY] [HomePage.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/HomePage.jsx)
- Thêm engineering-specific PRESET_THEMES
- Cập nhật TEMPLATE_CATEGORIES cho các nhóm ngành mới
- Filter theo subject area

#### [MODIFY] [TemplatePreview.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/dashboard/TemplatePreview.jsx)
- Render mini-preview thực tế thay vì gradient box
- Hiển thị metadata: số slides, tags, difficulty level

---

### [Component 3] Interactive Simulation Templates

#### [NEW] [interactive-templates/](file:///d:/NCKH_2025/revealjs_gui/server/data/interactive-templates/)
- Các file HTML snippet được embed vào templates dưới dạng HTML element
- Self-contained: mỗi simulation là 1 HTML block với CSS + JS inline
- Ví dụ templates tương tác:
  - `logic-gate-sim.html` — Click inputs to see outputs of AND/OR/NAND/NOR/XOR gates
  - `rlc-circuit-sim.html` — Slider thay đổi R/L/C, xem đáp ứng tần số
  - `pid-tuning-sim.html` — Điều chỉnh Kp/Ki/Kd, xem step response real-time
  - `bode-plot-gen.html` — Nhập hàm truyền, vẽ biểu đồ Bode
  - `3phase-visualizer.html` — Vector quay 3 pha animation
  - `gear-train-sim.html` — Animation truyền động bánh răng

## Chiến lược tạo nội dung Template

Mỗi template chuyên ngành sẽ có structure chung:

```
Slide 1: Title Slide — Tên bài, tên môn, logo/branding
Slide 2: Outline — Mục lục nội dung
Slide 3-7: Content Slides — Lý thuyết + hình minh hoạ
Slide 8: Interactive Demo — HTML embed simulation (nếu có)
Slide 9: Summary — Tóm tắt key points
Slide 10: Q&A/References
```

### Màu sắc theo ngành (Color Scheme por Subject):

| Ngành | Primary Color | Background |
|-------|--------------|------------|
| Kỹ thuật số | `#00d4ff` (cyan) | `#0a1628` (dark navy) |
| Vi xử lý | `#ff6b35` (orange) | `#1a0e2e` (deep purple) |
| Lý thuyết mạch | `#00ff87` (green) | `#0d1b0e` (dark green) |
| Điện tử | `#ffd700` (gold) | `#1a1200` (dark gold) |
| Tự động hoá | `#ff4757` (red) | `#1a0a0e` (dark red) |
| Điện | `#4ecdc4` (teal) | `#0a1a18` (dark teal) |
| Đo lường | `#a8e6cf` (mint) | `#0e1a14` (dark mint) |
| Điện tử CS | `#ff8a5c` (coral) | `#1a100a` (dark coral) |
| Cơ khí | `#95adb6` (steel) | `#0f1419` (dark steel) |
| Hình hoạ VKT | `#ddd8c4` (cream) | `#141210` (dark cream) |
| Thuỷ khí | `#48bfe3` (sky blue) | `#0a1628` (dark blue) |

## Open Questions

> [!IMPORTANT]
> **Q1**: Mỗi môn nên có bao nhiêu template? Đề xuất: 3-5 templates/môn (Bài giảng tổng quan, Bài giảng chi tiết, Lab report, Seminar, Project presentation).

> [!IMPORTANT]
> **Q2**: Interactive simulation — nên embed trực tiếp HTML hay tạo riêng 1 thư viện simulation components mà user có thể kéo thả? Đề xuất: embed HTML trước (nhanh), refactor sau.

> [!IMPORTANT]
> **Q3**: Ưu tiên nhóm nào trước? Đề xuất P0 (Kỹ thuật số, Vi xử lý, Lý thuyết mạch) vì gần với KI digital electronics đã có sẵn.

> [!IMPORTANT]
> **Q4**: Template content có cần tiếng Việt song ngữ không? (titleVi + title)

## Verification Plan

### Automated
- `npm run dev` → verify template gallery loads correctly
- API test: `GET /api/marketplace/templates` returns new categories + templates
- Template selection → creates presentation with correct slides

### Manual
- Duyệt qua mỗi category, xem template cards hiển thị đúng
- Click vào template → preview → Use → verify slides có đầy đủ content
- Interactive templates: test HTML embeds hoạt động (logic gate click, slider thay đổi)
- Export HTML offline → verify interactive simulations vẫn work

## Ước tính effort

| Phase | Effort |
|-------|--------|
| Template Data Infrastructure | 1-2 ngày |
| Template Content (P0: 3 môn × 3 templates) | 2-3 ngày |
| Template Content (P1: 3 môn × 3 templates) | 2-3 ngày |
| Template Content (P2: 5 môn × 2 templates) | 3-4 ngày |
| Interactive Simulations (3-4 sims) | 3-4 ngày |
| UI improvements | 1-2 ngày |
| **Total** | **~12-18 ngày** |
