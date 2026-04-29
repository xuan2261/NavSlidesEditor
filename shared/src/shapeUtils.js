const SHAPES = [
  { id: 'rect', name: 'Rectangle', icon: '▭' },
  { id: 'rounded-rect', name: 'Rounded Rect', icon: '▢' },
  { id: 'circle', name: 'Circle', icon: '○' },
  { id: 'triangle', name: 'Triangle', icon: '△' },
  { id: 'diamond', name: 'Diamond', icon: '◇' },
  { id: 'arrow-right', name: 'Arrow Right', icon: '→' },
  { id: 'star', name: 'Star', icon: '★' },
  { id: 'line', name: 'Line', icon: '—' },
  { id: 'hexagon', name: 'Hexagon', icon: '⬡' },
  { id: 'pentagon', name: 'Pentagon', icon: '⬠' },
  { id: 'cloud', name: 'Cloud', icon: '☁' },
  { id: 'cylinder', name: 'Cylinder', icon: '⛁' },
  { id: 'parallelogram', name: 'Parallelogram', icon: '▱' },
  { id: 'trapezoid', name: 'Trapezoid', icon: '⏢' },
  { id: 'bracket', name: 'Bracket', icon: '{' },
]
const { escapePlainText } = require('./content-safety.js')

function shapeSvgString(el) {
  const w = el.width,
    h = el.height
  const fill = el.fill || '#6366f1'
  const stroke = el.stroke || 'none'
  const sw = el.strokeWidth || 0
  const shape = el.shape || 'rect'

  let inner = ''
  if (shape === 'line') {
    const lw = el.strokeWidth || 3
    let dashStyle = ''
    if (el.dashArray) dashStyle = ` stroke-dasharray="${el.dashArray}"`
    inner = `<line x1="${lw}" y1="${h / 2}" x2="${w - lw}" y2="${h / 2}" stroke="${fill}" stroke-width="${lw}" fill="none"${dashStyle} />`
  } else {
    let shapeEl = ''
    switch (shape) {
      case 'rect':
        shapeEl = `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="${el.borderRadius || 0}" />`
        break
      case 'rounded-rect':
        shapeEl = `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="${Math.min(w, h) * 0.15}" />`
        break
      case 'circle':
        shapeEl = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max(0, w / 2 - sw / 2)}" ry="${Math.max(0, h / 2 - sw / 2)}" />`
        break
      case 'triangle':
        shapeEl = `<polygon points="${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}" />`
        break
      case 'diamond':
        shapeEl = `<polygon points="${w / 2},${sw} ${w - sw},${h / 2} ${w / 2},${h - sw} ${sw},${h / 2}" />`
        break
      case 'arrow-right':
        shapeEl = `<polygon points="${sw},${h * 0.35} ${w * 0.6},${h * 0.35} ${w * 0.6},${sw} ${w - sw},${h / 2} ${w * 0.6},${h - sw} ${w * 0.6},${h * 0.65} ${sw},${h * 0.65}" />`
        break
      case 'star': {
        const cx = w / 2,
          cy = h / 2,
          outerR = Math.min(w, h) / 2 - sw,
          innerR = outerR * 0.4
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
        }
        shapeEl = `<polygon points="${pts.join(' ')}" />`
        break
      }
      case 'hexagon':
        shapeEl = `<polygon points="${w / 4},${sw} ${w * 0.75},${sw} ${w - sw},${h / 2} ${w * 0.75},${h - sw} ${w / 4},${h - sw} ${sw},${h / 2}" />`
        break
      case 'pentagon':
        shapeEl = `<polygon points="${w / 2},${sw} ${w - sw},${h * 0.38} ${w * 0.81},${h - sw} ${w * 0.19},${h - sw} ${sw},${h * 0.38}" />`
        break
      case 'cloud':
        shapeEl = `<path d="M ${w * 0.25} ${h * 0.65} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.2} ${h * 0.35} A ${w * 0.25} ${h * 0.25} 0 0 1 ${w * 0.6} ${h * 0.15} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.85} ${h * 0.35} A ${w * 0.2} ${h * 0.2} 0 0 1 ${w * 0.8} ${h * 0.7} Z" />`
        break
      case 'cylinder':
        shapeEl = `<path d="M ${sw} ${h * 0.15} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${w - sw} ${h * 0.15} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${sw} ${h * 0.15} L ${sw} ${h * 0.85} A ${w / 2 - sw} ${h * 0.15} 0 0 0 ${w - sw} ${h * 0.85} Z" />`
        break
      case 'parallelogram':
        shapeEl = `<polygon points="${w * 0.2},${sw} ${w - sw},${sw} ${w * 0.8},${h - sw} ${sw},${h - sw}" />`
        break
      case 'trapezoid':
        shapeEl = `<polygon points="${w * 0.2},${sw} ${w * 0.8},${sw} ${w - sw},${h - sw} ${sw},${h - sw}" />`
        break
      case 'bracket': {
        const strk = stroke === 'none' ? fill : stroke
        const swThick = Math.max(3, sw)
        shapeEl = `<path d="M ${w * 0.8} ${swThick} Q ${w * 0.4} ${swThick} ${w * 0.4} ${h * 0.25} T ${swThick} ${h * 0.5} Q ${w * 0.4} ${h * 0.5} ${w * 0.4} ${h * 0.75} T ${w * 0.8} ${h - swThick}" fill="none" stroke="${strk}" stroke-width="${swThick}" />`
        break
      }
      default:
        shapeEl = `<rect x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" />`
    }
    inner = `<g fill="${fill}" stroke="${stroke}" stroke-width="${sw}">${shapeEl}</g>`
  }

  let textEl = ''
  if (el.text) {
    const fs = el.fontSize || 16
    const tc = el.textColor || '#ffffff'
    textEl = `<text x="${w / 2}" y="${h / 2}" dominant-baseline="middle" text-anchor="middle" font-size="${fs}" fill="${tc}" style="font-family:inherit;">${escapePlainText(el.text)}</text>`
  }

  return `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible;">${inner}${textEl}</svg>`
}
module.exports = { SHAPES, shapeSvgString }
