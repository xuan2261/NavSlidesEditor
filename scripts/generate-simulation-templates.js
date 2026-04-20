/**
 * Generate Phase 05: 6 Interactive Simulation Templates
 * Each has: Title slide + Theory slide + Interactive HTML embed slide + Instructions slide + Q&A
 */
const fs = require('fs');
const path = require('path');

// ── Slide helpers (reuse from Phase 03/04) ──
function mkSlide(id, bg, elements) {
  return { id, elements, background: { type: 'color', color: bg } };
}

function titleSlide(id, bg, primary, text, title, subtitle) {
  return mkSlide(id, bg, [
    { type:'shape',shape:'rect',x:0,y:0,width:960,height:8,fill:primary,stroke:'none',strokeWidth:0,locked:true,zIndex:0 },
    { type:'text',x:60,y:100,width:840,height:120,zIndex:1,content:`<h1 style="text-align:center; color:${text}">${title}</h1>` },
    { type:'text',x:160,y:260,width:640,height:60,zIndex:2,content:`<p style="text-align:center; color:${text}80">${subtitle}</p>` },
    { type:'shape',shape:'rect',x:380,y:245,width:200,height:2,fill:`${primary}60`,stroke:'none',strokeWidth:0,locked:true,zIndex:3 }
  ]);
}

function theorySlide(id, bg, primary, text, heading, bodyHtml) {
  return mkSlide(id, bg, [
    { type:'shape',shape:'rect',x:0,y:0,width:960,height:6,fill:primary,stroke:'none',strokeWidth:0,locked:true,zIndex:0 },
    { type:'text',x:40,y:20,width:880,height:50,zIndex:1,content:`<h2 style="color:${primary}">${heading}</h2>` },
    { type:'shape',shape:'rect',x:40,y:70,width:880,height:1,fill:`${primary}30`,stroke:'none',strokeWidth:0,locked:true,zIndex:2 },
    { type:'text',x:40,y:85,width:880,height:430,zIndex:3,content:`<div style="color:${text}; font-size:20px; line-height:1.7">${bodyHtml}</div>` }
  ]);
}

function simSlide(id, bg, primary, htmlContent) {
  return mkSlide(id, bg, [
    { type:'shape',shape:'rect',x:0,y:0,width:960,height:4,fill:primary,stroke:'none',strokeWidth:0,locked:true,zIndex:0 },
    { type:'html',x:10,y:10,width:940,height:520,zIndex:1,content: htmlContent }
  ]);
}

function instrSlide(id, bg, primary, text, instructions) {
  const li = instructions.map(i => `<li>${i}</li>`).join('');
  return mkSlide(id, bg, [
    { type:'shape',shape:'rect',x:0,y:0,width:960,height:6,fill:primary,stroke:'none',strokeWidth:0,locked:true,zIndex:0 },
    { type:'text',x:40,y:20,width:880,height:50,zIndex:1,content:`<h2 style="color:${primary}">Hướng dẫn sử dụng</h2>` },
    { type:'shape',shape:'rect',x:40,y:70,width:880,height:1,fill:`${primary}30`,stroke:'none',strokeWidth:0,locked:true,zIndex:2 },
    { type:'text',x:60,y:90,width:840,height:400,zIndex:3,content:`<ol style="color:${text}; font-size:20px; line-height:2">${li}</ol>` }
  ]);
}

function qnaSlide(id, bg, primary, text) {
  return mkSlide(id, bg, [
    { type:'text',x:60,y:140,width:840,height:120,zIndex:0,content:`<h1 style="text-align:center; color:${primary}">Hỏi &amp; Đáp</h1>` },
    { type:'text',x:160,y:280,width:640,height:60,zIndex:1,content:`<p style="text-align:center; color:${text}80; font-size:20px">Cảm ơn đã theo dõi!</p>` }
  ]);
}

function tmplObj(id, category, title, desc, tags, colorScheme, slides) {
  return {
    id, category, title, description: desc, tags, difficulty: 'intermediate',
    thumbnail: { type:'gradient', gradient:`linear-gradient(135deg, ${colorScheme.background}, ${colorScheme.primary}30)` },
    colorScheme, theme:'black', transition:'slide', slides
  };
}

// ══════════════════════════════════════════════════════
// SIMULATION 1: Logic Gate Simulator
// ══════════════════════════════════════════════════════
const SIM1_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim1_logic.html'), 'utf8');

// ══════════════════════════════════════════════════════
// SIMULATION 2: RLC Circuit Response
// ══════════════════════════════════════════════════════
const SIM2_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim2_rlc.html'), 'utf8');

// ══════════════════════════════════════════════════════
// SIMULATION 3: PID Controller Tuning
// ══════════════════════════════════════════════════════
const SIM3_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim3_pid.html'), 'utf8');

// ══════════════════════════════════════════════════════
// SIMULATION 4: Bode Plot Generator
// ══════════════════════════════════════════════════════
const SIM4_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim4_bode.html'), 'utf8');

// ══════════════════════════════════════════════════════
// SIMULATION 5: 3-Phase Power System
// ══════════════════════════════════════════════════════
const SIM5_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim5_3phase.html'), 'utf8');

// ══════════════════════════════════════════════════════
// SIMULATION 6: Gear Train Simulator
// ══════════════════════════════════════════════════════
const SIM6_HTML = fs.readFileSync(path.join(__dirname, 'simulations', 'sim6_gear.html'), 'utf8');

// ══════════════════════════════════════════════════════
// Build simulation templates
// ══════════════════════════════════════════════════════

const simTemplates = [
  // Sim 1: Logic Gates
  tmplObj('sim-logic-gates','digital-electronics',
    'Interactive — Logic Gate Simulator',
    'Mô phỏng tương tác 8 cổng logic: AND, OR, NAND, NOR, XOR, XNOR, NOT, BUFFER. Click input để xem output.',
    ['interactive','logic-gate','simulation','digital'],
    { primary:'#00d4ff', background:'#0a1628', text:'#e0f2ff', accent:'#00ff87' },
    [
      titleSlide('sim1-s1','#0a1628','#00d4ff','#e0f2ff','🔌 Logic Gate Simulator','Mô phỏng tương tác các cổng logic cơ bản'),
      theorySlide('sim1-s2','#0a1628','#00d4ff','#e0f2ff','Cổng logic — Lý thuyết',
        '<p><b>Cổng logic</b> là mạch điện tử thực hiện phép toán Boolean:</p><ul><li><b>AND:</b> Y = A · B — Output = 1 khi cả 2 input = 1</li><li><b>OR:</b> Y = A + B — Output = 1 khi ít nhất 1 input = 1</li><li><b>NOT:</b> Y = Ā — Đảo ngược input</li><li><b>NAND/NOR:</b> Đảo của AND/OR — universal gates</li><li><b>XOR:</b> Y = A ⊕ B — Output = 1 khi 2 input khác nhau</li></ul><p><b>Ứng dụng:</b> ALU, bộ cộng, multiplexer, flip-flop</p>'),
      simSlide('sim1-s3','#0a1628','#00d4ff',SIM1_HTML),
      instrSlide('sim1-s4','#0a1628','#00d4ff','#e0f2ff',[
        'Click nút A hoặc B để toggle giữa 0 và 1',
        'Quan sát output thay đổi theo bảng chân trị',
        'So sánh AND vs NAND (đảo nhau)',
        'So sánh OR vs NOR (đảo nhau)',
        'NOT chỉ có 1 input, BUFFER output = input'
      ]),
      qnaSlide('sim1-s5','#0a1628','#00d4ff','#e0f2ff')
    ]),

  // Sim 2: RLC Response
  tmplObj('sim-rlc-response','circuit-theory',
    'Interactive — RLC Frequency Response',
    'Mô phỏng đáp ứng tần số mạch RLC: thay đổi R, L, C → xem biểu đồ magnitude real-time.',
    ['interactive','rlc','frequency-response','simulation','circuit'],
    { primary:'#00ff87', background:'#0d1b0e', text:'#d5ffe8', accent:'#56ab2f' },
    [
      titleSlide('sim2-s1','#0d1b0e','#00ff87','#d5ffe8','📊 RLC Frequency Response','Mô phỏng đáp ứng tần số mạch RLC nối tiếp'),
      theorySlide('sim2-s2','#0d1b0e','#00ff87','#d5ffe8','Mạch RLC — Đáp ứng tần số',
        '<p><b>Hàm truyền RLC nối tiếp:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$H(j\\omega) = \\frac{1}{1 - \\omega^2 LC + j\\omega RC}$$</p><p><b>Tần số cộng hưởng:</b></p><p style="text-align:center; font-size:22px">$$f_0 = \\frac{1}{2\\pi\\sqrt{LC}}$$</p><p><b>Hệ số phẩm chất:</b> $$Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}}$$</p><p><b>Bandwidth:</b> BW = f₀/Q</p>'),
      simSlide('sim2-s3','#0d1b0e','#00ff87',SIM2_HTML),
      instrSlide('sim2-s4','#0d1b0e','#00ff87','#d5ffe8',[
        'Kéo slider R để thay đổi điện trở (10Ω – 10kΩ)',
        'Kéo slider L để thay đổi cuộn cảm (1mH – 100mH)',
        'Kéo slider C để thay đổi tụ điện (1nF – 1000nF)',
        'Quan sát đỉnh cộng hưởng di chuyển khi thay L hoặc C',
        'Tăng R → đỉnh thấp hơn (Q giảm), giảm R → đỉnh nhọn hơn'
      ]),
      qnaSlide('sim2-s5','#0d1b0e','#00ff87','#d5ffe8')
    ]),

  // Sim 3: PID Tuning
  tmplObj('sim-pid-tuning','automation',
    'Interactive — PID Controller Tuning',
    'Mô phỏng chỉnh định PID: thay đổi Kp, Ki, Kd → xem step response real-time.',
    ['interactive','pid','tuning','step-response','simulation'],
    { primary:'#ff4757', background:'#1a0a0e', text:'#ffd5d0', accent:'#ff6b81' },
    [
      titleSlide('sim3-s1','#1a0a0e','#ff4757','#ffd5d0','🎛️ PID Controller Tuning','Mô phỏng chỉnh định bộ điều khiển PID'),
      theorySlide('sim3-s2','#1a0a0e','#ff4757','#ffd5d0','PID — Lý thuyết',
        '<p><b>Luật điều khiển PID:</b></p><p style="text-align:center; font-size:22px; margin:15px 0">$$u(t) = K_p e(t) + K_i \\int e(t)dt + K_d \\frac{de}{dt}$$</p><ul><li><b>P:</b> Giảm sai số, nhưng không triệt tiêu hoàn toàn</li><li><b>I:</b> Triệt tiêu sai số xác lập (SS error = 0)</li><li><b>D:</b> Giảm overshoot, dự đoán xu hướng</li></ul><p><b>Plant:</b> G(s) = 1/(s² + 2s + 1) — hệ bậc 2</p>'),
      simSlide('sim3-s3','#1a0a0e','#ff4757',SIM3_HTML),
      instrSlide('sim3-s4','#1a0a0e','#ff4757','#ffd5d0',[
        'Kéo slider Kp, Ki, Kd để thay đổi thông số PID',
        'Nhấn preset "P only" để xem chỉ P (có steady-state error)',
        'Nhấn "PI" để xem I triệt tiêu SS error nhưng tăng overshoot',
        'Nhấn "PID" để xem hiệu quả kết hợp 3 thành phần',
        'Quan sát metrics: Rise time, Overshoot, Settling time, SS error'
      ]),
      qnaSlide('sim3-s5','#1a0a0e','#ff4757','#ffd5d0')
    ]),

  // Sim 4: Bode Plot
  tmplObj('sim-bode-plot','circuit-theory',
    'Interactive — Bode Plot Generator',
    'Nhập hàm truyền (tử/mẫu) → vẽ biểu đồ Bode magnitude + phase tự động.',
    ['interactive','bode','transfer-function','simulation','circuit'],
    { primary:'#4ecdc4', background:'#0a1a18', text:'#d0fff5', accent:'#2ecc71' },
    [
      titleSlide('sim4-s1','#0a1a18','#4ecdc4','#d0fff5','📈 Bode Plot Generator','Công cụ vẽ biểu đồ Bode tương tác'),
      theorySlide('sim4-s2','#0a1a18','#4ecdc4','#d0fff5','Biểu đồ Bode — Lý thuyết',
        '<p><b>Bode plot</b> biểu diễn |H(jω)| (dB) và ∠H(jω) (°) theo log(ω)</p><p><b>Magnitude:</b></p><p style="text-align:center; font-size:20px">$$|H|_{dB} = 20\\log_{10}|H(j\\omega)|$$</p><p><b>Các chỉ tiêu quan trọng:</b></p><ul><li><b>Gain Margin:</b> |H| tại pha = −180°</li><li><b>Phase Margin:</b> pha tại |H| = 0dB</li><li><b>Bandwidth:</b> ω khi |H| giảm −3dB</li></ul>'),
      simSlide('sim4-s3','#0a1a18','#4ecdc4',SIM4_HTML),
      instrSlide('sim4-s4','#0a1a18','#4ecdc4','#d0fff5',[
        'Nhập hệ số tử số (Num) và mẫu số (Den) cách nhau bằng dấu phẩy',
        'Ví dụ: Num="1", Den="1,2,1" → H(s) = 1/(s²+2s+1)',
        'Click "Plot" để vẽ biểu đồ Bode',
        'Sử dụng preset buttons để xem các hàm truyền phổ biến',
        'Đồ thị trên: Magnitude (dB), đồ thị dưới: Phase (°)'
      ]),
      qnaSlide('sim4-s5','#0a1a18','#4ecdc4','#d0fff5')
    ]),

  // Sim 5: 3-Phase
  tmplObj('sim-3phase','electrical',
    'Interactive — 3-Phase Power Visualizer',
    'Animation hệ thống 3 pha: sóng sin + vector phasor quay real-time.',
    ['interactive','3-phase','phasor','animation','simulation'],
    { primary:'#48bfe3', background:'#0a1628', text:'#d0eeff', accent:'#00b4d8' },
    [
      titleSlide('sim5-s1','#0a1628','#48bfe3','#d0eeff','⚡ 3-Phase Power Visualizer','Animation hệ thống điện 3 pha'),
      theorySlide('sim5-s2','#0a1628','#48bfe3','#d0eeff','Hệ thống 3 pha — Lý thuyết',
        '<p><b>3 pha cân bằng, lệch 120°:</b></p><p>$$V_a = V_m \\sin(\\omega t)$$</p><p>$$V_b = V_m \\sin(\\omega t - 120°)$$</p><p>$$V_c = V_m \\sin(\\omega t + 120°)$$</p><p><b>Tính chất:</b> V<sub>a</sub> + V<sub>b</sub> + V<sub>c</sub> = 0 (luôn luôn)</p><p><b>Điện áp dây:</b> $$V_{line} = \\sqrt{3} \\times V_{phase}$$</p>'),
      simSlide('sim5-s3','#0a1628','#48bfe3',SIM5_HTML),
      instrSlide('sim5-s4','#0a1628','#48bfe3','#d0eeff',[
        'Kéo slider Frequency để thay đổi tần số (40–60 Hz)',
        'Kéo slider Amplitude để thay đổi biên độ',
        'Kéo slider Imbalance để tạo mất cân bằng pha',
        'Nhấn Pause/Play để dừng/chạy animation',
        'Bên trái: dạng sóng 3 pha, bên phải: vector phasor quay'
      ]),
      qnaSlide('sim5-s5','#0a1628','#48bfe3','#d0eeff')
    ]),

  // Sim 6: Gear Train
  tmplObj('sim-gear-train','mechanical',
    'Interactive — Gear Train Simulator',
    'Animation bánh răng ăn khớp: thay đổi Z₁, Z₂ → xem tỷ số truyền, RPM, moment.',
    ['interactive','gear','transmission','animation','simulation'],
    { primary:'#95adb6', background:'#0f1419', text:'#dce5e8', accent:'#74b9ff' },
    [
      titleSlide('sim6-s1','#0f1419','#95adb6','#dce5e8','⚙️ Gear Train Simulator','Mô phỏng truyền động bánh răng'),
      theorySlide('sim6-s2','#0f1419','#95adb6','#dce5e8','Truyền động bánh răng — Lý thuyết',
        '<p><b>Tỷ số truyền:</b></p><p style="text-align:center; font-size:24px; margin:15px 0">$$i = \\frac{Z_2}{Z_1} = \\frac{n_1}{n_2} = \\frac{T_2}{T_1}$$</p><ul><li><b>i > 1:</b> giảm tốc, tăng moment</li><li><b>i < 1:</b> tăng tốc, giảm moment</li><li><b>i = 1:</b> truyền thẳng</li></ul><p><b>Hiệu suất:</b> η ≈ 96–99% (bánh răng trụ)</p>'),
      simSlide('sim6-s3','#0f1419','#95adb6',SIM6_HTML),
      instrSlide('sim6-s4','#0f1419','#95adb6','#dce5e8',[
        'Kéo slider Z₁ để thay đổi số răng bánh chủ động (10–50)',
        'Kéo slider Z₂ để thay đổi số răng bánh bị động (10–50)',
        'Kéo slider RPM để thay đổi tốc độ quay đầu vào',
        'Quan sát: tỷ số truyền i, tốc độ ra n₂, tỷ số moment T₂/T₁',
        'Z₂ > Z₁ → giảm tốc, tăng moment xoắn'
      ]),
      qnaSlide('sim6-s5','#0f1419','#95adb6','#dce5e8')
    ])
];

// ══════════════════════════════════════════════════════
// MERGE
// ══════════════════════════════════════════════════════
const filePath = path.join(__dirname, '..', 'server', 'data', 'built-in-templates.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
console.log(`Existing: ${existing.length}`);
console.log(`New simulations: ${simTemplates.length}`);

const newIds = simTemplates.map(t => t.id);
const filteredExisting = existing.filter(t => !newIds.includes(t.id));
const merged = [...filteredExisting, ...simTemplates];
console.log(`Total after replacement: ${merged.length}`);

// Check HTML sizes
simTemplates.forEach(t => {
  t.slides.forEach(s => {
    s.elements.forEach(e => {
      if (e.type === 'html' && e.htmlContent) {
        console.log(`  ${t.id}: HTML size = ${(e.htmlContent.length/1024).toFixed(1)}KB`);
      }
    });
  });
});

fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
console.log(`Written. File size: ${(fs.statSync(filePath).size/1024).toFixed(1)} KB`);
