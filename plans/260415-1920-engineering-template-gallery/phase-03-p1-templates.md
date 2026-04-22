# Phase 03: P1 Templates — Kỹ thuật Điện tử + Tự động hoá + Điện

## Context Links

- [Phase 02](./phase-02-p0-templates.md) — Slide structure standards & helper script
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json)

## Overview

- **Priority:** P1
- **Status:** ⬜ Pending
- **Effort:** 3-4 ngày
- **Depends on:** Phase 01 + Phase 02 (reuse helper script + slide standards)
- Tạo 15 templates (5/môn × 3 môn) cho nhóm ưu tiên trung bình.

---

## Subject 4: Kỹ thuật Điện tử (Electronics Engineering)

**Color:** `primary: #ffd700`, `bg: #1a1200`, `text: #fff5d0`

### Template 4.1: Bài giảng tổng quan — Linh kiện bán dẫn

**10 slides:**

1. Title: "Linh kiện bán dẫn & Mạch khuếch đại"
2. Outline: Diode → BJT → MOSFET → Op-Amp → Mạch ứng dụng
3. Content: Diode bán dẫn — Đặc tuyến I-V, mạch chỉnh lưu (shapes cho sơ đồ mạch)
4. Content: Transistor BJT — Cấu tạo NPN/PNP, 3 chế độ hoạt động
5. Content: BJT Amplifier — Common Emitter, latex: `$A_v = -g_m R_C$`
6. Content: MOSFET — Enhancement vs Depletion, đặc tuyến output
7. Content: Op-Amp lý tưởng — Luật vàng: `$V^+ = V^-$`, `$I_{in} = 0$`
8. Content: Mạch khuếch đại Op-Amp — Inverting + Non-inverting (2-column layout)
9. Summary: Bảng so sánh BJT vs MOSFET vs Op-Amp (Table element)
10. Q&A

### Template 4.2: Bài giảng chi tiết — Mạch khuếch đại thuật toán

**12 slides** — Op-amp configurations: Summer, Diff, Integrator, Differentiator, Active Filter, Comparator, Schmitt trigger.

### Template 4.3: Lab Report — Khảo sát đặc tuyến BJT

**8 slides** — Đo Ic-Vce, Ic-Ib, xác định β, vùng hoạt động.

### Template 4.4: Seminar — Analog vs Digital Signal Processing

**7 slides** — ADC/DAC, sampling theorem, anti-aliasing filter.

### Template 4.5: Project — Thiết kế mạch nguồn/khuếch đại

**9 slides** — Schematic, PCB, BOM, test results.

---

## Subject 5: Tự động hoá (Automation & Control)

**Color:** `primary: #ff4757`, `bg: #1a0a0e`, `text: #ffd5d0`

### Template 5.1: Bài giảng tổng quan — Hệ thống điều khiển tự động

**10 slides:**

1. Title: "Cơ sở Điều khiển Tự động"
2. Outline: Open/Closed loop → Transfer function → Stability → PID → PLC
3. Content: Hệ thống vòng hở vs vòng kín — Block diagram (shapes)
4. Content: Hàm truyền — LaTeX: `$G(s) = \frac{Y(s)}{X(s)} = \frac{K}{s^2 + 2\zeta\omega_n s + \omega_n^2}$`
5. Content: Sơ đồ khối — Nối tiếp, song song, phản hồi (shape diagrams)
6. Content: Ổn định — Routh-Hurwitz, Nyquist criterion
7. Content: Bộ điều khiển PID — `$u(t) = K_p e(t) + K_i \int e(t)dt + K_d \frac{de}{dt}$`
8. Content: PLC cơ bản — Kiến trúc, ngôn ngữ Ladder
9. Summary: So sánh P, PI, PD, PID (Table)
10. Q&A

**Đặc điểm:**

- Slide 3,5: Block diagrams dùng shape+arrow elements
- Slide 7: PID formula dùng LaTeX block
- Slide 8: Ladder diagram dùng HTML embed hoặc shapes

### Template 5.2: Bài giảng chi tiết — Thiết kế bộ điều khiển PID

**12 slides** — Ziegler-Nichols tuning, Root Locus, Bode compensation, Simulink demo.

### Template 5.3: Lab Report — TN bộ điều khiển PID

**8 slides** — Điều khiển nhiệt độ/tốc độ motor, đo step response.

### Template 5.4: Seminar — SCADA và Industry 4.0

**7 slides** — SCADA architecture, HMI, IIoT, OPC-UA, digital twin.

### Template 5.5: Project — Đồ án hệ thống điều khiển

**9 slides** — Plant modeling, controller design, MATLAB/Simulink, hardware implementation.

---

## Subject 6: Điện (Electrical Engineering)

**Color:** `primary: #4ecdc4`, `bg: #0a1a18`, `text: #d0fff5`

### Template 6.1: Bài giảng tổng quan — Máy điện & Hệ thống điện

**10 slides:**

1. Title: "Máy điện và Hệ thống cung cấp điện"
2. Outline
3. Content: Máy biến áp — Nguyên lý, sơ đồ tương đương, LaTeX: `$\frac{V_1}{V_2} = \frac{N_1}{N_2}$`
4. Content: Động cơ không đồng bộ — Cấu tạo rotor lồng sóc, đặc tuyến moment-tốc độ
5. Content: Động cơ đồng bộ — V-curve, ứng dụng
6. Content: Hệ thống 3 pha — Đấu Y/Δ, LaTeX: `$V_{dây} = \sqrt{3} V_{pha}$`
7. Content: Sơ đồ cung cấp điện — Trạm biến áp, đường dây, phụ tải
8. Content: Bảo vệ rơle — Rơle quá dòng, rơle khoảng cách
9. Summary
10. Q&A

### Template 6.2: Bài giảng chi tiết — Hệ thống điện 3 pha

**12 slides** — Cân bằng/mất cân bằng, công suất 3 pha, đo công suất bằng Wattmeter.

### Template 6.3: Lab Report — TN máy biến áp

**8 slides** — Thí nghiệm không tải, ngắn mạch, xác định tham số.

### Template 6.4: Seminar — Năng lượng tái tạo

**7 slides** — Solar PV, wind turbine, grid integration, MPPT.

### Template 6.5: Project — Thiết kế hệ thống cung cấp điện

**9 slides** — Single-line diagram, load calculation, transformer selection, protection.

---

## Implementation Steps

### Step 1: Reuse helper script từ Phase 02 (10 min)

Import `generate-templates.js`, cập nhật color schemes cho 3 môn mới.

### Step 2: Tạo 5 templates Điện tử (2-3 giờ)

Ưu tiên LaTeX cho công thức mạch, shapes cho schematic đơn giản.

### Step 3: Tạo 5 templates Tự động hoá (2-3 giờ)

Block diagrams bằng shapes. PID formula bằng LaTeX.

### Step 4: Tạo 5 templates Điện (2-3 giờ)

3-phase diagrams, transformer equivalent circuits.

### Step 5: Merge + Test (1 giờ)

## Todo List

- [ ] **Kỹ thuật Điện tử:**
  - [ ] 4.1: BG tổng quan — Bán dẫn
  - [ ] 4.2: BG chi tiết — Op-Amp
  - [ ] 4.3: Lab Report — BJT
  - [ ] 4.4: Seminar — Analog vs Digital
  - [ ] 4.5: Project — Mạch nguồn
- [ ] **Tự động hoá:**
  - [ ] 5.1: BG tổng quan — Điều khiển
  - [ ] 5.2: BG chi tiết — PID
  - [ ] 5.3: Lab Report — PID
  - [ ] 5.4: Seminar — SCADA
  - [ ] 5.5: Project — Hệ thống ĐK
- [ ] **Điện:**
  - [ ] 6.1: BG tổng quan — Máy điện
  - [ ] 6.2: BG chi tiết — 3 pha
  - [ ] 6.3: Lab Report — MBA
  - [ ] 6.4: Seminar — NL tái tạo
  - [ ] 6.5: Project — CCĐ
- [ ] Merge JSON + test

## Success Criteria

- 15 templates mới (tổng 30 sau Phase 02)
- Filter "Tự động hoá" → 5 results
- Block diagrams render đúng (shapes + arrows)
- LaTeX formulas hiển thị đúng trong present mode
