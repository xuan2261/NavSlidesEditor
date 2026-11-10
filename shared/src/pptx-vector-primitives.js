const { cloneFamilyData } = require('./pptx-family-operations-data')
const PARAMETERS = Object.freeze({
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'], polygon: ['points'],
})
const fail = () => { throw new TypeError('Invalid SVG primitive') }
function normalizePrimitive(input) {
  const value = cloneFamilyData(input)
  if (!value || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'parameters') ||
      !Object.hasOwn(PARAMETERS, value.kind)) fail()
  const parameters = value.parameters, names = PARAMETERS[value.kind]
  if (!parameters || Array.isArray(parameters) || Object.keys(parameters).some((key) => !names.includes(key))) fail()
  if (names.includes('points')) {
    if (!Array.isArray(parameters.points) || parameters.points.length < 2 || parameters.points.length > 8192) fail()
    for (const point of parameters.points)
      if (!point || Object.keys(point).length !== 2 || !['x', 'y'].every((axis) =>
        Number.isFinite(point[axis]) && Math.abs(point[axis]) <= 1e12)) fail()
  } else {
    for (const [name, number] of Object.entries(parameters))
      if (!Number.isFinite(number) || Math.abs(number) > 1e12 ||
          ['width', 'height', 'r', 'rx', 'ry'].includes(name) && number < 0) fail()
    const required = { rect: ['width', 'height'], circle: ['r'], ellipse: ['rx', 'ry'], line: [] }[value.kind]
    if (required.some((name) => !(parameters[name] > 0))) fail()
  }
  return value
}
function primitiveCommands(input) {
  const { kind, parameters: p } = normalizePrimitive(input)
  const move = (x, y) => ({ kind: 'moveTo', points: [{ x, y }] })
  const line = (x, y) => ({ kind: 'lnTo', points: [{ x, y }] })
  const arc = (rx, ry, start) => ({ kind: 'arcTo', wR: rx, hR: ry, stAng: start, swAng: 5400000 })
  const close = { kind: 'close' }
  if (kind === 'line') return [move(p.x1 ?? 0, p.y1 ?? 0), line(p.x2 ?? 0, p.y2 ?? 0)]
  if (kind === 'polyline' || kind === 'polygon') return [move(p.points[0].x, p.points[0].y),
    ...p.points.slice(1).map(({ x, y }) => line(x, y)), ...(kind === 'polygon' ? [close] : [])]
  if (kind === 'circle' || kind === 'ellipse') {
    const rx = p.r ?? p.rx, ry = p.r ?? p.ry, x = p.cx ?? 0, y = p.cy ?? 0
    return [move(x + rx, y), ...[0, 5400000, 10800000, 16200000].map((angle) => arc(rx, ry, angle)), close]
  }
  const x = p.x ?? 0, y = p.y ?? 0, w = p.width, h = p.height
  const rx = Math.min(p.rx ?? p.ry ?? 0, w / 2), ry = Math.min(p.ry ?? p.rx ?? 0, h / 2)
  if (!rx || !ry) return [move(x, y), line(x + w, y), line(x + w, y + h), line(x, y + h), close]
  return [move(x + rx, y), line(x + w - rx, y), arc(rx, ry, 16200000),
    line(x + w, y + h - ry), arc(rx, ry, 0), line(x + rx, y + h), arc(rx, ry, 5400000),
    line(x, y + ry), arc(rx, ry, 10800000), close]
}
function primitiveGeometry(geometry, primitive) {
  const commands = primitiveCommands(primitive).map((command, at) => ({ ...command,
    ...(command.points ? { points: command.points.map((point, index) => ({ ...point,
      componentId: `${geometry.componentId}:primitive:${at}:${index}` })) } : {}),
  }))
  return { ...geometry, paths: [{ ...geometry.paths[0], commands }] }
}
module.exports = { PARAMETERS, normalizePrimitive, primitiveCommands, primitiveGeometry }
