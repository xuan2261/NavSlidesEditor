# Phase 05: Interactive Simulation Templates

## Context Links

- [Toolbar.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/Toolbar.jsx) — onAddHtml handler
- [htmlGenerator.js](file:///d:/NCKH_2025/revealjs_gui/shared/src/htmlGenerator.js) — HTML element rendering
- [presentations.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/presentations.js) — Template → Presentation flow

## Overview

- **Priority:** P1
- **Status:** ⬜ Pending
- **Effort:** 3-4 ngày
- **Depends on:** Phase 01
- Tạo 6 interactive simulation templates sử dụng HTML embed elements.
- Mỗi simulation là 1 self-contained HTML snippet (HTML + CSS + JS inline) chạy trong iframe.
- User click "Use Template" → presentation có slide chứa interactive demo.

## Key Insights

- Platform đã hỗ trợ HTML embed element type — chạy trong iframe sandboxed
- `htmlGenerator.js` render HTML elements thành `<iframe srcdoc="...">` trong present mode
- Simulations phải self-contained: không phụ thuộc CDN (hoạt động offline)
- Canvas size: 960×540, HTML element có thể chiếm toàn slide hoặc 1 phần

## Requirements

### Functional

1. 6 interactive simulations cho 6 chủ đề
2. Mỗi simulation có UI controls (buttons, sliders, dropdowns)
3. Real-time visualization (canvas/SVG animation)
4. Responsive trong iframe (scale theo element size)
5. Hoạt động trong present mode + export HTML

### Non-functional

- Mỗi HTML snippet < 50KB (tránh JSON quá lớn)
- Render < 100ms trên thiết bị trung bình
- Touch-friendly controls (slider, buttons đủ lớn)

## Architecture

### HTML Embed Element Structure

```json
{
  "type": "html",
  "x": 20,
  "y": 20,
  "width": 920,
  "height": 500,
  "zIndex": 1,
  "htmlContent": "<html>...self-contained simulation...</html>"
}
```

### Simulation Template Structure

Mỗi template simulation có 4-5 slides:

1. **Title:** Giới thiệu simulation
2. **Theory:** Lý thuyết ngắn gọn (text + LaTeX)
3. **Interactive Demo:** HTML embed element chiếm ~90% slide
4. **Instructions:** Hướng dẫn sử dụng
5. **Q&A**

---

## Simulation 1: Logic Gate Simulator (Kỹ thuật số)

**Category:** `digital-electronics`
**Mô tả:** Click input buttons (0/1) → xem output qua các cổng logic.

### HTML Snippet Spec:

```html
<!-- ~200 lines, self-contained -->
<style>
  * {
    margin: 0;
    box-sizing: border-box;
    font-family: 'Segoe UI', sans-serif;
  }
  body {
    background: #0a1628;
    color: #e0f2ff;
    padding: 16px;
  }
  .gate-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .gate-card {
    background: #0f2040;
    border: 1px solid #00d4ff30;
    border-radius: 8px;
    padding: 12px;
  }
  .gate-name {
    font-size: 14px;
    font-weight: 700;
    color: #00d4ff;
    margin-bottom: 8px;
  }
  .input-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 4px 0;
  }
  .input-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid #00d4ff;
    background: transparent;
    color: #e0f2ff;
    font-size: 16px;
    cursor: pointer;
  }
  .input-btn.on {
    background: #00d4ff;
    color: #0a1628;
  }
  .output {
    font-size: 24px;
    font-weight: 700;
    margin-top: 8px;
  }
  .output.high {
    color: #00ff87;
  }
  .output.low {
    color: #ff4757;
  }
</style>
<div>
  <h3 style="text-align:center;margin-bottom:12px">🔌 Logic Gate Simulator</h3>
  <p style="text-align:center;font-size:12px;color:#e0f2ff80;margin-bottom:16px">
    Click inputs (0/1) to see gate outputs
  </p>
  <div class="gate-grid" id="gates"></div>
</div>
<script>
  const GATES = [
    { name: 'AND', fn: (a, b) => a & b, symbol: '·' },
    { name: 'OR', fn: (a, b) => a | b, symbol: '+' },
    { name: 'NAND', fn: (a, b) => ~(a & b) & 1, symbol: '⊼' },
    { name: 'NOR', fn: (a, b) => ~(a | b) & 1, symbol: '⊽' },
    { name: 'XOR', fn: (a, b) => a ^ b, symbol: '⊕' },
    { name: 'XNOR', fn: (a, b) => ~(a ^ b) & 1, symbol: '⊙' },
    { name: 'NOT A', fn: (a) => ~a & 1, symbol: '¬', unary: true },
    { name: 'BUFFER', fn: (a) => a, symbol: '▷', unary: true },
  ]
  const container = document.getElementById('gates')
  GATES.forEach((gate) => {
    const card = document.createElement('div')
    card.className = 'gate-card'
    let a = 0,
      b = 0
    const update = () => {
      const out = gate.unary ? gate.fn(a) : gate.fn(a, b)
      outEl.textContent = `Output: ${out}`
      outEl.className = `output ${out ? 'high' : 'low'}`
      btnA.className = `input-btn ${a ? 'on' : ''}`
      if (btnB) btnB.className = `input-btn ${b ? 'on' : ''}`
    }
    card.innerHTML = `<div class="gate-name">${gate.symbol} ${gate.name}</div>`
    const row = document.createElement('div')
    row.className = 'input-row'
    const btnA = document.createElement('button')
    btnA.className = 'input-btn'
    btnA.textContent = 'A:0'
    btnA.onclick = () => {
      a = 1 - a
      btnA.textContent = `A:${a}`
      update()
    }
    row.appendChild(btnA)
    let btnB
    if (!gate.unary) {
      btnB = document.createElement('button')
      btnB.className = 'input-btn'
      btnB.textContent = 'B:0'
      btnB.onclick = () => {
        b = 1 - b
        btnB.textContent = `B:${b}`
        update()
      }
      row.appendChild(btnB)
    }
    card.appendChild(row)
    const outEl = document.createElement('div')
    outEl.className = 'output low'
    outEl.textContent = 'Output: 0'
    card.appendChild(outEl)
    container.appendChild(card)
  })
</script>
```

---

## Simulation 2: RLC Circuit Response (Lý thuyết mạch)

**Category:** `circuit-theory`
**Mô tả:** 3 sliders (R, L, C) → vẽ đáp ứng tần số real-time trên canvas.

### HTML Snippet Spec (~250 lines):

- **Controls:** 3 range sliders cho R (1-10kΩ), L (1-100mH), C (1-100nF)
- **Display:** Canvas 2D vẽ biểu đồ magnitude response |H(jω)|
- **Math:** `H(jω) = 1 / (1 - ω²LC + jωRC)` — tính cho ω từ 1 đến 100kHz
- **Features:**
  - Resonant frequency marker: `f₀ = 1/(2π√LC)` hiển thị trên biểu đồ
  - Q-factor hiển thị: `Q = (1/R)√(L/C)`
  - Bandwidth: `BW = f₀/Q`
  - Logarithmic frequency axis
  - Grid lines + axis labels
- **Color:** Green theme (#00ff87 traces, #0d1b0e background)

---

## Simulation 3: PID Controller Tuning (Tự động hoá)

**Category:** `automation`
**Mô tả:** 3 sliders (Kp, Ki, Kd) → step response animation real-time.

### HTML Snippet Spec (~300 lines):

- **Controls:** 3 range sliders:
  - Kp: 0.1 - 10.0 (step 0.1)
  - Ki: 0.0 - 5.0 (step 0.1)
  - Kd: 0.0 - 5.0 (step 0.1)
- **Display:** Canvas vẽ step response y(t) + setpoint
- **Plant model:** Second-order system `G(s) = 1/(s² + 2s + 1)`
- **PID:** `C(s) = Kp + Ki/s + Kd·s`
- **Simulation:** Euler method, dt=0.01, simulate 10s
- **Metrics hiển thị:**
  - Rise time, settling time, overshoot %, steady-state error
  - Color-coded (green=good, yellow=ok, red=bad)
- **Features:**
  - "Reset" button
  - Preset buttons: "P only", "PI", "PID", "Ziegler-Nichols"
  - Animated trace drawing
- **Color:** Red theme (#ff4757 traces, #1a0a0e background)

---

## Simulation 4: Bode Plot Generator (Lý thuyết mạch / Tự động)

**Category:** `circuit-theory`
**Mô tả:** Nhập hàm truyền (poles/zeros) → vẽ biểu đồ Bode magnitude + phase.

### HTML Snippet Spec (~250 lines):

- **Input:** Text fields cho:
  - Numerator coefficients: e.g. "1, 0" → s + 0
  - Denominator coefficients: e.g. "1, 2, 1" → s² + 2s + 1
  - Gain K: number input
- **Display:** 2 canvas stacked vertically:
  - Top: Magnitude (dB) vs log(ω) — với grid lines
  - Bottom: Phase (degrees) vs log(ω)
- **Features:**
  - Preset buttons: "Low-pass RC", "High-pass RC", "Band-pass RLC", "2nd order"
  - Gain/Phase margin markers
  - Cursor following: hover → show frequency + magnitude + phase
- **Color:** Green/Teal theme

---

## Simulation 5: 3-Phase Power System Visualizer (Điện)

**Category:** `electrical`
**Mô tả:** Animation 3 pha quay với vector diagram.

### HTML Snippet Spec (~200 lines):

- **Display:** Canvas vẽ:
  - 3 sinewave (R=red, Y=yellow, B=blue) amplitude vs time
  - Rotating phasor diagram (3 vectors 120° apart)
- **Controls:**
  - Frequency slider (50Hz ± 20%)
  - Amplitude slider
  - Phase imbalance slider (0-30°)
  - Play/Pause button
- **Formulas hiển thị:**
  - `Va = Vm·sin(ωt)`, `Vb = Vm·sin(ωt - 120°)`, `Vc = Vm·sin(ωt + 120°)`
  - `Vline = √3 × Vphase`
- **Animation:** requestAnimationFrame, smooth 60fps

---

## Simulation 6: Gear Train Simulator (Cơ khí)

**Category:** `mechanical`
**Mô tả:** Animation bánh răng ăn khớp, thay đổi tỷ số truyền.

### HTML Snippet Spec (~200 lines):

- **Display:** Canvas vẽ:
  - 2-3 bánh răng ăn khớp (drawn as circles with teeth)
  - Rotation animation, speed proportional to gear ratio
- **Controls:**
  - Driver gear teeth (Z1): slider 10-50
  - Driven gear teeth (Z2): slider 10-50
  - Input RPM: slider 100-3000
- **Calculations hiển thị:**
  - Gear ratio: `i = Z2/Z1`
  - Output RPM: `n2 = n1 × Z1/Z2`
  - Output torque: `T2 = T1 × Z2/Z1`
- **Animation:** Gear teeth mesh visually, rotation speed changes real-time

---

## Implementation Steps

### Step 1: Tạo Simulation 1 — Logic Gates (2-3 giờ)

Viết HTML snippet đầy đủ, test trong browser, embed vào template JSON.

**Test method:**

1. Save HTML to temp file → mở trong browser → verify tương tác
2. Tạo template entry trong built-in-templates.json
3. `npm run dev` → Marketplace → Use template → verify HTML element render

### Step 2: Tạo Simulation 2 — RLC Response (3-4 giờ)

Canvas-based frequency response. Cần math: complex number evaluation.

### Step 3: Tạo Simulation 3 — PID Tuning (3-4 giờ)

Euler simulation loop. Most complex — animated step response.

### Step 4: Tạo Simulation 4 — Bode Plot (2-3 giờ)

Polynomial evaluation, logarithmic axes.

### Step 5: Tạo Simulation 5 — 3-Phase (2-3 giờ)

requestAnimationFrame, phasor rotation, multiple sinewaves.

### Step 6: Tạo Simulation 6 — Gear Train (2-3 giờ)

Gear teeth drawing algorithm, mesh animation.

### Step 7: Integrate into templates (1 giờ)

Wrap each simulation as a complete template (Title + Theory + Demo + Instructions + Q&A).

### Step 8: Test all simulations (1 giờ)

- In editor: HTML element visible, resizable
- In present mode: interactive, controls work
- Export HTML: simulations functional offline

## Todo List

- [ ] Sim 1: Logic Gate Simulator
- [ ] Sim 2: RLC Circuit Response
- [ ] Sim 3: PID Controller Tuning
- [ ] Sim 4: Bode Plot Generator
- [ ] Sim 5: 3-Phase Visualizer
- [ ] Sim 6: Gear Train Simulator
- [ ] Wrap simulations in templates
- [ ] Test in editor mode
- [ ] Test in present mode
- [ ] Test offline export

## Success Criteria

- 6 simulations hoạt động trong present mode
- Controls responsive (sliders, buttons)
- Canvas renders smooth (>30fps)
- Export HTML offline → simulations vẫn work
- Mỗi HTML snippet < 50KB

## Risk Assessment

| Risk                                | Impact | Mitigation                          |
| ----------------------------------- | ------ | ----------------------------------- |
| iframe sandbox blocks scripts       | High   | Verify sandbox="allow-scripts"      |
| Canvas DPI scaling trên Retina      | Medium | Use devicePixelRatio                |
| JSON escape issues cho HTML content | High   | Properly escape quotes, newlines    |
| Large HTML snippets bloat JSON      | Medium | Minify HTML before embedding        |
| Touch events on mobile              | Low    | Use pointer events instead of mouse |

## Security Considerations

- HTML embeds run in sandboxed iframes — no access to parent DOM
- No external network requests in simulations
- No localStorage/cookie usage
- All math computation is client-side only
