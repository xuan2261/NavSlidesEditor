import { useState } from 'react'

const ALLOWED_MATH_TOKENS = /^(?:[0-9+\-*/().%\s,]|u|v|sin|cos|tan|abs|sqrt|pow|exp|log|ceil|floor|round|min|max|PI|E|asin|acos|atan|atan2)+$/

function sanitizeMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return '0'
  const trimmed = expr.trim()
  if (!ALLOWED_MATH_TOKENS.test(trimmed)) return '0'
  return trimmed
}

const PRESETS = [
  { name: 'Cartesian', x: 'u', y: 'v' },
  { name: 'Polar', x: 'u*cos(v)', y: 'u*sin(v)' },
  { name: 'Wave Mesh', x: 'u', y: 'v+sin(u*3)*0.3' },
  { name: 'Log Polar', x: 'log(u+1)*cos(v)', y: 'log(u+1)*sin(v)' },
  { name: 'Perspective', x: 'u/(1+abs(v)*0.2)', y: 'v/(1+abs(u)*0.2)' },
  { name: 'Gravity Well', x: 'u/(1+u*u+v*v)', y: 'v/(1+u*u+v*v)' },
  { name: 'Saddle', x: 'u', y: 'v+u*v*0.1' },
  { name: 'Spiral', x: '(1+0.3*v)*cos(u)', y: '(1+0.3*v)*sin(u)' },
  { name: 'Diamond', x: 'u+v', y: 'u-v' },
  { name: 'Sinusoidal', x: 'u+sin(v)', y: 'v+sin(u)' },
  { name: 'Lissajous', x: 'sin(3*u)', y: 'sin(2*u)' },
]

function generateHTML(params) {
  const { xExpr, yExpr, uMin, uMax, vMin, vMax, uDiv, vDiv, color } = params
  const safeX = sanitizeMathExpr(xExpr || 'u')
  const safeY = sanitizeMathExpr(yExpr || 'v')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style></head><body><canvas id="c"></canvas><script>
var c=document.getElementById('c'),x=c.getContext('2d');
function resize(){c.width=c.offsetWidth*2;c.height=c.offsetHeight*2;draw()}
function eval2(expr,u,v){with(Math){return Function('u','v','with(Math){return('+expr+')}')(u,v)}}
function draw(){
var W=c.width,H=c.height,x0=W/2,y0=H/2,s=Math.min(W,H)*0.35;
x.clearRect(0,0,W,H);x.strokeStyle='${color||'#6366f1'}';x.lineWidth=1;
var uM=${uMin||0},uX=${uMax||6.28},vM=${vMin||0},vX=${vMax||6.28},uN=${uDiv||20},vN=${vDiv||20};
for(var i=0;i<=uN;i++){x.beginPath();
for(var j=0;j<=vN;j++){
var u=uM+(uX-uM)*i/uN,v=vM+(vX-vM)*j/vN;
var px=eval2('${safeX}',u,v),py=eval2('${safeY}',u,v);
var sx=x0+px*s,sy=y0-py*s;
j===0?x.moveTo(sx,sy):x.lineTo(sx,sy)}x.stroke()}
for(var j=0;j<=vN;j++){x.beginPath();
for(var i=0;i<=uN;i++){
var u=uM+(uX-uM)*i/uN,v=vM+(vX-vM)*j/vN;
var px=eval2('${safeX}',u,v),py=eval2('${safeY}',u,v);
var sx=x0+px*s,sy=y0-py*s;
i===0?x.moveTo(sx,sy):x.lineTo(sx,sy)}x.stroke()}
}
resize();window.onresize=resize;
</script></body></html>`
}

export default function ParametricMathGridSurfacePlotterModal({ onInsert, onClose }) {
  const [preset, setPreset] = useState(0)
  const [params, setParams] = useState({
    xExpr: 'u', yExpr: 'v',
    uMin: 0, uMax: 6.28, vMin: 0, vMax: 6.28,
    uDiv: 20, vDiv: 20,
    color: '#6366f1', gridStyle: 'wireframe',
  })

  const applyPreset = (i) => {
    setPreset(i)
    setParams((p) => ({ ...p, xExpr: PRESETS[i].x, yExpr: PRESETS[i].y }))
  }

  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[650px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border font-semibold text-text-primary">Math Grid</div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 border-r border-border overflow-y-auto p-2">
            {PRESETS.map((p, i) => (
              <button key={p.name} className={`w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer ${preset === i ? 'bg-accent text-white' : 'hover:bg-hover text-text-primary'}`} onClick={() => applyPreset(i)}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-text-muted mb-1">X(u,v)</div>
                <input className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs font-mono" value={params.xExpr} onChange={(e) => update('xExpr', e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] text-text-muted mb-1">Y(u,v)</div>
                <input className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs font-mono" value={params.yExpr} onChange={(e) => update('yExpr', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[['uMin', 'u min'], ['uMax', 'u max'], ['vMin', 'v min'], ['vMax', 'v max']].map(([k, l]) => (
                <div key={k}>
                  <div className="text-[11px] text-text-muted mb-1">{l}</div>
                  <input type="number" step={0.1} className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-xs" value={params[k]} onChange={(e) => update(k, +e.target.value)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-text-muted mb-1">u divisions</div>
                <input type="number" min={5} max={100} className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-xs" value={params.uDiv} onChange={(e) => update('uDiv', +e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] text-text-muted mb-1">v divisions</div>
                <input type="number" min={5} max={100} className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-xs" value={params.vDiv} onChange={(e) => update('vDiv', +e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] text-text-muted mb-1">Color</div>
                <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.color} onChange={(e) => update('color', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button className="btn btn-secondary px-4 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary px-4 py-1.5 text-sm" onClick={() => { onInsert(generateHTML(params)); onClose() }}>Insert</button>
        </div>
      </div>
    </div>
  )
}
