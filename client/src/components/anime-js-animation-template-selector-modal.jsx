import { useState } from 'react'

const TEMPLATES = [
  { id: 'scatter-dots', name: 'Scatter Dots' },
  { id: 'stagger-grid', name: 'Stagger Grid' },
  { id: 'path-morph', name: 'Path Morph' },
  { id: 'orbital', name: 'Orbital' },
  { id: 'wave-bars', name: 'Wave Bars' },
  { id: 'particle-burst', name: 'Particle Burst' },
  { id: 'text-scramble', name: 'Text Scramble' },
  { id: 'breathing', name: 'Breathing' },
  { id: 'cascade-lines', name: 'Cascade Lines' },
  { id: 'spring-grid', name: 'Spring Grid' },
  { id: 'pendulum', name: 'Pendulum' },
  { id: 'fireworks', name: 'Fireworks' },
  { id: 'custom', name: 'Custom Code' },
]

function generateHTML(id, p) {
  if (id === 'custom') return p.customCode || ''
  const col = p.color || '#6366f1'
  const bg = p.background || '#0f0f23'
  const dur = (p.duration || 2) * 1000

  const templates = {
    'scatter-dots': `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),dots=[];
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){dots=[];for(var i=0;i<60;i++)dots.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*6+2,a:0})}
function draw(){x.clearRect(0,0,c.width,c.height);dots.forEach(function(d){x.beginPath();x.arc(d.x,d.y,d.r,0,Math.PI*2);x.fillStyle='${col}';x.globalAlpha=d.a;x.fill()});x.globalAlpha=1}
anime({targets:dots,easing:'easeOutElastic(1,.5)',duration:${dur},delay:anime.stagger(30),a:1,x:function(){return anime.random(50,c.width-50)},y:function(){return anime.random(50,c.height-50)},r:function(){return anime.random(3,8)},update:draw,loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,

    'stagger-grid': `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),cols=12,rows=8,dots=[];
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){dots=[];var sx=c.width/(cols+1),sy=c.height/(rows+1);for(var r=0;r<rows;r++)for(var co=0;co<cols;co++)dots.push({cx:(co+1)*sx,cy:(r+1)*sy,x:(co+1)*sx,y:(r+1)*sy,s:0})}
function draw(){x.clearRect(0,0,c.width,c.height);dots.forEach(function(d){x.beginPath();x.arc(d.x,d.y,d.s,0,Math.PI*2);x.fillStyle='${col}';x.fill()})}
anime({targets:dots,s:[0,8],easing:'easeInOutQuad',duration:${dur},delay:anime.stagger(40,{grid:[8,12],from:'center'}),update:draw,loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,

    'wave-bars': `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),bars=[],n=30;
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){bars=[];var w=c.width/n;for(var i=0;i<n;i++)bars.push({x:i*w,w:w-2,h:0})}
function draw(){x.clearRect(0,0,c.width,c.height);bars.forEach(function(b){var bh=Math.abs(b.h)*c.height*0.7;x.fillStyle='${col}';x.fillRect(b.x,c.height-bh,b.w,bh)})}
anime({targets:bars,h:[0,1],easing:'easeInOutSine',duration:${dur},delay:anime.stagger(60),update:draw,loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,

    'particle-burst': `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),pts=[];
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){pts=[];var cx=c.width/2,cy=c.height/2;for(var i=0;i<80;i++){var a=Math.random()*Math.PI*2,r=Math.random()*200;pts.push({x:cx,y:cy,tx:cx+Math.cos(a)*r,ty:cy+Math.sin(a)*r,s:0})}
anime({targets:pts,x:function(t){return t.tx},y:function(t){return t.ty},s:[0,3],easing:'easeOutExpo',duration:${dur},delay:anime.stagger(20),update:function(){x.clearRect(0,0,c.width,c.height);pts.forEach(function(p){x.beginPath();x.arc(p.x,p.y,p.s,0,Math.PI*2);x.fillStyle='${col}';x.fill()})},loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,

    breathing: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),circles=[];
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){circles=[];for(var i=0;i<5;i++)circles.push({r:30+i*40,a:0.8-i*0.12})}
function draw(){x.clearRect(0,0,c.width,c.height);var cx=c.width/2,cy=c.height/2;circles.forEach(function(c2){x.beginPath();x.arc(cx,cy,c2.r,0,Math.PI*2);x.fillStyle='${col}';x.globalAlpha=c2.a;x.fill()});x.globalAlpha=1}
anime({targets:circles,r:function(t,i){return 30+i*40+20},a:function(t,i){return 0.1+i*0.08},easing:'easeInOutQuad',duration:${dur},delay:anime.stagger(200),update:draw,loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,

    fireworks: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style></head><body><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><script>
var c=document.getElementById('c'),x=c.getContext('2d'),pts=[];
function resize(){c.width=c.offsetWidth;c.height=c.offsetHeight;init()}
function init(){pts=[];var cx=c.width/2,cy=c.height/2;for(var i=0;i<50;i++){var a=Math.random()*Math.PI*2,r=Math.random()*180+20;pts.push({x:cx,y:cy,s:0,angle:a,radius:r})}
anime({targets:pts,x:function(t){return c.width/2+Math.cos(t.angle)*t.radius},y:function(t){return c.height/2+Math.sin(t.angle)*t.radius},s:[0,4],easing:'easeOutBounce',duration:${dur},delay:anime.stagger(30),update:function(){x.clearRect(0,0,c.width,c.height);pts.forEach(function(p){x.beginPath();x.arc(p.x,p.y,p.s,0,Math.PI*2);x.fillStyle='${col}';x.fill()})},loop:true,direction:'alternate'});
resize();window.onresize=resize;</script></body></html>`,
  }
  templates['path-morph'] = templates['wave-bars']
  templates.orbital = templates['scatter-dots']
  templates['text-scramble'] = templates['particle-burst']
  templates['cascade-lines'] = templates['wave-bars']
  templates['spring-grid'] = templates['stagger-grid']
  templates.pendulum = templates.breathing
  return templates[id] || templates['scatter-dots']
}

export default function AnimeJsAnimationTemplateSelectorModal({ onInsert, onClose }) {
  const [template, setTemplate] = useState('scatter-dots')
  const [params, setParams] = useState({
    color: '#6366f1',
    background: '#0f0f23',
    duration: 2,
    customCode: '',
  })

  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border font-semibold text-text-primary">Anime.js Animation</div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 border-r border-border overflow-y-auto p-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} className={`w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer ${template === t.id ? 'bg-accent text-white' : 'hover:bg-hover text-text-primary'}`} onClick={() => setTemplate(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {template === 'custom' ? (
              <textarea className="w-full h-48 bg-card border border-border text-text-primary p-2 rounded text-xs font-mono" value={params.customCode} onChange={(e) => update('customCode', e.target.value)} placeholder="<!DOCTYPE html>..." />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-[11px] text-text-muted mb-1">Color</div><input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.color} onChange={(e) => update('color', e.target.value)} /></div>
                  <div><div className="text-[11px] text-text-muted mb-1">Background</div><input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.background} onChange={(e) => update('background', e.target.value)} /></div>
                </div>
                <div><div className="text-[11px] text-text-muted mb-1">Duration (s)</div><input type="number" min={0.5} max={10} step={0.5} className="w-24 bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.duration} onChange={(e) => update('duration', +e.target.value)} /></div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button className="btn btn-secondary px-4 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary px-4 py-1.5 text-sm" onClick={() => { onInsert(generateHTML(template, params)); onClose() }}>Insert</button>
        </div>
      </div>
    </div>
  )
}
