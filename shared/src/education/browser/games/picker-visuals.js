const { node } = require('../dom.js')
const SVG = 'http://www.w3.org/2000/svg'
function svgNode(document, tag, attrs = {}, text) {
  const element = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
  if (text !== undefined) element.textContent = text
  return element
}
function wheel(document, config) {
  const stage = node(document, 'div', undefined, { class: 'ns-picker-wheel' })
  const svg = svgNode(document, 'svg', { viewBox: '-110 -110 220 220', 'aria-hidden': 'true' })
  const count = Math.max(config.items.length, config.wheelSegments)
  const point = (angle) => [
    Math.cos((angle * Math.PI) / 180) * 100,
    Math.sin((angle * Math.PI) / 180) * 100,
  ]
  for (let i = 0; i < count; i++) {
    const start = (i * 360) / count - 90,
      end = ((i + 1) * 360) / count - 90
    const a = point(start),
      b = point(end),
      item = config.items[i % config.items.length]
    const path =
      count === 1
        ? 'M0,-100 A100,100 0 1,1 0,100 A100,100 0 1,1 0,-100'
        : `M0,0 L${a} A100,100 0 ${360 / count > 180 ? 1 : 0},1 ${b} Z`
    const group = svgNode(document, 'g', { 'data-ns-picker-item': item.id })
    group.append(
      svgNode(document, 'path', {
        d: path,
        fill: config.wheelColors[i % config.wheelColors.length],
        stroke: '#fff',
        'stroke-width': '.5',
      })
    )
    group.append(
      svgNode(
        document,
        'text',
        {
          x: 52,
          y: 2,
          transform: `rotate(${(start + end) / 2})`,
          'font-size': Math.max(3, Math.min(8, 160 / count)),
          fill: '#fff',
          'text-anchor': 'middle',
        },
        item.label.slice(0, 22)
      )
    )
    svg.append(group)
  }
  stage.append(svg, node(document, 'span', '▼', { class: 'ns-picker-pointer' }))
  return { stage, svg }
}
function dice(document, count, values) {
  const stage = node(document, 'div', undefined, { class: 'ns-picker-dice', 'aria-label': 'Dice' })
  const dots = {
    1: [[0, 0]],
    2: [
      [-1, -1],
      [1, 1],
    ],
    3: [
      [-1, -1],
      [0, 0],
      [1, 1],
    ],
    4: [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ],
    5: [
      [-1, -1],
      [1, -1],
      [0, 0],
      [-1, 1],
      [1, 1],
    ],
    6: [
      [-1, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [1, 1],
    ],
  }
  for (let i = 0; i < count; i++) {
    const value = values[i] || 1
    const svg = svgNode(document, 'svg', {
      viewBox: '-30 -30 60 60',
      role: 'img',
      'aria-label': `Die ${i + 1}: ${value}`,
    })
    svg.append(
      svgNode(document, 'rect', { x: -29, y: -29, width: 58, height: 58, rx: 8, fill: '#fff' })
    )
    for (const [x, y] of dots[value])
      svg.append(svgNode(document, 'circle', { cx: x * 16, cy: y * 16, r: 4, fill: '#111827' }))
    stage.append(svg)
  }
  return stage
}
function confetti(document) {
  const layer = node(document, 'div', undefined, {
    class: 'ns-picker-confetti',
    'aria-hidden': 'true',
  })
  for (let i = 0; i < 24; i++) {
    const piece = node(document, 'i')
    piece.style.left = `${(i * 41) % 100}%`
    piece.style.background = ['#fbbf24', '#818cf8', '#34d399', '#f472b6'][i % 4]
    piece.style.animationDelay = `${(i % 4) * 60}ms`
    layer.append(piece)
  }
  return layer
}
module.exports = { wheel, dice, confetti }
