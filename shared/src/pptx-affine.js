// Column vectors: [a,b,c,d,e,f] maps (x,y) to (a*x+c*y+e, b*x+d*y+f).
// Constructors consume authored OOXML coordinates, never parser-normalized boxes.
const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0])

function scalar(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Invalid ${name}`)
  return value
}
function matrix(value) {
  if (!Array.isArray(value) || value.length !== 6) throw new TypeError('Invalid affine matrix')
  for (const item of value) scalar(item, 'matrix coefficient')
  return value
}
function represented(values) {
  if (values.some((value) => !Number.isFinite(value)))
    throw new RangeError('Affine arithmetic is not representable')
  return values
}
function multiply(left, right) {
  const [a, b, c, d, e, f] = matrix(left)
  const [g, h, i, j, k, l] = matrix(right)
  return represented([
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ])
}
function transformPoint(transform, point) {
  const [a, b, c, d, e, f] = matrix(transform)
  const x = scalar(point?.x, 'point x')
  const y = scalar(point?.y, 'point y')
  const [mappedX, mappedY] = represented([a * x + c * y + e, b * x + d * y + f])
  return { x: mappedX, y: mappedY }
}
function invert(transform) {
  const [a, b, c, d, e, f] = matrix(transform)
  const determinant = a * d - b * c
  let linear
  if (Number.isFinite(determinant) && determinant !== 0) {
    linear = [d / determinant, -b / determinant, -c / determinant, a / determinant]
  } else {
    // Normalize before determinant arithmetic: tiny valid matrices must not
    // become singular solely because products underflow. No epsilon cutoff.
    const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d))
    if (scale === 0) throw new RangeError('Singular affine matrix')
    const normalized = [a / scale, b / scale, c / scale, d / scale]
    const divisor = normalized[0] * normalized[3] - normalized[1] * normalized[2]
    if (divisor === 0) throw new RangeError('Singular affine matrix')
    linear = [normalized[3], -normalized[1], -normalized[2], normalized[0]].map(
      (value) => value / divisor / scale
    )
  }
  const [ia, ib, ic, id] = represented(linear)
  return represented([ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)])
}
function extent(value, name, allowZero = false) {
  const cx = scalar(value?.cx, `${name} cx`)
  const cy = scalar(value?.cy, `${name} cy`)
  if (allowZero ? cx < 0 || cy < 0 : cx <= 0 || cy <= 0) throw new RangeError(`Invalid ${name}`)
  return { cx, cy }
}
function flip(value, name) {
  if (value === undefined) return 1
  if (typeof value !== 'boolean') throw new TypeError(`Invalid ${name}`)
  return value ? -1 : 1
}
function rotationAndFlip(source) {
  const units = source.rotation === undefined ? 0 : scalar(source.rotation, 'rotation')
  const angle = (units / 60000 / 180) * Math.PI
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const horizontal = flip(source.flipH, 'flipH')
  const vertical = flip(source.flipV, 'flipV')
  return [cos * horizontal, sin * horizontal, -sin * vertical, cos * vertical, 0, 0]
}
function leafTransform(source) {
  const off = { x: scalar(source?.off?.x, 'off x'), y: scalar(source?.off?.y, 'off y') }
  const ext = extent(source.ext, 'extent', true)
  const [a, b, c, d] = rotationAndFlip(source)
  return represented([
    a,
    b,
    c,
    d,
    off.x + ext.cx / 2 - (a * ext.cx) / 2 - (c * ext.cy) / 2,
    off.y + ext.cy / 2 - (b * ext.cx) / 2 - (d * ext.cy) / 2,
  ])
}
function groupTransform(source) {
  const off = { x: scalar(source?.off?.x, 'off x'), y: scalar(source?.off?.y, 'off y') }
  const ext = extent(source.ext, 'extent')
  const chExt = extent(source.chExt, 'child extent')
  const chOff = {
    x: scalar(source.chOff?.x, 'child offset x'),
    y: scalar(source.chOff?.y, 'child offset y'),
  }
  const scaleX = ext.cx / chExt.cx
  const scaleY = ext.cy / chExt.cy
  if (scaleX === 0 || scaleY === 0) throw new RangeError('Group scale is not representable')
  const rotation = rotationAndFlip(source)
  const [a, b, c, d] = represented([
    rotation[0] * scaleX,
    rotation[1] * scaleX,
    rotation[2] * scaleY,
    rotation[3] * scaleY,
  ])
  const childX = chOff.x + chExt.cx / 2
  const childY = chOff.y + chExt.cy / 2
  return represented([
    a,
    b,
    c,
    d,
    off.x + ext.cx / 2 - a * childX - c * childY,
    off.y + ext.cy / 2 - b * childX - d * childY,
  ])
}
function viewportTransform({ slideWidth, slideHeight, viewportWidth, viewportHeight }) {
  for (const [name, value] of Object.entries({
    slideWidth,
    slideHeight,
    viewportWidth,
    viewportHeight,
  })) {
    scalar(value, name)
    if (value <= 0) throw new RangeError(`Invalid ${name}`)
  }
  const scale = Math.min(viewportWidth / slideWidth, viewportHeight / slideHeight)
  return represented([
    scale,
    0,
    0,
    scale,
    (viewportWidth - slideWidth * scale) / 2,
    (viewportHeight - slideHeight * scale) / 2,
  ])
}

module.exports = {
  IDENTITY,
  multiply,
  transformPoint,
  invert,
  groupTransform,
  leafTransform,
  viewportTransform,
}
