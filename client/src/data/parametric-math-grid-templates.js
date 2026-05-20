// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky
// PRESETS, compileExpr, evalRange, and generateGrid ported from
// jbirky/parallax-presentations @ ce548c5 (AGPL-3.0-or-later).
// Adapted into a NavSlides data module: regex sanitizer added, UI shell
// rewritten locally, output emitted as inline SVG (no canvas/script).

// Allowlist for user-provided math expressions. Limits the alphabet to
// digits, arithmetic operators, parentheses, comma, whitespace, the two
// parameters u/v, and a closed set of Math member names. Tokens like
// `constructor`, `prototype`, `globalThis`, `eval`, `Function`, `[`, `]`,
// `=`, backtick, `this`, `self` fall outside this set and are rejected.
// Longer named tokens are listed before their shorter prefixes so
// regex backtracking is unnecessary on the common path.
export const ALLOWED_MATH_TOKENS =
  /^(?:[0-9+\-*/().%\s,]|sinh|cosh|tanh|asin|acos|atan2|atan|sin|cos|tan|abs|sqrt|pow|exp|log2|log|hypot|sign|ceil|floor|round|min|max|PI|E|u|v)+$/

export function sanitizeMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return '0'
  const trimmed = expr.trim()
  if (!trimmed) return '0'
  if (!ALLOWED_MATH_TOKENS.test(trimmed)) return '0'
  return trimmed
}

export const PRESETS = [
  { name: 'Cartesian', xExpr: 'u', yExpr: 'v', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 10, vDiv: 10 },
  { name: 'Polar', xExpr: 'u*cos(v)', yExpr: 'u*sin(v)', uMin: 0.5, uMax: 5, vMin: 0, vMax: '2*PI', uDiv: 8, vDiv: 32 },
  { name: 'Wave Mesh', xExpr: 'u+0.4*sin(v*PI)', yExpr: 'v+0.4*sin(u*PI)', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 12, vDiv: 12 },
  { name: 'Log Polar', xExpr: 'exp(u*0.3)*cos(v)', yExpr: 'exp(u*0.3)*sin(v)', uMin: 0, uMax: 5, vMin: 0, vMax: '2*PI', uDiv: 8, vDiv: 32 },
  { name: 'Perspective', xExpr: 'u/(1+v*0.15)', yExpr: 'v', uMin: -5, uMax: 5, vMin: 0, vMax: 5, uDiv: 10, vDiv: 10 },
  { name: 'Gravity Well', xExpr: 'u*(1+0.3/(0.5+u*u+v*v))', yExpr: 'v*(1+0.3/(0.5+u*u+v*v))', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 16, vDiv: 16 },
  { name: 'Saddle', xExpr: 'u+0.08*u*v', yExpr: 'v+0.04*(u*u-v*v)', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 12, vDiv: 12 },
  { name: 'Spiral', xExpr: '(1+u*0.15)*cos(v)', yExpr: '(1+u*0.15)*sin(v)', uMin: 0, uMax: 20, vMin: 0, vMax: '6*PI', uDiv: 6, vDiv: 80 },
  { name: 'Diamond', xExpr: '(u+v)*0.7', yExpr: '(u-v)*0.7', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 8, vDiv: 8 },
  { name: 'Sinusoidal', xExpr: 'u', yExpr: 'v+sin(u*PI)*cos(v*PI*0.5)*0.8', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 1, vDiv: 20 },
]

const MATH_DESTRUCTURE =
  'const {sin,cos,tan,abs,sqrt,pow,exp,log,log2,PI,E,min,max,floor,ceil,round,atan2,hypot,sign,asin,acos,atan,sinh,cosh,tanh}=Math;'

export function compileExpr(expr) {
  const safe = sanitizeMathExpr(expr)
  try {
    return new Function('u', 'v', MATH_DESTRUCTURE + 'return(' + safe + ')')
  } catch {
    return null
  }
}

// Allowlist for the four range fields (uMin/uMax/vMin/vMax). Numeric
// arithmetic over digits, +-*/(), whitespace, decimal point, plus the
// two named constants PI and E. Anything else (`constructor`, `Function`,
// `eval`, lowercase identifiers, brackets, backticks, etc.) is rejected.
// PRESETS ship range strings like '2*PI' / '6*PI' which fit this set.
const ALLOWED_RANGE_TOKENS = /^(?:[0-9+\-*/().\s]|PI|E)+$/

export function evalRange(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0
  if (typeof val !== 'string') return 0
  const trimmed = val.trim()
  if (!trimmed) return 0
  if (!ALLOWED_RANGE_TOKENS.test(trimmed)) return 0
  try {
    const result = new Function('const {PI,E}=Math;return(' + trimmed + ')')()
    return Number.isFinite(result) ? result : 0
  } catch {
    return 0
  }
}

function toPolyline(pts) {
  const segments = []
  let current = []
  for (const p of pts) {
    if (p) {
      current.push(p)
    } else if (current.length > 1) {
      segments.push(current)
      current = []
    } else {
      current = []
    }
  }
  if (current.length > 1) segments.push(current)
  return segments
}

export function generateGrid(xExpr, yExpr, params) {
  const xFn = compileExpr(xExpr)
  const yFn = compileExpr(yExpr)
  if (!xFn || !yFn) return { uLines: [], vLines: [], error: 'Invalid expression' }

  const uMin = evalRange(params.uMin)
  const uMax = evalRange(params.uMax)
  const vMin = evalRange(params.vMin)
  const vMax = evalRange(params.vMax)
  const uDiv = params.uDiv || 10
  const vDiv = params.vDiv || 10
  const uStep = uDiv > 0 ? (uMax - uMin) / uDiv : 1
  const vStep = vDiv > 0 ? (vMax - vMin) / vDiv : 1

  const points = []
  for (let i = 0; i <= uDiv; i++) {
    points[i] = []
    const u = uMin + uStep * i
    for (let j = 0; j <= vDiv; j++) {
      const v = vMin + vStep * j
      try {
        const x = xFn(u, v)
        const y = yFn(u, v)
        points[i][j] = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
      } catch {
        points[i][j] = null
      }
    }
  }

  const uLines = []
  for (let i = 0; i <= uDiv; i++) uLines.push(...toPolyline(points[i]))
  const vLines = []
  for (let j = 0; j <= vDiv; j++) vLines.push(...toPolyline(points.map((row) => row[j])))

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const row of points) {
    for (const p of row) {
      if (!p) continue
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) return { uLines: [], vLines: [], error: 'No valid points' }

  const pad = Math.max(maxX - minX, maxY - minY) * 0.05 || 1
  return {
    uLines,
    vLines,
    bounds: { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad },
  }
}

function polylineMarkup(seg, color, sw, opacity) {
  const points = seg.map((p) => `${p.x},${p.y}`).join(' ')
  return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function generateMathGridSvgHtml(grid, style) {
  if (!grid || grid.error || !grid.bounds) return ''
  const { color = '#6366f1', lineWidth = 1.5, opacity = 0.8, showU = true, showV = true, bg = 'transparent' } = style || {}
  const { bounds, uLines, vLines } = grid
  const bw = bounds.maxX - bounds.minX || 1
  const bh = bounds.maxY - bounds.minY || 1
  const sw = (lineWidth * bw) / 400

  const paths = []
  if (showU) for (const seg of uLines) paths.push(polylineMarkup(seg, color, sw, opacity))
  if (showV) for (const seg of vLines) paths.push(polylineMarkup(seg, color, sw, opacity))

  const bgStyle = bg !== 'transparent' ? `background:${bg};` : 'background:transparent;'
  return (
    `<style>*{margin:0;padding:0}html,body{width:100%;height:100%;${bgStyle}overflow:hidden}</style>\n` +
    `<svg viewBox="${bounds.minX} ${bounds.minY} ${bw} ${bh}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">\n` +
    `${paths.join('\n')}\n` +
    `</svg>`
  )
}
