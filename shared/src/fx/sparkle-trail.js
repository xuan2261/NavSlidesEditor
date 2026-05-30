/**
 * Sparkle trail: twinkling sparks that drift gently upward and respawn. Self-contained.
 */
const sparkleTrail = {
  name: 'sparkle-trail',
  label: 'Sparkle Trail',
  defaultParams: { count: 80, speed: 1, spark: '#fff3b0', bg: '#1a1226' },
  initState: function (w, h, p) {
    var n = Math.max(10, p.count || 80)
    var sp = []
    for (var i = 0; i < n; i++) {
      sp.push({ x: Math.random() * w, y: Math.random() * h, r: 0.5 + Math.random() * 2, tw: Math.random() * Math.PI * 2, drift: (Math.random() - 0.5) * 0.3 })
    }
    return { sp: sp, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    var spd = (p.speed || 1) * 20
    ctx.fillStyle = p.bg || '#1a1226'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = p.spark || '#fff3b0'
    for (var i = 0; i < state.sp.length; i++) {
      var s = state.sp[i]
      s.y -= spd * dt
      s.x += s.drift * spd * dt
      if (s.y < 0) { s.y = h; s.x = Math.random() * w }
      var a = 0.3 + 0.7 * Math.abs(Math.sin(s.tw + t * 3))
      ctx.globalAlpha = a
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  },
}
module.exports = sparkleTrail
