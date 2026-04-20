/* eslint-env node */
const fs = require('fs');
const path = require('path');

const BUILT_IN_PATH = path.join(__dirname, 'server', 'data', 'built-in-templates.json');

const simulations = [
  {
    id: 'sim-ohm-law',
    category: 'circuit-theory',
    title: "Ohm's Law Simulation",
    titleVi: "Mô phỏng định luật Ohm",
    description: "Interactive Ohm's law calculator with real-time circuit visualization.",
    tags: ['ohm', 'circuit', 'simulation', 'interactive'],
    thumbnail: 'sim-ohm-law.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: "<h1 style='text-align:center'>Ohm's Law</h1>" },
          { id: 'el-2', type: 'text', x: 180, y: 320, width: 600, height: 60, zIndex: 2, content: "<p style='text-align:center'>Interactive Circuit Simulation</p>" }
        ]
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          { id: 'el-3', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Theory</h2>' },
          { id: 'el-4', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: "<p>Ohm's law states that the current through a conductor between two points is directly proportional to the voltage across the two points.</p><p style='text-align:center; font-size: 32px; font-weight: bold; margin-top: 20px;'>V = I × R</p>" }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-ohm',
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
  body { font-family: system-ui, sans-serif; color: white; margin: 0; padding: 20px; box-sizing: border-box; background: transparent; overflow: hidden; }
  .container { display: flex; gap: 40px; height: 100%; }
  .controls { flex: 1; display: flex; flex-direction: column; gap: 20px; }
  .control-group { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
  .control-group label { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; }
  input[type="range"] { width: 100%; }
  .viz { flex: 1; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-radius: 12px; }
  .circuit { position: relative; width: 300px; height: 200px; border: 4px solid #4b5563; border-bottom: none; border-top: none; }
  .wire-top { position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: #4b5563; }
  .wire-bottom { position: absolute; bottom: 0; left: 0; width: 100%; height: 4px; background: #4b5563; }
  .battery { position: absolute; left: -20px; top: 70px; width: 40px; height: 60px; background: #ef4444; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; }
  .resistor { position: absolute; right: -15px; top: 60px; width: 30px; height: 80px; background: #f59e0b; border: 2px solid #b45309; display: flex; align-items: center; justify-content: center; font-weight: bold; writing-mode: vertical-rl; text-orientation: mixed; }
  .current-arrow { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); color: #3b82f6; font-weight: bold; font-size: 20px; }
  .stats { text-align: center; margin-top: 20px; font-size: 24px; font-weight: bold; }
</style>
</head>
<body>
<div class="container">
  <div class="controls">
    <div class="control-group">
      <label><span>Voltage (V)</span><span id="v-val">12.0 V</span></label>
      <input type="range" id="v-slider" min="0" max="24" step="0.1" value="12">
    </div>
    <div class="control-group">
      <label><span>Resistance (R)</span><span id="r-val">100 Ω</span></label>
      <input type="range" id="r-slider" min="1" max="200" step="1" value="100">
    </div>
    <div class="stats">
      Current (I) = <span id="i-val" style="color: #3b82f6">0.12 A</span>
    </div>
  </div>
  <div class="viz">
    <div class="circuit">
      <div class="wire-top"></div>
      <div class="wire-bottom"></div>
      <div class="battery" id="bat-viz">12V</div>
      <div class="resistor" id="res-viz">100Ω</div>
      <div class="current-arrow" id="cur-viz">➔ 0.12A</div>
    </div>
  </div>
</div>
<script>
  const vSlider = document.getElementById('v-slider');
  const rSlider = document.getElementById('r-slider');
  const vVal = document.getElementById('v-val');
  const rVal = document.getElementById('r-val');
  const iVal = document.getElementById('i-val');
  const batViz = document.getElementById('bat-viz');
  const resViz = document.getElementById('res-viz');
  const curViz = document.getElementById('cur-viz');

  function update() {
    const v = parseFloat(vSlider.value);
    const r = parseFloat(rSlider.value);
    const i = v / r;
    
    vVal.textContent = v.toFixed(1) + ' V';
    rVal.textContent = r.toFixed(0) + ' Ω';
    iVal.textContent = i.toFixed(3) + ' A';
    
    batViz.textContent = v.toFixed(1) + 'V';
    resViz.textContent = r.toFixed(0) + 'Ω';
    curViz.textContent = '➔ ' + i.toFixed(2) + 'A';
    
    batViz.style.opacity = 0.5 + (v/24)*0.5;
    curViz.style.fontSize = Math.max(14, 14 + (i*10)) + 'px';
  }

  vSlider.addEventListener('input', update);
  rSlider.addEventListener('input', update);
  update();
</script>
</body>
</html>`
          }
        ]
      },
      {
        id: 'slide-4',
        background: '#1e1e2e',
        elements: [
          { id: 'el-5', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Explanation</h2>' },
          { id: 'el-6', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<p>As voltage increases (with constant resistance), the current increases proportionally.</p><p>As resistance increases (with constant voltage), the current decreases inversely.</p>' }
        ]
      },
      {
        id: 'slide-5',
        background: '#1e1e2e',
        elements: [
          { id: 'el-7', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Exercises</h2>' },
          { id: 'el-8', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<ol><li>Calculate current if V = 24V and R = 120Ω.</li><li>If a 9V battery produces 0.05A, what is the resistance?</li></ol>' }
        ]
      }
    ]
  },
  {
    id: 'sim-binary-converter',
    category: 'digital-electronics',
    title: 'Base Converter',
    titleVi: 'Bộ chuyển đổi cơ số',
    description: 'Real-time Decimal/Binary/Hex/Octal converter with bit visualization.',
    tags: ['binary', 'hex', 'converter', 'digital'],
    thumbnail: 'sim-binary-converter.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Base Converter</h1>' },
          { id: 'el-2', type: 'text', x: 180, y: 320, width: 600, height: 60, zIndex: 2, content: '<p style="text-align:center">Dec ↔ Bin ↔ Hex ↔ Oct</p>' }
        ]
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          { id: 'el-3', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Theory</h2>' },
          { id: 'el-4', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<ul><li><b>Base 10 (Decimal):</b> 0-9</li><li><b>Base 2 (Binary):</b> 0, 1</li><li><b>Base 16 (Hexadecimal):</b> 0-9, A-F</li><li><b>Base 8 (Octal):</b> 0-7</li></ul>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-bin',
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
  body { font-family: monospace; color: white; margin: 0; padding: 20px; background: transparent; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .input-group { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; }
  .input-group label { display: block; margin-bottom: 8px; font-weight: bold; font-family: system-ui; }
  input { width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; font-family: monospace; font-size: 18px; border-radius: 4px; box-sizing: border-box; }
  input:focus { outline: none; border-color: #6366f1; }
  .bits { grid-column: 1 / -1; display: flex; gap: 10px; justify-content: center; margin-top: 20px; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; }
  .bit { width: 40px; height: 50px; background: #1e1e2e; border: 2px solid #4b5563; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 4px; cursor: pointer; transition: 0.2s; }
  .bit.on { background: #10b981; border-color: #059669; }
  .bit-label { font-size: 10px; color: #888; margin-top: 4px; font-family: system-ui; }
</style>
</head>
<body>
<div class="grid">
  <div class="input-group">
    <label style="color: #60a5fa">Decimal (Base 10)</label>
    <input type="text" id="dec" value="42">
  </div>
  <div class="input-group">
    <label style="color: #34d399">Binary (Base 2)</label>
    <input type="text" id="bin">
  </div>
  <div class="input-group">
    <label style="color: #fbbf24">Hexadecimal (Base 16)</label>
    <input type="text" id="hex">
  </div>
  <div class="input-group">
    <label style="color: #c084fc">Octal (Base 8)</label>
    <input type="text" id="oct">
  </div>
  <div class="bits" id="bit-container"></div>
</div>
<script>
  const dec = document.getElementById('dec');
  const bin = document.getElementById('bin');
  const hex = document.getElementById('hex');
  const oct = document.getElementById('oct');
  const bits = document.getElementById('bit-container');

  function updateBits(val) {
    bits.innerHTML = '';
    const num = Math.min(255, Math.max(0, val));
    for(let i=7; i>=0; i--) {
      const bitVal = (num >> i) & 1;
      const bitDiv = document.createElement('div');
      bitDiv.className = 'bit ' + (bitVal ? 'on' : '');
      bitDiv.innerHTML = bitVal + '<div class="bit-label">' + Math.pow(2,i) + '</div>';
      bitDiv.onclick = () => {
        const newVal = bitVal ? (num & ~(1<<i)) : (num | (1<<i));
        dec.value = newVal;
        updateFromDec();
      };
      bits.appendChild(bitDiv);
    }
  }

  function updateFromDec() {
    let val = parseInt(dec.value, 10);
    if (isNaN(val)) val = 0;
    bin.value = val.toString(2);
    hex.value = val.toString(16).toUpperCase();
    oct.value = val.toString(8);
    updateBits(val);
  }

  dec.addEventListener('input', updateFromDec);
  bin.addEventListener('input', () => {
    let val = parseInt(bin.value, 2);
    if (!isNaN(val)) { dec.value = val; updateFromDec(); }
  });
  hex.addEventListener('input', () => {
    let val = parseInt(hex.value, 16);
    if (!isNaN(val)) { dec.value = val; updateFromDec(); }
  });
  oct.addEventListener('input', () => {
    let val = parseInt(oct.value, 8);
    if (!isNaN(val)) { dec.value = val; updateFromDec(); }
  });

  updateFromDec();
</script>
</body>
</html>`
          }
        ]
      },
      {
        id: 'slide-4',
        background: '#1e1e2e',
        elements: [
          { id: 'el-5', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Explanation</h2>' },
          { id: 'el-6', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<p>Click on the individual bits to toggle them and see how the numbers change across different bases.</p>' }
        ]
      },
      {
        id: 'slide-5',
        background: '#1e1e2e',
        elements: [
          { id: 'el-7', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Exercises</h2>' },
          { id: 'el-8', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<ol><li>Convert 0xFF to decimal.</li><li>What is 10101010 in hexadecimal?</li></ol>' }
        ]
      }
    ]
  },
  {
    id: 'sim-logic-gates',
    category: 'digital-electronics',
    title: 'Logic Gates',
    titleVi: 'Cổng logic',
    description: 'Interactive AND/OR/NOT logic gate simulator.',
    tags: ['logic', 'gates', 'boolean', 'simulation'],
    thumbnail: 'sim-logic-gates.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Logic Gates</h1>' }
        ]
      },
      {
        id: 'slide-2',
        background: '#1e1e2e',
        elements: [
          { id: 'el-2', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Theory</h2>' },
          { id: 'el-3', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<p>Logic gates are the basic building blocks of any digital system. They implement boolean functions.</p>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-logic',
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
  body { font-family: system-ui; color: white; margin: 0; padding: 20px; background: transparent; overflow: hidden; display: flex; flex-direction: column; align-items: center; }
  select { padding: 10px; font-size: 18px; margin-bottom: 30px; background: #2d2d4e; color: white; border: 1px solid #6366f1; border-radius: 4px; }
  .gate-container { display: flex; align-items: center; gap: 40px; }
  .inputs { display: flex; flex-direction: column; gap: 40px; }
  .node { width: 50px; height: 50px; border-radius: 50%; border: 3px solid #4b5563; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; cursor: pointer; user-select: none; transition: 0.2s; background: #1e1e2e; }
  .node.on { background: #10b981; border-color: #059669; box-shadow: 0 0 15px #10b981; }
  .node.off { background: #ef4444; border-color: #b91c1c; }
  .gate { width: 120px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border: 2px solid white; border-radius: 8px; background: rgba(255,255,255,0.1); position: relative; }
  .wire-in-1 { position: absolute; left: -40px; top: 25px; width: 40px; height: 2px; background: #888; }
  .wire-in-2 { position: absolute; left: -40px; top: 75px; width: 40px; height: 2px; background: #888; }
  .wire-out { position: absolute; right: -40px; top: 50px; width: 40px; height: 2px; background: #888; }
  .truth-table { margin-top: 40px; border-collapse: collapse; }
  .truth-table th, .truth-table td { border: 1px solid #4b5563; padding: 8px 16px; text-align: center; }
  .truth-table th { background: rgba(255,255,255,0.1); }
</style>
</head>
<body>
  <select id="gate-type">
    <option value="AND">AND Gate</option>
    <option value="OR">OR Gate</option>
    <option value="XOR">XOR Gate</option>
    <option value="NAND">NAND Gate</option>
    <option value="NOR">NOR Gate</option>
  </select>

  <div class="gate-container">
    <div class="inputs">
      <div class="node off" id="inA" onclick="toggle('inA')">0</div>
      <div class="node off" id="inB" onclick="toggle('inB')">0</div>
    </div>
    <div class="gate">
      <div class="wire-in-1"></div>
      <div class="wire-in-2"></div>
      <span id="gate-label">AND</span>
      <div class="wire-out"></div>
    </div>
    <div class="node off" id="outQ" style="cursor: default">0</div>
  </div>

  <table class="truth-table">
    <thead><tr><th>A</th><th>B</th><th>Q</th></tr></thead>
    <tbody id="tt-body"></tbody>
  </table>

<script>
  let a = 0, b = 0;
  const inA = document.getElementById('inA');
  const inB = document.getElementById('inB');
  const outQ = document.getElementById('outQ');
  const typeSel = document.getElementById('gate-type');
  const label = document.getElementById('gate-label');
  const ttBody = document.getElementById('tt-body');

  function toggle(id) {
    if (id === 'inA') a = 1 - a;
    if (id === 'inB') b = 1 - b;
    update();
  }

  function calc(a, b, type) {
    switch(type) {
      case 'AND': return a & b;
      case 'OR': return a | b;
      case 'XOR': return a ^ b;
      case 'NAND': return 1 - (a & b);
      case 'NOR': return 1 - (a | b);
      default: return 0;
    }
  }

  function update() {
    const type = typeSel.value;
    label.textContent = type;
    const q = calc(a, b, type);
    
    inA.className = 'node ' + (a ? 'on' : 'off');
    inA.textContent = a;
    inB.className = 'node ' + (b ? 'on' : 'off');
    inB.textContent = b;
    outQ.className = 'node ' + (q ? 'on' : 'off');
    outQ.textContent = q;

    ttBody.innerHTML = '';
    for(let i=0; i<=1; i++) {
      for(let j=0; j<=1; j++) {
        const res = calc(i, j, type);
        const tr = document.createElement('tr');
        if (i===a && j===b) tr.style.background = 'rgba(99,102,241,0.3)';
        tr.innerHTML = \`<td>\${i}</td><td>\${j}</td><td>\${res}</td>\`;
        ttBody.appendChild(tr);
      }
    }
  }

  typeSel.addEventListener('change', update);
  update();
</script>
</body>
</html>`
          }
        ]
      },
      {
        id: 'slide-4',
        background: '#1e1e2e',
        elements: [
          { id: 'el-4', type: 'text', x: 80, y: 80, width: 800, height: 80, zIndex: 1, content: '<h2>Exercises</h2>' },
          { id: 'el-5', type: 'text', x: 80, y: 180, width: 800, height: 200, zIndex: 2, content: '<ol><li>Build an XOR gate using only NAND gates.</li></ol>' }
        ]
      }
    ]
  },
  {
    id: 'sim-projectile',
    category: 'physics',
    title: 'Projectile Motion',
    titleVi: 'Chuyển động ném xiên',
    description: 'Physics simulation of projectile motion with angle and velocity controls.',
    tags: ['physics', 'projectile', 'kinematics'],
    thumbnail: 'sim-projectile.png',
    theme: 'dracula',
    transition: 'fade',
    slides: [
      {
        id: 'slide-1',
        background: '#1e1e2e',
        elements: [
          { id: 'el-1', type: 'text', x: 80, y: 200, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center">Projectile Motion</h1>' }
        ]
      },
      {
        id: 'slide-3',
        background: '#1e1e2e',
        elements: [
          {
            id: 'el-sim-proj',
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
  body { font-family: system-ui; color: white; margin: 0; padding: 10px; background: transparent; overflow: hidden; }
  .controls { display: flex; gap: 20px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 10px; }
  .controls label { display: flex; flex-direction: column; font-size: 12px; font-weight: bold; }
  canvas { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; display: block; }
  .stats { position: absolute; right: 30px; top: 80px; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 8px; border: 1px solid #6366f1; font-family: monospace; }
</style>
</head>
<body>
  <div class="controls">
    <label>Angle (°): <span id="ang-val">45</span>
      <input type="range" id="angle" min="0" max="90" value="45">
    </label>
    <label>Velocity (m/s): <span id="vel-val">20</span>
      <input type="range" id="vel" min="5" max="50" value="20">
    </label>
    <button onclick="launch()" style="padding: 0 20px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Launch</button>
  </div>
  <canvas id="canvas" width="900" height="400"></canvas>
  <div class="stats" id="stats"></div>

<script>
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const angleSlider = document.getElementById('angle');
  const velSlider = document.getElementById('vel');
  const angVal = document.getElementById('ang-val');
  const velVal = document.getElementById('vel-val');
  const statsDiv = document.getElementById('stats');

  const g = 9.81;
  const scale = 5; // pixels per meter
  let t = 0;
  let animating = false;
  let path = [];
  let v0 = 20;
  let theta = 45;

  function drawBg() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=50) { ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); }
    for(let i=0; i<canvas.height; i+=50) { ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, canvas.height-10, canvas.width, 10);
  }

  function updateParams() {
    theta = parseFloat(angleSlider.value);
    v0 = parseFloat(velSlider.value);
    angVal.textContent = theta;
    velVal.textContent = v0;
    
    const rad = theta * Math.PI / 180;
    const tFlight = (2 * v0 * Math.sin(rad)) / g;
    const hMax = Math.pow(v0 * Math.sin(rad), 2) / (2 * g);
    const range = (Math.pow(v0, 2) * Math.sin(2 * rad)) / g;

    statsDiv.innerHTML = \`Max Height: \${hMax.toFixed(1)} m<br>Range: \${range.toFixed(1)} m<br>Time: \${tFlight.toFixed(2)} s\`;
    if(!animating) { path=[]; drawBg(); }
  }

  angleSlider.addEventListener('input', updateParams);
  velSlider.addEventListener('input', updateParams);

  function launch() {
    t = 0;
    path = [];
    animating = true;
    requestAnimationFrame(animate);
  }

  function animate() {
    if (!animating) return;
    t += 0.05;
    const rad = theta * Math.PI / 180;
    const x = v0 * Math.cos(rad) * t;
    const y = v0 * Math.sin(rad) * t - 0.5 * g * t * t;

    if (y < 0 && t > 0) { animating = false; return; }

    const px = 20 + x * scale;
    const py = canvas.height - 10 - y * scale;
    path.push({x: px, y: py});

    drawBg();
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    for(let i=0; i<path.length; i++) {
      if(i===0) ctx.moveTo(path[i].x, path[i].y);
      else ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    requestAnimationFrame(animate);
  }

  updateParams();
  drawBg();
</script>
</body>
</html>`
          }
        ]
      }
    ]
  }
];

// Append to built-in-templates.json
fs.readFile(BUILT_IN_PATH, 'utf-8', (err, data) => {
  if (err) {
    console.error('Error reading JSON:', err);
    return;
  }
  try {
    const templates = JSON.parse(data);
    
    // Filter out existing ones with the same IDs if running multiple times
    const simIds = simulations.map(s => s.id);
    const filteredTemplates = templates.filter(t => !simIds.includes(t.id));
    
    const newTemplates = [...filteredTemplates, ...simulations];
    
    fs.writeFileSync(BUILT_IN_PATH, JSON.stringify(newTemplates, null, 2), 'utf-8');
    console.log(`Successfully added ${simulations.length} simulation templates.`);
  } catch (e) {
    console.error('Error parsing JSON:', e);
  }
});
