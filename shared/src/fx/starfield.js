/**
 * Drifting starfield — small twinkling points moving toward the viewer.
 *
 * initState/draw are self-contained (no module-scope refs) so the registry can
 * serialize them into the inlined htmlGenerator runtime, shared with the editor.
 */
const starfield = {
  name: 'starfield',
  label: 'Starfield',
  defaultParams: { count: 120, speed: 1, star: '#ffffff', bg: '#05070f' },
  initState: function (w, h, p) {
    var n = Math.max(10, p.count || 120)
    var stars = []
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        tw: Math.random() * Math.PI * 2,
      })
    }
    return { stars: stars, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    var spd = (p.speed || 1) * 30
    ctx.fillStyle = p.bg || '#05070f'
    ctx.fillRect(0, 0, w, h)
    var star = p.star || '#ffffff'
    for (var i = 0; i < state.stars.length; i++) {
      var s = state.stars[i]
      s.y += (0.3 + s.z) * spd * dt
      if (s.y > h) {
        s.y = 0
        s.x = Math.random() * w
      }
      var size = 0.5 + s.z * 1.8
      var alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.tw + t * 2))
      ctx.globalAlpha = alpha
      ctx.fillStyle = star
      ctx.beginPath()
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  },
}

module.exports = starfield
