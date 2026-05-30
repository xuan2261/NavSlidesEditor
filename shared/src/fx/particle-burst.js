/**
 * Particle burst: particles continuously emit from center and fade out. Self-contained.
 */
const particleBurst = {
  name: 'particle-burst',
  label: 'Particle Burst',
  defaultParams: { count: 90, speed: 1, color1: '#ffd700', color2: '#ff6b35', bg: '#10060a' },
  initState: function (w, h, p) {
    var n = Math.max(10, p.count || 90)
    var ps = []
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2
      var v = 0.3 + Math.random() * 0.9
      ps.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: Math.random(), c: i % 2 ? p.color1 : p.color2 })
    }
    return { ps: ps, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    var spd = (p.speed || 1) * 120
    ctx.fillStyle = p.bg || '#10060a'
    ctx.fillRect(0, 0, w, h)
    for (var i = 0; i < state.ps.length; i++) {
      var q = state.ps[i]
      q.x += q.vx * spd * dt; q.y += q.vy * spd * dt
      q.life -= dt * 0.4
      if (q.life <= 0) {
        var a = Math.random() * Math.PI * 2, v = 0.3 + Math.random() * 0.9
        q.x = w / 2; q.y = h / 2; q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; q.life = 1
      }
      ctx.globalAlpha = Math.max(0, q.life)
      ctx.fillStyle = q.c || '#ffd700'
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  },
}
module.exports = particleBurst
