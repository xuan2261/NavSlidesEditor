import { useState } from 'react'

const TEMPLATES = [
  { id: 'rotating-cube', name: 'Rotating Cube' },
  { id: 'wireframe-sphere', name: 'Wireframe Sphere' },
  { id: 'particle-cloud', name: 'Particle Cloud' },
  { id: 'torus-knot', name: 'Torus Knot' },
  { id: 'wave-plane', name: 'Wave Plane' },
  { id: 'galaxy', name: 'Galaxy' },
  { id: 'terrain', name: 'Terrain' },
  { id: 'instanced-spheres', name: 'Instanced Spheres' },
  { id: 'custom', name: 'Custom Code' },
]

function generateHTML(id, p) {
  if (id === 'custom') return p.customCode || ''
  const col = p.color || '#6366f1'
  const bg = p.background || '#0f0f23'
  const speed = p.speed || 1

  const threeScript = `<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>`
  const base = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style>${threeScript}</head><body><script>
var scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,1000);
var renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);document.body.appendChild(renderer.domElement);
camera.position.z=3;var S=${speed};`

  const templates = {
    'rotating-cube': `${base}
var geo=new THREE.BoxGeometry(1,1,1),mat=new THREE.MeshBasicMaterial({color:'${col}',wireframe:true});
var mesh=new THREE.Mesh(geo,mat);scene.add(mesh);
function animate(){requestAnimationFrame(animate);mesh.rotation.x+=0.01*S;mesh.rotation.y+=0.013*S;renderer.render(scene,camera)}animate();
window.onresize=function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
</script></body></html>`,

    'wireframe-sphere': `${base}
var geo=new THREE.SphereGeometry(1.2,32,32),mat=new THREE.MeshBasicMaterial({color:'${col}',wireframe:true});
var mesh=new THREE.Mesh(geo,mat);scene.add(mesh);
function animate(){requestAnimationFrame(animate);mesh.rotation.x+=0.005*S;mesh.rotation.y+=0.008*S;renderer.render(scene,camera)}animate();
window.onresize=function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
</script></body></html>`,

    'particle-cloud': `${base}
var geo=new THREE.BufferGeometry(),n=2000,pos=new Float32Array(n*3);
for(var i=0;i<n*3;i++)pos[i]=(Math.random()-0.5)*6;
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
var mat=new THREE.PointsMaterial({color:'${col}',size:0.02});var pts=new THREE.Points(geo,mat);scene.add(pts);
function animate(){requestAnimationFrame(animate);pts.rotation.x+=0.001*S;pts.rotation.y+=0.002*S;renderer.render(scene,camera)}animate();
window.onresize=function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
</script></body></html>`,

    'torus-knot': `${base}
var geo=new THREE.TorusKnotGeometry(1,0.3,128,16),mat=new THREE.MeshBasicMaterial({color:'${col}',wireframe:true});
var mesh=new THREE.Mesh(geo,mat);scene.add(mesh);
function animate(){requestAnimationFrame(animate);mesh.rotation.x+=0.008*S;mesh.rotation.y+=0.012*S;renderer.render(scene,camera)}animate();
window.onresize=function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
</script></body></html>`,

    'wave-plane': `${base}
var geo=new THREE.PlaneGeometry(4,4,40,40),mat=new THREE.MeshBasicMaterial({color:'${col}',wireframe:true});
var mesh=new THREE.Mesh(geo,mat);mesh.rotation.x=-0.5;scene.add(mesh);
var posAttr=geo.attributes.position;
function animate(){requestAnimationFrame(animate);var t=Date.now()*0.001*S;for(var i=0;i<posAttr.count;i++){var x=posAttr.getX(i),y=posAttr.getY(i);posAttr.setZ(i,Math.sin(x*2+t)*0.3+Math.cos(y*2+t)*0.3)}posAttr.needsUpdate=true;renderer.render(scene,camera)}animate();
window.onresize=function(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
</script></body></html>`,
  }
  templates.galaxy = templates['particle-cloud']
  templates.terrain = templates['wave-plane']
  templates['instanced-spheres'] = templates['wireframe-sphere']
  return templates[id] || templates['rotating-cube']
}

export default function ThreeJs3DSceneTemplateSelectorModal({ onInsert, onClose }) {
  const [template, setTemplate] = useState('rotating-cube')
  const [params, setParams] = useState({
    color: '#6366f1',
    background: '#0f0f23',
    speed: 1,
    customCode: '',
  })

  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border font-semibold text-text-primary">Three.js 3D Scene</div>
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
                <div><div className="text-[11px] text-text-muted mb-1">Speed</div><input type="number" min={0.1} max={5} step={0.1} className="w-24 bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.speed} onChange={(e) => update('speed', +e.target.value)} /></div>
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
