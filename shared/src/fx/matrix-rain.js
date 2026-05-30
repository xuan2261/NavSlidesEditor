/**
 * Matrix-style falling glyph rain. Self-contained initState/draw for runtime
 * serialization (shared by editor + export).
 */
const matrixRain = {
  name: 'matrix-rain',
  label: 'Matrix Rain',
  defaultParams: { speed: 1, glyph: '#00ff66', bg: '#000000', fontSize: 16 },
  initState: function (w, h, p) {
    var fs = p.fontSize || 16
    var cols = Math.max(1, Math.floor(w / fs))
    var drops = []
    for (var i = 0; i < cols; i++) drops.push(Math.random() * -h)
    return { drops: drops, fs: fs, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    var dt = Math.min(0.05, t - state.last)
    state.last = t
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = p.glyph || '#00ff66'
    ctx.font = state.fs + 'px monospace'
    var step = (p.speed || 1) * state.fs * 14 * dt
    for (var i = 0; i < state.drops.length; i++) {
      var ch = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96))
      ctx.fillText(ch, i * state.fs, state.drops[i])
      state.drops[i] += step
      if (state.drops[i] > h && Math.random() > 0.975) state.drops[i] = 0
    }
  },
}
module.exports = matrixRain
