// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky
// Template HTML strings ported from parallax-presentations
// (jbirky/parallax-presentations @ ce548c5, AGPL-3.0-or-later).
// Adapted into a NavSlides data module; UI shell rewritten locally.

export const ANIME_CDN = 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js'

export const TEMPLATES = [
  { id: 'scatter-dots', name: 'Scatter Dots', desc: 'Dots scatter from center then reform into a pattern' },
  { id: 'stagger-grid', name: 'Stagger Grid', desc: 'Grid of squares with ripple stagger animation' },
  { id: 'morph-path', name: 'Path Morph', desc: 'SVG path morphs between two shapes' },
  { id: 'orbit', name: 'Orbital', desc: 'Elements orbit around a central point' },
  { id: 'wave-bars', name: 'Wave Bars', desc: 'Vertical bars animate in a sine wave pattern' },
  { id: 'particle-burst', name: 'Particle Burst', desc: 'Particles explode outward and fade' },
  { id: 'text-scramble', name: 'Text Scramble', desc: 'Characters scramble then resolve into text' },
  { id: 'breathing', name: 'Breathing', desc: 'Concentric rings pulse with breathing rhythm' },
  { id: 'cascade-lines', name: 'Cascade Lines', desc: 'Horizontal lines draw on with staggered timing' },
  { id: 'spring-grid', name: 'Spring Grid', desc: 'Grid with elastic spring physics on hover' },
  { id: 'pendulum', name: 'Pendulum', desc: 'Swinging pendulum with trail' },
  { id: 'fireworks', name: 'Fireworks', desc: 'Bursts of colored particles like fireworks' },
  { id: 'custom', name: 'Custom Code', desc: 'Write your own anime.js animation from scratch' },
]

export const DEFAULT_CUSTOM = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="${ANIME_CDN}"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
body { display: flex; align-items: center; justify-content: center; }
.box { width: 50px; height: 50px; background: #6366f1; border-radius: 8px; }
</style>
</head><body>

<div class="box"></div>

<script>
anime({
  targets: '.box',
  translateX: 250,
  rotate: '1turn',
  backgroundColor: '#f59e0b',
  duration: 1500,
  direction: 'alternate',
  loop: true,
  easing: 'easeInOutQuad'
});
</script>
</body></html>`

export function generateAnimeHtml(templateId, params) {
  if (templateId === 'custom') return params.customCode || ''

  const { color, color2, count, duration, bg, size } = params
  const col = color || '#6366f1'
  const col2 = color2 || '#f59e0b'
  const n = count || 20
  const dur = (duration || 2) * 1000
  const background = bg || 'transparent'
  const sz = size || 10

  const base = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="${ANIME_CDN}"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:${background}}
body{display:flex;align-items:center;justify-content:center}
</style></head><body>`

  const end = `</body></html>`

  switch (templateId) {

    case 'scatter-dots': {
      return `${base}
<div id="container" style="position:relative;width:100%;height:100%"></div>
<script>
var W=window.innerWidth,H=window.innerHeight,c=document.getElementById('container');
for(var i=0;i<${n};i++){var d=document.createElement('div');d.className='dot';d.style.cssText='position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;background:${col};left:'+(W/2-${sz}/2)+'px;top:'+(H/2-${sz}/2)+'px;';c.appendChild(d)}
anime({targets:'.dot',translateX:function(){return anime.random(-W/2,W/2)},translateY:function(){return anime.random(-H/2,H/2)},scale:[0,function(){return anime.random(5,15)/10}],opacity:[0,1],duration:${dur},delay:anime.stagger(${Math.round(dur / n / 2)},{from:'center'}),easing:'easeOutElastic(1,.6)',direction:'alternate',loop:true});
</script>${end}`
    }

    case 'stagger-grid': {
      const cols = Math.ceil(Math.sqrt(n))
      const rows = Math.ceil(n / cols)
      return `${base}
<div id="grid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;width:${Math.min(cols * (sz + 12), 500)}px;height:${Math.min(rows * (sz + 12), 400)}px;"></div>
<script>
for(var i=0;i<${cols * rows};i++){var d=document.createElement('div');d.className='cell';d.style.cssText='background:${col};border-radius:${Math.round(sz * 0.2)}px;';document.getElementById('grid').appendChild(d)}
anime({targets:'.cell',scale:[{value:.1,easing:'easeOutSine',duration:${Math.round(dur * 0.25)}},{value:1,easing:'easeInOutQuad',duration:${Math.round(dur * 0.6)}}],opacity:[.3,1],borderRadius:['${Math.round(sz * 0.2)}px','50%','${Math.round(sz * 0.2)}px'],backgroundColor:['${col}','${col2}','${col}'],delay:anime.stagger(${Math.round(dur / (cols * rows) * 0.8)},{grid:[${cols},${rows}],from:'center'}),loop:true,direction:'alternate',easing:'easeInOutQuad'});
</script>${end}`
    }

    case 'morph-path': {
      return `${base}
<svg viewBox="0 0 400 400" width="80%" height="80%" style="display:block;margin:auto;">
  <path id="morph" d="M200 50 L350 150 L300 350 L100 350 L50 150 Z" fill="none" stroke="${col}" stroke-width="2" />
</svg>
<script>
var shapes=['M200 50 L350 150 L300 350 L100 350 L50 150 Z','M200 20 C350 20 380 200 380 200 C380 200 350 380 200 380 C50 380 20 200 20 200 C20 200 50 20 200 20 Z','M200 80 L240 170 L340 170 L260 230 L290 330 L200 270 L110 330 L140 230 L60 170 L160 170 Z'];
var idx=0;
function next(){idx=(idx+1)%shapes.length;anime({targets:'#morph',d:[{value:shapes[idx]}],stroke:idx%2===0?'${col}':'${col2}',duration:${dur},easing:'easeInOutQuad',complete:function(){setTimeout(next,${Math.round(dur * 0.3)})}});}
next();
</script>${end}`
    }

    case 'orbit': {
      return `${base}
<div id="orbit" style="position:relative;width:300px;height:300px;">
  <div style="position:absolute;left:50%;top:50%;width:${sz * 2}px;height:${sz * 2}px;margin:-${sz}px;background:${col};border-radius:50%;"></div>
</div>
<script>
var c=document.getElementById('orbit');
for(var i=0;i<${n};i++){var d=document.createElement('div');d.className='orb';d.style.cssText='position:absolute;left:50%;top:50%;width:${Math.max(4, sz * 0.6)}px;height:${Math.max(4, sz * 0.6)}px;margin:-${Math.max(2, sz * 0.3)}px;background:${col2};border-radius:50%;opacity:0.8;';c.appendChild(d)}
anime({targets:'.orb',translateX:function(el,i){return Math.cos(i*2*Math.PI/${n})*(80+i*3)},translateY:function(el,i){return Math.sin(i*2*Math.PI/${n})*(80+i*3)},scale:[0,1],opacity:[0,.8],delay:anime.stagger(${Math.round(dur / n * 0.5)}),duration:${Math.round(dur * 0.6)},easing:'easeOutExpo',complete:function(){anime({targets:'.orb',rotate:'1turn',duration:${dur * 2},easing:'linear',loop:true})}});
anime({targets:'#orbit',rotate:'1turn',duration:${dur * 4},easing:'linear',loop:true});
</script>${end}`
    }

    case 'wave-bars': {
      return `${base}
<div id="bars" style="display:flex;align-items:center;height:80%;gap:${Math.max(2, Math.round(sz * 0.3))}px;"></div>
<script>
for(var i=0;i<${n};i++){var d=document.createElement('div');d.className='bar';d.style.cssText='width:${Math.max(3, sz * 0.8)}px;height:20px;background:${col};border-radius:${Math.round(sz * 0.2)}px;';document.getElementById('bars').appendChild(d)}
anime({targets:'.bar',height:function(el,i){return[20,anime.random(40,200)]},backgroundColor:['${col}','${col2}','${col}'],duration:${dur},delay:anime.stagger(${Math.round(dur / n * 0.4)},{from:'center'}),direction:'alternate',loop:true,easing:'easeInOutSine'});
</script>${end}`
    }

    case 'particle-burst': {
      return `${base}
<div id="stage" style="position:relative;width:100%;height:100%;"></div>
<script>
function burst(){var s=document.getElementById('stage');s.innerHTML='';var cx=window.innerWidth/2,cy=window.innerHeight/2;
for(var i=0;i<${n};i++){var d=document.createElement('div');d.className='p';d.style.cssText='position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;left:'+cx+'px;top:'+cy+'px;background:'+(['${col}','${col2}','#fff'][i%3]);s.appendChild(d)}
anime({targets:'.p',translateX:function(){return anime.random(-300,300)},translateY:function(){return anime.random(-300,300)},scale:[{value:1,duration:100},{value:0,duration:${dur}}],opacity:[1,0],duration:${dur},easing:'easeOutExpo',complete:function(){setTimeout(burst,400)}});}
burst();
</script>${end}`
    }

    case 'text-scramble': {
      const text = params.text || 'ANIMATE'
      const escaped = text.replace(/'/g, "\\'")
      return `${base}
<div id="txt" style="font-size:${sz * 4}px;font-family:monospace;color:${col};letter-spacing:0.1em;white-space:pre;"></div>
<script>
var target='${escaped}',chars='!@#$%^&*()_+-=[]{}|;:,.<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',el=document.getElementById('txt');
function scramble(){var result=new Array(target.length).fill('');var done=new Array(target.length).fill(false);var frame=0;
function step(){var all=true;for(var i=0;i<target.length;i++){if(!done[i]){if(frame>i*3+10){done[i]=true;result[i]=target[i]}else{result[i]=chars[Math.floor(Math.random()*chars.length)];all=false}}};el.textContent=result.join('');frame++;if(!all)requestAnimationFrame(step);else setTimeout(function(){result=new Array(target.length).fill('');done=new Array(target.length).fill(false);frame=0;el.textContent='';setTimeout(step,300)},${dur});}step();}
scramble();
</script>${end}`
    }

    case 'breathing': {
      const rings = Math.min(n, 12)
      return `${base}
<svg id="svg" viewBox="0 0 400 400" width="80%" height="80%" style="display:block;margin:auto;">
${Array.from({ length: rings }, (_, i) => `  <circle class="ring" cx="200" cy="200" r="${20 + i * (150 / rings)}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.6"/>`).join('\n')}
</svg>
<script>
anime({targets:'.ring',r:function(el){return[parseFloat(el.getAttribute('r')),parseFloat(el.getAttribute('r'))*1.15]},opacity:[0.6,0.2],strokeWidth:[1.5,0.5],duration:${dur},delay:anime.stagger(${Math.round(dur / rings * 0.3)}),direction:'alternate',loop:true,easing:'easeInOutSine'});
</script>${end}`
    }

    case 'cascade-lines': {
      return `${base}
<svg id="svg" viewBox="0 0 500 400" width="90%" height="80%" style="display:block;margin:auto;" stroke-linecap="round">
${Array.from({ length: n }, (_, i) => {
  const y = 20 + i * (360 / n)
  return `  <line class="ln" x1="50" y1="${y}" x2="450" y2="${y}" stroke="${i % 2 === 0 ? col : col2}" stroke-width="${Math.max(1, sz * 0.3)}" opacity="0.7"/>`
}).join('\n')}
</svg>
<script>
document.querySelectorAll('.ln').forEach(function(l){var len=l.getTotalLength();l.style.strokeDasharray=len;l.style.strokeDashoffset=len;});
anime({targets:'.ln',strokeDashoffset:[anime.setDashoffset,0],opacity:[0.3,0.8],duration:${dur},delay:anime.stagger(${Math.round(dur / n * 0.6)}),easing:'easeInOutCubic',direction:'alternate',loop:true});
</script>${end}`
    }

    case 'spring-grid': {
      const cols = Math.ceil(Math.sqrt(n))
      const rows = Math.ceil(n / cols)
      const gap = Math.max(sz + 4, 20)
      return `${base}
<div id="grid" style="display:grid;grid-template-columns:repeat(${cols},${sz}px);gap:${gap - sz}px;"></div>
<script>
for(var i=0;i<${cols * rows};i++){var d=document.createElement('div');d.className='dot';d.style.cssText='width:${sz}px;height:${sz}px;border-radius:50%;background:${col};cursor:pointer;';document.getElementById('grid').appendChild(d)}
var anim=anime({targets:'.dot',scale:[{value:1.4,easing:'easeOutSine',duration:${Math.round(dur * 0.12)}},{value:1,easing:'easeOutElastic(1,.4)',duration:${Math.round(dur * 0.8)}}],backgroundColor:['${col}','${col2}','${col}'],delay:anime.stagger(${Math.round(dur / (cols * rows) * 0.6)},{grid:[${cols},${rows}],from:'center'}),loop:true,direction:'alternate'});
</script>${end}`
    }

    case 'pendulum': {
      return `${base}
<svg viewBox="0 0 400 400" width="80%" height="80%" style="display:block;margin:auto;">
  <line id="arm" x1="200" y1="40" x2="200" y2="300" stroke="${col}" stroke-width="2"/>
  <circle id="bob" cx="200" cy="300" r="${sz}" fill="${col}"/>
  ${Array.from({ length: 8 }, (_, i) => `<circle class="trail" cx="200" cy="300" r="${Math.max(2, sz * 0.3)}" fill="${col2}" opacity="${0.1 + i * 0.05}"/>`).join('\n')}
</svg>
<script>
anime({targets:'#arm',rotate:[{value:35,duration:${Math.round(dur * 0.5)}},{value:-35,duration:${dur}}],duration:${dur},easing:'easeInOutSine',direction:'alternate',loop:true,update:function(a){var angle=parseFloat(document.getElementById('arm').style.transform?.match(/[\\d.-]+/)?.[0]||0)*Math.PI/180;var bx=200+260*Math.sin(angle),by=40+260*Math.cos(angle);document.getElementById('bob').setAttribute('cx',bx);document.getElementById('bob').setAttribute('cy',by);document.getElementById('arm').setAttribute('x2',bx);document.getElementById('arm').setAttribute('y2',by);}});
anime({targets:'.trail',opacity:[0.3,0],scale:[1,0.3],duration:${Math.round(dur * 0.4)},delay:anime.stagger(60),loop:true,easing:'easeOutQuad'});
</script>${end}`
    }

    case 'fireworks': {
      return `${base}
<canvas id="c" style="width:100%;height:100%;display:block;"></canvas>
<script>
var c=document.getElementById('c'),ctx=c.getContext('2d');c.width=window.innerWidth;c.height=window.innerHeight;
var particles=[],colors=['${col}','${col2}','#fff','#f87171','#34d399','#fbbf24'];
function burst(x,y){for(var i=0;i<${n};i++){var a=Math.random()*Math.PI*2,v=2+Math.random()*4;particles.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,color:colors[Math.floor(Math.random()*colors.length)],r:${Math.max(2, sz * 0.4)}})}}
function draw(){ctx.fillStyle='rgba(${background === 'transparent' || background === '#000000' ? '0,0,0' : '10,10,20'},0.15)';ctx.fillRect(0,0,c.width,c.height);
for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life-=0.012;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;requestAnimationFrame(draw)}
function launch(){burst(c.width*0.2+Math.random()*c.width*0.6,c.height*0.2+Math.random()*c.height*0.4);setTimeout(launch,${Math.round(dur * 0.4)}+Math.random()*${Math.round(dur * 0.6)})}
draw();launch();
</script>${end}`
    }

    default:
      return `${base}<div style="color:#888;font-size:14px;">Select a template</div>${end}`
  }
}
