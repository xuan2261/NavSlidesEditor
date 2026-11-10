const Clipper = require('clipper-lib')
const { IDENTITY, multiply, transformPoint } = require('./pptx-affine')

function presetShadowNeedsInkBounds(program) {
  return program?.effects?.some((effect) =>
    effect.kind === 'cont'
      ? presetShadowNeedsInkBounds(effect)
      : effect.kind === 'prstShdw' && ['shdw19', 'shdw20'].includes(effect.prst)
  )
}

// PowerPoint 16/build10417, resume-native-preset19-20-calibration.md.
// Only the measured solid, unstroked polygon profile is admitted here. A
// conservative control-point/viewport box is not an ink envelope.
function presetShadowInkBounds(paths, { fill, stroke, strokeWidth, occurrenceMatrix = IDENTITY }) {
  const fail = () => {
    throw new RangeError('Unsupported preset shadow source ink envelope')
  }
  if (
    (stroke !== 'none' && stroke !== 'transparent' && strokeWidth > 0) ||
    (fill !== 'none' && !/^#[\da-f]{3,8}$/i.test(fill))
  )
    fail()
  const frame = [...occurrenceMatrix.slice(0, 4), 0, 0],
    ink = []
  for (const path of paths) {
    const transform = multiply(frame, path.transform),
      contours = []
    let current
    for (const segment of path.segments) {
      if (segment.kind === 'moveTo') {
        current = []
        contours.push(current)
      } else if (!['lnTo', 'close'].includes(segment.kind)) fail()
      if (segment.kind === 'close') continue
      const point = transformPoint(transform, segment.points.at(-1))
      const X = Math.round(point.x * 1e6),
        Y = Math.round(point.y * 1e6)
      if (Math.max(Math.abs(X), Math.abs(Y)) > 2 ** 46) fail()
      current.push({ X, Y })
    }
    const clipper = new Clipper.Clipper(),
      result = []
    clipper.AddPaths(
      contours.filter((contour) => contour.length >= 3),
      Clipper.PolyType.ptSubject,
      true
    )
    clipper.Execute(
      Clipper.ClipType.ctUnion,
      result,
      Clipper.PolyFillType.pftNonZero,
      Clipper.PolyFillType.pftNonZero
    )
    for (const contour of result) ink.push(...contour)
  }
  if (!ink.length) return null
  return [
    Math.min(...ink.map((p) => p.X)) / 1e6,
    Math.min(...ink.map((p) => p.Y)) / 1e6,
    Math.max(...ink.map((p) => p.X)) / 1e6,
    Math.max(...ink.map((p) => p.Y)) / 1e6,
  ]
}
module.exports = { presetShadowNeedsInkBounds, presetShadowInkBounds }
