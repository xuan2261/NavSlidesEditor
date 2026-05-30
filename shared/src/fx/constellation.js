/**
 * Constellation network: drifting points joined by lines when near. Self-contained.
 */
const constellation = {
  name: 'constellation',
  label: 'Constellation',
  defaultParams: { count: 70, speed: 1, dot: '#88c0d0', line: '#88c0d0', bg: '#0b1020', linkDist: 120 },
  initState: function (w, h, p) {
    var n = Math.max(10, p.count || 70)
    var pts = []
    for (var i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * w, y: Math.random() * h,
        dx: (Math.random() - 0.5) * 0.6, dy: (Math.random() - 0.5) * 0.6,
      })
    }
    return { pts: pts, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    var spd = (p.speed || 1) * 60
    var dist = p.linkDist || 120
    ctx.fillStyle = p.bg || '#0b1020'
    ctx.fillRect(0, 0, w, h)
    var pts = state.pts
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i]
      a.x += a.dx * spd * dt; a.y += a.dy * spd * dt
      if (a.x < 0 || a.x > w) a.dx *= -1
      if (a.y < 0 || a.y > h) a.dy *= -1
      for (var j = i + 1; j < pts.length; j++) {
        var b = pts[j]
        var dx = a.x - b.x, dy = a.y - b.y
        var d = Math.sqrt(dx * dx + dy * dy)
        if (d < dist) {
          ctx.globalAlpha = 1 - d / dist
          ctx.strokeStyle = p.line || '#88c0d0'
          ctx.lineWidth = 0.6
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = p.dot || '#88c0d0'
    for (var k = 0; k < pts.length; k++) {
      ctx.beginPath(); ctx.arc(pts[k].x, pts[k].y, 1.6, 0, Math.PI * 2); ctx.fill()
    }
  },
}
module.exports = constellation
