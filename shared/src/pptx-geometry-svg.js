const {
  deriveGeometryPaths,
  geometryStrokePaint,
  geometryFillPaint,
  PRESET_DASH_PATTERNS,
} = require('./pptx-geometry-document')
const { escapePlainText } = require('./content-safety')
const { deriveNativeLineEnds } = require('./pptx-geometry-line-ends')
const { gradientPaintId, gradientSvgDefinition } = require('./pptx-geometry-gradient')
const { patternPaintId, patternSvgDefinition } = require('./pptx-geometry-pattern')
const { blipPaintId, blipSvgDefinition } = require('./pptx-geometry-blip')
const { geometryShadowSvg } = require('./pptx-geometry-effects')
const { transformPoint } = require('./pptx-affine')
const { deriveNativeOutline } = require('./pptx-geometry-outline')
const {
  presetShadowNeedsInkBounds,
  presetShadowInkBounds,
} = require('./pptx-geometry-preset-shadow')
function geometryRenderTransform(geometry, { width, height }) {
  if (
    ![width, height].every((value) => typeof value === 'number' && Number.isFinite(value)) ||
    width < 0 ||
    height < 0
  )
    throw new TypeError('Invalid geometry render extent')
  // Zero authored extents are not SVG viewport dimensions. Omitted-grid
  // native coordinates still have a known EMU-to-CSS unit on that axis.
  return [
    geometry.width === 0 ? 96 / 914400 : width / geometry.width,
    0,
    0,
    geometry.height === 0 ? 96 / 914400 : height / geometry.height,
    0,
    0,
  ]
}
function geometrySvgPathsString(
  geometry,
  {
    width,
    height,
    fill,
    stroke,
    strokeWidth,
    occurrenceMatrix,
    blipAsset,
    blipDerivedAssets,
    fillFrame,
    effectFillAssets,
    outputPixelScale = 1,
  }
) {
  const nativeFill = geometryFillPaint(geometry)
  if (nativeFill) ({ fill } = nativeFill)
  const fillAlpha =
    nativeFill?.fillOpacity === undefined ? '' : ` fill-opacity="${nativeFill.fillOpacity}"`
  const nativeStroke = geometryStrokePaint(geometry)
  if (geometry.style?.fill?.gradient) fill = `url(#${gradientPaintId(geometry, fillFrame)})`
  const patternOptions = { width, height, nativeStroke: !!nativeStroke, occurrenceMatrix }
  if (geometry.style?.fill?.pattern) fill = `url(#${patternPaintId(geometry, patternOptions)})`
  const blipOptions = { ...patternOptions, asset: blipAsset, derivedAssets: blipDerivedAssets, fillFrame }
  if (geometry.style?.fill?.blip) fill = `url(#${blipPaintId(geometry, blipOptions)})`
  if (nativeStroke) ({ stroke, strokeWidth } = nativeStroke)
  const strokeAlpha =
    nativeStroke?.strokeOpacity === undefined
      ? ''
      : ` stroke-opacity="${nativeStroke.strokeOpacity}"`
  const endAlpha =
    nativeStroke?.strokeOpacity === undefined ? '' : ` opacity="${nativeStroke.strokeOpacity}"`
  const transform = geometryRenderTransform(geometry, { width, height })
  if (typeof strokeWidth !== 'number' || !Number.isFinite(strokeWidth) || strokeWidth < 0)
    throw new TypeError('Invalid geometry render extent')
  const paint = (color) => {
    if (
      ['none', 'transparent', 'currentColor'].includes(color) ||
      /^#[\da-f]{3,8}$/i.test(color) ||
      /^url\(#[A-Za-z0-9_-]+\)$/.test(color) ||
      /^var\(--ns-[a-z0-9-]+\)$/.test(color)
    )
      return color
    throw new TypeError('Invalid geometry paint')
  }
  paint(fill)
  paint(stroke)
  const derived = deriveGeometryPaths(geometry, {
    transform: nativeStroke ? [1, 0, 0, 1, 0, 0] : transform,
    projectToLocal: true,
    localScale: nativeStroke ? [transform[0], transform[3]] : [1, 1],
  })
  const nativeStyle = geometry.style?.stroke
  const dashPattern = !nativeStroke
    ? []
    : nativeStyle?.dash?.kind === 'preset'
      ? PRESET_DASH_PATTERNS[nativeStyle.dash.value].map((amount) => strokeWidth * amount)
      : nativeStyle?.dash?.kind === 'custom'
        ? nativeStyle.dash.stops.flatMap((stop) =>
            [stop.dash, stop.space].map((amount) => (strokeWidth * amount) / 100000)
          )
        : []
  const decoration = nativeStroke
    ? ` stroke-linecap="${{ flat: 'butt', rnd: 'round', sq: 'square' }[nativeStyle.cap ?? 'sq']}"` +
      (nativeStyle.join
        ? ` stroke-linejoin="${nativeStyle.join.kind === 'miter' && nativeStyle.join.limit < 100000 ? 'bevel' : nativeStyle.join.kind}"`
        : '') +
      (nativeStyle.join?.kind === 'miter' && nativeStyle.join.limit >= 100000
        ? ` stroke-miterlimit="${nativeStyle.join.limit / 100000}"`
        : '') +
      (dashPattern.length ? ` stroke-dasharray="${dashPattern.join(' ')}"` : '')
    : ' vector-effect="non-scaling-stroke"'
  const modifiers = [
    'norm',
    ...new Set(
      derived.paths
        .map((path) => path.fill)
        .filter((modifier) => modifier && modifier !== 'norm' && modifier !== 'none')
    ),
  ]
  const gradient = geometry.style?.fill?.gradient
    ? modifiers
        .map((modifier) =>
          gradientSvgDefinition(geometry, {
            width,
            height,
            nativeStroke: !!nativeStroke,
            fillFrame,
            modifier,
          })
        )
        .join('')
    : geometry.style?.fill?.pattern
      ? modifiers
          .map((modifier) => patternSvgDefinition(geometry, { ...patternOptions, modifier }))
          .join('')
      : geometry.style?.fill?.blip
        ? modifiers
            .map((modifier) => blipSvgDefinition(geometry, { ...blipOptions, modifier }))
            .join('')
        : ''
  const program = geometry.style?.effects
  const separateChannels =
    program?.kind === 'dag' ||
    program?.effects?.some(
      (effect) =>
        effect.kind === 'fillOverlay' || (effect.kind === 'innerShdw' && program.effects.length > 1)
    )
  const fillInk = [],
    lineInk = []
  const paintedFillPaths = []
  const ink = derived.paths
    .map((path) => {
      const modifier = path.fill || 'norm'
      let pathFill = modifier === 'none' ? 'none' : fill
      if (modifier !== 'none' && modifier !== 'norm' && geometry.style?.fill?.gradient) {
        pathFill = `url(#${gradientPaintId(geometry, fillFrame, modifier)})`
      } else if (modifier !== 'none' && modifier !== 'norm' && geometry.style?.fill?.pattern) {
        pathFill = `url(#${patternPaintId(geometry, { ...patternOptions, modifier })})`
      } else if (modifier !== 'none' && modifier !== 'norm' && geometry.style?.fill?.blip) {
        pathFill = `url(#${blipPaintId(geometry, { ...blipOptions, modifier })})`
      } else if (modifier !== 'none' && modifier !== 'norm') {
        if (!/^#[\da-f]{6}$/i.test(fill))
          throw new TypeError('Path shade requires resolved RGB paint')
        const amount = { lighten: 0.4, lightenLess: 0.2, darken: -0.4, darkenLess: -0.2 }[modifier]
        pathFill =
          '#' +
          [1, 3, 5]
            .map((offset) => {
              const channel = parseInt(fill.slice(offset, offset + 2), 16)
              const result =
                amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount)
              return Math.round(result).toString(16).padStart(2, '0')
            })
            .join('')
      }
      if (pathFill !== 'none') paintedFillPaths.push(path)
      if (
        nativeStroke &&
        ((nativeStyle.compound ?? 'sng') !== 'sng' || (nativeStyle.alignment ?? 'ctr') !== 'ctr')
      ) {
        if (!(Number.isFinite(outputPixelScale) && outputPixelScale > 0))
          throw new TypeError('Invalid geometry output pixel scale')
        const [a, b, c, d] = occurrenceMatrix ?? [1, 0, 0, 1]
        // Largest singular value of the outer linear map; path projection
        // is already budgeted inside deriveNativeOutline.
        const occurrenceScale = (Math.hypot(a + d, b - c) + Math.hypot(a - d, b + c)) / 2
        const footprint = deriveNativeOutline(
          stroke === 'none' ? { ...path, stroke: false } : path,
          {
            ...nativeStyle,
            compound: nativeStyle.compound ?? 'sng',
            alignment: nativeStyle.alignment ?? 'ctr',
          },
          strokeWidth,
          { maxScale: Math.max(1, outputPixelScale * occurrenceScale) }
        )
        const fillPath =
          pathFill !== 'none'
            ? `<path data-pptx-geometry-fill="${escapePlainText(path.componentId)}" d="${escapePlainText(path.d)}" transform="matrix(${path.transform.join(' ')})" style="fill:${escapePlainText(pathFill)};stroke:none;"${fillAlpha}/>`
            : ''
        const outlinePath = `<path data-pptx-geometry-path="${escapePlainText(path.componentId)}" d="${escapePlainText(footprint.d)}" transform="matrix(${footprint.transform.join(' ')})" style="fill:${escapePlainText(stroke)};stroke:none;" fill-rule="${footprint.fillRule}"${endAlpha}/>`
        if (separateChannels) {
          fillInk.push(fillPath)
          if (path.stroke !== false && stroke !== 'none' && strokeWidth > 0)
            lineInk.push(outlinePath)
        }
        return fillPath + outlinePath
      }
      const lineEnds =
        nativeStroke && stroke !== 'none'
          ? deriveNativeLineEnds(path, nativeStyle, strokeWidth)
          : null
      const fillPath =
        lineEnds && pathFill !== 'none'
          ? `<path data-pptx-geometry-fill="${escapePlainText(path.componentId)}" d="${escapePlainText(path.d)}" transform="matrix(${path.transform.join(' ')})" style="fill:${escapePlainText(pathFill)};stroke:none;"${fillAlpha}/>`
          : ''
      const strokePath = `<path data-pptx-geometry-path="${escapePlainText(path.componentId)}" d="${escapePlainText(lineEnds ? lineEnds.strokeD : path.d)}" transform="matrix(${path.transform.join(' ')})" style="fill:${escapePlainText(lineEnds ? 'none' : pathFill)};stroke:${escapePlainText(path.stroke === false ? 'none' : stroke)};" stroke-width="${strokeWidth}"${fillAlpha}${strokeAlpha}${decoration}/>`
      const ends =
        lineEnds?.ends
          .map((end) => {
            const ink = end.ellipse
              ? `<ellipse cx="0" cy="0" rx="${end.ellipse[0]}" ry="${end.ellipse[1]}" style="fill:${escapePlainText(stroke)};stroke:none;"/>`
              : `<path d="${escapePlainText(end.d)}" style="fill:${end.open ? 'none' : escapePlainText(stroke)};stroke:${end.open ? escapePlainText(stroke) : 'none'};"${end.open ? ` stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="miter" stroke-miterlimit="100"` : ''}/>`
            return `<g data-pptx-line-end="${end.end}" data-pptx-line-end-type="${end.type}" transform="matrix(${end.transform.join(' ')})"${endAlpha}>${ink}</g>`
          })
          .join('') ?? ''
      if (separateChannels) {
        if (pathFill !== 'none')
          fillInk.push(
            `<path data-pptx-geometry-fill="${escapePlainText(path.componentId)}" d="${escapePlainText(path.d)}" transform="matrix(${path.transform.join(' ')})" style="fill:${escapePlainText(pathFill)};stroke:none;"${fillAlpha}/>`
          )
        if (path.stroke !== false && stroke !== 'none' && strokeWidth > 0)
          lineInk.push(
            lineEnds
              ? strokePath + ends
              : `<path data-pptx-geometry-path="${escapePlainText(path.componentId)}" d="${escapePlainText(path.d)}" transform="matrix(${path.transform.join(' ')})" style="fill:none;stroke:${escapePlainText(stroke)};" stroke-width="${strokeWidth}"${strokeAlpha}${decoration}/>`
          )
      }
      return fillPath + strokePath + ends
    })
    .join('')
  if (!geometry.style?.effects?.effects?.length) return gradient + ink
  const boundPoints = derived.paths.flatMap((path) =>
    path.segments.flatMap((segment) =>
      [
        ...segment.points,
        ...(segment.kind === 'arcTo'
          ? [
              { x: segment.center.x - segment.radii[0], y: segment.center.y - segment.radii[1] },
              { x: segment.center.x + segment.radii[0], y: segment.center.y + segment.radii[1] },
            ]
          : []),
      ].map((point) => transformPoint(path.transform, point))
    )
  )
  const strokePad = strokeWidth * Math.max(10, (nativeStyle?.join?.limit ?? 400000) / 100000)
  const pathBounds = [
    Math.min(0, ...boundPoints.map((point) => point.x)),
    Math.min(0, ...boundPoints.map((point) => point.y)),
    Math.max(width, ...boundPoints.map((point) => point.x)),
    Math.max(height, ...boundPoints.map((point) => point.y)),
  ]
  const bounds = pathBounds.map((value, index) => value + (index < 2 ? -strokePad : strokePad))
  const fillImage = fillInk.join(''),
    lineImage = lineInk.join('')
  return (
    gradient +
    geometryShadowSvg(geometry, {
      width,
      height,
      ink,
      bounds,
      occurrenceMatrix,
      fillFrame,
      effectFillAssets,
      ...(presetShadowNeedsInkBounds(program)
        ? {
            presetInkBounds: presetShadowInkBounds(paintedFillPaths, {
              fill,
              stroke,
              strokeWidth,
              occurrenceMatrix,
            }),
          }
        : {}),
      ...(separateChannels
        ? {
            sourceImages: {
              fill: { ink: fillImage, bounds: fillImage ? pathBounds : null },
              line: { ink: lineImage, bounds: lineImage ? bounds : null },
            },
          }
        : {}),
    })
  )
}
module.exports = { geometrySvgPathsString, geometryRenderTransform }
module.exports.default = module.exports
