# Phase 02: P0 Templates — Kỹ thuật số + Vi xử lý + Lý thuyết mạch

## Context Links
- [Brainstorm Report](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/brain/5bf33ce8-e4a5-4d66-816a-7a37d626fcc9/implementation_plan.md)
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json)
- [KI: Digital Electronics](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/knowledge/digital_electronics_course_content/artifacts/curriculum_summary.md)
- [presentations.js L34-113](file:///d:/NCKH_2025/revealjs_gui/server/routes/presentations.js#L34-L113) — Template → Presentation creation flow

## Overview
- **Priority:** P0
- **Status:** ⬜ Pending
- **Effort:** 3-4 ngày
- **Depends on:** Phase 01 (Infrastructure)
- Tạo 15 templates (5/môn × 3 môn) cho 3 môn ưu tiên cao nhất.

## Template Types (5 per subject)

| Type | Mục đích | Slides | Đặc điểm |
|------|---------|--------|-----------|
| **Bài giảng tổng quan** | Overview 1 chương/module | 8-10 | Title → Outline → 5-6 content → Summary → Q&A |
| **Bài giảng chi tiết** | Deep-dive 1 bài học | 10-12 | Title → Objectives → Theory → Examples → Exercises → Summary |
| **Lab Report** | Báo cáo thí nghiệm | 8 | Title → Objective → Equipment → Procedure → Data → Analysis → Conclusion → References |
| **Seminar** | Trình bày seminar | 6-8 | Title → Agenda → Problem → Solution → Demo → Discussion → Q&A |
| **Project Presentation** | Báo cáo đồ án | 8-10 | Title → Team → Problem → Design → Implementation → Results → Conclusion → Future Work |

## Slide Structure Standard

Mỗi template tuân thủ layout 960×540px (16:9 standard của reveal.js).

### Common Slide Layouts

**Title Slide:**
```json
{
  "elements": [
    { "type": "shape", "shape": "rect", "x": 0, "y": 0, "width": 960, "height": 8, "fill": "{PRIMARY}", "locked": true },
    { "type": "text", "x": 60, "y": 120, "width": 840, "height": 120, "content": "<h1 style=\"text-align:center; color:{TEXT}\">{TITLE}</h1>" },
    { "type": "text", "x": 160, "y": 270, "width": 640, "height": 60, "content": "<p style=\"text-align:center; color:{TEXT}80\">Giảng viên: ... · Lớp: ... · Ngày: ...</p>" },
    { "type": "shape", "shape": "rect", "x": 380, "y": 250, "width": 200, "height": 2, "fill": "{PRIMARY}60", "locked": true }
  ],
  "background": { "type": "color", "color": "{BG}" }
}
```

**Content Slide (2-column):**
```json
{
  "elements": [
    { "type": "shape", "shape": "rect", "x": 0, "y": 0, "width": 960, "height": 6, "fill": "{PRIMARY}", "locked": true },
    { "type": "text", "x": 40, "y": 20, "width": 880, "height": 50, "content": "<h2 style=\"color:{PRIMARY}\">Section Title</h2>" },
    { "type": "shape", "shape": "rect", "x": 40, "y": 70, "width": 880, "height": 1, "fill": "{PRIMARY}30", "locked": true },
    { "type": "text", "x": 40, "y": 85, "width": 420, "height": 400, "content": "<p style=\"color:{TEXT}\">Left column</p>" },
    { "type": "text", "x": 500, "y": 85, "width": 420, "height": 400, "content": "<p style=\"color:{TEXT}\">Right column</p>" }
  ],
  "background": { "type": "color", "color": "{BG}" }
}
```

**Summary/Q&A Slide:**
```json
{
  "elements": [
    { "type": "text", "x": 80, "y": 80, "width": 800, "height": 100, "content": "<h1 style=\"text-align:center; color:{PRIMARY}\">Tóm tắt</h1>" },
    { "type": "text", "x": 120, "y": 200, "width": 720, "height": 280, "content": "<ul style=\"color:{TEXT}; font-size:22px\"><li>Point 1</li><li>Point 2</li><li>Point 3</li></ul>" }
  ],
  "background": { "type": "gradient", "gradient": "linear-gradient(135deg, {BG}, {BG_DARK})" }
}
```

---

## Subject 1: Kỹ thuật số (Digital Electronics)

**Color Scheme:** `primary: #00d4ff`, `bg: #0a1628`, `text: #e0f2ff`, `accent: #00ff87`

### Template 1.1: Bài giảng tổng quan — Cổng logic & Đại số Boolean
**10 slides:**
1. **Title:** "Chương 2: Đại số Boolean & Cổng Logic"
2. **Outline:** Mục lục 6 mục (Tiên đề, Định lý, Cổng logic, Bảng chân trị, K-map, Ứng dụng)
3. **Content:** Tiên đề Boolean — Bảng các tiên đề (A+0=A, A·1=A, A+A'=1,...)
4. **Content:** Các cổng logic cơ bản — AND, OR, NOT, NAND, NOR, XOR, XNOR (ký hiệu + bảng chân trị)
5. **Content:** Định lý De Morgan — Công thức + minh hoạ
6. **Content:** Phương pháp K-map — Grid 2×2, 3×3, 4×4 layout
7. **Content:** Ví dụ rút gọn hàm Boolean — Từ SOP → K-map → Kết quả
8. **Content:** Ứng dụng thực tế — Mạch cộng, mạch so sánh
9. **Summary:** Tóm tắt key points
10. **Q&A:** Câu hỏi & tài liệu tham khảo

**Đặc điểm đặc biệt:**
- Slide 4: Sử dụng Table element cho bảng chân trị
- Slide 6: K-map grid dùng Table element với color-coded cells
- LaTeX cho công thức Boolean: `$F = A \cdot B + \overline{C}$`

### Template 1.2: Bài giảng chi tiết — Flip-Flop & Máy trạng thái
**12 slides:**
1. **Title:** "Flip-Flop và Máy trạng thái hữu hạn"
2. **Objectives:** Mục tiêu bài học (4-5 learning objectives)
3. **Theory:** SR Flip-Flop — Sơ đồ + bảng trạng thái
4. **Theory:** JK Flip-Flop — Sơ đồ + bảng trạng thái
5. **Theory:** D Flip-Flop — Sơ đồ + timing diagram (shape elements)
6. **Theory:** T Flip-Flop — Sơ đồ + ứng dụng bộ đếm
7. **Theory:** Máy trạng thái Moore — Diagram dùng shapes (circles + arrows)
8. **Theory:** Máy trạng thái Mealy — Diagram + so sánh Moore vs Mealy
9. **Example:** Ví dụ thiết kế bộ đếm 0-9
10. **Exercise:** Bài tập tự giải (3-4 bài)
11. **Summary:** Tóm tắt key formulas
12. **Q&A**

### Template 1.3: Lab Report — Thí nghiệm cổng logic
**8 slides:**
1. **Title:** "Báo cáo thí nghiệm: Khảo sát cổng logic cơ bản"
2. **Objective:** Mục đích thí nghiệm
3. **Equipment:** Thiết bị sử dụng (IC 7400, 7408, 7432, breadboard, nguồn 5V, LED)
4. **Procedure:** Quy trình thí nghiệm (5 bước)
5. **Data:** Bảng số liệu đo (Table element)
6. **Analysis:** Phân tích kết quả — So sánh lý thuyết vs thực tế
7. **Conclusion:** Kết luận + nhận xét
8. **References:** Tài liệu tham khảo

### Template 1.4: Seminar — Ứng dụng FPGA
**7 slides:**
1. **Title:** "FPGA trong thiết kế hệ thống số hiện đại"
2. **Agenda:** Nội dung trình bày
3. **Problem:** Tại sao cần FPGA? Hạn chế của ASIC
4. **Solution:** Kiến trúc FPGA: CLB, IOB, Interconnect
5. **Demo:** Ví dụ thiết kế bộ đếm trên Xilinx Vivado (screenshot placeholder)
6. **Discussion:** So sánh FPGA vs ASIC vs MCU (Table comparison)
7. **Q&A**

### Template 1.5: Project Presentation — Đồ án thiết kế số
**9 slides:**
1. **Title:** "Đồ án: Thiết kế [Tên hệ thống số]"
2. **Team:** Thông tin nhóm (tên, MSSV, phân công)
3. **Problem:** Bài toán đặt ra
4. **Design:** Sơ đồ khối hệ thống (shapes)
5. **Implementation:** Chi tiết triển khai — Sơ đồ mạch, code VHDL/Verilog
6. **Testing:** Kết quả kiểm thử — Waveform + bảng kết quả
7. **Results:** Kết quả đạt được
8. **Conclusion:** Kết luận + hướng phát triển
9. **References**

---

## Subject 2: Kỹ thuật Vi xử lý (Microprocessor Engineering)

**Color Scheme:** `primary: #ff6b35`, `bg: #1a0e2e`, `text: #ffe0d0`, `accent: #ffd700`

### Template 2.1: Bài giảng tổng quan — Kiến trúc vi xử lý
**10 slides:**
1. **Title:** "Kiến trúc và tổ chức vi xử lý"
2. **Outline:** CPU → Memory → I/O → Bus → Instruction Set → Pipeline
3. **Content:** Kiến trúc Von Neumann vs Harvard — So sánh 2 kiến trúc
4. **Content:** Cấu trúc CPU — ALU, CU, Registers (diagram dùng shapes)
5. **Content:** Hệ thống nhớ — RAM, ROM, Cache hierarchy
6. **Content:** Bus system — Address bus, Data bus, Control bus
7. **Content:** Tập lệnh — RISC vs CISC, format lệnh
8. **Content:** Pipeline — 5-stage pipeline diagram
9. **Summary**
10. **Q&A**

### Template 2.2: Bài giảng chi tiết — Lập trình Assembly
**12 slides:**
1. **Title:** "Lập trình Assembly cho vi xử lý 8051/AVR/ARM"
2. **Objectives:** 5 mục tiêu
3. **Theory:** Cấu trúc chương trình Assembly
4. **Theory:** Các chế độ định địa chỉ (7 addressing modes)
5. **Theory:** Nhóm lệnh di chuyển dữ liệu — MOV, PUSH, POP
6. **Theory:** Nhóm lệnh số học — ADD, SUB, MUL, DIV
7. **Theory:** Nhóm lệnh logic & rẽ nhánh — AND, OR, JMP, CALL
8. **Example:** Ví dụ: Cộng 2 số 16-bit (code block)
9. **Example:** Ví dụ: Delay loop (code + timing calc)
10. **Exercise:** 4 bài tập
11. **Summary**
12. **Q&A**

### Template 2.3: Lab Report — Lập trình vi điều khiển
**8 slides** — Tương tự cấu trúc Lab Report chuẩn, nội dung: đọc ADC, điều khiển LED, giao tiếp UART.

### Template 2.4: Seminar — IoT và Vi xử lý
**7 slides** — ESP32/STM32 trong IoT, sensor integration, wireless protocols.

### Template 2.5: Project Presentation — Đồ án vi xử lý
**9 slides** — Cấu trúc project, hardware schematic, PCB layout, firmware flowchart.

---

## Subject 3: Lý thuyết mạch (Circuit Theory)

**Color Scheme:** `primary: #00ff87`, `bg: #0d1b0e`, `text: #d0ffe0`, `accent: #4ecdc4`

### Template 3.1: Bài giảng tổng quan — Mạch điện cơ bản
**10 slides:**
1. **Title:** "Phân tích mạch điện tuyến tính"
2. **Outline:** Kirchhoff → Thevenin/Norton → Mạch RLC → Đáp ứng tần số → Bode
3. **Content:** Định luật Kirchhoff — KVL, KCL với LaTeX: `$\sum V = 0$`, `$\sum I = 0$`
4. **Content:** Phương pháp dòng nhánh — Lập hệ phương trình (LaTeX matrix)
5. **Content:** Định lý Thevenin & Norton — Sơ đồ tương đương
6. **Content:** Mạch RLC nối tiếp — Phương trình vi phân, đáp ứng tự do
7. **Content:** Phân tích tần số — Hàm truyền `$H(j\omega) = \frac{V_o}{V_i}$`
8. **Content:** Biểu đồ Bode — Vẽ biểu đồ biên độ + pha
9. **Summary:** Tóm tắt công thức chính
10. **Q&A**

**Đặc điểm:**
- Sử dụng LaTeX nặng cho tất cả công thức
- Slide 6: Sơ đồ mạch RLC bằng shapes (resistor = rectangle, capacitor = parallel lines, inductor = coils)
- Slide 8: Chart element cho biểu đồ Bode (2 charts: magnitude + phase)

### Template 3.2: Bài giảng chi tiết — Mạch lọc tần số
**12 slides:**
1. **Title:** "Mạch lọc tần số RC, RL, RLC"
2. **Objectives**
3. **Theory:** Mạch lọc thông thấp RC — Sơ đồ + hàm truyền `$H(s) = \frac{1}{1+sRC}$`
4. **Theory:** Mạch lọc thông cao RC — Sơ đồ + hàm truyền
5. **Theory:** Mạch lọc thông dải RLC — Sơ đồ + bandwidth, Q-factor
6. **Theory:** Mạch lọc chắn dải RLC — Sơ đồ + tần số cộng hưởng
7. **Theory:** Biểu đồ Bode cho mỗi loại — 4 biểu đồ (Chart elements)
8. **Example:** Thiết kế mạch lọc thông thấp fc=1kHz
9. **Example:** Thiết kế mạch lọc thông dải
10. **Exercise**
11. **Summary**
12. **Q&A**

### Template 3.3: Lab Report — TN mạch RLC
**8 slides** — Đo tần số cộng hưởng, Q-factor, đáp ứng tần số bằng oscilloscope.

### Template 3.4: Seminar — Ứng dụng mạch lọc trong viễn thông
**7 slides** — Filter design for RF, DSP filter, adaptive filters.

### Template 3.5: Project Presentation — Đồ án lý thuyết mạch
**9 slides** — Phân tích mạch phức tạp, mô phỏng LTSpice/MATLAB.

---

## Implementation Steps (chi tiết cho toàn bộ P0)

### Step 1: Tạo helper function sinh template (30 min)
Tạo script Node.js để generate template JSON entries. Tránh viết thủ công hàng nghìn dòng JSON.

```javascript
// scripts/generate-templates.js
function createSlide({ title, content, bg, elements, notes }) {
  return {
    id: `s-${Math.random().toString(36).slice(2, 10)}`,
    elements: elements || [
      titleElement(title),
      contentElement(content),
    ],
    background: bg || { type: 'color', color: '#0a1628' },
    notes: notes || '',
  };
}

function createTemplate({ id, category, title, description, tags, colorScheme, slides }) {
  return {
    id,
    category,
    title,
    description,
    tags,
    difficulty: 'intermediate',
    thumbnail: {
      type: 'gradient',
      gradient: `linear-gradient(135deg, ${colorScheme.bg}, ${colorScheme.primary}20)`,
    },
    colorScheme,
    theme: 'black',
    transition: 'slide',
    slides,
  };
}
```

### Step 2: Tạo 5 templates Kỹ thuật số (2-3 giờ)
Viết đầy đủ từng slide elements theo spec ở trên. Ưu tiên:
- Text boxes với formatted HTML
- Table elements cho bảng chân trị, K-map
- Shape elements cho sơ đồ mạch đơn giản
- LaTeX elements cho công thức Boolean
- Code blocks cho VHDL/Verilog snippets

### Step 3: Tạo 5 templates Vi xử lý (2-3 giờ)
- Code blocks cho Assembly, C
- Shape diagrams cho CPU architecture
- Table elements cho instruction sets

### Step 4: Tạo 5 templates Lý thuyết mạch (2-3 giờ)
- LaTeX nặng cho công thức
- Chart elements cho Bode plots
- Shape elements cho sơ đồ mạch

### Step 5: Merge vào built-in-templates.json (30 min)
Chạy script generate → merge JSON → verify.

### Step 6: Test (1 giờ)
- Mỗi template: click Use → verify presentation created đúng
- Check special elements: LaTeX render, tables display, charts work
- Export HTML → verify offline

## Todo List

- [ ] Tạo helper script generate-templates.js
- [ ] **Kỹ thuật số:**
  - [ ] Template 1.1: Bài giảng tổng quan — Cổng logic
  - [ ] Template 1.2: Bài giảng chi tiết — Flip-Flop
  - [ ] Template 1.3: Lab Report — TN cổng logic
  - [ ] Template 1.4: Seminar — FPGA
  - [ ] Template 1.5: Project — Đồ án thiết kế số
- [ ] **Vi xử lý:**
  - [ ] Template 2.1: Bài giảng tổng quan — Kiến trúc CPU
  - [ ] Template 2.2: Bài giảng chi tiết — Assembly
  - [ ] Template 2.3: Lab Report — Vi điều khiển
  - [ ] Template 2.4: Seminar — IoT
  - [ ] Template 2.5: Project — Đồ án VXL
- [ ] **Lý thuyết mạch:**
  - [ ] Template 3.1: Bài giảng tổng quan — Mạch điện
  - [ ] Template 3.2: Bài giảng chi tiết — Mạch lọc
  - [ ] Template 3.3: Lab Report — TN RLC
  - [ ] Template 3.4: Seminar — Viễn thông
  - [ ] Template 3.5: Project — Đồ án LTM
- [ ] Merge JSON + test tất cả templates
- [ ] Verify LaTeX, Table, Chart rendering

## Success Criteria
- 15 templates tạo thành công, load trong Marketplace
- Mỗi template có 6-12 slides với đầy đủ content
- LaTeX formulas render đúng
- Tables hiển thị có header + data rows
- Filter by category "Kỹ thuật số" → 5 results

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| JSON quá lớn (15 templates × 10 slides × 5-6 elements) | Minimize whitespace, lazy load |
| LaTeX syntax errors trong template content | Test render cho mỗi formula |
| Shapes không đủ diễn tả sơ đồ mạch phức tạp | Dùng HTML embed cho sơ đồ phức tạp |
