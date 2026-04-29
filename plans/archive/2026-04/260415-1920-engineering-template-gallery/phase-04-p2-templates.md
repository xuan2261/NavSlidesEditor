# Phase 04: P2 Templates — Đo lường + ĐTCS + Cơ khí + VKT + Thuỷ khí

## Context Links

- [Phase 02](./phase-02-p0-templates.md) — Slide standards & helper script
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json)

## Overview

- **Priority:** P2
- **Status:** ⬜ Pending
- **Effort:** 3-4 ngày
- **Depends on:** Phase 01 + Phase 02
- 5 môn × 3 templates/môn (giảm xuống 3 do priority thấp) = 15 templates.
- Chỉ tạo: Bài giảng tổng quan + Lab Report + Project Presentation.

> [!NOTE]
> P2 giảm xuống 3 templates/môn thay vì 5 để kiểm soát scope. Thêm Seminar + BG chi tiết sau nếu cần.

---

## Subject 7: Đo lường điện (Electrical Measurement)

**Color:** `primary: #a8e6cf`, `bg: #0e1a14`, `text: #d5ffe8`

### Template 7.1: Bài giảng tổng quan — Cơ sở đo lường

**10 slides:**

1. Title: "Đo lường đại lượng điện"
2. Outline: Sai số → Cơ cấu đo → Cầu đo → Oscilloscope → Sensor
3. Content: Sai số đo lường — Sai số tuyệt đối, tương đối, hệ thống, ngẫu nhiên. LaTeX: `$\delta = \frac{\Delta X}{X_{true}} \times 100\%$`
4. Content: Cơ cấu đo — Từ điện, điện từ, điện động (diagram shapes)
5. Content: Cầu đo Wheatstone — Sơ đồ mạch cầu, điều kiện cân bằng: `$R_x = \frac{R_2 R_3}{R_1}$`
6. Content: Oscilloscope — Cấu tạo, đọc tín hiệu, đo Vpp, frequency
7. Content: Sensor & Transducer — Nhiệt độ (RTD, thermocouple), áp suất, vị trí
8. Content: Đo công suất — Wattmeter, công suất AC 3 pha
9. Summary: Bảng tổng hợp phương pháp đo (Table)
10. Q&A

### Template 7.2: Lab Report — Đo đại lượng điện

**8 slides** — Sử dụng DMM, oscilloscope đo R/L/C, so sánh cầu đo vs DMM.

### Template 7.3: Project — Thiết kế hệ thống đo

**9 slides** — Sensor selection, signal conditioning, ADC, display, calibration.

---

## Subject 8: Điện tử công suất (Power Electronics)

**Color:** `primary: #ff8a5c`, `bg: #1a100a`, `text: #ffe0d5`

### Template 8.1: Bài giảng tổng quan — Linh kiện & mạch công suất

**10 slides:**

1. Title: "Điện tử công suất: Linh kiện & Bộ biến đổi"
2. Outline: Thyristor → Chỉnh lưu → Buck/Boost → Inverter → PWM
3. Content: Linh kiện công suất — SCR, TRIAC, IGBT, power MOSFET (Table so sánh)
4. Content: Chỉnh lưu — Nửa chu kỳ, toàn chu kỳ, cầu 3 pha. LaTeX: `$V_{dc} = \frac{V_m}{\pi}$` (nửa CK)
5. Content: Buck converter — Sơ đồ, duty cycle: `$V_o = D \cdot V_{in}$`
6. Content: Boost converter — Sơ đồ, `$V_o = \frac{V_{in}}{1-D}$`
7. Content: Inverter — Half-bridge, full-bridge, 3-phase inverter
8. Content: PWM — Sinusoidal PWM, space vector PWM (waveform diagram)
9. Summary
10. Q&A

### Template 8.2: Lab Report — Mạch chỉnh lưu có điều khiển

**8 slides** — Thyristor firing angle, output voltage measurement, filter.

### Template 8.3: Project — Thiết kế bộ biến đổi DC-DC/inverter

**9 slides** — Schematic, control loop, simulation, prototype.

---

## Subject 9: Cơ khí (Mechanical Engineering)

**Color:** `primary: #95adb6`, `bg: #0f1419`, `text: #dce5e8`

### Template 9.1: Bài giảng tổng quan — Chi tiết máy

**10 slides:**

1. Title: "Chi tiết máy: Truyền động & Liên kết"
2. Outline: Bánh răng → Đai → Xích → Trục → Ổ lăn → Lò xo → Bu lông
3. Content: Truyền động bánh răng — Bánh răng trụ, côn, trục vít. Tỷ số truyền: `$i = \frac{n_1}{n_2} = \frac{z_2}{z_1}$`
4. Content: Truyền động đai — Belt drive, V-belt, timing belt. Công suất truyền
5. Content: Trục & then — Tính toán đường kính trục theo moment xoắn: `$d \geq \sqrt[3]{\frac{16M}{\pi[\tau]}}$`
6. Content: Ổ lăn — Phân loại, tuổi thọ: `$L_{10} = \left(\frac{C}{P}\right)^p \times 10^6$ vòng`
7. Content: Mối ghép bu lông — Siết bu lông, lực kẹp, ứng suất
8. Content: Lò xo — Lò xo nén, kéo, xoắn. `$F = k \cdot x$`
9. Summary: Bảng tóm tắt (Table)
10. Q&A

### Template 9.2: Lab Report — Khảo sát cơ cấu truyền động

**8 slides** — Đo tỷ số truyền, hiệu suất, rung, nhiệt.

### Template 9.3: Project — Thiết kế hệ thống truyền động

**9 slides** — Sơ đồ động học, tính toán hộp số, bản vẽ, chế tạo.

---

## Subject 10: Hình hoạ - Vẽ kỹ thuật (Technical Drawing)

**Color:** `primary: #ddd8c4`, `bg: #141210`, `text: #f0ede0`

### Template 10.1: Bài giảng tổng quan — Cơ sở vẽ kỹ thuật

**10 slides:**

1. Title: "Vẽ kỹ thuật: Tiêu chuẩn & Phương pháp"
2. Outline: Tiêu chuẩn → Đường nét → Hình chiếu → Mặt cắt → Kích thước → Bản vẽ lắp
3. Content: Tiêu chuẩn bản vẽ — Khổ giấy (A0-A4), khung tên, tỷ lệ
4. Content: Các loại đường nét — Nét liền đậm, liền mảnh, đứt, chấm gạch (Table + shape examples)
5. Content: Hình chiếu vuông góc — 6 hướng chiếu, bố trí 3 hình chiếu chính
6. Content: Hình chiếu trục đo — Isometric, dimetric, trimetric
7. Content: Mặt cắt & Hình cắt — Ký hiệu vật liệu, mặt cắt liên tục
8. Content: Ghi kích thước — Quy tắc ghi, dung sai, ký hiệu độ nhám
9. Summary
10. Q&A

**Đặc điểm:** Theme sáng hơn (bg: #f5f0e8) để phù hợp bản vẽ kỹ thuật.

### Template 10.2: Lab Report — Bài tập vẽ kỹ thuật

**8 slides** — Đọc bản vẽ, vẽ hình chiếu thứ 3, bản vẽ chi tiết.

### Template 10.3: Project — Bản vẽ thiết kế sản phẩm

**9 slides** — Ý tưởng → Sketch → Bản vẽ chi tiết → Bản vẽ lắp → BOM.

---

## Subject 11: Thuỷ khí (Fluid Mechanics)

**Color:** `primary: #48bfe3`, `bg: #0a1628`, `text: #d0eeff`

### Template 11.1: Bài giảng tổng quan — Cơ học chất lỏng

**10 slides:**

1. Title: "Cơ học chất lỏng: Tĩnh học & Động học"
2. Outline: Tính chất → Áp suất → Bernoulli → Tổn thất → Bơm → Van
3. Content: Tính chất chất lỏng — Khối lượng riêng, độ nhớt, sức căng bề mặt
4. Content: Tĩnh học — Áp suất thuỷ tĩnh: `$p = p_0 + \rho g h$`
5. Content: Bernoulli — `$\frac{p}{\rho g} + \frac{v^2}{2g} + z = const$`
6. Content: Phương trình liên tục — `$A_1 v_1 = A_2 v_2$`
7. Content: Tổn thất áp suất — Tổn thất dọc đường (Darcy-Weisbach), tổn thất cục bộ
8. Content: Bơm — Đặc tuyến bơm, điểm làm việc, NPSH
9. Summary
10. Q&A

### Template 11.2: Lab Report — Đo lưu lượng & tổn thất

**8 slides** — Rotameter, Venturi, Orifice, đo tổn thất qua van/cua.

### Template 11.3: Project — Thiết kế hệ thống đường ống

**9 slides** — Pipe sizing, pump selection, system curve, control valve.

---

## Implementation Steps

### Step 1: Tạo 3 templates/môn × 5 môn = 15 templates (6-8 giờ)

Reuse helper script, chỉ thay color scheme + content.

### Step 2: Đặc biệt cho Hình hoạ - VKT (1 giờ)

- Dùng theme sáng thay vì tối
- Shapes elements cho ví dụ đường nét, hình chiếu

### Step 3: Merge + Test (1 giờ)

## Todo List

- [ ] **Đo lường:** 7.1 + 7.2 + 7.3
- [ ] **Điện tử CS:** 8.1 + 8.2 + 8.3
- [ ] **Cơ khí:** 9.1 + 9.2 + 9.3
- [ ] **VKT:** 10.1 + 10.2 + 10.3
- [ ] **Thuỷ khí:** 11.1 + 11.2 + 11.3
- [ ] Merge + test all (tổng ~45 templates)

## Success Criteria

- 15 templates mới (tổng ~45 sau Phase 02+03)
- VKT templates dùng light theme
- Tất cả LaTeX formulas render đúng
- Categories filter hoạt động cho cả 11 ngành
