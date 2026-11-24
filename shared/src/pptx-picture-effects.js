const { deriveGeometryPaths, geometryStrokePaint } = require('./pptx-geometry-document')
const { transformPoint } = require('./pptx-affine')
const { geometryEffectResult } = require('./pptx-geometry-effects')

// Picture alpha belongs to the raster fill only. Shape effects consume the
// resulting fill and outline as distinct channels, exactly as native geometry.
function pictureShapeEffects(geometry, options, fillInk, lineInk) {
  if (!geometry.style?.effects?.effects?.length) return fillInk + lineInk
  const { width, height } = options
  const derived = deriveGeometryPaths(geometry, {
    transform: [width / geometry.width, 0, 0, height / geometry.height, 0, 0],
    projectToLocal: true,
  })
  const bounds = [0, 0, width, height]
  for (const path of derived.paths) {
    const include = (point) => {
      const local = transformPoint(path.transform, point)
      bounds[0] = Math.min(bounds[0], local.x)
      bounds[1] = Math.min(bounds[1], local.y)
      bounds[2] = Math.max(bounds[2], local.x)
      bounds[3] = Math.max(bounds[3], local.y)
    }
    for (const segment of path.segments) {
      for (const point of segment.points) include(point)
      if (segment.kind === 'arcTo') {
        include({ x: segment.center.x - segment.radii[0], y: segment.center.y - segment.radii[1] })
        include({ x: segment.center.x + segment.radii[0], y: segment.center.y + segment.radii[1] })
      }
    }
  }
  const stroke = geometryStrokePaint(geometry)
  // Match the geometry renderer's conservative miter envelope. This is a filter
  // allocation region, not a replacement/clamp of the authored picture frame.
  const pad = (stroke?.strokeWidth ?? 0) *
    Math.max(10, (geometry.style?.stroke?.join?.limit ?? 400000) / 100000)
  const lineBounds = bounds.map((value, index) => value + (index < 2 ? -pad : pad))
  return geometryEffectResult(geometry, {
    ...options,
    ink: fillInk + lineInk,
    bounds: lineBounds,
    sourceImages: {
      fill: { ink: fillInk, bounds },
      line: { ink: lineInk, bounds: lineBounds },
    },
  }).ink
}
module.exports = { pictureShapeEffects }
