/**
 * Knowledge graph: a few hub nodes with orbiting child nodes + links. Self-contained.
 */
const knowledgeGraph = {
  name: 'knowledge-graph',
  label: 'Knowledge Graph',
  defaultParams: { hubs: 3, speed: 1, node: '#7aa2f7', line: '#3b4a78', bg: '#0f1424' },
  initState: function (w, h, p) {
    var hubCount = Math.max(1, p.hubs || 3)
    var hubs = []
    for (var i = 0; i < hubCount; i++) {
      var children = []
      var cn = 4 + Math.floor(Math.random() * 4)
      for (var j = 0; j < cn; j++) children.push({ ang: Math.random() * Math.PI * 2, rad: 40 + Math.random() * 60 })
      hubs.push({ x: (i + 1) * (w / (hubCount + 1)), y: h * (0.35 + Math.random() * 0.3), children: children, phase: Math.random() * Math.PI * 2 })
    }
    return { hubs: hubs, last: 0 }
  },
  draw: function (ctx, state, t, p, w, h) {
    state.last = t
    ctx.fillStyle = p.bg || '#0f1424'
    ctx.fillRect(0, 0, w, h)
    var spd = (p.speed || 1) * 0.3
    for (var i = 0; i < state.hubs.length; i++) {
      var hub = state.hubs[i]
      for (var j = 0; j < hub.children.length; j++) {
        var c = hub.children[j]
        var ang = c.ang + t * spd
        var cx = hub.x + Math.cos(ang) * c.rad
        var cy = hub.y + Math.sin(ang) * c.rad
        ctx.strokeStyle = p.line || '#3b4a78'
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(cx, cy); ctx.stroke()
        ctx.fillStyle = p.node || '#7aa2f7'
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = p.node || '#7aa2f7'
      ctx.beginPath(); ctx.arc(hub.x, hub.y, 6, 0, Math.PI * 2); ctx.fill()
    }
  },
}
module.exports = knowledgeGraph
