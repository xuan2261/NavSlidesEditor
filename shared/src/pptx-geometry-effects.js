const {
  geometryOuterShadow,
  geometryInnerShadow,
  geometryGlow,
  geometrySoftEdge,
  geometryBlur,
} = require('./pptx-geometry-document')
const { geometryInnerShadowSvg } = require('./pptx-geometry-effect-inner-shadow')
const { geometryGlowSvg } = require('./pptx-geometry-effect-glow')
const { geometrySoftEdgeSvg } = require('./pptx-geometry-effect-soft-edge')
const { geometryBlurSvg } = require('./pptx-geometry-effect-blur')
const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { IDENTITY, multiply, invert, transformPoint } = require('./pptx-affine')

function geometrySingleEffectSvg(
  geometry,
  { width, height, ink, bounds, occurrenceMatrix = IDENTITY }
) {
  const blur = geometryBlur(geometry)
  if (blur) return geometryBlurSvg(geometry, blur, { ink, bounds, occurrenceMatrix })
  const soft = geometrySoftEdge(geometry)
  if (soft) return geometrySoftEdgeSvg(geometry, soft, { ink, bounds, occurrenceMatrix })
  const glow = geometryGlow(geometry)
  if (glow) return geometryGlowSvg(geometry, glow, { ink, bounds, occurrenceMatrix })
  const inner = geometryInnerShadow(geometry)
  if (inner) return geometryInnerShadowSvg(geometry, inner, { ink, bounds, occurrenceMatrix })
  const shadow = geometryOuterShadow(geometry)
  if (!shadow) return ink
  return geometryOuterShadowImage(geometry, shadow, {
    width,
    height,
    ink,
    bounds,
    occurrenceMatrix,
  }).ink
}

function geometryEffectFrame(
  shadow,
  { width, height, bounds, occurrenceMatrix = IDENTITY, anchorBounds }
) {
  const frame = shadow.rotWithShape === false ? [...occurrenceMatrix.slice(0, 4), 0, 0] : IDENTITY
  const corners = (box) => [
    { x: box[0], y: box[1] },
    { x: box[2], y: box[1] },
    { x: box[2], y: box[3] },
    { x: box[0], y: box[3] },
  ]
  const framePoints = anchorBounds
    ? corners(anchorBounds)
    : corners([0, 0, width, height]).map((point) => transformPoint(frame, point))
  const minX = Math.min(...framePoints.map((point) => point.x))
  const maxX = Math.max(...framePoints.map((point) => point.x))
  const minY = Math.min(...framePoints.map((point) => point.y))
  const maxY = Math.max(...framePoints.map((point) => point.y))
  const alignment = shadow.algn ?? 'b'
  const anchorX = ['tl', 'l', 'bl'].includes(alignment)
    ? minX
    : ['tr', 'r', 'br'].includes(alignment)
      ? maxX
      : (minX + maxX) / 2
  const anchorY =
    alignment.startsWith('t') || alignment === 't'
      ? minY
      : alignment.startsWith('b') || alignment === 'b'
        ? maxY
        : (minY + maxY) / 2
  const angle = ((shadow.dir ?? 0) * Math.PI) / 10800000
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  // Native shadow distance stays in slide units through group scaling.
  const directionScale =
    shadow.rotWithShape === false
      ? 1
      : Math.hypot(
          occurrenceMatrix[0] * cosine + occurrenceMatrix[2] * sine,
          occurrenceMatrix[1] * cosine + occurrenceMatrix[3] * sine
        )
  const distance = (shadow.dist ?? 0) / 9525 / directionScale
  const linear = [
    (shadow.sx ?? 100000) / 100000,
    Math.tan(((shadow.ky ?? 0) * Math.PI) / 10800000),
    Math.tan(((shadow.kx ?? 0) * Math.PI) / 10800000),
    (shadow.sy ?? 100000) / 100000,
    0,
    0,
  ]
  const effect = multiply(
    [1, 0, 0, 1, anchorX + distance * cosine, anchorY + distance * sine],
    multiply(linear, [1, 0, 0, 1, -anchorX, -anchorY])
  )
  const maskTransform = multiply(effect, frame)
  // Native EMF+ alpha probes establish Gaussian edge transfer, rather than
  // shipping the captured shadow bitmap. Pixel equivalence remains separately qualified.
  const sigma = (shadow.blurRad ?? 0) / 9525 / 3
  const pad = sigma * 4 + 1
  const transformedBounds = corners(bounds).map((point) => transformPoint(maskTransform, point))
  const left = Math.min(...transformedBounds.map((point) => point.x)) - pad
  const top = Math.min(...transformedBounds.map((point) => point.y)) - pad
  const right = Math.max(...transformedBounds.map((point) => point.x)) + pad
  const bottom = Math.max(...transformedBounds.map((point) => point.y)) + pad
  const inverse = invert(frame)
  const localPoints = corners([left, top, right, bottom]).map((point) =>
    transformPoint(inverse, point)
  )
  return {
    frame,
    inverse,
    maskTransform,
    sigma,
    filterBounds: [left, top, right, bottom],
    bounds: [
      Math.min(...localPoints.map((p) => p.x)),
      Math.min(...localPoints.map((p) => p.y)),
      Math.max(...localPoints.map((p) => p.x)),
      Math.max(...localPoints.map((p) => p.y)),
    ],
  }
}
function geometryOuterShadowImage(
  geometry,
  shadow,
  { width, height, ink, bounds, occurrenceMatrix = IDENTITY, includeSource = true, anchorBounds }
) {
  const effect = geometryEffectFrame(shadow, {
    width,
    height,
    bounds,
    occurrenceMatrix,
    anchorBounds,
  })
  const {
    inverse,
    maskTransform,
    sigma,
    filterBounds: [left, top, right, bottom],
  } = effect
  const color = resolveGeometryColorPaint(shadow.color)
  const alpha = Math.round(color.alpha * 255) / 255
  // Filter identity follows rendered values, not source-record map ordering.
  const key = JSON.stringify([
    color.rgb,
    alpha,
    bounds,
    width,
    height,
    occurrenceMatrix,
    anchorBounds,
    maskTransform,
    sigma,
  ])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = 'pptx-shadow-' + hash.toString(16).padStart(32, '0')
  return {
    ink: `<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${sigma}" result="blur"/><feFlood flood-color="#${color.rgb}" flood-opacity="${alpha}" result="color"/><feComposite in="color" in2="blur" operator="in"/></filter></defs><g data-pptx-geometry-shadow="${geometry.componentId}" transform="matrix(${inverse.join(' ')})"><g filter="url(#${id})"><g transform="matrix(${maskTransform.join(' ')})">${ink}</g></g></g>${includeSource ? ink : ''}`,
    bounds: includeSource
      ? [
          Math.min(bounds[0], effect.bounds[0]),
          Math.min(bounds[1], effect.bounds[1]),
          Math.max(bounds[2], effect.bounds[2]),
          Math.max(bounds[3], effect.bounds[3]),
        ]
      : effect.bounds,
  }
}

function geometryEffectResult(geometry, options) {
  return require('./pptx-geometry-effect-render').geometryEffectResult(geometry, options)
}
function geometryShadowSvg(geometry, options) {
  return geometryEffectResult(geometry, options).ink
}
module.exports = {
  geometryShadowSvg,
  geometryEffectResult,
  geometrySingleEffectSvg,
  geometryOuterShadowImage,
  geometryEffectFrame,
}
