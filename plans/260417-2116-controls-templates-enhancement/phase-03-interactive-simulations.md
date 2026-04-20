# Phase 3: Interactive Simulation Templates

## Context
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json) — 53 templates, ~911KB
- [marketplace.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/marketplace.js) — 17 categories
- [htmlGenerator.js:115-118](file:///d:/NCKH_2025/revealjs_gui/shared/src/htmlGenerator.js#L115-L118) — HTML embed iframe rendering
- Existing interactive templates đã có (Phase 5 của plan 260415)

## Overview
- Priority: P1
- Status: ✅ Completed
- Thêm 10 interactive simulation templates mới vào built-in-templates.json

## Requirements

### Functional
1. 10 simulation templates — mỗi template có 5-8 slides
2. Mỗi simulation template chứa ít nhất 1 slide với `html` embed element có JavaScript tương tác
3. Thêm 4 categories mới vào marketplace
4. Simulations phải work cả online lẫn offline (inline JS, không CDN)

### 10 Simulation Templates

| # | Template ID | Category | Simulation |
|---|------------|----------|------------|
| 1 | `sim-ohm-law` | circuit-theory | Ohm's Law calculator — 3 sliders V/I/R, real-time update |
| 2 | `sim-binary-converter` | digital-electronics | Dec↔Bin↔Hex↔Oct converter — input fields + auto convert |
| 3 | `sim-logic-gates` | digital-electronics | Click inputs toggle 0/1, see gate output — AND/OR/NOT/NAND/NOR/XOR |
| 4 | `sim-sorting-algo` | computer-science | Visual bubble sort — click "Step" to animate one swap |
| 5 | `sim-pid-controller` | automation | PID tuning — Kp/Ki/Kd sliders, step response canvas |
| 6 | `sim-projectile` | physics | Projectile motion — angle + velocity → trajectory canvas |
| 7 | `sim-resistor-color` | electronics | 4-band resistor color code → value calculator |
| 8 | `sim-signal-wave` | signal-processing | Sine/Square/Triangle wave generator — freq + amp sliders |
| 9 | `sim-matrix-calc` | mathematics | 2×2 matrix operations — add/multiply/determinant/inverse |
| 10 | `sim-newton-force` | physics | Force vector diagram — drag force arrows, see net force |

### Categories mới
```
{ id: 'computer-science', name: 'Tin học', nameEn: 'Computer Science', icon: 'code' }
{ id: 'physics', name: 'Vật lý', nameEn: 'Physics', icon: 'atom' }
{ id: 'mathematics', name: 'Toán học', nameEn: 'Mathematics', icon: 'sigma' }
{ id: 'signal-processing', name: 'Xử lý tín hiệu', nameEn: 'Signal Processing', icon: 'activity' }
```

## Architecture

### Simulation HTML Embed Pattern
Mỗi simulation là 1 self-contained HTML document (trong `content` field của html element):
```html
<!DOCTYPE html>
<html>
<head>
  <style>/* inline CSS */</style>
</head>
<body>
  <div id="controls"><!-- sliders, inputs --></div>
  <canvas id="canvas" width="460" height="300"></canvas>
  <script>
    // Pure vanilla JS — no external dependencies
    // All math + rendering inline
  </script>
</body>
</html>
```

### Template Structure per Simulation
```
Slide 1: Title slide — tên simulation, mô tả ngắn
Slide 2: Lý thuyết — text + LaTeX formulas
Slide 3: Interactive simulation — html embed element (full slide)
Slide 4: Hướng dẫn / Explanation — text + callouts
Slide 5: Bài tập — text with exercises
```

## Related Code Files

### Modify
- `server/data/built-in-templates.json` — Append 10 simulation templates
- `server/routes/marketplace.js` — Add 4 new categories

### Create
- (none — all content goes into existing JSON file)

## Implementation Steps

1. **Add new categories to marketplace.js**
   - Add `computer-science`, `physics`, `mathematics`, `signal-processing` to CATEGORIES array

2. **Create simulation templates — each template follows the 5-slide structure**

   **sim-ohm-law** (circuit-theory):
   - HTML simulation: 3 range sliders (V: 0-24V, I: 0-10A, R: 0-100Ω)
   - Lock one variable, adjust other two
   - Real-time display: V = I × R with colored indicators
   - Canvas: simple circuit diagram (battery + resistor)

   **sim-binary-converter** (digital-electronics):
   - HTML simulation: 4 input fields (Dec, Bin, Hex, Oct)
   - Type in any field → auto-convert all others
   - Bit visualization: 8 toggleable bit boxes
   - Color-coded: decimal=blue, binary=green, hex=orange, octal=purple

   **sim-logic-gates** (digital-electronics):
   - HTML simulation: Select gate type from dropdown
   - 2 clickable input circles (toggle 0/1)
   - Gate symbol drawn on canvas
   - Output circle shows result with color (green=1, red=0)

   **sim-sorting-algo** (computer-science):
   - HTML simulation: Array of 8 colored bars
   - "Step" button advances bubble sort by one comparison
   - "Reset" button randomizes
   - Highlighting current comparison pair
   - Step counter display

   **sim-pid-controller** (automation):
   - HTML simulation: 3 sliders (Kp: 0-10, Ki: 0-5, Kd: 0-5)
   - Canvas draws step response curve
   - Shows overshoot %, settling time, steady-state error
   - Simple discrete PID simulation (100 time steps)

   **sim-projectile** (physics):
   - HTML simulation: angle slider (0-90°), velocity slider (1-50 m/s)
   - Canvas draws parabolic trajectory
   - Shows max height, range, time of flight
   - Animated dot following trajectory on "Launch" button

   **sim-resistor-color** (electronics):
   - HTML simulation: 4 dropdown selects (band 1-4 colors)
   - SVG resistor body with colored bands
   - Calculated resistance value display
   - Tolerance display from 4th band

   **sim-signal-wave** (signal-processing):
   - HTML simulation: wave type select (sine/square/triangle/sawtooth)
   - Frequency slider (1-20 Hz), Amplitude slider (0-1)
   - Canvas renders waveform (real-time animation)
   - Shows period, frequency, peak-to-peak values

   **sim-matrix-calc** (mathematics):
   - HTML simulation: 2×2 matrix A input (4 fields), 2×2 matrix B input
   - Operation select: Add, Multiply, Determinant(A), Inverse(A)
   - Result matrix display
   - Step-by-step calculation shown below

   **sim-newton-force** (physics):
   - HTML simulation: 3 force inputs (magnitude + angle)
   - Canvas draws force vectors from center point
   - Net force vector calculated and drawn (dashed, different color)
   - Shows magnitude + direction of resultant

3. **Validate JSON structure**
   - Each template must have: id, category, title, titleVi, description, tags, thumbnail, theme, transition, slides
   - Each slide must have: id, elements[], background

4. **Test simulations**
   - Load each template via TemplateGallery → create presentation
   - Present mode → verify all simulations are interactive
   - Offline export → verify simulations still work

## Todo List

- [x] Add 4 new categories to marketplace.js
- [x] Create sim-ohm-law template (5 slides + HTML simulation)
- [x] Create sim-binary-converter template
- [x] Create sim-logic-gates template
- [x] Create sim-sorting-algo template
- [x] Create sim-pid-controller template
- [x] Create sim-projectile template
- [x] Create sim-resistor-color template
- [x] Create sim-signal-wave template
- [x] Create sim-matrix-calc template
- [x] Create sim-newton-force template
- [x] Validate built-in-templates.json (JSON.parse)
- [x] Test all simulations in present mode
- [x] Test offline export for simulations

## Success Criteria
- ✅ 63 total built-in templates (53 + 10 new)
- ✅ 21 categories total (17 + 4 new)
- ✅ All 10 simulations interactive in present mode
- ✅ No CDN dependencies in simulation HTML
- ✅ Build passes, no JSON errors

## Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON file grows to ~1.5MB | Medium | minify template data, cache with TTL |
| Complex simulations too large for JSON string | Medium | Keep each HTML under 5KB |
| Canvas simulations don't scale | Low | Use percentage-based sizing |
