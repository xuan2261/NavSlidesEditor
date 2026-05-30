/**
 * Animated gradient blobs drifting across the canvas. Cheap, calm background FX.
 *
 * initState/draw are self-contained (no module-scope refs) so the registry can
 * serialize them via .toString() into the inlined htmlGenerator runtime — the
 * SAME source the editor canvas imports. Keep them dependency-free.
 */
const gradientBlob = {
  name: 'gradient-blob',
  label: 'Gradient Blobs',
  defaultParams: { count: 4, speed: 1, color1: '#6366f1', color2: '#ec4899', bg: '#0d0221' },
  initState: function (w, h, p) {
    var n = Math.max(1, p.count || 4)
    var blobs = []
    for (var i = 0; i < n; i++) {
      blobs.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (0.2 + Math.random() * 0.25) * Math.min(w, h),
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        c: i % 2 === 0 ? p.color1 || '#6366f1' : p.color2 || '#ec4899',
      })
    }
    return { blobs: blobs, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    var spd = (p.speed || 1) * 60
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = p.bg || '#0d0221'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    for (var i = 0; i < state.blobs.length; i++) {
      var b = state.blobs[i]
      b.x += b.dx * spd * dt
      b.y += b.dy * spd * dt
      if (b.x < -b.r) b.x = w + b.r
      if (b.x > w + b.r) b.x = -b.r
      if (b.y < -b.r) b.y = h + b.r
      if (b.y > h + b.r) b.y = -b.r
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
      g.addColorStop(0, b.c)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  },
}

module.exports = gradientBlob
