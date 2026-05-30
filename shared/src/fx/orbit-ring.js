/**
 * Orbit ring: concentric rings of dots rotating at different speeds. Self-contained.
 */
const orbitRing = {
  name: 'orbit-ring',
  label: 'Orbit Ring',
  defaultParams: { rings: 4, speed: 1, dot: '#a78bfa', bg: '#0c0a1a' },
  initState: function (w, h, p) {
    var rn = Math.max(1, p.rings || 4)
    var rings = []
    var maxR = Math.min(w, h) * 0.42
    for (var i = 0; i < rn; i++) {
      var dots = 6 + i * 3
      rings.push({ radius: maxR * ((i + 1) / rn), dots: dots, phase: Math.random() * Math.PI * 2, dir: i % 2 === 0 ? 1 : -1 })
    }
    return { rings: rings, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    state.last = t
    ctx.fillStyle = p.bg || '#0c0a1a'
    ctx.fillRect(0, 0, w, h)
    var cx = w / 2, cy = h / 2
    var spd = (p.speed || 1) * 0.4
    ctx.fillStyle = p.dot || '#a78bfa'
    for (var i = 0; i < state.rings.length; i++) {
      var ring = state.rings[i]
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath(); ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2); ctx.stroke()
      for (var j = 0; j < ring.dots; j++) {
        var ang = ring.phase + (j / ring.dots) * Math.PI * 2 + t * spd * ring.dir
        var x = cx + Math.cos(ang) * ring.radius
        var y = cy + Math.sin(ang) * ring.radius
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill()
      }
    }
  },
}
module.exports = orbitRing
