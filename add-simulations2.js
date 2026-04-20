const fs = require('fs');
const path = require('path');

const BUILT_IN_PATH = path.join(__dirname, 'server', 'data', 'built-in-templates.json');

const additionalSimulations = [
  {
    id: 'sim-sorting-algo',
    category: 'computer-science',
    title: 'Bubble Sort Visualizer',
    titleVi: 'Mô phỏng thuật toán sắp xếp',
    description: 'Visual step-by-step bubble sort algorithm.',
    tags: ['sorting', 'algorithm', 'computer-science', 'bubble'],
    thumbnail: 'sim-sorting-algo.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Bubble Sort</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-sort',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 460,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; display: flex; flex-direction: column; align-items: center; }
  .bars { display: flex; align-items: flex-end; gap: 10px; height: 300px; margin-bottom: 30px; }
  .bar { width: 40px; background: #3b82f6; transition: 0.3s; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px; font-weight: bold; border-radius: 4px 4px 0 0; }
  .bar.compare { background: #f59e0b; }
  .bar.sorted { background: #10b981; }
  .controls { display: flex; gap: 20px; }
  button { padding: 10px 20px; font-size: 16px; font-weight: bold; cursor: pointer; background: #6366f1; color: white; border: none; border-radius: 4px; }
  button:hover { background: #4f46e5; }
</style>
</head>
<body>
  <div class="bars" id="bars"></div>
  <div class="controls">
    <button onclick="step()">Step</button>
    <button onclick="reset()">Reset</button>
    <span id="stats" style="align-self: center; font-size: 18px;">Comparisons: 0</span>
  </div>

<script>
  let arr = [];
  let n = 8;
  let i = 0, j = 0;
  let comparisons = 0;
  let sorted = false;

  function init() {
    arr = Array.from({length: n}, () => Math.floor(Math.random() * 90) + 10);
    i = 0; j = 0; comparisons = 0; sorted = false;
    render();
  }

  function render() {
    const container = document.getElementById('bars');
    container.innerHTML = '';
    document.getElementById('stats').textContent = 'Comparisons: ' + comparisons;
    
    arr.forEach((val, idx) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      if (!sorted && (idx === j || idx === j+1)) bar.classList.add('compare');
      if (idx >= n - i || sorted) bar.classList.add('sorted');
      bar.style.height = (val * 2.5) + 'px';
      bar.textContent = val;
      container.appendChild(bar);
    });
  }

  function step() {
    if (sorted) return;
    
    if (i < n - 1) {
      if (j < n - i - 1) {
        if (arr[j] > arr[j+1]) {
          let temp = arr[j];
          arr[j] = arr[j+1];
          arr[j+1] = temp;
        }
        j++;
        comparisons++;
      } else {
        j = 0;
        i++;
      }
    } else {
      sorted = true;
    }
    render();
  }

  function reset() { init(); }
  init();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  },
  {
    id: 'sim-pid-controller',
    category: 'automation',
    title: 'PID Controller Tuning',
    titleVi: 'Điều khiển PID',
    description: 'Tune Proportional, Integral, and Derivative gains and observe the step response.',
    tags: ['pid', 'automation', 'control-theory'],
    thumbnail: 'sim-pid-controller.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">PID Controller</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-pid',
            type: 'html',
            x: 20,
            y: 20,
            width: 920,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; overflow: hidden; display: flex; }
  .controls { width: 250px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; }
  .control-group { margin-bottom: 20px; }
  .control-group label { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; }
  input[type="range"] { width: 100%; }
  canvas { margin-left: 20px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; }
</style>
</head>
<body>
  <div class="controls">
    <div class="control-group">
      <label><span>Kp</span><span id="kp-val">2.0</span></label>
      <input type="range" id="kp" min="0" max="10" step="0.1" value="2.0">
    </div>
    <div class="control-group">
      <label><span>Ki</span><span id="ki-val">0.1</span></label>
      <input type="range" id="ki" min="0" max="2" step="0.01" value="0.1">
    </div>
    <div class="control-group">
      <label><span>Kd</span><span id="kd-val">0.5</span></label>
      <input type="range" id="kd" min="0" max="5" step="0.1" value="0.5">
    </div>
  </div>
  <canvas id="canvas" width="600" height="400"></canvas>

<script>
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const kpSlider = document.getElementById('kp');
  const kiSlider = document.getElementById('ki');
  const kdSlider = document.getElementById('kd');
  const kpVal = document.getElementById('kp-val');
  const kiVal = document.getElementById('ki-val');
  const kdVal = document.getElementById('kd-val');

  function simulate() {
    const Kp = parseFloat(kpSlider.value);
    const Ki = parseFloat(kiSlider.value);
    const Kd = parseFloat(kdSlider.value);
    
    kpVal.textContent = Kp.toFixed(1);
    kiVal.textContent = Ki.toFixed(2);
    kdVal.textContent = Kd.toFixed(1);

    // Simple discrete plant simulation (1st order + inertia)
    let y = 0, y_prev = 0;
    let err_sum = 0, err_prev = 0;
    const setpoint = 100;
    const dt = 0.1;
    const steps = 200;
    const history = [];

    for(let i=0; i<steps; i++) {
      const err = setpoint - y;
      err_sum += err * dt;
      const d_err = (err - err_prev) / dt;
      
      const u = Kp * err + Ki * err_sum + Kd * d_err;
      
      // Plant physics: y'' + 2y' + y = u
      const y_new = y + y_prev + 0.05 * u; // highly simplified plant
      y_prev = y;
      y = y_new * 0.95; // damping
      
      err_prev = err;
      history.push(y);
    }

    draw(history, setpoint);
  }

  function draw(history, setpoint) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    for(let i=0; i<400; i+=40) { ctx.moveTo(0, i); ctx.lineTo(600, i); }
    for(let i=0; i<600; i+=60) { ctx.moveTo(i, 0); ctx.lineTo(i, 400); }
    ctx.stroke();

    // Setpoint
    const spY = canvas.height - (setpoint * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, spY);
    ctx.lineTo(600, spY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Response
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    history.forEach((val, i) => {
      const px = i * (600 / history.length);
      const py = canvas.height - (val * 2);
      if(i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  kpSlider.addEventListener('input', simulate);
  kiSlider.addEventListener('input', simulate);
  kdSlider.addEventListener('input', simulate);
  simulate();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  },
  {
    id: 'sim-resistor-color',
    category: 'electronics',
    title: 'Resistor Color Code',
    titleVi: 'Mã màu điện trở',
    description: '4-band resistor color code calculator.',
    tags: ['electronics', 'resistor', 'color-code'],
    thumbnail: 'sim-resistor-color.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Resistor Color Code</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-resistor',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 460,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; text-align: center; }
  .resistor { position: relative; width: 400px; height: 120px; background: #deb887; margin: 40px auto; border-radius: 60px; box-shadow: inset 0 -15px 20px rgba(0,0,0,0.3); border: 2px solid #a0522d; }
  .wire { position: absolute; top: 55px; width: 100px; height: 10px; background: #9ca3af; z-index: -1; }
  .wire.left { left: -100px; }
  .wire.right { right: -100px; }
  .band { position: absolute; width: 30px; height: 100%; top: 0; }
  #b1 { left: 60px; }
  #b2 { left: 120px; }
  #b3 { left: 180px; }
  #b4 { right: 60px; }
  select { padding: 10px; font-size: 16px; margin: 10px; border-radius: 4px; background: #374151; color: white; border: none; }
  .result { font-size: 48px; font-weight: bold; margin-top: 40px; color: #60a5fa; }
</style>
</head>
<body>
  <div style="position: relative; width: 400px; margin: 0 auto;">
    <div class="wire left"></div>
    <div class="resistor">
      <div class="band" id="b1" style="background: brown"></div>
      <div class="band" id="b2" style="background: black"></div>
      <div class="band" id="b3" style="background: red"></div>
      <div class="band" id="b4" style="background: gold"></div>
    </div>
    <div class="wire right"></div>
  </div>

  <div>
    <select id="s1" onchange="calc()">
      <option value="0" data-c="black">Black (0)</option><option value="1" data-c="brown" selected>Brown (1)</option><option value="2" data-c="red">Red (2)</option><option value="3" data-c="orange">Orange (3)</option><option value="4" data-c="yellow">Yellow (4)</option><option value="5" data-c="green">Green (5)</option><option value="6" data-c="blue">Blue (6)</option><option value="7" data-c="violet">Violet (7)</option><option value="8" data-c="gray">Gray (8)</option><option value="9" data-c="white">White (9)</option>
    </select>
    <select id="s2" onchange="calc()">
      <option value="0" data-c="black" selected>Black (0)</option><option value="1" data-c="brown">Brown (1)</option><option value="2" data-c="red">Red (2)</option><option value="3" data-c="orange">Orange (3)</option><option value="4" data-c="yellow">Yellow (4)</option><option value="5" data-c="green">Green (5)</option><option value="6" data-c="blue">Blue (6)</option><option value="7" data-c="violet">Violet (7)</option><option value="8" data-c="gray">Gray (8)</option><option value="9" data-c="white">White (9)</option>
    </select>
    <select id="s3" onchange="calc()">
      <option value="1" data-c="black">Black (x1)</option><option value="10" data-c="brown">Brown (x10)</option><option value="100" data-c="red" selected>Red (x100)</option><option value="1000" data-c="orange">Orange (x1k)</option><option value="10000" data-c="yellow">Yellow (x10k)</option><option value="100000" data-c="green">Green (x100k)</option><option value="1000000" data-c="blue">Blue (x1M)</option>
    </select>
    <select id="s4" onchange="calc()">
      <option value="1" data-c="brown">Brown (±1%)</option><option value="2" data-c="red">Red (±2%)</option><option value="5" data-c="gold" selected>Gold (±5%)</option><option value="10" data-c="silver">Silver (±10%)</option>
    </select>
  </div>

  <div class="result" id="res">1,000 Ω ±5%</div>

<script>
  function format(val) {
    if (val >= 1000000) return (val/1000000) + ' MΩ';
    if (val >= 1000) return (val/1000) + ' kΩ';
    return val + ' Ω';
  }
  function calc() {
    const s1 = document.getElementById('s1');
    const s2 = document.getElementById('s2');
    const s3 = document.getElementById('s3');
    const s4 = document.getElementById('s4');
    
    document.getElementById('b1').style.background = s1.options[s1.selectedIndex].dataset.c;
    document.getElementById('b2').style.background = s2.options[s2.selectedIndex].dataset.c;
    document.getElementById('b3').style.background = s3.options[s3.selectedIndex].dataset.c;
    document.getElementById('b4').style.background = s4.options[s4.selectedIndex].dataset.c;

    const val = (parseInt(s1.value)*10 + parseInt(s2.value)) * parseInt(s3.value);
    document.getElementById('res').innerHTML = format(val) + ' &plusmn;' + s4.value + '%';
  }
</script>
</body>
</html>`
          }
        ]
      }
    ]
  },
  {
    id: 'sim-signal-wave',
    category: 'signal-processing',
    title: 'Signal Wave Generator',
    titleVi: 'Bộ tạo sóng tín hiệu',
    description: 'Generate and visualize sine, square, and triangle waves.',
    tags: ['signal', 'wave', 'frequency', 'amplitude'],
    thumbnail: 'sim-signal-wave.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Signal Generator</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-wave',
            type: 'html',
            x: 20,
            y: 20,
            width: 920,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; overflow: hidden; display: flex; }
  .controls { width: 250px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; }
  .control-group { margin-bottom: 20px; }
  .control-group label { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px; }
  input[type="range"], select { width: 100%; padding: 5px; }
  canvas { margin-left: 20px; background: #0f172a; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; }
</style>
</head>
<body>
  <div class="controls">
    <div class="control-group">
      <label>Waveform</label>
      <select id="type">
        <option value="sine">Sine</option>
        <option value="square">Square</option>
        <option value="triangle">Triangle</option>
      </select>
    </div>
    <div class="control-group">
      <label><span>Frequency</span><span id="f-val">1.0 Hz</span></label>
      <input type="range" id="freq" min="0.1" max="5" step="0.1" value="1.0">
    </div>
    <div class="control-group">
      <label><span>Amplitude</span><span id="a-val">1.0</span></label>
      <input type="range" id="amp" min="0" max="2" step="0.1" value="1.0">
    </div>
  </div>
  <canvas id="canvas" width="600" height="400"></canvas>

<script>
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const typeSel = document.getElementById('type');
  const fSlider = document.getElementById('freq');
  const aSlider = document.getElementById('amp');
  const fVal = document.getElementById('f-val');
  const aVal = document.getElementById('a-val');

  let time = 0;

  function draw() {
    const f = parseFloat(fSlider.value);
    const a = parseFloat(aSlider.value);
    const type = typeSel.value;
    
    fVal.textContent = f.toFixed(1) + ' Hz';
    aVal.textContent = a.toFixed(1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 200); ctx.lineTo(600, 200);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for(let x=0; x<600; x++) {
      const t = time + (x / 100);
      let y = 0;
      
      if (type === 'sine') y = Math.sin(2 * Math.PI * f * t);
      else if (type === 'square') y = Math.sign(Math.sin(2 * Math.PI * f * t));
      else if (type === 'triangle') y = 2 * Math.abs(2 * (t * f - Math.floor(t * f + 0.5))) - 1;

      const px = x;
      const py = 200 - (y * a * 150);
      
      if(x===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    
    time += 0.02;
    requestAnimationFrame(draw);
  }

  draw();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  },
  {
    id: 'sim-matrix-calc',
    category: 'mathematics',
    title: 'Matrix Calculator',
    titleVi: 'Máy tính ma trận',
    description: '2x2 Matrix operations: Add, Multiply, Determinant, Inverse.',
    tags: ['matrix', 'math', 'algebra'],
    thumbnail: 'sim-matrix-calc.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Matrix Operations</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-matrix',
            type: 'html',
            x: 40,
            y: 40,
            width: 880,
            height: 460,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; text-align: center; }
  .container { display: flex; align-items: center; justify-content: center; gap: 30px; margin-top: 40px; }
  .matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 20px; border-left: 3px solid white; border-right: 3px solid white; border-radius: 8px; background: rgba(255,255,255,0.05); }
  input { width: 60px; height: 60px; text-align: center; font-size: 24px; background: #374151; color: white; border: 1px solid #6b7280; border-radius: 4px; }
  select { padding: 10px; font-size: 24px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .result-val { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; background: rgba(16,185,129,0.2); color: #10b981; border-radius: 4px; }
  .scalar-res { font-size: 32px; font-weight: bold; color: #10b981; }
</style>
</head>
<body>
  <div class="container">
    <div class="matrix">
      <input type="number" id="a00" value="1"><input type="number" id="a01" value="2">
      <input type="number" id="a10" value="3"><input type="number" id="a11" value="4">
    </div>
    <select id="op" onchange="calc()">
      <option value="+">+</option>
      <option value="*">×</option>
      <option value="det">det(A)</option>
      <option value="inv">inv(A)</option>
    </select>
    <div class="matrix" id="mat-b">
      <input type="number" id="b00" value="2"><input type="number" id="b01" value="0">
      <input type="number" id="b10" value="1"><input type="number" id="b11" value="2">
    </div>
    <div style="font-size: 40px; font-weight: bold;">=</div>
    <div class="matrix" id="res-matrix">
      <div class="result-val" id="r00">3</div><div class="result-val" id="r01">2</div>
      <div class="result-val" id="r10">4</div><div class="result-val" id="r11">6</div>
    </div>
    <div id="res-scalar" class="scalar-res" style="display:none;"></div>
  </div>

<script>
  const inputs = document.querySelectorAll('input');
  inputs.forEach(i => i.addEventListener('input', calc));

  function calc() {
    const a00 = parseFloat(document.getElementById('a00').value)||0;
    const a01 = parseFloat(document.getElementById('a01').value)||0;
    const a10 = parseFloat(document.getElementById('a10').value)||0;
    const a11 = parseFloat(document.getElementById('a11').value)||0;
    const b00 = parseFloat(document.getElementById('b00').value)||0;
    const b01 = parseFloat(document.getElementById('b01').value)||0;
    const b10 = parseFloat(document.getElementById('b10').value)||0;
    const b11 = parseFloat(document.getElementById('b11').value)||0;
    const op = document.getElementById('op').value;
    
    document.getElementById('mat-b').style.display = (op==='det'||op==='inv') ? 'none' : 'grid';
    document.getElementById('res-matrix').style.display = (op==='det') ? 'none' : 'grid';
    document.getElementById('res-scalar').style.display = (op==='det') ? 'block' : 'none';

    if (op === '+') {
      document.getElementById('r00').textContent = a00+b00;
      document.getElementById('r01').textContent = a01+b01;
      document.getElementById('r10').textContent = a10+b10;
      document.getElementById('r11').textContent = a11+b11;
    } else if (op === '*') {
      document.getElementById('r00').textContent = a00*b00 + a01*b10;
      document.getElementById('r01').textContent = a00*b01 + a01*b11;
      document.getElementById('r10').textContent = a10*b00 + a11*b10;
      document.getElementById('r11').textContent = a10*b01 + a11*b11;
    } else if (op === 'det') {
      document.getElementById('res-scalar').textContent = (a00*a11 - a01*a10);
    } else if (op === 'inv') {
      const det = a00*a11 - a01*a10;
      if (det === 0) {
        document.getElementById('r00').textContent = 'NaN';
        document.getElementById('r01').textContent = 'NaN';
        document.getElementById('r10').textContent = 'NaN';
        document.getElementById('r11').textContent = 'NaN';
      } else {
        document.getElementById('r00').textContent = (a11/det).toFixed(2);
        document.getElementById('r01').textContent = (-a01/det).toFixed(2);
        document.getElementById('r10').textContent = (-a10/det).toFixed(2);
        document.getElementById('r11').textContent = (a00/det).toFixed(2);
      }
    }
  }
  calc();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  },
  {
    id: 'sim-newton-force',
    category: 'physics',
    title: 'Force Vector Addition',
    titleVi: 'Tổng hợp lực',
    description: 'Calculate and visualize the net force from multiple vectors.',
    tags: ['physics', 'force', 'vector', 'newton'],
    thumbnail: 'sim-newton-force.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Force Vectors</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-force',
            type: 'html',
            x: 20,
            y: 20,
            width: 920,
            height: 500,
            zIndex: 1,
            content: `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; overflow: hidden; display: flex; }
  .controls { width: 300px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; }
  .force-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
  .force-row input { width: 60px; background: #374151; color: white; border: 1px solid #4b5563; padding: 5px; border-radius: 4px; }
  .force-label { width: 20px; font-weight: bold; }
  canvas { margin-left: 20px; background: #1e293b; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; }
  .result { margin-top: 20px; padding: 15px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; border-radius: 8px; color: #10b981; font-weight: bold; }
</style>
</head>
<body>
  <div class="controls">
    <h3>Forces (N, Degrees)</h3>
    <div class="force-row">
      <span class="force-label" style="color:#ef4444">F1</span>
      Mag: <input type="number" id="m1" value="10">
      Ang: <input type="number" id="a1" value="0">
    </div>
    <div class="force-row">
      <span class="force-label" style="color:#3b82f6">F2</span>
      Mag: <input type="number" id="m2" value="15">
      Ang: <input type="number" id="a2" value="90">
    </div>
    <div class="force-row">
      <span class="force-label" style="color:#eab308">F3</span>
      Mag: <input type="number" id="m3" value="0">
      Ang: <input type="number" id="a3" value="180">
    </div>
    <div class="result" id="res">Net Force: 18.0 N @ 56.3°</div>
  </div>
  <canvas id="canvas" width="550" height="460"></canvas>

<script>
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const scale = 10; // pixels per Newton

  const inputs = document.querySelectorAll('input');
  inputs.forEach(i => i.addEventListener('input', draw));

  function drawArrow(x0, y0, x1, y1, color, dashed=false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if(dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    
    // arrowhead
    const angle = Math.atan2(y1-y0, x1-x0);
    ctx.fillStyle = color;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 10 * Math.cos(angle - Math.PI/6), y1 - 10 * Math.sin(angle - Math.PI/6));
    ctx.lineTo(x1 - 10 * Math.cos(angle + Math.PI/6), y1 - 10 * Math.sin(angle + Math.PI/6));
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();

    let netX = 0, netY = 0;
    const colors = ['#ef4444', '#3b82f6', '#eab308'];
    
    for(let i=1; i<=3; i++) {
      const mag = parseFloat(document.getElementById('m'+i).value)||0;
      const ang = parseFloat(document.getElementById('a'+i).value)||0;
      if (mag > 0) {
        const rad = -ang * Math.PI / 180; // Negative because canvas Y goes down
        const fx = mag * Math.cos(rad);
        const fy = mag * Math.sin(rad);
        netX += fx;
        netY += fy;
        
        drawArrow(cx, cy, cx + fx*scale, cy + fy*scale, colors[i-1]);
      }
    }

    const netMag = Math.sqrt(netX*netX + netY*netY);
    let netAng = Math.atan2(-netY, netX) * 180 / Math.PI; // back to degrees
    if (netAng < 0) netAng += 360;

    document.getElementById('res').innerHTML = \`Net Force: \${netMag.toFixed(1)} N <br> Angle: \${netAng.toFixed(1)}°\`;

    if (netMag > 0) {
      drawArrow(cx, cy, cx + netX*scale, cy + netY*scale, '#10b981', true);
    }
  }

  draw();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  }
];

// Read and append to the existing file
fs.readFile(BUILT_IN_PATH, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading JSON:', err);
    return;
  }
  try {
    const templates = JSON.parse(data);
    
    // Filter out existing ones with the same IDs
    const simIds = additionalSimulations.map(s => s.id);
    const filteredTemplates = templates.filter(t => !simIds.includes(t.id));
    
    const newTemplates = [...filteredTemplates, ...additionalSimulations];
    
    fs.writeFileSync(BUILT_IN_PATH, JSON.stringify(newTemplates, null, 2), 'utf-8');
    console.log(`Successfully appended ${additionalSimulations.length} more simulation templates.`);
  } catch (e) {
    console.error('Error parsing JSON:', e);
  }
});
