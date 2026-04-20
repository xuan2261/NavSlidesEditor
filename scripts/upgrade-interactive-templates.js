#!/usr/bin/env node
/**
 * Upgrade Interactive Templates
 * - Fix LaTeX formulas (text → latex elements)
 * - Add new simulation slides
 * - Improve theory slides with visual boxes
 * - Upgrade ending slides
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'server', 'data', 'built-in-templates.json');

// ─── Utility helpers ───
function makeId() { return 'up-' + Math.random().toString(36).substring(2, 10); }

function shapeBar(color, height = 6) {
  return { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height, fill: color, stroke: 'none', strokeWidth: 0, locked: true, zIndex: 0 };
}

function shapeDivider(color, y = 70) {
  return { type: 'shape', shape: 'rect', x: 40, y, width: 880, height: 1, fill: color + '30', stroke: 'none', strokeWidth: 0, locked: true, zIndex: 1 };
}

function glassBox(x, y, w, h, color) {
  return { type: 'shape', shape: 'rect', x, y, width: w, height: h, fill: color + '12', stroke: color + '40', strokeWidth: 1, cornerRadius: 12, locked: true, zIndex: 1 };
}

function textEl(x, y, w, h, content, z = 2) {
  return { type: 'text', x, y, width: w, height: h, zIndex: z, content };
}

function latexEl(x, y, w, h, content, z = 3) {
  return { type: 'latex', x, y, width: w, height: h, zIndex: z, content };
}

function htmlEmbed(x, y, w, h, content, z = 2) {
  return { type: 'html', x, y, width: w, height: h, zIndex: z, content };
}

function makeSlide(bg, elements) {
  return { id: makeId(), elements, background: { type: 'color', color: bg } };
}

// ─── HTML Simulations ───

function logicGateCombinationalHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Combinational Circuit</title>
<style>
:root{--bg:#0a1628;--primary:#00d4ff;--text:#e0f2ff;--high:#00ff87;--low:#ff4757;--glass:rgba(15,32,64,0.6);--border:rgba(0,212,255,0.2)}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(0,212,255,0.5)}
.main{display:flex;gap:16px;width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px)}
.circuit{flex:2;position:relative}
.panel{flex:1;background:rgba(0,0,0,0.25);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:8px;overflow-y:auto}
.panel h4{text-align:center;color:var(--primary);font-size:0.85rem;margin-bottom:4px}
select{background:rgba(0,212,255,0.1);border:1px solid var(--primary);color:var(--text);padding:6px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;width:100%}
select:focus{outline:none;box-shadow:0 0 8px rgba(0,212,255,0.4)}
.io-btn{width:44px;height:44px;border-radius:50%;border:2px solid;font-weight:bold;font-size:1.1rem;cursor:pointer;position:absolute;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:10;background:var(--bg)}
.io-btn:hover{transform:scale(1.15);box-shadow:0 0 15px currentColor}
.io-btn.high{color:var(--bg);background:var(--high);border-color:var(--high)}
.io-btn.low{color:var(--low);border-color:var(--low)}
.out-display{width:52px;height:52px;border-radius:50%;border:2px solid;font-weight:bold;font-size:1.3rem;position:absolute;display:flex;align-items:center;justify-content:center;z-index:10;background:var(--bg);cursor:default}
.out-display.high{color:var(--bg);background:var(--high);border-color:var(--high);box-shadow:0 0 20px rgba(0,255,135,0.5)}
.out-display.low{color:var(--low);border-color:var(--low)}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
.wire{fill:none;stroke-width:3;stroke-linecap:round;transition:stroke 0.3s}
.wire.high{stroke:var(--high);filter:drop-shadow(0 0 6px rgba(0,255,135,0.5))}
.wire.low{stroke:var(--low)}
.gate-body{fill:var(--glass);stroke:var(--primary);stroke-width:2.5}
.label{fill:var(--primary);font-size:11px;font-weight:600;text-anchor:middle}
.result-row{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-radius:6px;font-size:0.8rem;background:rgba(0,0,0,0.2)}
.result-row .val{font-family:monospace;font-weight:bold;font-size:1rem}
.val.h{color:var(--high)}.val.l{color:var(--low)}
.expr{font-family:monospace;font-size:0.85rem;color:rgba(255,255,255,0.7);text-align:center;padding:6px;background:rgba(0,212,255,0.08);border-radius:8px;border:1px solid rgba(0,212,255,0.15)}
</style></head><body>
<h3>Combinational Logic Circuit</h3>
<div class="main">
  <div class="circuit" id="circuit">
    <div class="io-btn low" id="btnA" style="top:60px;left:10px" onclick="toggle('A')">0</div>
    <div class="io-btn low" id="btnB" style="top:160px;left:10px" onclick="toggle('B')">0</div>
    <div class="io-btn low" id="btnC" style="top:260px;left:10px" onclick="toggle('C')">0</div>
    <div class="out-display low" id="outNode" style="top:143px;right:10px">0</div>
    <svg id="svg" viewBox="0 0 560 360"></svg>
  </div>
  <div class="panel">
    <h4>Gate Configuration</h4>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.5)">Gate 1 (A,B → M)</div>
    <select id="gate1" onchange="update()">
      <option value="AND">AND</option><option value="OR">OR</option><option value="NAND">NAND</option>
      <option value="NOR">NOR</option><option value="XOR">XOR</option><option value="XNOR">XNOR</option>
    </select>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-top:6px">Gate 2 (M,C → Y)</div>
    <select id="gate2" onchange="update()">
      <option value="AND">AND</option><option value="OR" selected>OR</option><option value="NAND">NAND</option>
      <option value="NOR">NOR</option><option value="XOR">XOR</option><option value="XNOR">XNOR</option>
    </select>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:6px 0"></div>
    <div id="expr" class="expr">Y = (A·B) + C</div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:6px 0"></div>
    <h4>Signals</h4>
    <div class="result-row"><span>A</span><span class="val l" id="vA">0</span></div>
    <div class="result-row"><span>B</span><span class="val l" id="vB">0</span></div>
    <div class="result-row"><span>C</span><span class="val l" id="vC">0</span></div>
    <div class="result-row"><span>M (mid)</span><span class="val l" id="vM">0</span></div>
    <div class="result-row" style="background:rgba(0,212,255,0.15)"><span><b>Y (out)</b></span><span class="val l" id="vY">0</span></div>
  </div>
</div>
<script>
const ops={AND:(a,b)=>a&b,OR:(a,b)=>a|b,NAND:(a,b)=>(~(a&b))&1,NOR:(a,b)=>(~(a|b))&1,XOR:(a,b)=>a^b,XNOR:(a,b)=>(~(a^b))&1};
const sym={AND:'·',OR:'+',NAND:'⊼',NOR:'⊽',XOR:'⊕',XNOR:'⊙'};
let A=0,B=0,C=0;
function toggle(v){if(v==='A')A=1-A;else if(v==='B')B=1-B;else C=1-C;update()}
function update(){
  const g1=document.getElementById('gate1').value,g2=document.getElementById('gate2').value;
  const M=ops[g1](A,B),Y=ops[g2](M,C);
  ['btnA','btnB','btnC'].forEach((id,i)=>{const v=[A,B,C][i];const el=document.getElementById(id);el.textContent=v;el.className='io-btn '+(v?'high':'low')});
  const out=document.getElementById('outNode');out.textContent=Y;out.className='out-display '+(Y?'high':'low');
  document.getElementById('vA').textContent=A;document.getElementById('vA').className='val '+(A?'h':'l');
  document.getElementById('vB').textContent=B;document.getElementById('vB').className='val '+(B?'h':'l');
  document.getElementById('vC').textContent=C;document.getElementById('vC').className='val '+(C?'h':'l');
  document.getElementById('vM').textContent=M;document.getElementById('vM').className='val '+(M?'h':'l');
  document.getElementById('vY').textContent=Y;document.getElementById('vY').className='val '+(Y?'h':'l');
  document.getElementById('expr').innerHTML='Y = (A '+sym[g1]+' B) '+sym[g2]+' C';
  drawCircuit(g1,g2,M,Y);
}
function drawCircuit(g1,g2,M,Y){
  const svg=document.getElementById('svg');
  const wc=(v)=>v?'wire high':'wire low';
  svg.innerHTML=\`
    <path class="\${wc(A)}" d="M 55 80 H 160"/>
    <path class="\${wc(B)}" d="M 55 180 H 160"/>
    <path class="\${wc(C)}" d="M 55 280 H 350 V 200 H 360"/>
    <path class="\${wc(M)}" d="M 290 130 H 360"/>
    <path class="\${wc(Y)}" d="M 470 165 H 500"/>
    <rect class="gate-body" x="160" y="80" width="130" height="100" rx="10"/>
    <text class="label" x="225" y="138">\${g1}</text>
    <rect class="gate-body" x="360" y="115" width="110" height="100" rx="10"/>
    <text class="label" x="415" y="173">\${g2}</text>
    <text fill="rgba(255,255,255,0.3)" font-size="10" x="305" y="125">M</text>
  \`;
}
update();
</script></body></html>`;
}

function rlcPhasorHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>RLC Impedance Phasor</title>
<style>
:root{--bg:#071a12;--primary:#00ff87;--text:#d5ffe8;--glass:rgba(10,40,25,0.6);--border:rgba(0,255,135,0.2)}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(0,255,135,0.5)}
.main{display:flex;gap:16px;width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px)}
.canvas-wrap{flex:2;position:relative;display:flex;align-items:center;justify-content:center}
canvas{border-radius:12px;background:rgba(0,0,0,0.3)}
.controls{flex:1;display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,0.25);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05)}
.controls h4{text-align:center;color:var(--primary);font-size:0.85rem;margin-bottom:4px}
.slider-group{display:flex;flex-direction:column;gap:2px}
.slider-group label{font-size:0.75rem;display:flex;justify-content:space-between;color:rgba(255,255,255,0.7)}
.slider-group label span{color:var(--primary);font-weight:bold}
input[type=range]{width:100%;accent-color:var(--primary);height:6px}
.info-row{display:flex;justify-content:space-between;padding:4px 8px;border-radius:6px;font-size:0.8rem;background:rgba(0,0,0,0.2)}
.info-row .val{font-family:monospace;font-weight:bold;color:var(--primary)}
.legend{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.legend span{font-size:0.7rem;display:flex;align-items:center;gap:3px}
.legend span::before{content:'';width:12px;height:3px;border-radius:2px;display:inline-block}
.leg-r::before{background:#ff6b6b}.leg-l::before{background:#4ecdc4}.leg-c::before{background:#ffd93d}.leg-z::before{background:#00ff87}
</style></head><body>
<h3>RLC Impedance Phasor Diagram</h3>
<div class="main">
  <div class="canvas-wrap"><canvas id="cv" width="480" height="350"></canvas></div>
  <div class="controls">
    <h4>Parameters</h4>
    <div class="slider-group"><label>R <span id="rv">100</span> Ω</label><input type="range" id="sR" min="10" max="500" value="100" oninput="draw()"></div>
    <div class="slider-group"><label>L <span id="lv">50</span> mH</label><input type="range" id="sL" min="1" max="200" value="50" oninput="draw()"></div>
    <div class="slider-group"><label>C <span id="cv2">10</span> μF</label><input type="range" id="sC" min="1" max="100" value="10" oninput="draw()"></div>
    <div class="slider-group"><label>f <span id="fv">50</span> Hz</label><input type="range" id="sF" min="10" max="500" value="50" oninput="draw()"></div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"></div>
    <div class="info-row"><span>|Z|</span><span class="val" id="zMag">—</span></div>
    <div class="info-row"><span>φ</span><span class="val" id="zPhase">—</span></div>
    <div class="info-row"><span>X<sub>L</sub></span><span class="val" id="xL">—</span></div>
    <div class="info-row"><span>X<sub>C</sub></span><span class="val" id="xC">—</span></div>
    <div class="info-row"><span>f₀ (res)</span><span class="val" id="f0">—</span></div>
    <div class="legend">
      <span class="leg-r">R</span><span class="leg-l">X<sub>L</sub></span>
      <span class="leg-c">X<sub>C</sub></span><span class="leg-z">Z</span>
    </div>
  </div>
</div>
<script>
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
function draw(){
  const R=+document.getElementById('sR').value,L=+document.getElementById('sL').value/1000,
        C=+document.getElementById('sC').value/1e6,f=+document.getElementById('sF').value;
  document.getElementById('rv').textContent=R;document.getElementById('lv').textContent=(L*1000).toFixed(0);
  document.getElementById('cv2').textContent=(C*1e6).toFixed(0);document.getElementById('fv').textContent=f;
  const w=2*Math.PI*f,XL=w*L,XC=1/(w*C),X=XL-XC,Z=Math.sqrt(R*R+X*X),phi=Math.atan2(X,R)*180/Math.PI;
  const f0=1/(2*Math.PI*Math.sqrt(L*C));
  document.getElementById('zMag').textContent=Z.toFixed(1)+' Ω';
  document.getElementById('zPhase').textContent=phi.toFixed(1)+'°';
  document.getElementById('xL').textContent=XL.toFixed(1)+' Ω';
  document.getElementById('xC').textContent=XC.toFixed(1)+' Ω';
  document.getElementById('f0').textContent=f0.toFixed(1)+' Hz';
  ctx.clearRect(0,0,480,350);
  const cx=130,cy=175,scale=Math.min(180/Math.max(R,Math.abs(XL),Math.abs(XC),Z,1),1.5);
  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  for(let i=-200;i<=200;i+=40){ctx.beginPath();ctx.moveTo(cx+i,20);ctx.lineTo(cx+i,330);ctx.stroke();ctx.beginPath();ctx.moveTo(20,cy+i);ctx.lineTo(460,cy+i);ctx.stroke()}
  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(20,cy);ctx.lineTo(460,cy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,20);ctx.lineTo(cx,330);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='11px sans-serif';
  ctx.fillText('Re (Ω)',420,cy-8);ctx.fillText('Im (Ω)',cx+8,30);
  // Draw vectors
  function arrow(x1,y1,x2,y2,color,w2){
    ctx.strokeStyle=color;ctx.lineWidth=w2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    const a=Math.atan2(y2-y1,x2-x1),hl=10;
    ctx.fillStyle=color;ctx.beginPath();
    ctx.moveTo(x2,y2);ctx.lineTo(x2-hl*Math.cos(a-0.35),y2-hl*Math.sin(a-0.35));
    ctx.lineTo(x2-hl*Math.cos(a+0.35),y2-hl*Math.sin(a+0.35));ctx.fill();
  }
  // R vector (horizontal)
  arrow(cx,cy,cx+R*scale,cy,'#ff6b6b',3);
  // XL vector (up from R end)
  if(XL>0.5) arrow(cx+R*scale,cy,cx+R*scale,cy-XL*scale,'#4ecdc4',3);
  // XC vector (down from R end) 
  if(XC>0.5) arrow(cx+R*scale,cy,cx+R*scale,cy+XC*scale,'#ffd93d',3);
  // Z vector (resultant)
  arrow(cx,cy,cx+R*scale,cy-X*scale,'#00ff87',3.5);
  // Angle arc
  if(Math.abs(phi)>2){
    ctx.strokeStyle='rgba(0,255,135,0.4)';ctx.lineWidth=1.5;
    ctx.beginPath();const ar=30;ctx.arc(cx,cy,ar,0,-phi*Math.PI/180,phi>0);ctx.stroke();
    ctx.fillStyle='#00ff87';ctx.font='bold 12px monospace';
    ctx.fillText(phi.toFixed(1)+'°',cx+35,cy+(phi>0?-10:18));
  }
  // Labels
  ctx.font='bold 12px sans-serif';
  ctx.fillStyle='#ff6b6b';ctx.fillText('R='+R+'Ω',cx+R*scale/2-15,cy+20);
  ctx.fillStyle='#4ecdc4';if(XL>5)ctx.fillText('XL='+XL.toFixed(0)+'Ω',cx+R*scale+8,cy-XL*scale/2);
  ctx.fillStyle='#ffd93d';if(XC>5)ctx.fillText('XC='+XC.toFixed(0)+'Ω',cx+R*scale+8,cy+XC*scale/2+5);
  ctx.fillStyle='#00ff87';ctx.fillText('|Z|='+Z.toFixed(0)+'Ω',cx+R*scale/2-30,cy-X*scale/2-10);
  // Resonance indicator
  if(Math.abs(f-f0)<f0*0.08){
    ctx.fillStyle='rgba(0,255,135,0.15)';ctx.fillRect(10,10,140,30);
    ctx.fillStyle='#00ff87';ctx.font='bold 13px sans-serif';ctx.fillText('⚡ RESONANCE!',20,30);
  }
}
draw();
</script></body></html>`;
}

function pidCompareHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>P vs PI vs PID</title>
<style>
:root{--bg:#1a0a0a;--primary:#ff4757;--text:#ffd5d0;--glass:rgba(40,15,15,0.6);--border:rgba(255,71,87,0.2)}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(255,71,87,0.5)}
.main{width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px);display:flex;flex-direction:column}
.top{display:flex;gap:12px;align-items:center;justify-content:center;margin-bottom:10px;flex-wrap:wrap}
.param{display:flex;align-items:center;gap:4px;font-size:0.8rem}
.param label{color:rgba(255,255,255,0.6)}
.param input{width:60px;background:rgba(255,71,87,0.1);border:1px solid var(--primary);color:var(--text);padding:3px 6px;border-radius:6px;font-size:0.8rem;text-align:center}
.param input:focus{outline:none;box-shadow:0 0 6px rgba(255,71,87,0.4)}
button{background:rgba(255,71,87,0.15);border:1px solid var(--primary);color:var(--text);padding:5px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer;transition:all 0.2s}
button:hover{background:rgba(255,71,87,0.3)}
.chart-wrap{flex:1;position:relative}
canvas{width:100%;height:100%;border-radius:10px;background:rgba(0,0,0,0.3)}
.legend{display:flex;gap:16px;justify-content:center;margin-top:8px}
.legend span{font-size:0.75rem;display:flex;align-items:center;gap:4px}
.legend span::before{content:'';width:20px;height:3px;border-radius:2px}
.leg-p::before{background:#ff6b6b}.leg-pi::before{background:#ffd93d}.leg-pid::before{background:#00ff87}
.leg-sp::before{background:rgba(255,255,255,0.3);border-top:2px dashed rgba(255,255,255,0.3);height:0}
.metrics{display:flex;gap:8px;justify-content:center;margin-top:4px;flex-wrap:wrap}
.metric{font-size:0.7rem;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,0.3)}
</style></head><body>
<h3>P vs PI vs PID — Step Response Comparison</h3>
<div class="main">
  <div class="top">
    <div class="param"><label>Kp</label><input id="kp" value="2.0"></div>
    <div class="param"><label>Ki</label><input id="ki" value="1.0"></div>
    <div class="param"><label>Kd</label><input id="kd" value="0.5"></div>
    <button onclick="simulate()">Simulate</button>
    <button onclick="document.getElementById('kp').value='2.0';document.getElementById('ki').value='1.0';document.getElementById('kd').value='0.5';simulate()">Reset</button>
  </div>
  <div class="chart-wrap"><canvas id="cv"></canvas></div>
  <div class="legend">
    <span class="leg-p">P only</span><span class="leg-pi">PI</span>
    <span class="leg-pid">PID</span><span class="leg-sp">Setpoint</span>
  </div>
  <div class="metrics" id="metrics"></div>
</div>
<script>
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
function resize(){cv.width=cv.parentElement.clientWidth;cv.height=cv.parentElement.clientHeight}
window.addEventListener('resize',()=>{resize();simulate()});
function simPID(Kp,Ki,Kd,dt,steps){
  let y=0,dy=0,integral=0,prev_e=0,out=[];
  for(let i=0;i<steps;i++){
    const sp=1,e=sp-y;integral+=e*dt;const de=(e-prev_e)/dt;prev_e=e;
    const u=Kp*e+Ki*integral+Kd*de;
    const ddy=u-2*dy-y;dy+=ddy*dt;y+=dy*dt;
    out.push(Math.max(-0.5,Math.min(2,y)));
  }
  return out;
}
function simulate(){
  resize();
  const Kp=parseFloat(document.getElementById('kp').value)||0;
  const Ki=parseFloat(document.getElementById('ki').value)||0;
  const Kd=parseFloat(document.getElementById('kd').value)||0;
  const dt=0.02,steps=500;
  const pData=simPID(Kp,0,0,dt,steps);
  const piData=simPID(Kp,Ki,0,dt,steps);
  const pidData=simPID(Kp,Ki,Kd,dt,steps);
  const W=cv.width,H=cv.height,px=40,py=20,gw=W-px-20,gh=H-py-30;
  ctx.clearRect(0,0,W,H);
  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  for(let i=0;i<=10;i++){const x=px+gw*i/10;ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x,py+gh);ctx.stroke()}
  for(let i=0;i<=8;i++){const y=py+gh*i/8;ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px+gw,y);ctx.stroke()}
  // Setpoint
  const spY=py+gh*(1-1/2);
  ctx.setLineDash([6,4]);ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(px,spY);ctx.lineTo(px+gw,spY);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='11px sans-serif';ctx.fillText('SP=1',px+gw+2,spY+4);
  // Axes labels
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='10px sans-serif';
  for(let i=0;i<=5;i++){const t=(steps*dt*i/5).toFixed(0);ctx.fillText(t+'s',px+gw*i/5-8,py+gh+15)}
  for(let v=0;v<=2;v+=0.5){const y2=py+gh*(1-v/2);ctx.fillText(v.toFixed(1),px-30,y2+4)}
  // Draw curves
  function drawCurve(data,color){
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.beginPath();
    data.forEach((v,i)=>{const x=px+gw*i/steps,y=py+gh*(1-v/2);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});
    ctx.stroke();
  }
  drawCurve(pData,'#ff6b6b');drawCurve(piData,'#ffd93d');drawCurve(pidData,'#00ff87');
  // Metrics
  function getMetrics(data,label){
    const ss=data[data.length-1],os=Math.max(...data),rise=data.findIndex(v=>v>=0.9);
    return label+': SS='+(1-ss).toFixed(3)+' OS='+((os-1)*100).toFixed(1)+'% Rise='+(rise*0.02).toFixed(2)+'s';
  }
  document.getElementById('metrics').innerHTML=
    '<span class="metric" style="color:#ff6b6b">'+getMetrics(pData,'P')+'</span>'+
    '<span class="metric" style="color:#ffd93d">'+getMetrics(piData,'PI')+'</span>'+
    '<span class="metric" style="color:#00ff87">'+getMetrics(pidData,'PID')+'</span>';
}
simulate();
</script></body></html>`;
}

function bodePoleZeroHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Pole-Zero Map</title>
<style>
:root{--bg:#0a1a1a;--primary:#4ecdc4;--text:#d0fff5;--glass:rgba(10,40,40,0.6);--border:rgba(78,205,196,0.2)}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(78,205,196,0.5)}
.main{display:flex;gap:16px;width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px)}
.canvas-wrap{flex:2;display:flex;align-items:center;justify-content:center}
canvas{border-radius:12px;background:rgba(0,0,0,0.3)}
.panel{flex:1;display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,0.25);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05);overflow-y:auto}
.panel h4{text-align:center;color:var(--primary);font-size:0.85rem}
.preset-btn{background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.3);color:var(--text);padding:5px 10px;border-radius:8px;font-size:0.75rem;cursor:pointer;transition:all 0.2s;text-align:left}
.preset-btn:hover{background:rgba(78,205,196,0.25)}
.preset-btn.active{background:var(--primary);color:var(--bg);font-weight:bold}
.info{font-size:0.75rem;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:6px;line-height:1.5}
.stability{padding:6px;border-radius:8px;text-align:center;font-weight:bold;font-size:0.85rem}
.stable{background:rgba(0,255,135,0.15);color:#00ff87;border:1px solid rgba(0,255,135,0.3)}
.unstable{background:rgba(255,71,87,0.15);color:#ff4757;border:1px solid rgba(255,71,87,0.3)}
.marginal{background:rgba(255,217,61,0.15);color:#ffd93d;border:1px solid rgba(255,217,61,0.3)}
</style></head><body>
<h3>Pole-Zero Map — s-Plane</h3>
<div class="main">
  <div class="canvas-wrap"><canvas id="cv" width="480" height="350"></canvas></div>
  <div class="panel">
    <h4>System Presets</h4>
    <button class="preset-btn active" onclick="setPreset(0,this)">1st Order: 1/(s+2)<br><small>1 pole at s=-2</small></button>
    <button class="preset-btn" onclick="setPreset(1,this)">2nd Order Stable<br><small>poles: -1±j2</small></button>
    <button class="preset-btn" onclick="setPreset(2,this)">Underdamped<br><small>poles: -0.5±j3</small></button>
    <button class="preset-btn" onclick="setPreset(3,this)">Marginally Stable<br><small>poles: ±j2</small></button>
    <button class="preset-btn" onclick="setPreset(4,this)">Unstable<br><small>poles: +1±j1</small></button>
    <button class="preset-btn" onclick="setPreset(5,this)">With Zeros<br><small>pole:-2±j1, zero:-1</small></button>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"></div>
    <div id="stability" class="stability stable">✓ STABLE</div>
    <div class="info" id="info">Poles in left half-plane → stable system</div>
  </div>
</div>
<script>
const presets=[
  {poles:[{r:-2,i:0}],zeros:[],name:'1st Order'},
  {poles:[{r:-1,i:2},{r:-1,i:-2}],zeros:[],name:'2nd Order Stable'},
  {poles:[{r:-0.5,i:3},{r:-0.5,i:-3}],zeros:[],name:'Underdamped'},
  {poles:[{r:0,i:2},{r:0,i:-2}],zeros:[],name:'Marginally Stable'},
  {poles:[{r:1,i:1},{r:1,i:-1}],zeros:[],name:'Unstable'},
  {poles:[{r:-2,i:1},{r:-2,i:-1}],zeros:[{r:-1,i:0}],name:'With Zeros'},
];
let current=presets[0];
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
function setPreset(idx,btn){
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');current=presets[idx];draw();
}
function draw(){
  ctx.clearRect(0,0,480,350);const cx=240,cy=175,sc=40;
  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  for(let x=-5;x<=5;x++){ctx.beginPath();ctx.moveTo(cx+x*sc,0);ctx.lineTo(cx+x*sc,350);ctx.stroke()}
  for(let y=-4;y<=4;y++){ctx.beginPath();ctx.moveTo(0,cy+y*sc);ctx.lineTo(480,cy+y*sc);ctx.stroke()}
  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(480,cy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,350);ctx.stroke();
  // Left half shading (stable region)
  ctx.fillStyle='rgba(0,255,135,0.03)';ctx.fillRect(0,0,cx,350);
  // Right half shading (unstable)
  ctx.fillStyle='rgba(255,71,87,0.03)';ctx.fillRect(cx,0,240,350);
  // Labels
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='11px sans-serif';
  ctx.fillText('σ (Real)',440,cy-8);ctx.fillText('jω (Imag)',cx+6,14);
  ctx.fillStyle='rgba(0,255,135,0.2)';ctx.font='10px sans-serif';ctx.fillText('Stable',20,20);
  ctx.fillStyle='rgba(255,71,87,0.2)';ctx.fillText('Unstable',430,20);
  for(let x=-5;x<=5;x++)if(x!==0){ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='9px sans-serif';ctx.fillText(x,cx+x*sc-3,cy+14)}
  for(let y=-4;y<=4;y++)if(y!==0){ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='9px sans-serif';ctx.fillText((y>0?'-':'')+'j'+Math.abs(y),cx+6,cy+y*sc+3)}
  // Draw zeros (circles)
  current.zeros.forEach(z=>{
    ctx.strokeStyle='#4ecdc4';ctx.lineWidth=2.5;ctx.beginPath();
    ctx.arc(cx+z.r*sc,cy-z.i*sc,8,0,Math.PI*2);ctx.stroke();
  });
  // Draw poles (crosses)
  current.poles.forEach(p=>{
    const px2=cx+p.r*sc,py2=cy-p.i*sc;
    ctx.strokeStyle='#ff4757';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(px2-7,py2-7);ctx.lineTo(px2+7,py2+7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px2+7,py2-7);ctx.lineTo(px2-7,py2+7);ctx.stroke();
    // Glow
    ctx.shadowColor='rgba(255,71,87,0.5)';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(px2,py2,1,0,Math.PI*2);ctx.fillStyle='#ff4757';ctx.fill();
    ctx.shadowBlur=0;
  });
  // Stability check
  const stable=current.poles.every(p=>p.r<0);
  const marginal=current.poles.some(p=>p.r===0)&&!current.poles.some(p=>p.r>0);
  const el=document.getElementById('stability');
  const info=document.getElementById('info');
  if(stable){el.className='stability stable';el.textContent='✓ STABLE';info.textContent='All poles in LHP (Re < 0) → System is asymptotically stable'}
  else if(marginal){el.className='stability marginal';el.textContent='⚠ MARGINALLY STABLE';info.textContent='Poles on jω axis → Bounded output, sustained oscillation'}
  else{el.className='stability unstable';el.textContent='✗ UNSTABLE';info.textContent='Poles in RHP (Re > 0) → Output grows unbounded'}
}
draw();
</script></body></html>`;
}

function threePhPhasorHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>3-Phase Phasor</title>
<style>
:root{--bg:#0a1525;--primary:#48bfe3;--text:#d0eeff;--glass:rgba(10,25,50,0.6);--border:rgba(72,191,227,0.2)}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(72,191,227,0.5)}
.main{display:flex;gap:16px;width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px)}
.canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center}
canvas{border-radius:12px;background:rgba(0,0,0,0.3)}
.panel{width:200px;display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,0.25);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05)}
.panel h4{text-align:center;color:var(--primary);font-size:0.85rem;margin-bottom:2px}
.slider-group label{font-size:0.75rem;display:flex;justify-content:space-between;color:rgba(255,255,255,0.7)}.slider-group label span{color:var(--primary);font-weight:bold}
input[type=range]{width:100%;accent-color:var(--primary);height:5px}
.info-row{display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px;font-size:0.75rem;background:rgba(0,0,0,0.2)}
.info-row .val{font-family:monospace;font-weight:bold}
.controls{display:flex;gap:6px}
button{flex:1;background:rgba(72,191,227,0.1);border:1px solid rgba(72,191,227,0.3);color:var(--text);padding:4px;border-radius:6px;font-size:0.7rem;cursor:pointer}
button:hover{background:rgba(72,191,227,0.25)}
button.active{background:var(--primary);color:var(--bg);font-weight:bold}
.phase-a{color:#ff6b6b}.phase-b{color:#ffd93d}.phase-c{color:#4ecdc4}
</style></head><body>
<h3>3-Phase Rotating Phasor Diagram</h3>
<div class="main">
  <div class="canvas-wrap"><canvas id="phasor" width="340" height="340"></canvas></div>
  <div class="canvas-wrap"><canvas id="wave" width="340" height="340"></canvas></div>
  <div class="panel">
    <h4>Controls</h4>
    <div class="slider-group"><label>Speed <span id="sv">1.0</span>x</label><input type="range" id="speed" min="0.1" max="3" step="0.1" value="1"></div>
    <div class="slider-group"><label>V<sub>m</sub> <span id="vv">220</span> V</label><input type="range" id="amp" min="50" max="380" value="220"></div>
    <div class="controls">
      <button id="btnPlay" class="active" onclick="togglePlay()">▶ Play</button>
      <button onclick="resetPhase()">↺ Reset</button>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:3px 0"></div>
    <h4>Instantaneous Values</h4>
    <div class="info-row"><span class="phase-a">V<sub>a</sub></span><span class="val phase-a" id="va">—</span></div>
    <div class="info-row"><span class="phase-b">V<sub>b</sub></span><span class="val phase-b" id="vb">—</span></div>
    <div class="info-row"><span class="phase-c">V<sub>c</sub></span><span class="val phase-c" id="vc">—</span></div>
    <div class="info-row"><span>ΣV</span><span class="val" id="vsum" style="color:var(--primary)">—</span></div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:3px 0"></div>
    <div class="info-row"><span>V<sub>line</sub></span><span class="val" style="color:var(--primary)" id="vline">—</span></div>
    <div class="info-row"><span>ωt</span><span class="val" style="color:var(--primary)" id="wt">—</span></div>
  </div>
</div>
<script>
const pc=document.getElementById('phasor'),pctx=pc.getContext('2d');
const wc=document.getElementById('wave'),wctx=wc.getContext('2d');
let angle=0,playing=true,history=[];
function togglePlay(){playing=!playing;document.getElementById('btnPlay').textContent=playing?'⏸ Pause':'▶ Play';document.getElementById('btnPlay').classList.toggle('active',playing)}
function resetPhase(){angle=0;history=[]}
function drawPhasor(){
  const Vm=+document.getElementById('amp').value;
  document.getElementById('sv').textContent=(+document.getElementById('speed').value).toFixed(1);
  document.getElementById('vv').textContent=Vm;
  const cx=170,cy=170,r=Vm/380*130;
  pctx.clearRect(0,0,340,340);
  // Grid circles
  [0.25,0.5,0.75,1].forEach(f=>{pctx.strokeStyle='rgba(255,255,255,0.06)';pctx.lineWidth=1;pctx.beginPath();pctx.arc(cx,cy,r*f/0.75*0.75,0,Math.PI*2);pctx.stroke()});
  // Axes
  pctx.strokeStyle='rgba(255,255,255,0.15)';pctx.lineWidth=1;
  pctx.beginPath();pctx.moveTo(20,cy);pctx.lineTo(320,cy);pctx.stroke();
  pctx.beginPath();pctx.moveTo(cx,20);pctx.lineTo(cx,320);pctx.stroke();
  // Phases
  const phases=[
    {a:angle,color:'#ff6b6b',label:'A'},
    {a:angle-2*Math.PI/3,color:'#ffd93d',label:'B'},
    {a:angle+2*Math.PI/3,color:'#4ecdc4',label:'C'}
  ];
  phases.forEach(p=>{
    const ex=cx+r*Math.cos(p.a),ey=cy-r*Math.sin(p.a);
    // Trail
    pctx.strokeStyle=p.color+'40';pctx.lineWidth=1;pctx.beginPath();pctx.arc(cx,cy,r,0,Math.PI*2);pctx.stroke();
    // Arrow
    pctx.strokeStyle=p.color;pctx.lineWidth=3;pctx.beginPath();pctx.moveTo(cx,cy);pctx.lineTo(ex,ey);pctx.stroke();
    // Arrowhead
    const aa=Math.atan2(cy-ey,ex-cx);
    pctx.fillStyle=p.color;pctx.beginPath();pctx.moveTo(ex,ey);
    pctx.lineTo(ex-10*Math.cos(aa-0.4),ey+10*Math.sin(aa-0.4));
    pctx.lineTo(ex-10*Math.cos(aa+0.4),ey+10*Math.sin(aa+0.4));pctx.fill();
    // Dot
    pctx.beginPath();pctx.arc(ex,ey,4,0,Math.PI*2);pctx.fill();
    // Label
    pctx.fillStyle=p.color;pctx.font='bold 13px sans-serif';
    pctx.fillText(p.label,ex+(ex>cx?8:-16),ey+(ey>cy?18:-8));
  });
  // Values
  const va=Vm*Math.sin(angle),vb=Vm*Math.sin(angle-2*Math.PI/3),vc_val=Vm*Math.sin(angle+2*Math.PI/3);
  document.getElementById('va').textContent=va.toFixed(1)+' V';
  document.getElementById('vb').textContent=vb.toFixed(1)+' V';
  document.getElementById('vc').textContent=vc_val.toFixed(1)+' V';
  document.getElementById('vsum').textContent=(va+vb+vc_val).toFixed(2)+' V';
  document.getElementById('vline').textContent=(Vm*Math.sqrt(3)).toFixed(0)+' V';
  document.getElementById('wt').textContent=(angle*180/Math.PI%360).toFixed(0)+'°';
  // Waveform
  history.push({a:va/Vm,b:vb/Vm,c:vc_val/Vm});if(history.length>300)history.shift();
  wctx.clearRect(0,0,340,340);
  wctx.strokeStyle='rgba(255,255,255,0.1)';wctx.lineWidth=1;
  [85,170,255].forEach(y=>{wctx.beginPath();wctx.moveTo(0,y);wctx.lineTo(340,y);wctx.stroke()});
  const colors=['#ff6b6b','#ffd93d','#4ecdc4'];
  ['a','b','c'].forEach((ph,pi)=>{
    wctx.strokeStyle=colors[pi];wctx.lineWidth=2;wctx.beginPath();
    history.forEach((h,i)=>{const x=340-history.length+i,y=170-h[ph]*120;i===0?wctx.moveTo(x,y):wctx.lineTo(x,y)});
    wctx.stroke();
  });
  wctx.fillStyle='rgba(255,255,255,0.3)';wctx.font='10px sans-serif';wctx.fillText('Time →',280,335);
}
function animate(){
  if(playing){const spd=+document.getElementById('speed').value;angle+=0.03*spd}
  drawPhasor();requestAnimationFrame(animate);
}
animate();
</script></body></html>`;
}

function gearMultiStageHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Multi-Stage Gear Train</title>
<style>
:root{--bg:#121820;--primary:#95adb6;--text:#dce5e8;--glass:rgba(20,28,38,0.6);--border:rgba(149,173,182,0.2);--accent:#64ffda}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif}
body{background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:12px;overflow:hidden}
h3{font-size:1.1rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-shadow:0 0 10px rgba(100,255,218,0.4)}
.main{display:flex;gap:16px;width:100%;max-width:920px;height:380px;background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(10px)}
.canvas-wrap{flex:2;display:flex;align-items:center;justify-content:center}
canvas{border-radius:12px;background:rgba(0,0,0,0.25)}
.panel{flex:1;display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,0.25);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.05);overflow-y:auto}
.panel h4{text-align:center;color:var(--accent);font-size:0.85rem;margin-bottom:2px}
.slider-group label{font-size:0.75rem;display:flex;justify-content:space-between;color:rgba(255,255,255,0.7)}.slider-group label span{color:var(--accent);font-weight:bold}
input[type=range]{width:100%;accent-color:var(--accent);height:5px}
.info-box{padding:6px 8px;border-radius:6px;font-size:0.75rem;background:rgba(0,0,0,0.2);display:flex;justify-content:space-between}
.info-box .val{font-family:monospace;font-weight:bold;color:var(--accent)}
.gear-label{font-size:0.7rem;padding:3px 8px;border-radius:4px;text-align:center}
.g1{background:rgba(255,107,107,0.15);color:#ff6b6b;border:1px solid rgba(255,107,107,0.2)}
.g2{background:rgba(255,217,61,0.15);color:#ffd93d;border:1px solid rgba(255,217,61,0.2)}
.g3{background:rgba(78,205,196,0.15);color:#4ecdc4;border:1px solid rgba(78,205,196,0.2)}
</style></head><body>
<h3>Multi-Stage Gear Train Simulator</h3>
<div class="main">
  <div class="canvas-wrap"><canvas id="cv" width="540" height="350"></canvas></div>
  <div class="panel">
    <h4>Gear Teeth</h4>
    <div class="gear-label g1">Gear 1 (Input/Driver)</div>
    <div class="slider-group"><label>Z₁ <span id="z1v">20</span></label><input type="range" id="z1" min="10" max="60" value="20" oninput="update()"></div>
    <div class="gear-label g2">Gear 2 (Idler)</div>
    <div class="slider-group"><label>Z₂ <span id="z2v">40</span></label><input type="range" id="z2" min="10" max="60" value="40" oninput="update()"></div>
    <div class="gear-label g3">Gear 3 (Output/Driven)</div>
    <div class="slider-group"><label>Z₃ <span id="z3v">30</span></label><input type="range" id="z3" min="10" max="60" value="30" oninput="update()"></div>
    <div class="slider-group"><label>ω₁ (input) <span id="w1v">60</span> rpm</label><input type="range" id="w1" min="10" max="200" value="60" oninput="update()"></div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"></div>
    <h4>Results</h4>
    <div class="info-box"><span>i₁₂ = Z₂/Z₁</span><span class="val" id="i12">—</span></div>
    <div class="info-box"><span>i₂₃ = Z₃/Z₂</span><span class="val" id="i23">—</span></div>
    <div class="info-box"><span>i<sub>total</sub> = Z₃/Z₁</span><span class="val" id="itot">—</span></div>
    <div class="info-box"><span>ω₃ (output)</span><span class="val" id="w3v">—</span></div>
    <div class="info-box"><span>T₃/T₁ ratio</span><span class="val" id="tratio">—</span></div>
  </div>
</div>
<script>
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
let angle1=0;
function drawGear(x,y,r,teeth,angle,color,label){
  const toothH=8,toothW=Math.PI*2/teeth/2;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  // Gear body
  ctx.beginPath();
  for(let i=0;i<teeth;i++){
    const a=i*Math.PI*2/teeth;
    const a1=a-toothW/2,a2=a+toothW/2;
    ctx.lineTo((r+toothH)*Math.cos(a1),(r+toothH)*Math.sin(a1));
    ctx.lineTo((r+toothH)*Math.cos(a2),(r+toothH)*Math.sin(a2));
    const a3=a+Math.PI/teeth-toothW/2,a4=a+Math.PI/teeth+toothW/2;
    ctx.lineTo(r*Math.cos(a3),r*Math.sin(a3));
    ctx.lineTo(r*Math.cos(a4),r*Math.sin(a4));
  }
  ctx.closePath();ctx.fillStyle=color+'25';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
  // Center hub
  ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  // Spokes
  ctx.strokeStyle=color+'60';ctx.lineWidth=1.5;
  for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(10*Math.cos(a),10*Math.sin(a));ctx.lineTo((r-5)*Math.cos(a),(r-5)*Math.sin(a));ctx.stroke()}
  ctx.restore();
  // Label below
  ctx.fillStyle=color;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(label,x,y+r+25);
}
function update(){
  const Z1=+document.getElementById('z1').value,Z2=+document.getElementById('z2').value,Z3=+document.getElementById('z3').value;
  const w1=+document.getElementById('w1').value;
  document.getElementById('z1v').textContent=Z1;document.getElementById('z2v').textContent=Z2;document.getElementById('z3v').textContent=Z3;
  document.getElementById('w1v').textContent=w1;
  const i12=Z2/Z1,i23=Z3/Z2,itot=Z3/Z1;
  const w3=w1/itot;
  document.getElementById('i12').textContent=i12.toFixed(2);
  document.getElementById('i23').textContent=i23.toFixed(2);
  document.getElementById('itot').textContent=itot.toFixed(2);
  document.getElementById('w3v').textContent=w3.toFixed(1)+' rpm';
  document.getElementById('tratio').textContent=itot.toFixed(2);
}
function animate(){
  const Z1=+document.getElementById('z1').value,Z2=+document.getElementById('z2').value,Z3=+document.getElementById('z3').value;
  const w1=+document.getElementById('w1').value;
  const sc=1.8,r1=Z1*sc,r2=Z2*sc,r3=Z3*sc;
  const speed=w1/60*0.05;
  angle1+=speed;
  const angle2=-angle1*Z1/Z2;
  const angle3=-angle2*Z2/Z3;
  ctx.clearRect(0,0,540,350);
  // Positions: gears mesh
  const x1=100,y1=175;
  const x2=x1+r1+r2+12,y2=175;
  const x3=x2+r2+r3+12,y3=175;
  // Connection lines
  ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke();ctx.setLineDash([]);
  drawGear(x1,y1,r1,Z1,angle1,'#ff6b6b','Z₁='+Z1);
  drawGear(x2,y2,r2,Z2,angle2,'#ffd93d','Z₂='+Z2);
  drawGear(x3,y3,r3,Z3,angle3,'#4ecdc4','Z₃='+Z3);
  // Speed labels
  ctx.font='10px monospace';ctx.textAlign='center';
  ctx.fillStyle='#ff6b6b';ctx.fillText(w1+' rpm',x1,y1+r1+38);
  ctx.fillStyle='#ffd93d';ctx.fillText((w1*Z1/Z2).toFixed(0)+' rpm',x2,y2+r2+38);
  ctx.fillStyle='#4ecdc4';ctx.fillText((w1*Z1/Z3).toFixed(0)+' rpm',x3,y3+r3+38);
  // Direction arrows
  const dirs=[{x:x1,y:y1,r:r1,cw:true,c:'#ff6b6b'},{x:x2,y:y2,r:r2,cw:false,c:'#ffd93d'},{x:x3,y:y3,r:r3,cw:true,c:'#4ecdc4'}];
  dirs.forEach(d=>{
    ctx.strokeStyle=d.c+'80';ctx.lineWidth=1.5;
    const sa=d.cw?-0.5:0.5,ea=d.cw?1:2.5;
    ctx.beginPath();ctx.arc(d.x,d.y,d.r+18,sa,ea);ctx.stroke();
    const ae=d.cw?ea:sa;const ax=d.x+(d.r+18)*Math.cos(ae),ay=d.y+(d.r+18)*Math.sin(ae);
    ctx.fillStyle=d.c+'80';ctx.beginPath();ctx.arc(ax,ay,3,0,Math.PI*2);ctx.fill();
  });
  requestAnimationFrame(animate);
}
update();animate();
</script></body></html>`;
}

// ─── Template Upgrade Functions ───

function upgradeLogicGate(template) {
  const C = template.colorScheme;
  const bg = C.background;
  
  // Slide 0: Keep title (already good)
  
  // Slide 1: Improved theory with LaTeX elements and glass boxes
  template.slides[1] = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Cổng logic — Lý thuyết</h2>`),
    shapeDivider(C.primary, 62),
    // Glass box left - Boolean operations
    glassBox(30, 75, 440, 210, C.primary),
    textEl(45, 82, 410, 30, `<p style="color:${C.primary};font-size:15px;font-weight:bold">⚡ Phép toán Boolean cơ bản</p>`),
    textEl(45, 112, 410, 160, `<ul style="color:${C.text};font-size:17px;line-height:2"><li><b>AND:</b> Y = A · B — cả 2 = 1 → output 1</li><li><b>OR:</b> Y = A + B — ít nhất 1 = 1 → output 1</li><li><b>NOT:</b> Y = A̅ — đảo input</li><li><b>XOR:</b> Y = A ⊕ B — khác nhau → 1</li></ul>`, 3),
    // Glass box right - Universal gates
    glassBox(490, 75, 440, 210, C.accent),
    textEl(505, 82, 410, 30, `<p style="color:${C.accent};font-size:15px;font-weight:bold">🔧 Universal Gates</p>`),
    textEl(505, 112, 410, 160, `<ul style="color:${C.text};font-size:17px;line-height:2"><li><b>NAND</b> = NOT(AND) — universal gate</li><li><b>NOR</b> = NOT(OR) — universal gate</li><li>Mọi mạch logic đều xây từ NAND hoặc NOR</li><li><b>XNOR:</b> Y = (A ⊕ B)̅ — equality gate</li></ul>`, 3),
    // Bottom: DeMorgan
    glassBox(30, 300, 900, 100, '#ffd93d'),
    textEl(45, 305, 200, 30, `<p style="color:#ffd93d;font-size:15px;font-weight:bold">📐 Định lý DeMorgan</p>`),
    latexEl(45, 340, 400, 50, `\\overline{A \\cdot B} = \\bar{A} + \\bar{B}`, 4),
    latexEl(490, 340, 400, 50, `\\overline{A + B} = \\bar{A} \\cdot \\bar{B}`, 4),
  ]);

  // Slide 2: Keep existing simulator (Logic Gate Visualizer)
  
  // Insert new slide 3: Combinational Circuit
  const combSlide = makeSlide(bg, [
    shapeBar(C.primary, 4),
    htmlEmbed(10, 15, 940, 520, logicGateCombinationalHTML()),
  ]);
  
  // Slide 3 (was usage guide) - improve it
  const usageSlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Hướng dẫn sử dụng</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 290, C.primary),
    textEl(45, 82, 410, 30, `<p style="color:${C.primary};font-size:15px;font-weight:bold">🎮 Slide "Logic Gate Visualizer"</p>`),
    textEl(45, 115, 410, 240, `<ol style="color:${C.text};font-size:16px;line-height:2.2"><li>Click nút <b>A</b> hoặc <b>B</b> để toggle 0/1</li><li>Chọn loại gate: AND, OR, NAND, NOR, XOR, XNOR, NOT</li><li>Quan sát output thay đổi real-time</li><li>Truth table highlight dòng tương ứng</li><li>NOT chỉ sử dụng 1 input (A)</li></ol>`, 3),
    glassBox(490, 75, 440, 290, C.accent),
    textEl(505, 82, 410, 30, `<p style="color:${C.accent};font-size:15px;font-weight:bold">🔗 Slide "Combinational Circuit"</p>`),
    textEl(505, 115, 410, 240, `<ol style="color:${C.text};font-size:16px;line-height:2.2"><li>Chọn Gate 1 (A,B → M) từ dropdown</li><li>Chọn Gate 2 (M,C → Y) từ dropdown</li><li>Click A, B, C để toggle input</li><li>Xem tín hiệu trung gian M</li><li>Biểu thức logic Y cập nhật tự động</li></ol>`, 3),
  ]);
  
  // Slide 4 (was Q&A) - upgrade to Key Takeaways
  const takeawaySlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:${C.primary}">📌 Key Takeaways</h1>`),
    shapeDivider(C.primary, 140),
    glassBox(60, 160, 400, 80, C.primary),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.primary}">01</b> — NAND và NOR là universal gates, xây mọi mạch logic</p>`, 3),
    glassBox(500, 160, 400, 80, C.accent),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.accent}">02</b> — DeMorgan biến AND↔OR qua phủ định</p>`, 3),
    glassBox(60, 260, 400, 80, '#ffd93d'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">03</b> — Combinational: output = f(inputs hiện tại)</p>`, 3),
    glassBox(500, 260, 400, 80, '#a78bfa'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#a78bfa">04</b> — Ứng dụng: ALU, Adder, MUX, Encoder</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  // Rebuild slides array
  const existingSimSlide = template.slides[2]; // the HTML simulation
  template.slides = [
    template.slides[0], // title
    template.slides[1], // theory (updated above)
    existingSimSlide,    // existing simulation
    combSlide,           // NEW: combinational circuit
    usageSlide,          // usage guide (improved)
    takeawaySlide,       // key takeaways (replaces Q&A)
  ];
}

function upgradeRLC(template) {
  const C = template.colorScheme;
  const bg = C.background;
  
  // Slide 1: Improved theory with LaTeX elements
  template.slides[1] = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 600, 45, `<h2 style="color:${C.primary}">Mạch RLC — Đáp ứng tần số</h2>`),
    shapeDivider(C.primary, 62),
    // Transfer function box
    glassBox(30, 75, 440, 170, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📐 Hàm truyền RLC nối tiếp</p>`),
    latexEl(60, 112, 390, 50, `H(j\\omega) = \\frac{1}{1 - \\omega^2 LC + j\\omega RC}`, 4),
    latexEl(60, 170, 200, 40, `f_0 = \\frac{1}{2\\pi\\sqrt{LC}}`, 4),
    textEl(270, 175, 180, 30, `<p style="color:${C.text}90;font-size:14px">← Tần số cộng hưởng</p>`, 3),
    // Quality factor box
    glassBox(490, 75, 440, 170, C.accent),
    textEl(505, 82, 410, 25, `<p style="color:${C.accent};font-size:14px;font-weight:bold">⚡ Hệ số phẩm chất Q</p>`),
    latexEl(520, 112, 250, 50, `Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}}`, 4),
    textEl(505, 170, 410, 60, `<ul style="color:${C.text};font-size:15px;line-height:1.8"><li>Q cao → đỉnh nhọn, chọn lọc tần số tốt</li><li>Q thấp → đỉnh tù, dải thông rộng</li></ul>`, 3),
    // Bandwidth box
    glassBox(30, 260, 900, 100, '#ffd93d'),
    textEl(45, 268, 200, 25, `<p style="color:#ffd93d;font-size:14px;font-weight:bold">📊 Bandwidth & Ứng dụng</p>`),
    latexEl(45, 298, 200, 40, `BW = \\frac{f_0}{Q}`, 4),
    textEl(280, 275, 630, 80, `<ul style="color:${C.text};font-size:15px;line-height:1.9"><li><b>Bộ lọc thông dải:</b> chọn tần số mong muốn, loại bỏ nhiễu</li><li><b>LC tank:</b> mạch dao động, radio tuner, PLL</li><li><b>R lớn:</b> giảm Q → damping nhanh hơn</li></ul>`, 3),
  ]);

  // Insert phasor diagram slide after existing simulation
  const phasorSlide = makeSlide(bg, [
    shapeBar(C.primary, 4),
    htmlEmbed(10, 15, 940, 520, rlcPhasorHTML()),
  ]);

  const usageSlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Hướng dẫn sử dụng</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 280, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📈 Frequency Response</p>`),
    textEl(45, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Kéo slider R, L, C để thay đổi thông số</li><li>Quan sát đỉnh cộng hưởng di chuyển</li><li>R lớn → đỉnh thấp, Q giảm</li><li>Xem metrics: f₀, Q, BW realtime</li></ol>`, 3),
    glassBox(490, 75, 440, 280, C.accent),
    textEl(505, 82, 410, 25, `<p style="color:${C.accent};font-size:14px;font-weight:bold">🔄 Impedance Phasor</p>`),
    textEl(505, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Điều chỉnh R, L, C, f để xem phasor</li><li>Vector R (đỏ) nằm ngang</li><li>X<sub>L</sub> hướng lên, X<sub>C</sub> hướng xuống</li><li>Z (xanh lá) = vector tổng → |Z|, φ</li></ol>`, 3),
  ]);

  const takeawaySlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:${C.primary}">📌 Key Takeaways</h1>`),
    shapeDivider(C.primary, 140),
    glassBox(60, 160, 400, 80, C.primary),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.primary}">01</b> — Cộng hưởng khi X<sub>L</sub> = X<sub>C</sub>, Z = R (thuần trở)</p>`, 3),
    glassBox(500, 160, 400, 80, C.accent),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.accent}">02</b> — Q càng cao → chọn lọc tần số càng tốt</p>`, 3),
    glassBox(60, 260, 400, 80, '#ffd93d'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">03</b> — Phasor: R nằm ngang, L hướng lên, C hướng xuống</p>`, 3),
    glassBox(500, 260, 400, 80, '#a78bfa'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#a78bfa">04</b> — BW = f₀/Q: trade-off giữa độ nhọn vs dải thông</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  const existingSimSlide = template.slides[2];
  template.slides = [
    template.slides[0],
    template.slides[1],
    existingSimSlide,
    phasorSlide,
    usageSlide,
    takeawaySlide,
  ];
}

function upgradePID(template) {
  const C = template.colorScheme;
  const bg = C.background;
  
  // Slide 1: Improved theory
  template.slides[1] = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">PID — Lý thuyết điều khiển</h2>`),
    shapeDivider(C.primary, 62),
    // PID formula box
    glassBox(30, 75, 900, 90, C.primary),
    textEl(45, 80, 200, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📐 Luật điều khiển PID</p>`),
    latexEl(200, 105, 560, 50, `u(t) = K_p \\, e(t) + K_i \\int_0^t e(\\tau)\\,d\\tau + K_d \\, \\frac{de(t)}{dt}`, 4),
    // Three columns: P, I, D
    glassBox(30, 180, 290, 190, '#ff6b6b'),
    textEl(45, 185, 260, 25, `<p style="color:#ff6b6b;font-size:14px;font-weight:bold">P — Proportional</p>`),
    textEl(45, 215, 260, 145, `<ul style="color:${C.text};font-size:14px;line-height:1.9"><li>Phản ứng theo sai số hiện tại</li><li>K<sub>p</sub> ↑ → response nhanh hơn</li><li>K<sub>p</sub> quá lớn → dao động</li><li>Không triệt tiêu SS error</li></ul>`, 3),
    glassBox(335, 180, 290, 190, '#ffd93d'),
    textEl(350, 185, 260, 25, `<p style="color:#ffd93d;font-size:14px;font-weight:bold">I — Integral</p>`),
    textEl(350, 215, 260, 145, `<ul style="color:${C.text};font-size:14px;line-height:1.9"><li>Tích lũy sai số theo thời gian</li><li>Triệt tiêu SS error = 0</li><li>K<sub>i</sub> quá lớn → overshoot</li><li>Wind-up khi saturation</li></ul>`, 3),
    glassBox(640, 180, 290, 190, '#4ecdc4'),
    textEl(655, 185, 260, 25, `<p style="color:#4ecdc4;font-size:14px;font-weight:bold">D — Derivative</p>`),
    textEl(655, 215, 260, 145, `<ul style="color:${C.text};font-size:14px;line-height:1.9"><li>Dự đoán xu hướng sai số</li><li>Giảm overshoot hiệu quả</li><li>K<sub>d</sub> → damping tốt hơn</li><li>Nhạy với nhiễu tần số cao</li></ul>`, 3),
    // Plant info
    glassBox(30, 385, 900, 50, C.primary),
    textEl(45, 390, 200, 30, `<p style="color:${C.text}90;font-size:14px"><b>Plant:</b></p>`, 3),
    latexEl(200, 392, 300, 35, `G(s) = \\frac{1}{s^2 + 2s + 1}`, 4),
    textEl(520, 390, 380, 30, `<p style="color:${C.text}70;font-size:13px">Hệ bậc 2, poles tại s = -1 (critically damped)</p>`, 3),
  ]);

  // New comparison slide
  const compareSlide = makeSlide(bg, [
    shapeBar(C.primary, 4),
    htmlEmbed(10, 15, 940, 520, pidCompareHTML()),
  ]);

  const usageSlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Hướng dẫn sử dụng</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 280, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">🎛️ PID Tuning</p>`),
    textEl(45, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Kéo slider Kp, Ki, Kd để thay đổi</li><li>Mode "P only" / "PI" / "PID" so sánh</li><li>Quan sát Rise time, Overshoot, Settling</li><li>"Ziegler-Nichols" → auto-tune</li></ol>`, 3),
    glassBox(490, 75, 440, 280, C.accent || '#4ecdc4'),
    textEl(505, 82, 410, 25, `<p style="color:${C.accent || '#4ecdc4'};font-size:14px;font-weight:bold">📊 P vs PI vs PID Compare</p>`),
    textEl(505, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>3 đường cong cùng hiển thị</li><li><span style="color:#ff6b6b">●</span> P: có SS error, không overshoot</li><li><span style="color:#ffd93d">●</span> PI: SS=0, có overshoot</li><li><span style="color:#00ff87">●</span> PID: SS=0, ít overshoot</li></ol>`, 3),
  ]);

  const takeawaySlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:${C.primary}">📌 Key Takeaways</h1>`),
    shapeDivider(C.primary, 140),
    glassBox(60, 160, 400, 80, '#ff6b6b'),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ff6b6b">P</b> — Response nhanh nhưng luôn có steady-state error</p>`, 3),
    glassBox(500, 160, 400, 80, '#ffd93d'),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">PI</b> — Triệt tiêu SS error nhưng tăng overshoot</p>`, 3),
    glassBox(60, 260, 400, 80, '#4ecdc4'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#4ecdc4">PID</b> — Cân bằng: SS=0, giảm overshoot bằng D</p>`, 3),
    glassBox(500, 260, 400, 80, '#a78bfa'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#a78bfa">Tip</b> — Ziegler-Nichols: tìm K<sub>u</sub>, T<sub>u</sub> → tính Kp,Ki,Kd</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  const existingSimSlide = template.slides[2];
  template.slides = [
    template.slides[0],
    template.slides[1],
    existingSimSlide,
    compareSlide,
    usageSlide,
    takeawaySlide,
  ];
}

function upgradeBodePlot(template) {
  const C = template.colorScheme;
  const bg = C.background;
  
  // Slide 1: Improved theory
  template.slides[1] = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 600, 45, `<h2 style="color:${C.primary}">Biểu đồ Bode — Lý thuyết</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 145, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📐 Bode Magnitude</p>`),
    latexEl(60, 112, 380, 45, `|H|_{dB} = 20\\log_{10}|H(j\\omega)|`, 4),
    textEl(60, 165, 380, 40, `<p style="color:${C.text}90;font-size:14px">Trục x: log(ω), trục y: dB</p>`, 3),
    glassBox(490, 75, 440, 145, C.accent || '#ff6b6b'),
    textEl(505, 82, 410, 25, `<p style="color:${C.accent || '#ff6b6b'};font-size:14px;font-weight:bold">📐 Bode Phase</p>`),
    latexEl(520, 112, 380, 45, `\\angle H(j\\omega) = \\arctan\\left(\\frac{\\text{Im}}{\\text{Re}}\\right)`, 4),
    textEl(520, 165, 380, 40, `<p style="color:${C.text}90;font-size:14px">Đơn vị: độ (°), range [-180°, 0°]</p>`, 3),
    // Stability margins
    glassBox(30, 235, 900, 130, '#ffd93d'),
    textEl(45, 240, 300, 25, `<p style="color:#ffd93d;font-size:14px;font-weight:bold">⚠️ Chỉ tiêu ổn định</p>`),
    textEl(45, 270, 430, 90, `<ul style="color:${C.text};font-size:15px;line-height:2"><li><b style="color:#ff6b6b">Gain Margin:</b> |H| tại pha = −180°</li><li><b style="color:#4ecdc4">Phase Margin:</b> φ tại |H| = 0 dB</li><li><b>Bandwidth:</b> ω khi |H| giảm −3dB</li></ul>`, 3),
    textEl(490, 270, 420, 90, `<ul style="color:${C.text};font-size:15px;line-height:2"><li>GM > 0 dB → <span style="color:#00ff87">ổn định</span></li><li>PM > 45° → <span style="color:#00ff87">đủ damping</span></li><li>PM < 0° → <span style="color:#ff4757">mất ổn định</span></li></ul>`, 3),
  ]);

  // Pole-Zero Map slide
  const pzSlide = makeSlide(bg, [
    shapeBar(C.primary, 4),
    htmlEmbed(10, 15, 940, 520, bodePoleZeroHTML()),
  ]);

  const usageSlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Hướng dẫn sử dụng</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 280, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📈 Bode Plot Generator</p>`),
    textEl(45, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Nhập hệ số tử/mẫu của H(s)</li><li>Magnitude plot (dB) tự động vẽ</li><li>Phase plot (°) tương ứng</li><li>Xem Gain/Phase margins</li></ol>`, 3),
    glassBox(490, 75, 440, 280, '#ff4757'),
    textEl(505, 82, 410, 25, `<p style="color:#ff4757;font-size:14px;font-weight:bold">📍 Pole-Zero Map</p>`),
    textEl(505, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Chọn preset system từ panel</li><li><span style="color:#ff4757">✗</span> = poles, <span style="color:${C.primary}">○</span> = zeros</li><li>Left Half Plane → stable</li><li>Tự động check ổn định</li></ol>`, 3),
  ]);

  const takeawaySlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:${C.primary}">📌 Key Takeaways</h1>`),
    shapeDivider(C.primary, 140),
    glassBox(60, 160, 400, 80, C.primary),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.primary}">01</b> — Bode plot: dB=20log|H| + phase vs log(ω)</p>`, 3),
    glassBox(500, 160, 400, 80, '#ff6b6b'),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ff6b6b">02</b> — GM, PM dương → hệ thống ổn định</p>`, 3),
    glassBox(60, 260, 400, 80, '#ffd93d'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">03</b> — Poles LHP = stable, RHP = unstable</p>`, 3),
    glassBox(500, 260, 400, 80, '#a78bfa'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#a78bfa">04</b> — Zeros ảnh hưởng đường cong, không ảnh hưởng ổn định</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  const existingSimSlide = template.slides[2];
  template.slides = [
    template.slides[0],
    template.slides[1],
    existingSimSlide,
    pzSlide,
    usageSlide,
    takeawaySlide,
  ];
}

function upgradeThreePhase(template) {
  const C = template.colorScheme;
  const bg = C.background;

  // Slide 1: Improved theory
  template.slides[1] = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 600, 45, `<h2 style="color:${C.primary}">Hệ thống điện 3 pha — Lý thuyết</h2>`),
    shapeDivider(C.primary, 62),
    // Voltage equations
    glassBox(30, 75, 440, 175, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">⚡ Điện áp 3 pha cân bằng (lệch 120°)</p>`),
    latexEl(60, 115, 380, 35, `V_a = V_m \\sin(\\omega t)`, 4),
    latexEl(60, 155, 380, 35, `V_b = V_m \\sin(\\omega t - 120°)`, 4),
    latexEl(60, 195, 380, 35, `V_c = V_m \\sin(\\omega t + 120°)`, 4),
    // Properties
    glassBox(490, 75, 440, 175, '#ffd93d'),
    textEl(505, 82, 410, 25, `<p style="color:#ffd93d;font-size:14px;font-weight:bold">📐 Tính chất quan trọng</p>`),
    latexEl(520, 115, 350, 35, `V_a + V_b + V_c = 0 \\;\\text{(luôn luôn)}`, 4),
    latexEl(520, 160, 350, 35, `V_{line} = \\sqrt{3} \\times V_{phase}`, 4),
    textEl(520, 205, 390, 35, `<p style="color:${C.text}90;font-size:14px">Vline ≈ 1.732 × Vpha (star connection)</p>`, 3),
    // Power
    glassBox(30, 265, 900, 100, '#4ecdc4'),
    textEl(45, 272, 300, 25, `<p style="color:#4ecdc4;font-size:14px;font-weight:bold">🔌 Công suất 3 pha</p>`),
    latexEl(45, 302, 350, 40, `P_{3\\phi} = \\sqrt{3} \\, V_L \\, I_L \\, \\cos\\phi`, 4),
    textEl(430, 280, 480, 80, `<ul style="color:${C.text};font-size:14px;line-height:2"><li><b>Công suất không đổi</b> theo thời gian (không nhấp nháy)</li><li><b>Tiết kiệm dây dẫn</b> 25% so với 1 pha tương đương</li><li>Tạo <b>từ trường quay</b> cho động cơ không đồng bộ</li></ul>`, 3),
  ]);

  // Phasor diagram slide
  const phasorSlide = makeSlide(bg, [
    shapeBar(C.primary, 4),
    htmlEmbed(10, 15, 940, 520, threePhPhasorHTML()),
  ]);

  const usageSlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(40, 18, 400, 45, `<h2 style="color:${C.primary}">Hướng dẫn sử dụng</h2>`),
    shapeDivider(C.primary, 62),
    glassBox(30, 75, 440, 280, C.primary),
    textEl(45, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">📊 3-Phase Waveform</p>`),
    textEl(45, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Kéo slider Frequency, Amplitude</li><li>3 sóng sin lệch 120° nhau</li><li>Tổng luôn = 0 (xác minh bằng metrics)</li><li>Pause/Resume để phân tích</li></ol>`, 3),
    glassBox(490, 75, 440, 280, '#ff6b6b'),
    textEl(505, 82, 410, 25, `<p style="color:#ff6b6b;font-size:14px;font-weight:bold">🔄 Rotating Phasor</p>`),
    textEl(505, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>3 vector quay với tốc độ ω</li><li><span style="color:#ff6b6b">●</span> A, <span style="color:#ffd93d">●</span> B, <span style="color:#4ecdc4">●</span> C lệch 120°</li><li>Waveform (phải) = projection theo thời gian</li><li>ΣV luôn ≈ 0</li></ol>`, 3),
  ]);

  const takeawaySlide = makeSlide(bg, [
    shapeBar(C.primary),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:${C.primary}">📌 Key Takeaways</h1>`),
    shapeDivider(C.primary, 140),
    glassBox(60, 160, 400, 80, C.primary),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:${C.primary}">01</b> — 3 pha lệch 120°, tổng = 0 mọi thời điểm</p>`, 3),
    glassBox(500, 160, 400, 80, '#ff6b6b'),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ff6b6b">02</b> — V<sub>line</sub> = √3 × V<sub>phase</sub></p>`, 3),
    glassBox(60, 260, 400, 80, '#ffd93d'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">03</b> — Công suất 3 pha = const (không nhấp nháy)</p>`, 3),
    glassBox(500, 260, 400, 80, '#4ecdc4'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#4ecdc4">04</b> — Tạo từ trường quay cho motor 3 pha</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  const existingSimSlide = template.slides[2];
  template.slides = [
    template.slides[0],
    template.slides[1],
    existingSimSlide,
    phasorSlide,
    usageSlide,
    takeawaySlide,
  ];
}

function upgradeGearTrain(template) {
  const C = template.colorScheme;
  const bg = C.background;

  // Slide 1: Improved theory
  template.slides[1] = makeSlide(bg, [
    shapeBar('#64ffda'),
    textEl(40, 18, 600, 45, `<h2 style="color:#64ffda">Truyền động bánh răng — Lý thuyết</h2>`),
    shapeDivider('#64ffda', 62),
    // Main formula
    glassBox(30, 75, 440, 155, '#64ffda'),
    textEl(45, 82, 410, 25, `<p style="color:#64ffda;font-size:14px;font-weight:bold">📐 Tỷ số truyền</p>`),
    latexEl(60, 112, 390, 55, `i = \\frac{Z_2}{Z_1} = \\frac{n_1}{n_2} = \\frac{T_2}{T_1}`, 4),
    textEl(60, 175, 390, 45, `<p style="color:${C.text}90;font-size:14px">Z: số răng, n: tốc độ quay, T: moment xoắn</p>`, 3),
    // Properties
    glassBox(490, 75, 440, 155, C.primary),
    textEl(505, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">⚙️ Đặc tính</p>`),
    textEl(505, 112, 410, 110, `<ul style="color:${C.text};font-size:15px;line-height:2"><li><b>i > 1:</b> giảm tốc, tăng moment xoắn</li><li><b>i < 1:</b> tăng tốc, giảm moment</li><li><b>i = 1:</b> truyền thẳng 1:1</li></ul>`, 3),
    // Multi-stage
    glassBox(30, 245, 440, 120, '#ffd93d'),
    textEl(45, 252, 410, 25, `<p style="color:#ffd93d;font-size:14px;font-weight:bold">🔗 Truyền động nhiều cấp</p>`),
    latexEl(60, 282, 380, 40, `i_{total} = i_1 \\times i_2 = \\frac{Z_2}{Z_1} \\times \\frac{Z_3}{Z_2} = \\frac{Z_3}{Z_1}`, 4),
    textEl(60, 330, 380, 30, `<p style="color:${C.text}80;font-size:13px">→ Gear giữa (idler) hủy nhau, chỉ còn bánh đầu/cuối</p>`, 3),
    // Efficiency
    glassBox(490, 245, 440, 120, '#ff6b6b'),
    textEl(505, 252, 410, 25, `<p style="color:#ff6b6b;font-size:14px;font-weight:bold">⚡ Hiệu suất</p>`),
    textEl(505, 282, 410, 80, `<ul style="color:${C.text};font-size:15px;line-height:2"><li>η ≈ 96–99% (bánh răng trụ)</li><li>η ≈ 90–95% (bánh răng côn)</li><li>η ≈ 40–80% (trục vít, tự hãm)</li></ul>`, 3),
  ]);

  // Multi-stage gear train slide
  const multiStageSlide = makeSlide(bg, [
    shapeBar('#64ffda', 4),
    htmlEmbed(10, 15, 940, 520, gearMultiStageHTML()),
  ]);

  const usageSlide = makeSlide(bg, [
    shapeBar('#64ffda'),
    textEl(40, 18, 400, 45, `<h2 style="color:#64ffda">Hướng dẫn sử dụng</h2>`),
    shapeDivider('#64ffda', 62),
    glassBox(30, 75, 440, 280, '#64ffda'),
    textEl(45, 82, 410, 25, `<p style="color:#64ffda;font-size:14px;font-weight:bold">⚙️ Gear Train (2 bánh)</p>`),
    textEl(45, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Kéo slider Z₁, Z₂ thay đổi số răng</li><li>Quan sát tốc độ quay thay đổi</li><li>Thông số i, tốc độ, moment tự cập nhật</li><li>Bánh lớn quay chậm nhưng mạnh hơn</li></ol>`, 3),
    glassBox(490, 75, 440, 280, C.primary),
    textEl(505, 82, 410, 25, `<p style="color:${C.primary};font-size:14px;font-weight:bold">🔗 Multi-Stage (3 bánh)</p>`),
    textEl(505, 112, 410, 230, `<ol style="color:${C.text};font-size:16px;line-height:2"><li>Kéo Z₁, Z₂, Z₃ riêng biệt</li><li>3 bánh răng ăn khớp trực quan</li><li>i<sub>total</sub> = Z₃/Z₁ bất kể Z₂</li><li>Tốc độ ω₃ output tự tính</li></ol>`, 3),
  ]);

  const takeawaySlide = makeSlide(bg, [
    shapeBar('#64ffda'),
    textEl(60, 80, 840, 60, `<h1 style="text-align:center;color:#64ffda">📌 Key Takeaways</h1>`),
    shapeDivider('#64ffda', 140),
    glassBox(60, 160, 400, 80, '#64ffda'),
    textEl(75, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#64ffda">01</b> — i = Z₂/Z₁ = n₁/n₂ = T₂/T₁</p>`, 3),
    glassBox(500, 160, 400, 80, '#ff6b6b'),
    textEl(515, 170, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ff6b6b">02</b> — i > 1: giảm tốc, tăng moment (reducer)</p>`, 3),
    glassBox(60, 260, 400, 80, '#ffd93d'),
    textEl(75, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#ffd93d">03</b> — Multi-stage: i<sub>total</sub> = tích các i từng cấp</p>`, 3),
    glassBox(500, 260, 400, 80, '#4ecdc4'),
    textEl(515, 270, 370, 60, `<p style="color:${C.text};font-size:16px;line-height:1.6"><b style="color:#4ecdc4">04</b> — Hiệu suất: trụ 96-99%, côn 90-95%</p>`, 3),
    textEl(160, 380, 640, 40, `<p style="text-align:center;color:${C.text}80;font-size:15px">Cảm ơn đã theo dõi! 🎓</p>`),
  ]);

  const existingSimSlide = template.slides[2];
  template.slides = [
    template.slides[0],
    template.slides[1],
    existingSimSlide,
    multiStageSlide,
    usageSlide,
    takeawaySlide,
  ];
}

// ─── Main ───
function main() {
  console.log('Reading built-in-templates.json...');
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  
  const upgrades = [
    { match: 'Logic Gate', fn: upgradeLogicGate },
    { match: 'RLC Frequency', fn: upgradeRLC },
    { match: 'PID Controller', fn: upgradePID },
    { match: 'Bode Plot', fn: upgradeBodePlot },
    { match: '3-Phase Power', fn: upgradeThreePhase },
    { match: 'Gear Train', fn: upgradeGearTrain },
  ];

  let count = 0;
  upgrades.forEach(({ match, fn }) => {
    const template = data.find(t => t.title && t.title.includes(match));
    if (!template) {
      console.warn(`  ⚠ Template "${match}" not found, skipping`);
      return;
    }
    console.log(`  Upgrading: ${template.title} (${template.slides.length} slides → ...)`);
    fn(template);
    console.log(`    → ${template.slides.length} slides`);
    count++;
  });

  // Backup first
  const backupPath = DATA_PATH + '.backup-' + Date.now();
  fs.copyFileSync(DATA_PATH, backupPath);
  console.log(`\nBackup saved to: ${backupPath}`);

  // Write updated data
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ Updated ${count} interactive templates`);
  console.log('Done!');
}

main();
