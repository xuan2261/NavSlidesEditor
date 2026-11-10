import { createCanvas } from '@napi-rs/canvas'

export const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
let serial = 0
export const node = (type, children = [], attributes = [], namespaceUri = M) => ({
  componentId: `omml-render-${++serial}`,
  namespaceUri,
  type,
  attributes,
  children,
})
export const val = (type, value, namespaceUri = M) =>
  node(type, [], [{ namespaceUri, name: 'val', value }], namespaceUri)
export const run = (text, properties = []) => node('r', [...properties, { ...node('t'), text }])
export const arg = (type, text) => node(type, [run(text)])
export const doc = (...children) => ({ schemaVersion: 1, root: node('oMath', children) })
export const flatten = (box) => [box, ...box.children.flatMap(flatten)]

const context = createCanvas(8, 8).getContext('2d')
export function measureText(text, style) {
  context.font = `${style.italic ? 'italic' : 'normal'} ${style.bold ? 'bold' : 'normal'} ${style.fontSize}px "${style.fontFamily}"`
  const m = context.measureText(text)
  return {
    advanceWidth: m.width,
    inkLeft: -m.actualBoundingBoxLeft,
    inkRight: m.actualBoundingBoxRight,
    ascent: Math.max(0, m.actualBoundingBoxAscent),
    descent: Math.max(0, m.actualBoundingBoxDescent),
  }
}
// An explicit test typography policy, not measured Office MATH-table constants.
// Glyph widths/ink are always measured by the installed native canvas backend.
export function getMathMetrics({ fontSize: em }) {
  return {
    axisHeight: em * 0.25,
    ruleThickness: em * 0.04,
    scriptScale: 0.7,
    scriptShiftUp: em * 0.45,
    scriptShiftDown: em * 0.25,
    scriptGap: em * 0.15,
    fractionGap: em * 0.2,
    limitGap: em * 0.15,
    radicalGap: em * 0.12,
    radicalDegreeRaise: em * 0.6,
    delimiterGap: em * 0.1,
    columnGap: em * 0.5,
    rowGap: em * 0.3,
    accentGap: em * 0.1,
  }
}
export const options = {
  fontFamily: 'Cambria Math',
  fontSize: 24,
  color: '#123456',
  measureText,
  getMathMetrics,
}
